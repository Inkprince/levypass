// Drizzle schema. Database names are snake_case (via `casing`), TypeScript is camelCase.
// Money is integer kobo in `bigint` columns named `*_kobo`. Times are `timestamptz` (UTC);
// periods are computed in Africa/Lagos and stored as UTC instants.
// Tables from PRD section 7.2 plus those listed in tasks/plan.md.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const kobo = () => bigint({ mode: "number" });
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const tstz = () => timestamp({ withTimezone: true });

// ---------------------------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------------------------

export const authorityTier = pgEnum("authority_tier", ["state", "local_government"]);
export const marketType = pgEnum("market_type", ["market", "motor_park", "street"]);
export const locale = pgEnum("locale", ["en", "pcm", "yo"]);
export const traderStatus = pgEnum("trader_status", ["pending_verification", "active", "suspended"]);
export const levyPeriod = pgEnum("levy_period", ["daily", "weekly", "monthly", "yearly"]);
export const obligationStatus = pgEnum("obligation_status", ["due", "part_paid", "paid", "waived"]);
export const paymentChannel = pgEnum("payment_channel", ["virtual_account", "ussd", "card", "bank_transfer", "qr"]);
export const paymentStatus = pgEnum("payment_status", [
  "initiated", // we created a reference; nothing confirmed yet
  "pending", // the bank says pending
  "unknown", // timeout or 504: requery, never resend
  "successful", // verified server to server
  "failed",
  "reversed",
]);
export const ledgerEntryKind = pgEnum("ledger_entry_kind", [
  "inflow", // money reached the collection account: collection -> trader
  "fee", // bank charge read from the bank response: bank_fees -> collection
  "allocation", // trader credit applied to an obligation: trader -> levy_revenue
  "suspense", // money we could not match: collection -> suspense
  "suspense_release", // suspense matched later: suspense -> trader
  "reversal", // the bank reversed a payment
  "correction", // manual correction, always paired with an audit_log row
]);
export const officerStatus = pgEnum("officer_status", ["active", "suspended"]);
export const adminRole = pgEnum("admin_role", ["super_admin", "market_admin", "finance", "auditor"]);
export const scanResult = pgEnum("scan_result", ["paid", "not_paid", "unknown_trader", "invalid_token"]);
export const scanSource = pgEnum("scan_source", ["online", "offline_sync"]);
export const fraudFlagType = pgEnum("fraud_flag_type", [
  "double_charge", // FR-01
  "unknown_receipt", // FR-02
  "reused_receipt", // FR-02
  "suspended_officer_scan", // FR-03
  "unknown_officer_scan", // FR-03
]);
export const caseStatus = pgEnum("case_status", ["open", "resolved", "dismissed"]);
export const triageSource = pgEnum("triage_source", ["model", "fallback"]);
export const outboxKind = pgEnum("outbox_kind", ["sms", "job"]);
export const outboxStatus = pgEnum("outbox_status", ["pending", "sent", "failed"]);
export const bankCallStatus = pgEnum("bank_call_status", ["pending", "succeeded", "failed", "unknown"]);
export const otpPurpose = pgEnum("otp_purpose", ["register", "login"]);
export const subjectType = pgEnum("subject_type", ["trader", "officer", "admin", "system"]);

// ---------------------------------------------------------------------------------------------
// Authorities, markets, levies
// ---------------------------------------------------------------------------------------------

export const authorities = pgTable("authorities", {
  id: text().primaryKey(),
  name: text().notNull(),
  tier: authorityTier().notNull(),
  // The government collection account. Filled once T4 confirms which sandbox account it is.
  collectionAccountNumber: text(),
  collectionBankCode: text(),
  createdAt: createdAt(),
});

export const markets = pgTable(
  "markets",
  {
    id: text().primaryKey(),
    authorityId: text()
      .notNull()
      .references(() => authorities.id),
    name: text().notNull(),
    location: text().notNull(),
    type: marketType().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.authorityId)],
);

export const levyTypes = pgTable(
  "levy_types",
  {
    id: text().primaryKey(),
    authorityId: text()
      .notNull()
      .references(() => authorities.id),
    name: text().notNull(),
    amountKobo: kobo().notNull(),
    period: levyPeriod().notNull(),
    legalBasis: text().notNull(), // LV-06
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    // Whole naira only: amounts ending .00 never fire a sandbox trigger.
    check("levy_types_amount_whole_naira", sql`${t.amountKobo} > 0 AND ${t.amountKobo} % 100 = 0`),
  ],
);

/** LevyType.applies_to: the markets a levy applies to. */
export const levyTypeMarkets = pgTable(
  "levy_type_markets",
  {
    levyTypeId: text()
      .notNull()
      .references(() => levyTypes.id),
    marketId: text()
      .notNull()
      .references(() => markets.id),
  },
  (t) => [primaryKey({ columns: [t.levyTypeId, t.marketId] })],
);

