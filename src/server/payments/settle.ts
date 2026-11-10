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
import { db, type Db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { ensureObligations, levyAssignments } from "@/server/levy/obligations";
import { queueSms } from "@/server/notify/outbox";
import { t, isLocale } from "@/messages";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type SettleOutcome =
  | { kind: "settled"; receiptNumber: string; doubleCharge: boolean }
  | { kind: "already_settled" }
  | { kind: "pending" | "failed" | "reversed" | "not_found" | "unknown_payment" };

const periodLabel = (start: Date, period: string) => (period === "daily" ? lagosDate(start) : `${period} from ${lagosDate(start)}`);

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
    const status = verified.status;
    if (status !== payment.status) {
      await db().update(s.payments).set({ status, updatedAt: sql`now()`, providerData: sql`${s.payments.providerData} || ${JSON.stringify({ amountPaidKobo: verified.amountPaidKobo })}::jsonb` }).where(and(eq(s.payments.id, paymentId), sql`${s.payments.settledAt} IS NULL`));
    }
    return { kind: status };
  }
  return db().transaction((tx) => settleVerified(tx, paymentId, verified, now));
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
        channel: (v.channel === "bank_transfer" || v.channel === "card" || v.channel === "ussd" || v.channel === "qr" ? v.channel : p.channel) as typeof p.channel,
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
  const double = detectDoubleCharge({ amountKobo: amount, now, open, current: currentRows });

  // Future periods that do not exist yet (existing unpaid future ones are already in `open`).
  const existingFuture = await tx
    .select({ levyTypeId: s.obligations.levyTypeId, periodStart: s.obligations.periodStart })
    .from(s.obligations)
    .where(and(eq(s.obligations.traderId, traderId), gt(s.obligations.periodStart, now)));
  const taken = new Set(existingFuture.map((f) => `${f.levyTypeId}@${f.periodStart.getTime()}`));
  const future = futureObligations(assignments, now, 62).filter((f) => !taken.has(`${f.levyTypeId}@${f.periodStart.getTime()}`));

  const result = allocate({ amountKobo: amount, open, future });
  const collection = accounts.collection(trader.authorityId);
  post({ kind: "inflow", debitAccount: collection, creditAccount: accounts.trader(traderId), amountKobo: amount });
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

  const locale = isLocale(trader.locale) ? trader.locale : "en";
  const first = covered[0];
  const levy = first ? (levyName.get(first.levyTypeId) ?? "levy") : "levy";
  const period = first ? periodLabel(first.periodStart, levyPeriod.get(first.levyTypeId) ?? "daily") + (covered.length > 1 ? ` + ${covered.length - 1} more` : "") : "";
  const text = double
    ? t(locale, "sms.double_charge", { levy: levyName.get(double.levyTypeId) ?? "this levy", period: "today", amount: formatNaira(amount), number })
    : covered.length
      ? t(locale, "sms.receipt", { number, amount: formatNaira(amount), levy, period, url })
      : t(locale, "sms.receipt_credit", { number, amount: formatNaira(amount), credit: formatNaira(result.unallocatedKobo), url });
  await queueSms(tx, trader.phone, "sms.receipt", text, `receipt:${p.id}`);

  log("info", "payment.settled", { payment_id: p.id, trader_id: traderId, amount_kobo: amount, fee_kobo: v.feeKobo, allocations: covered.length, unallocated_kobo: result.unallocatedKobo, double_charge: Boolean(double), receipt: number });
  return { kind: "settled", receiptNumber: number, doubleCharge: Boolean(double) };
}
