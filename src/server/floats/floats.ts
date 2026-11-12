import "server-only";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { aheadQuote, type AheadQuote } from "@/core/allocation";
import { floatAmountsKobo, floatLabel, floatStatements, type FloatStatement } from "@/core/floats";
import { newId } from "@/core/ids";
import { accounts } from "@/core/ledger";
import { formatNaira, type Kobo } from "@/core/money";
import { futureObligations } from "@/core/obligations";
import { periodFor } from "@/core/periods";
import { BankUnknownOutcome, getBank } from "@/server/bank";
import { checkCashCode, recordHandoverInTx, startCash } from "@/server/cash/handovers";
import { db, type Db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { env } from "@/server/env";
import { ensureObligations, levyAssignments } from "@/server/levy/obligations";
import { log } from "@/server/log";
import { amountOwed } from "@/server/payments/start";
import { settleCashInTx, type CashMeta } from "@/server/payments/settle";
import { ensureWebhook } from "@/server/payments/webhook-setup";

// Officer cash floats (see src/core/floats.ts). The order is the whole point: the officer pays the
// government first, then takes cash from traders up to what they paid. No officer ever owes money.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Float balance straight from the ledger: loads in, cash collections out (money rule 2). */
async function floatBalance(tx: Tx | Db, officerId: string): Promise<Kobo> {
  const account = accounts.officerFloat(officerId);
  const [row] = (
    await tx.execute<{ kobo: string | null }>(sql`
      SELECT coalesce(sum(CASE WHEN credit_account = ${account} THEN amount_kobo ELSE -amount_kobo END), 0) AS kobo
      FROM ledger_entries WHERE credit_account = ${account} OR debit_account = ${account}`)
  ).rows;
  return Number(row?.kobo ?? 0);
}

export async function requestFloat(officerId: string, amountKobo: Kobo): Promise<Result<{ floatId: string }>> {
  if (!floatAmountsKobo.includes(amountKobo)) return { ok: false, error: "Choose one of the amounts shown." };
  return db().transaction(async (tx) => {
    const [o] = await tx.select({ status: s.officers.status }).from(s.officers).where(eq(s.officers.id, officerId)).for("update");
    if (!o || o.status !== "active") return { ok: false as const, error: "This officer ID is suspended. Contact the revenue office." };
    const [open] = await tx.select({ id: s.floats.id }).from(s.floats).where(and(eq(s.floats.officerId, officerId), inArray(s.floats.status, ["requested", "approved"])));
    if (open) return { ok: false as const, error: "You already have an advance remittance open. Finish it first." };
    const [last] = await tx.select({ seq: s.floats.seq }).from(s.floats).where(eq(s.floats.officerId, officerId)).orderBy(desc(s.floats.seq)).limit(1);
    const id = newId("flt");
    await tx.insert(s.floats).values({ id, officerId, seq: (last?.seq ?? 0) + 1, amountKobo });
    log("info", "float.requested", { float_id: id, officer_id: officerId, amount_kobo: amountKobo });
    return { ok: true as const, floatId: id };
  });
}

/** The revenue office approves or declines a request. The caller writes the audit row. */
export async function decideFloat(adminId: string, floatId: string, decision: "approved" | "declined", reason?: string): Promise<Result> {
  const done = await db()
    .update(s.floats)
    .set({ status: decision, decidedBy: adminId, decidedAt: new Date(), declineReason: decision === "declined" ? (reason?.trim() || null) : null })
    .where(and(eq(s.floats.id, floatId), eq(s.floats.status, "requested")))
    .returning({ id: s.floats.id });
  return done.length ? { ok: true } : { ok: false, error: "That request has already been decided." };
}

export type Deposit = { paymentId: string; amountKobo: Kobo; ussdCode?: string; transferAccount?: { accountNumber: string; accountName: string; bankName: string }; expiresAt?: string };

/**
 * Opens (or reopens) the bank checkout an officer uses to pay an approved float into the government
 * account. Same rules as a trader payment: the payment row and its reference exist before the bank
 * call, the call carries an Idempotency-Key, and a timeout is never resent (money rules 4 and 5).
 */
export async function startFloatDeposit(officerId: string, floatId: string): Promise<Result<{ deposit: Deposit }>> {
  const [f] = await db().select().from(s.floats).where(and(eq(s.floats.id, floatId), eq(s.floats.officerId, officerId)));
  if (!f || f.status !== "approved") return { ok: false, error: "This advance remittance is not waiting for payment." };
  if (f.paymentId) {
    const [p] = await db().select().from(s.payments).where(eq(s.payments.id, f.paymentId));
    const checkout = (p?.providerData as { checkout?: Omit<Deposit, "paymentId" | "amountKobo"> } | undefined)?.checkout;
    const live = p && (p.status === "pending" || p.status === "initiated" || p.status === "unknown") && (!checkout?.expiresAt || new Date(checkout.expiresAt) > new Date());
    if (live) return { ok: true, deposit: { paymentId: p.id, amountKobo: p.amountKobo, ...checkout } };
  }

  await ensureWebhook();
  const [o] = await db().select({ name: s.officers.name }).from(s.officers).where(eq(s.officers.id, officerId));
  const bank = getBank();
  const paymentId = newId("pay");
  const meta = { purpose: "float", floatId, officerId };
  await db().transaction(async (tx) => {
    await tx.insert(s.payments).values({ id: paymentId, provider: bank.provider, providerRef: paymentId, channel: "ussd", status: "initiated", amountKobo: f.amountKobo, providerData: meta });
    await tx.update(s.floats).set({ paymentId }).where(eq(s.floats.id, floatId));
  });
  try {
    const c = await bank.createCheckout({ reference: paymentId, amountKobo: f.amountKobo, customerName: o?.name ?? "LevyPass officer", callbackUrl: `${env().PUBLIC_BASE_URL}/officer/advance` }, { paymentId });
    const checkout = { ussdCode: c.ussdCode, transferAccount: c.transferAccount, expiresAt: c.expiresAt.toISOString() };
    await db().update(s.payments).set({ status: "pending", providerData: { ...meta, checkout } }).where(eq(s.payments.id, paymentId));
    return { ok: true, deposit: { paymentId, amountKobo: f.amountKobo, ...checkout } };
  } catch (error) {
    if (error instanceof BankUnknownOutcome) {
      await db().update(s.payments).set({ status: "unknown" }).where(eq(s.payments.id, paymentId));
      log("warn", "float.deposit_unknown", { float_id: floatId, payment_id: paymentId });
      return { ok: true, deposit: { paymentId, amountKobo: f.amountKobo } };
    }
    await db().update(s.payments).set({ status: "failed" }).where(eq(s.payments.id, paymentId));
    log("error", "float.deposit_failed", { float_id: floatId, payment_id: paymentId, error: String(error) });
    return { ok: false, error: "The bank did not open the payment. Try again in a minute." };
  }
}

/** How far ahead an officer can take cash for: tomorrow, or the next seven days. */
export const aheadDayChoices = [1, 7] as const;
/** `throughEnd` is the end of the last day covered (Lagos midnight), not the end of any weekly period inside it. */
export type AheadOption = { days: number; amountKobo: Kobo; throughEnd: string };

/** The exact amount that pays this trader `days` Lagos days ahead, in the order settlement allocates. */
async function quoteAhead(w: Tx | Db, traderId: string, now: Date, days: number): Promise<AheadQuote & { cutoff: Date }> {
  await ensureObligations(w, traderId, now);
  const assignments = await levyAssignments(w, traderId);
  const open = await w
    .select({ id: s.obligations.id, levyTypeId: s.obligations.levyTypeId, periodStart: s.obligations.periodStart, periodEnd: s.obligations.periodEnd, amountDueKobo: s.obligations.amountDueKobo, amountPaidKobo: s.obligations.amountPaidKobo })
    .from(s.obligations)
    .where(and(eq(s.obligations.traderId, traderId), inArray(s.obligations.status, ["due", "part_paid"])));
  const taken = new Set(
    (await w.select({ levyTypeId: s.obligations.levyTypeId, periodStart: s.obligations.periodStart }).from(s.obligations).where(and(eq(s.obligations.traderId, traderId), gt(s.obligations.periodStart, now)))).map((f) => `${f.levyTypeId}@${f.periodStart.getTime()}`),
  );
  const future = futureObligations(assignments, now, 62).filter((f) => !taken.has(`${f.levyTypeId}@${f.periodStart.getTime()}`));
  const cutoff = new Date(periodFor("daily", now).end.getTime() + days * 86_400_000);
  return { ...aheadQuote({ open, future, cutoff }), cutoff };
}

/** Pay-ahead amounts the officer can offer a trader who owes nothing today. Reads our database only. */
export async function cashAheadOptions(input: { officerId: string; scanId: string; now?: Date }): Promise<Result<{ options: AheadOption[] }>> {
  const now = input.now ?? new Date();
  const [scan] = await db().select().from(s.scans).where(eq(s.scans.id, input.scanId));
  if (!scan || scan.officerId !== input.officerId || !scan.traderId) return { ok: false, error: "Scan the trader's pass again before taking cash." };
  const owed = await amountOwed(scan.traderId, now);
  if (owed.totalKobo > 0) return { ok: false, error: `This trader owes ${formatNaira(owed.totalKobo)} now. Take that first.` };
  const options: AheadOption[] = [];
  for (const days of aheadDayChoices) {
    const q = await quoteAhead(db(), scan.traderId, now, days);
    if (q.amountKobo > 0) options.push({ days, amountKobo: q.amountKobo, throughEnd: q.cutoff.toISOString() });
  }
  return { ok: true, options };
}

export type CashCollected = { receiptNumber: string; amountKobo: Kobo; traderName: string; balanceKobo: Kobo; repeated: boolean };
type CashInput = { officerId: string; scanId: string; expectedKobo: Kobo; aheadDays?: number; now?: Date };
type Officer = typeof s.officers.$inferSelect;

/** The officer's own scan of this trader, under 15 minutes old. Cash is always tied to one. */
async function cashScan(input: CashInput, now: Date): Promise<Result<{ traderId: string }>> {
  const [scan] = await db().select().from(s.scans).where(eq(s.scans.id, input.scanId));
  if (!scan || scan.officerId !== input.officerId || !scan.traderId) return { ok: false, error: "Scan the trader's pass again before taking cash." };
  if (now.getTime() - scan.scannedAt.getTime() > 15 * 60_000) return { ok: false, error: "That scan is more than 15 minutes old. Scan the trader again." };
  return { ok: true, traderId: scan.traderId };
}

/** Everything that must hold before cash changes hands: amount, market, advance. Same checks before the code is sent and when the cash is recorded. */
async function planCash(w: Tx | Db, o: Officer | undefined, traderId: string, input: CashInput, now: Date): Promise<Result<{ amount: Kobo; balance: Kobo; traderName: string }>> {
  if (!o || o.status !== "active") return { ok: false, error: "This officer ID is suspended. Contact the revenue office." };
  const [trader] = await w.select({ name: s.traders.name, marketId: s.traders.marketId }).from(s.traders).where(eq(s.traders.id, traderId));
  const owed = await amountOwed(traderId, now);
  let amount: Kobo;
  if (input.aheadDays !== undefined) {
    // Paying ahead: only once today is paid, and only the exact amount quoted for those days.
    if (!(aheadDayChoices as readonly number[]).includes(input.aheadDays)) return { ok: false, error: "Choose tomorrow or the next 7 days." };
    if (owed.totalKobo > 0) return { ok: false, error: `This trader owes ${formatNaira(owed.totalKobo)} now. Take that first.` };
    const q = await quoteAhead(w, traderId, now, input.aheadDays);
    if (q.amountKobo <= 0) return { ok: false, error: "There is nothing to pay ahead for this trader." };
    if (q.amountKobo !== input.expectedKobo) return { ok: false, error: `The amount is now ${formatNaira(q.amountKobo)}. Scan the trader again.` };
    amount = q.amountKobo;
  } else {
    if (owed.totalKobo <= 0) return { ok: false, error: "This trader owes nothing now. Do not take cash." };
    if (owed.totalKobo !== input.expectedKobo) return { ok: false, error: `The amount owed is now ${formatNaira(owed.totalKobo)}. Scan the trader again.` };
    amount = owed.totalKobo;
  }
  const inArea = await w.select({ m: s.officerMarkets.marketId }).from(s.officerMarkets).where(and(eq(s.officerMarkets.officerId, o.id), eq(s.officerMarkets.marketId, trader?.marketId ?? "")));
  if (!trader || inArea.length === 0) return { ok: false, error: "This trader is outside your market. You cannot take their cash." };
  const balance = await floatBalance(w, o.id);
  if (balance < amount) return { ok: false, error: `Your advance has ${formatNaira(balance)} left, not enough for ${formatNaira(amount)}. Make a new advance remittance first.` };
  return { ok: true, amount, balance, traderName: trader.name };
}

/**
 * Step one of a cash levy: the officer taps "Take cash". Checks it could be recorded, then makes sure the
 * trader holds a cash code (src/server/cash/handovers.ts). `sent`: the code just went to the trader by SMS;
 * otherwise the trader asked first and the code is already on their phone.
 */
export async function startCashCollection(input: CashInput): Promise<Result<{ sent: boolean; amountKobo: Kobo }>> {
  const now = input.now ?? new Date();
  const sc = await cashScan(input, now);
  if (!sc.ok) return sc;
  const [o] = await db().select().from(s.officers).where(eq(s.officers.id, input.officerId));
  const plan = await planCash(db(), o, sc.traderId, input, now);
  if (!plan.ok) return plan;
  const { sent } = await startCash({ officerId: input.officerId, traderId: sc.traderId, amountKobo: plan.amount, now });
  return { ok: true, sent, amountKobo: plan.amount };
}

/**
 * Step two: cash handed to the officer, recorded with the trader's cash code, which proves the officer is
 * with the trader. Tied to the officer's own scan of that trader a few minutes earlier, which makes it
 * idempotent (one collection per scan). Paid out of the officer's float under a lock, so the float can
 * never go below zero.
 */
export async function collectCash(input: CashInput & { code: string }): Promise<Result<CashCollected>> {
  const now = input.now ?? new Date();
  const sc = await cashScan(input, now);
  if (!sc.ok) return sc;
  const traderId = sc.traderId;

  const existing = await repeatOf(input.scanId);
  if (existing) return { ok: true, ...existing, repeated: true };

  try {
    return await db().transaction(async (tx) => {
      // Officer first, then trader, always in that order. "No key update" leaves foreign-key checks free.
      const [o] = await tx.select().from(s.officers).where(eq(s.officers.id, input.officerId)).for("no key update");
      await tx.select({ id: s.traders.id }).from(s.traders).where(eq(s.traders.id, traderId)).for("no key update");
      // A double tap waited on the lock above: the first tap has recorded this scan's cash.
      const again = await repeatOf(input.scanId);
      if (again) return { ok: true as const, ...again, repeated: true };
      // Read after the trader lock, so a second officer taking cash from the same trader sees the first one's payment.
      const plan = await planCash(tx, o, traderId, input, now);
      if (!plan.ok) return plan;
      // Presence: only the officer the trader told their code to gets past here.
      const code = await checkCashCode(tx, { traderId, officerId: o!.id, code: input.code, now });
      if (!code.ok) return code;
      const amount = plan.amount;

      const paymentId = newId("pay");
      const meta: CashMeta = { officerId: o!.id, staffId: o!.staffId, scanId: input.scanId, ...(input.aheadDays !== undefined ? { purpose: "ahead" as const } : {}) };
      await tx.insert(s.payments).values({ id: paymentId, traderId, provider: "cash", providerRef: input.scanId, channel: "cash", status: "initiated", amountKobo: amount, providerData: meta });
      const outcome = await settleCashInTx(tx, paymentId, amount, now);
      if (outcome.kind !== "settled") throw new Error(`cash payment ${paymentId} did not settle: ${outcome.kind}`);
      // The trader's side, in the same transaction: their pass page now shows it and asks them to confirm.
      await recordHandoverInTx(tx, { traderId, officerId: o!.id, paymentId, amountKobo: amount, now });
      log("info", "cash.collected", { payment_id: paymentId, officer_id: o!.id, trader_id: traderId, scan_id: input.scanId, amount_kobo: amount });
      return { ok: true as const, receiptNumber: outcome.receiptNumber, amountKobo: amount, traderName: plan.traderName, balanceKobo: plan.balance - amount, repeated: false };
    });
  } catch (error) {
    // A double tap: the other request recorded this scan's cash first (unique provider reference).
    const again = await repeatOf(input.scanId);
    if (again) return { ok: true, ...again, repeated: true };
    throw error;
  }
}

async function repeatOf(scanId: string): Promise<Omit<CashCollected, "repeated"> | null> {
  const [row] = await db()
    .select({ amount: s.payments.amountKobo, number: s.receipts.number, name: s.traders.name, officerId: sql<string>`${s.payments.providerData}->>'officerId'` })
    .from(s.payments)
    .innerJoin(s.receipts, eq(s.receipts.paymentId, s.payments.id))
    .innerJoin(s.traders, eq(s.traders.id, s.payments.traderId))
    .where(and(eq(s.payments.provider, "cash"), eq(s.payments.providerRef, scanId)));
  if (!row) return null;
  return { receiptNumber: row.number, amountKobo: row.amount, traderName: row.name, balanceKobo: await floatBalance(db(), row.officerId) };
}

export type FloatRow = typeof s.floats.$inferSelect & { label: string };
/** `answer`: what the trader said in their app about this cash (null: not asked yet or not answered). */
export type CollectionLine = { paymentId: string; amountKobo: Kobo; at: Date; traderName: string; stall: string; receipt: string | null; answer: "confirmed" | "disputed" | null };
export type OfficerFloat = {
  balanceKobo: Kobo;
  overspentKobo: Kobo;
  open: FloatRow | null;
  /** Loaded floats, newest first, each with the cash collections it paid for. */
  statements: (FloatStatement & { label: string; lines: CollectionLine[] })[];
  history: FloatRow[];
};

/** Everything an officer or the office needs to account for an officer's floats, from our database only. */
export async function officerFloat(officerId: string): Promise<OfficerFloat> {
  const [o] = await db().select({ staffId: s.officers.staffId }).from(s.officers).where(eq(s.officers.id, officerId));
  const staffId = o?.staffId ?? "?";
  const rows = (await db().select().from(s.floats).where(eq(s.floats.officerId, officerId)).orderBy(desc(s.floats.seq))).map((f) => ({ ...f, label: floatLabel(staffId, f.seq) }));
  const account = accounts.officerFloat(officerId);
  const loads = await db()
    .select({ floatId: s.floats.id, amountKobo: s.ledgerEntries.amountKobo, at: s.ledgerEntries.createdAt })
    .from(s.ledgerEntries)
    .innerJoin(s.floats, eq(s.floats.paymentId, s.ledgerEntries.paymentId))
    .where(and(eq(s.ledgerEntries.kind, "float_load"), eq(s.ledgerEntries.creditAccount, account)));
  const spends = await db()
    .select({ paymentId: s.ledgerEntries.paymentId, amountKobo: s.ledgerEntries.amountKobo, at: s.ledgerEntries.createdAt, traderName: s.traders.name, stall: s.traders.stallOrVehicle, receipt: s.receipts.number, handover: s.cashHandovers.status })
    .from(s.ledgerEntries)
    .innerJoin(s.payments, eq(s.payments.id, s.ledgerEntries.paymentId))
    .innerJoin(s.traders, eq(s.traders.id, s.payments.traderId))
    .leftJoin(s.receipts, eq(s.receipts.paymentId, s.payments.id))
    .leftJoin(s.cashHandovers, eq(s.cashHandovers.paymentId, s.payments.id))
    .where(and(eq(s.ledgerEntries.kind, "cash_collection"), eq(s.ledgerEntries.debitAccount, account)));
  const st = floatStatements(
    loads.map((l) => ({ id: l.floatId, amountKobo: l.amountKobo, loadedAt: l.at })),
    spends.map((x) => ({ paymentId: x.paymentId!, amountKobo: x.amountKobo, at: x.at })),
  );
  const byPayment = new Map(spends.map((x) => [x.paymentId!, x]));
  const label = new Map(rows.map((r) => [r.id, r.label]));
  return {
    balanceKobo: st.balanceKobo,
    overspentKobo: st.overspentKobo,
    open: rows.find((r) => r.status === "requested" || r.status === "approved") ?? null,
    statements: st.floats
      .map((f) => ({
        ...f,
        label: label.get(f.id) ?? f.id,
        lines: f.collections.map((c) => {
          const x = byPayment.get(c.paymentId);
          const answer = x?.handover === "confirmed" || x?.handover === "disputed" ? x.handover : null;
          return { paymentId: c.paymentId, amountKobo: c.amountKobo, at: c.at, traderName: x?.traderName ?? "", stall: x?.stall ?? "", receipt: x?.receipt ?? null, answer };
        }),
      }))
      .reverse(),
    history: rows,
  };
}