// ---------------------------------------------------------------------------------------------
// Traders
// ---------------------------------------------------------------------------------------------

export const traders = pgTable(
  "traders",
  {
    id: text().primaryKey(),
    phone: text().notNull(), // E.164; logs show it masked
    name: text().notNull(),
    marketId: text()
      .notNull()
      .references(() => markets.id),
    stallOrVehicle: text().notNull(),
    businessType: text().notNull(),
    photoUrl: text(),
    // ID of the current signed QR token. Re-issuing a QR (TR-08) replaces it, which cancels the old one.
    qrTokenId: text().notNull(),
    status: traderStatus().notNull().default("pending_verification"),
    locale: locale().notNull().default("en"),
    phoneVerifiedAt: tstz(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.phone), uniqueIndex().on(t.qrTokenId), index().on(t.marketId)],
);

export const traderLevies = pgTable(
  "trader_levies",
  {
    traderId: text()
      .notNull()
      .references(() => traders.id),
    levyTypeId: text()
      .notNull()
      .references(() => levyTypes.id),
    startDate: date({ mode: "string" }).notNull(), // Lagos calendar date
    exemption: text(), // LV-05: reason, when exempt
  },
  (t) => [primaryKey({ columns: [t.traderId, t.levyTypeId] })],
);

/** One per trader. Shapes beyond the account number are kept raw until T4 records them. */
export const virtualAccounts = pgTable(
  "virtual_accounts",
  {
    id: text().primaryKey(),
    traderId: text()
      .notNull()
      .references(() => traders.id),
    provider: text().notNull(),
    accountNumber: text().notNull(),
    accountName: text().notNull(),
    providerData: jsonb().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.traderId), uniqueIndex().on(t.provider, t.accountNumber)],
);

// ---------------------------------------------------------------------------------------------
// Obligations, payments, ledger, receipts
// ---------------------------------------------------------------------------------------------

export const obligations = pgTable(
  "obligations",
  {
    id: text().primaryKey(),
    traderId: text()
      .notNull()
      .references(() => traders.id),
    levyTypeId: text()
      .notNull()
      .references(() => levyTypes.id),
    periodStart: tstz().notNull(), // inclusive, Lagos period start as a UTC instant
    periodEnd: tstz().notNull(), // exclusive
    amountDueKobo: kobo().notNull(),
    // Cache of the allocation entries for this obligation, written in the same transaction.
    amountPaidKobo: kobo().notNull().default(0),
    status: obligationStatus().notNull().default("due"),
    paidAt: tstz(),
    createdAt: createdAt(),
    updatedAt: tstz().notNull().defaultNow(),
  },
  (t) => [
    // Money rule 6: one obligation per trader, levy and period.
    uniqueIndex("obligations_trader_levy_period_uq").on(t.traderId, t.levyTypeId, t.periodStart),
    index().on(t.traderId, t.status, t.periodStart),
    index().on(t.periodStart),
    check("obligations_period_order", sql`${t.periodEnd} > ${t.periodStart}`),
    check("obligations_amount_due_positive", sql`${t.amountDueKobo} > 0`),
    check("obligations_amount_paid_range", sql`${t.amountPaidKobo} >= 0 AND ${t.amountPaidKobo} <= ${t.amountDueKobo}`),
    check(
      "obligations_status_matches_amount",
      sql`(${t.status} = 'waived')
        OR (${t.status} = 'due' AND ${t.amountPaidKobo} = 0)
        OR (${t.status} = 'part_paid' AND ${t.amountPaidKobo} > 0 AND ${t.amountPaidKobo} < ${t.amountDueKobo})
        OR (${t.status} = 'paid' AND ${t.amountPaidKobo} = ${t.amountDueKobo} AND ${t.paidAt} IS NOT NULL)`,
    ),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: text().primaryKey(),
    // Null until matched; unmatched money also gets a review_items row (money rule 7).
    traderId: text().references(() => traders.id),
    provider: text().notNull(),
    providerRef: text().notNull(),
    channel: paymentChannel().notNull(),
    status: paymentStatus().notNull(),
    amountKobo: kobo().notNull(), // gross amount the payer sent
    feeKobo: kobo(), // read from the bank response, never computed (money rule 9)
    virtualAccountNumber: text(),
    paidAt: tstz(), // the bank's time
    verifiedAt: tstz(), // when GET .../verify confirmed it (money rule 3)
    settledAt: tstz(), // when we allocated it to obligations
    providerData: jsonb().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: tstz().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payments_provider_ref_uq").on(t.provider, t.providerRef),
    index().on(t.traderId, t.createdAt),
    index().on(t.status),
    check("payments_amount_positive", sql`${t.amountKobo} > 0`),
    check("payments_fee_range", sql`${t.feeKobo} IS NULL OR (${t.feeKobo} >= 0 AND ${t.feeKobo} <= ${t.amountKobo})`),
    check("payments_settled_needs_verified", sql`${t.settledAt} IS NULL OR ${t.verifiedAt} IS NOT NULL`),
  ],
);

