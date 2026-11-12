import "server-only";
import { and, asc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { allocate, detectDoubleCharge, type OpenObligation } from "@/core/allocation";
import { newId } from "@/core/ids";
import { accounts } from "@/core/ledger";
import { formatNaira, type Kobo } from "@/core/money";
import { futureObligations } from "@/core/obligations";
import { lagosDate } from "@/core/periods";
import { newReceiptNumber } from "@/core/receipts";
import { getBank, type VerifiedPayment } from "@/server/bank";
import { closeWaitingInTx } from "@/server/cash/handovers";
import { db, type Db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { ensureObligations, levyAssignments } from "@/server/levy/obligations";
import { queueSms } from "@/server/notify/outbox";
import { t, isLocale, type Locale } from "@/messages";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Cash handed to an officer: recorded by `collectCash`, which also names the officer and the scan. */
export type CashMeta = { officerId: string; staffId: string; scanId: string; purpose?: "ahead" };

export type SettleOutcome =
  | { kind: "settled"; receiptNumber: string; doubleCharge: boolean }
  | { kind: "already_settled" }
  | { kind: "pending" | "failed" | "reversed" | "expired" | "not_found" | "unknown_payment" };

/** "2026-11-11" for a daily levy, "weekly from 2026-11-09" for the others, in the trader's language. */
function periodLabel(locale: Locale, start: Date, period: string): string {
  if (period === "daily") return lagosDate(start);
  const word = period === "weekly" ? t(locale, "sms.period_weekly") : period === "monthly" ? t(locale, "sms.period_monthly") : period === "yearly" ? t(locale, "sms.period_yearly") : period;
  return t(locale, "sms.period_from", { period: word, date: lagosDate(start) });
}

/**
 * Money rule 3: a webhook or redirect is only a hint. This asks the bank, then settles in one
 * transaction (rule 10). Safe to call any number of times for the same payment.
 */
export async function settlePayment(paymentId: string, now = new Date()): Promise<SettleOutcome> {
  const [payment] = await db().select().from(s.payments).where(eq(s.payments.id, paymentId));
  if (!payment) return { kind: "unknown_payment" };
  if (payment.settledAt) return { kind: "already_settled" };

  const verified = await getBank().verifyPayment(payment.providerRef);
  if (!verified) return { kind: "not_found" };
  if (verified.status !== "successful") {
    // An expired checkout is final for us: nobody can pay it any more. Our payment status has no
    // "expired", so it is stored as failed with the bank's own word kept beside it.
    const status = verified.status === "expired" ? "failed" : verified.status;
    if (status !== payment.status) {
      await db().transaction(async (tx) => {
        const closed = await tx
          .update(s.payments)
          .set({ status, updatedAt: sql`now()`, providerData: sql`${s.payments.providerData} || ${JSON.stringify({ amountPaidKobo: verified.amountPaidKobo, bankStatus: verified.status })}::jsonb` })
          .where(and(eq(s.payments.id, paymentId), sql`${s.payments.settledAt} IS NULL`, sql`${s.payments.status} <> ${status}`))
          .returning({ id: s.payments.id });
        // Rule 7: money sent to a checkout that then expired settles nowhere. A person must look at it.
        if (closed.length > 0 && verified.status === "expired" && verified.amountPaidKobo > 0) {
          await tx.insert(s.reviewItems).values({ id: newId("rev"), kind: "expired_part_paid", paymentId, provider: payment.provider, providerRef: payment.providerRef, amountKobo: verified.amountPaidKobo, details: { amountKobo: verified.amountKobo } });
        }
      });
      if (verified.status === "expired") log("info", "payment.expired", { payment_id: paymentId, amount_paid_kobo: verified.amountPaidKobo });
    }
    return { kind: verified.status };
  }
  return db().transaction((tx) => settleVerified(tx, paymentId, verified, now));
}

/**
 * Settles a cash payment inside the caller's transaction. The caller has already checked the officer's
 * float and locked it; the money is in the government account from the float deposit, which the bank
 * verified (money rule 3), so nothing here calls the bank.
 */
export async function settleCashInTx(tx: Tx, paymentId: string, amountKobo: Kobo, now: Date): Promise<SettleOutcome> {
  return settleVerified(tx, paymentId, { reference: paymentId, status: "successful", amountKobo, amountPaidKobo: amountKobo, feeKobo: 0, settlementKobo: amountKobo, channel: "cash", paidAt: now }, now);
}

async function settleVerified(tx: Tx, paymentId: string, v: VerifiedPayment, now: Date): Promise<SettleOutcome> {
  // Lock the row: a webhook and the poller can race for the same payment.
  const [p] = await tx.select().from(s.payments).where(eq(s.payments.id, paymentId)).for("update");
  if (!p) return { kind: "unknown_payment" };
  if (p.settledAt) return { kind: "already_settled" };

  const amount = v.amountKobo; // what the bank settles; any excess goes to review
  const journalId = newId("jnl");
  const ledger: (typeof s.ledgerEntries.$inferInsert)[] = [];
  const post = (e: Omit<typeof s.ledgerEntries.$inferInsert, "id" | "journalId" | "paymentId" | "createdAt">) =>
    ledger.push({ id: newId("led"), journalId, paymentId: p.id, createdAt: now, ...e });

  const finishPayment = async (traderId: string | null) => {
    await tx
      .update(s.payments)
      .set({
        traderId,
        status: "successful",
        amountKobo: amount,
        feeKobo: v.feeKobo,
        channel: (v.channel === "bank_transfer" || v.channel === "card" || v.channel === "ussd" || v.channel === "qr" || v.channel === "cash" ? v.channel : p.channel) as typeof p.channel,
        paidAt: v.paidAt ?? now,
        verifiedAt: now,
        settledAt: now,
        updatedAt: now,
        providerData: sql`${s.payments.providerData} || ${JSON.stringify({ amountPaidKobo: v.amountPaidKobo, settlementKobo: v.settlementKobo })}::jsonb`,
      })
      .where(eq(s.payments.id, p.id));
  };

  if (v.amountPaidKobo > amount) {
    await tx.insert(s.reviewItems).values({
      id: newId("rev"),
      kind: "overpayment_not_settled",
      paymentId: p.id,
      provider: p.provider,
      providerRef: p.providerRef,
      amountKobo: v.amountPaidKobo - amount,
      details: { note: "The bank reports more paid than it settles. The excess is not in our collection account.", amountPaidKobo: v.amountPaidKobo, settledKobo: amount },
    });
  }

  // An officer's float deposit: it loads their float once the bank has confirmed it.
  const meta = (p.providerData ?? {}) as { purpose?: string; floatId?: string; officerId?: string };
  if (!p.traderId && meta.purpose === "float" && meta.floatId) {
    const [f] = await tx.select().from(s.floats).where(eq(s.floats.id, meta.floatId)).for("update");
    const [officer] = f ? await tx.select({ authorityId: s.officers.authorityId }).from(s.officers).where(eq(s.officers.id, f.officerId)) : [];
    if (f && officer && f.status === "approved" && f.paymentId === p.id) {
      const collection = accounts.collection(officer.authorityId);
      post({ kind: "float_load", debitAccount: collection, creditAccount: accounts.officerFloat(f.officerId), amountKobo: amount, memo: `float ${f.id}` });
      if (v.feeKobo > 0) post({ kind: "fee", debitAccount: accounts.bankFees, creditAccount: collection, amountKobo: v.feeKobo, memo: "merchant fee read from the bank" });
      await tx.insert(s.ledgerEntries).values(ledger);
      await tx.update(s.floats).set({ status: "loaded", loadedAt: now }).where(eq(s.floats.id, f.id));
      await finishPayment(null);
      log("info", "float.loaded", { float_id: f.id, officer_id: f.officerId, payment_id: p.id, amount_kobo: amount, fee_kobo: v.feeKobo });
      return { kind: "settled", receiptNumber: "", doubleCharge: false };
    }
    // A deposit for a float that is no longer waiting for it falls through to suspense and review (rule 7).
  }

  // Unmatched money (rule 7): book it to suspense and queue it for review.
  if (!p.traderId) {
    const [aut] = await tx.select({ id: s.authorities.id }).from(s.authorities).limit(1);
    const collection = accounts.collection(aut?.id ?? "unknown");
    post({ kind: "inflow", debitAccount: collection, creditAccount: accounts.suspense, amountKobo: amount, memo: "unmatched payment" });
    if (v.feeKobo > 0) post({ kind: "fee", debitAccount: accounts.bankFees, creditAccount: collection, amountKobo: v.feeKobo });
    await tx.insert(s.ledgerEntries).values(ledger);
    await tx.insert(s.reviewItems).values({ id: newId("rev"), kind: "unmatched_payment", paymentId: p.id, provider: p.provider, providerRef: p.providerRef, amountKobo: amount, details: {} });
    await finishPayment(null);
    return { kind: "settled", receiptNumber: "", doubleCharge: false };
  }

  const traderId = p.traderId;
  const [trader] = await tx
    .select({ id: s.traders.id, phone: s.traders.phone, name: s.traders.name, locale: s.traders.locale, authorityId: s.markets.authorityId })
    .from(s.traders)
    .innerJoin(s.markets, eq(s.markets.id, s.traders.marketId))
    .where(eq(s.traders.id, traderId));
  if (!trader) throw new Error(`payment ${p.id} names unknown trader ${traderId}`);

  await ensureObligations(tx, traderId, now);
  const assignments = await levyAssignments(tx, traderId);
  const levyName = new Map(assignments.map((a) => [a.levyTypeId, a.name]));
  const levyPeriod = new Map(assignments.map((a) => [a.levyTypeId, a.period]));

  const openRows = await tx
    .select()
    .from(s.obligations)
    .where(and(eq(s.obligations.traderId, traderId), inArray(s.obligations.status, ["due", "part_paid"])))
    .orderBy(asc(s.obligations.periodStart))
    .for("update");
  const open: OpenObligation[] = openRows.map((o) => ({ id: o.id, levyTypeId: o.levyTypeId, periodStart: o.periodStart, periodEnd: o.periodEnd, amountDueKobo: o.amountDueKobo, amountPaidKobo: o.amountPaidKobo }));

  const currentRows = await tx
    .select()
    .from(s.obligations)
    .where(and(eq(s.obligations.traderId, traderId), lte(s.obligations.periodStart, now), gt(s.obligations.periodEnd, now)));
  // A pay-ahead the trader chose is not a double charge, even when it matches a paid period's amount.
  const chosenAhead = (p.providerData as { purpose?: string } | null)?.purpose === "ahead";
  const double = chosenAhead ? null : detectDoubleCharge({ amountKobo: amount, now, open, current: currentRows });

  // Future periods that do not exist yet (existing unpaid future ones are already in `open`).
  const existingFuture = await tx
    .select({ levyTypeId: s.obligations.levyTypeId, periodStart: s.obligations.periodStart })
    .from(s.obligations)
    .where(and(eq(s.obligations.traderId, traderId), gt(s.obligations.periodStart, now)));
  const taken = new Set(existingFuture.map((f) => `${f.levyTypeId}@${f.periodStart.getTime()}`));
  const future = futureObligations(assignments, now, 62).filter((f) => !taken.has(`${f.levyTypeId}@${f.periodStart.getTime()}`));

  const result = allocate({ amountKobo: amount, open, future });
  const collection = accounts.collection(trader.authorityId);
  const cash = p.channel === "cash" ? (p.providerData as CashMeta) : null;
  if (cash) post({ kind: "cash_collection", debitAccount: accounts.officerFloat(cash.officerId), creditAccount: accounts.trader(traderId), amountKobo: amount, memo: `cash to ${cash.staffId}` });
  else post({ kind: "inflow", debitAccount: collection, creditAccount: accounts.trader(traderId), amountKobo: amount });
  if (v.feeKobo > 0) post({ kind: "fee", debitAccount: accounts.bankFees, creditAccount: collection, amountKobo: v.feeKobo, memo: "merchant fee read from the bank" });

  const covered: { levyTypeId: string; periodStart: Date; amount: Kobo }[] = [];
  for (const a of result.allocations) {
    let obligationId: string;
    let levyTypeId: string;
    let periodStart: Date;
    const target = a.target;
    if (target.kind === "existing") {
      const o = openRows.find((r) => r.id === target.id)!;
      obligationId = o.id;
      levyTypeId = o.levyTypeId;
      periodStart = o.periodStart;
      const paid = o.amountPaidKobo + a.amountKobo;
      await tx
        .update(s.obligations)
        .set({ amountPaidKobo: paid, status: a.settles ? "paid" : "part_paid", paidAt: a.settles ? now : null, updatedAt: now })
        .where(eq(s.obligations.id, o.id));
    } else {
      const f = target.obligation;
      obligationId = newId("obl");
      levyTypeId = f.levyTypeId;
      periodStart = f.periodStart;
      await tx.insert(s.obligations).values({
        id: obligationId,
        traderId,
        ...f,
        amountPaidKobo: a.amountKobo,
        status: a.settles ? "paid" : "part_paid",
        paidAt: a.settles ? now : null,
      });
    }
    post({ kind: "allocation", debitAccount: accounts.trader(traderId), creditAccount: accounts.levyRevenue(trader.authorityId), amountKobo: a.amountKobo, obligationId });
    covered.push({ levyTypeId, periodStart, amount: a.amountKobo });
  }
  await tx.insert(s.ledgerEntries).values(ledger);

  if (double) {
    await tx.insert(s.fraudFlags).values({
      id: newId("flg"),
      type: "double_charge",
      traderId,
      paymentId: p.id,
      details: { paidObligationId: double.obligationId, levyTypeId: double.levyTypeId, amountKobo: amount, creditedTo: covered.map((c) => lagosDate(c.periodStart)) },
    });
  }

  const number = newReceiptNumber();
  const url = `${env().PUBLIC_BASE_URL}/r/${number}`;
  await tx.insert(s.receipts).values({ id: newId("rcp"), number, paymentId: p.id, traderId, amountKobo: amount, issuedAt: now, verificationUrl: url });
  await finishPayment(traderId);
  // Paid through the bank while waiting for an officer: take the trader off the officers' cash list.
  if (!cash) await closeWaitingInTx(tx, traderId);

  const locale = isLocale(trader.locale) ? trader.locale : "en";
  const first = covered[0];
  const levy = first ? (levyName.get(first.levyTypeId) ?? "levy") : "levy";
  const firstPeriod = first ? periodLabel(locale, first.periodStart, levyPeriod.get(first.levyTypeId) ?? "daily") : "";
  const period = covered.length > 1 ? t(locale, "sms.period_more", { period: firstPeriod, count: covered.length - 1 }) : firstPeriod;
  const text = double
    ? t(locale, "sms.double_charge", { levy: levyName.get(double.levyTypeId) ?? "this levy", period: t(locale, "sms.today"), amount: formatNaira(amount), number })
    : covered.length
      ? cash
        ? t(locale, "sms.receipt_cash", { number, amount: formatNaira(amount), levy, period, url, staffId: cash.staffId, ussd: "*347*13#" })
        : t(locale, "sms.receipt", { number, amount: formatNaira(amount), levy, period, url })
      : t(locale, "sms.receipt_credit", { number, amount: formatNaira(amount), credit: formatNaira(result.unallocatedKobo), url });
  await queueSms(tx, trader.phone, "sms.receipt", text, `receipt:${p.id}`);

  log("info", "payment.settled", { payment_id: p.id, trader_id: traderId, amount_kobo: amount, fee_kobo: v.feeKobo, allocations: covered.length, unallocated_kobo: result.unallocatedKobo, double_charge: Boolean(double), receipt: number });
  return { kind: "settled", receiptNumber: number, doubleCharge: Boolean(double) };
}