/**
 * Append-only double-entry ledger (money rule 2). Each row moves `amount_kobo` from
 * `debit_account` to `credit_account`, so the sum over all accounts is zero by construction.
 * Accounts: `trader:<id>`, `levy_revenue:<authority_id>`, `bank_fees`, `suspense`,
 * `collection:<authority_id>`. A trigger (migration 0002) rejects UPDATE, DELETE and TRUNCATE.
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: text().primaryKey(),
    journalId: text().notNull(), // groups the entries posted in one transaction
    kind: ledgerEntryKind().notNull(),
    debitAccount: text().notNull(),
    creditAccount: text().notNull(),
    amountKobo: kobo().notNull(),
    paymentId: text().references(() => payments.id),
    obligationId: text().references(() => obligations.id),
    reversesEntryId: text(), // set on reversal and correction entries
    memo: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.debitAccount),
    index().on(t.creditAccount),
    index().on(t.paymentId),
    index().on(t.obligationId),
    index().on(t.createdAt),
    check("ledger_entries_amount_positive", sql`${t.amountKobo} > 0`),
    check("ledger_entries_distinct_accounts", sql`${t.debitAccount} <> ${t.creditAccount}`),
    check("ledger_entries_allocation_has_obligation", sql`${t.kind} <> 'allocation' OR ${t.obligationId} IS NOT NULL`),
  ],
);

export const receipts = pgTable(
  "receipts",
  {
    id: text().primaryKey(),
    number: text().notNull(),
    paymentId: text()
      .notNull()
      .references(() => payments.id),
    traderId: text()
      .notNull()
      .references(() => traders.id),
    amountKobo: kobo().notNull(),
    issuedAt: tstz().notNull().defaultNow(),
    verificationUrl: text().notNull(),
  },
  (t) => [uniqueIndex("receipts_number_uq").on(t.number), uniqueIndex().on(t.paymentId), index().on(t.traderId, t.issuedAt)],
);

// ---------------------------------------------------------------------------------------------
// Officers, admins, scans
// ---------------------------------------------------------------------------------------------

export const officers = pgTable(
  "officers",
  {
    id: text().primaryKey(),
    authorityId: text()
      .notNull()
      .references(() => authorities.id),
    staffId: text().notNull(),
    name: text().notNull(),
    photoUrl: text(),
    pinHash: text().notNull(),
    deviceId: text(), // OF-01: bound on first login
    qrTokenId: text().notNull(), // OF-07 digital ID
    status: officerStatus().notNull().default("active"),
    suspendedAt: tstz(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.staffId), uniqueIndex().on(t.qrTokenId)],
);

export const officerMarkets = pgTable(
  "officer_markets",
  {
    officerId: text()
      .notNull()
      .references(() => officers.id),
    marketId: text()
      .notNull()
      .references(() => markets.id),
  },
  (t) => [primaryKey({ columns: [t.officerId, t.marketId] })],
);

export const admins = pgTable(
  "admins",
  {
    id: text().primaryKey(),
    email: text().notNull(),
    name: text().notNull(),
    passwordHash: text().notNull(),
    role: adminRole().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.email)],
);

export const scans = pgTable(
  "scans",
  {
    id: text().primaryKey(),
    officerId: text().references(() => officers.id), // null: unknown officer
    traderId: text().references(() => traders.id), // null: unknown trader or bad token
    result: scanResult().notNull(),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    accuracyMetres: doublePrecision(),
    scannedAt: tstz().notNull(),
    source: scanSource().notNull().default("online"),
    syncedAt: tstz(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.officerId, t.scannedAt), index().on(t.traderId, t.scannedAt)],
);

// ---------------------------------------------------------------------------------------------
// Fraud, complaints, review, audit
// ---------------------------------------------------------------------------------------------

export const fraudFlags = pgTable(
  "fraud_flags",
  {
    id: text().primaryKey(),
    type: fraudFlagType().notNull(),
    status: caseStatus().notNull().default("open"),
    traderId: text().references(() => traders.id),
    officerId: text().references(() => officers.id),
    paymentId: text().references(() => payments.id),
    scanId: text().references(() => scans.id),
    receiptNumber: text(), // the number that was checked, genuine or not
    details: jsonb().notNull().default({}),
    notes: text(),
    createdAt: createdAt(),
    resolvedAt: tstz(),
    resolvedBy: text(),
  },
  (t) => [index().on(t.status, t.createdAt), index().on(t.type)],
);

export const complaints = pgTable(
  "complaints",
  {
    id: text().primaryKey(),
    reporterTraderId: text().references(() => traders.id),
    officerId: text().references(() => officers.id), // null: unknown collector
    collectorDescription: text(),
    description: text().notNull(),
    photoUrl: text(),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    status: caseStatus().notNull().default("open"),
    // T20 triage, cached on the complaint.
    triageSummary: text(),
    triageCategory: text(),
    triageSeverity: text(),
    triageSource: triageSource(),
    triageLanguage: text(),
    createdAt: createdAt(),
    resolvedAt: tstz(),
    resolvedBy: text(),
  },
  (t) => [index().on(t.status, t.createdAt)],
);

/** Money rule 7: anything we cannot match lands here with its provider reference. */
export const reviewItems = pgTable(
  "review_items",
  {
    id: text().primaryKey(),
    kind: text().notNull(), // for example unmatched_inflow, unknown_account, amount_mismatch
    status: caseStatus().notNull().default("open"),
    paymentId: text().references(() => payments.id),
    provider: text().notNull(),
    providerRef: text().notNull(),
    amountKobo: kobo(),
    details: jsonb().notNull().default({}),
    createdAt: createdAt(),
    resolvedAt: tstz(),
    resolvedBy: text(),
  },
  (t) => [index().on(t.status, t.createdAt), index().on(t.provider, t.providerRef)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: text().primaryKey(),
    actorType: subjectType().notNull(),
    actorId: text().notNull(),
    action: text().notNull(),
    targetType: text().notNull(),
    targetId: text().notNull(),
    before: jsonb(),
    after: jsonb(),
    at: tstz().notNull().defaultNow(),
  },
  (t) => [index().on(t.targetType, t.targetId), index().on(t.at)],
);

// ---------------------------------------------------------------------------------------------
// Plumbing: webhooks, outbox, bank calls, OTPs, sessions
// ---------------------------------------------------------------------------------------------

/** Inserted only after the signature checks out, so a forged event cannot claim an event_id. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: text().primaryKey(),
    eventId: text().notNull(),
    eventType: text().notNull(),
    payload: jsonb().notNull(),
    receivedAt: tstz().notNull().defaultNow(),
    processedAt: tstz(),
    processingError: text(),
    attempts: integer().notNull().default(0),
  },
  (t) => [uniqueIndex("webhook_events_event_id_uq").on(t.eventId), index().on(t.processedAt)],
);

export const outbox = pgTable(
  "outbox",
  {
    id: text().primaryKey(),
    kind: outboxKind().notNull(),
    topic: text().notNull(), // for example sms.receipt, sms.otp, job.triage_complaint
    recipient: text(), // phone for SMS
    payload: jsonb().notNull(),
    dedupeKey: text(),
    status: outboxStatus().notNull().default("pending"),
    attempts: integer().notNull().default(0),
    availableAt: tstz().notNull().defaultNow(),
    sentAt: tstz(),
    lastError: text(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.dedupeKey), index().on(t.status, t.availableAt), index().on(t.recipient, t.createdAt)],
);

/** Money rule 4: the Idempotency-Key is written here before the bank call is made. */
export const bankCalls = pgTable(
  "bank_calls",
  {
    id: text().primaryKey(),
    idempotencyKey: text().notNull(),
    operation: text().notNull(), // for example create_virtual_account, checkout, verify
    method: text().notNull(),
    path: text().notNull(),
    requestBody: jsonb(),
    status: bankCallStatus().notNull().default("pending"),
    httpStatus: integer(),
    requestId: text(), // the bank's request_id
    responseBody: jsonb(),
    paymentId: text().references(() => payments.id),
    createdAt: createdAt(),
    completedAt: tstz(),
  },
  (t) => [uniqueIndex("bank_calls_idempotency_key_uq").on(t.idempotencyKey), index().on(t.status, t.createdAt)],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: text().primaryKey(),
    phone: text().notNull(),
    purpose: otpPurpose().notNull(),
    codeHash: text().notNull(),
    attempts: integer().notNull().default(0),
    expiresAt: tstz().notNull(),
    consumedAt: tstz(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.phone, t.createdAt)],
);

/** Server-side record of signed session cookies, so suspending an officer ends their session at once. */
export const sessions = pgTable(
  "sessions",
  {
    id: text().primaryKey(),
    subjectType: subjectType().notNull(),
    subjectId: text().notNull(),
    expiresAt: tstz().notNull(),
    revokedAt: tstz(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.subjectType, t.subjectId)],
);

/** Small key-value store for runtime settings, such as the bank webhook secret (shown once at registration). */
export const appSettings = pgTable("app_settings", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: tstz().notNull().defaultNow(),
});
