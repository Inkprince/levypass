import "server-only";
import { and, eq, inArray, lte } from "drizzle-orm";
import { newId } from "@/core/ids";
import type { Kobo } from "@/core/money";
import { periodFor } from "@/core/periods";
import { BankUnknownOutcome, getBank } from "@/server/bank";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { ensureObligations, levyAssignments } from "@/server/levy/obligations";
import { ensureWebhook } from "./webhook-setup";

export type Owed = { totalKobo: Kobo; lines: { levy: string; periodStart: Date; owedKobo: Kobo }[]; nextKobo: Kobo; nextLevy: string };

/** What a trader owes now (all unpaid periods up to today), and the next single period for paying ahead. */
export async function amountOwed(traderId: string, now = new Date()): Promise<Owed> {
  await ensureObligations(db(), traderId, now);
  const rows = await db()
    .select({ due: s.obligations.amountDueKobo, paid: s.obligations.amountPaidKobo, start: s.obligations.periodStart, levy: s.levyTypes.name })
    .from(s.obligations)
    .innerJoin(s.levyTypes, eq(s.levyTypes.id, s.obligations.levyTypeId))
    .where(and(eq(s.obligations.traderId, traderId), inArray(s.obligations.status, ["due", "part_paid"]), lte(s.obligations.periodStart, now)))
    .orderBy(s.obligations.periodStart);
  const lines = rows.map((r) => ({ levy: r.levy, periodStart: r.start, owedKobo: r.due - r.paid }));
  const daily = (await levyAssignments(db(), traderId)).sort((a, b) => (a.period === "daily" ? -1 : b.period === "daily" ? 1 : 0))[0];
  return { totalKobo: lines.reduce((x, l) => x + l.owedKobo, 0), lines, nextKobo: daily?.amountKobo ?? 0, nextLevy: daily?.name ?? "levy" };
}

export type StartedPayment = { paymentId: string; reference: string; amountKobo: Kobo; ussdCode?: string; paymentUrl?: string; transferAccount?: { accountNumber: string; accountName: string; bankName: string }; expiresAt?: Date; status: "pending" | "unknown" };

/**
 * Creates a checkout at the bank for a trader (PY-02, PY-03). The payment row exists before the
 * bank call, its ID is the bank reference, and the bank call itself carries an Idempotency-Key.
 */
export async function startPayment(input: { traderId: string; amountKobo?: Kobo; channel: "ussd" | "bank_transfer" | "card"; demoWithholdWebhook?: boolean }): Promise<StartedPayment> {
  await ensureWebhook();
  const [trader] = await db().select({ id: s.traders.id, name: s.traders.name }).from(s.traders).where(eq(s.traders.id, input.traderId));
  if (!trader) throw new Error("Unknown trader");
  let amount = input.amountKobo;
  if (amount === undefined) {
    const owed = await amountOwed(trader.id);
    amount = owed.totalKobo > 0 ? owed.totalKobo : owed.nextKobo;
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Nothing to pay");

  const bank = getBank();
  const paymentId = newId("pay");
  await db().insert(s.payments).values({
    id: paymentId,
    traderId: trader.id,
    provider: bank.provider,
    providerRef: paymentId,
    channel: input.channel,
    status: "initiated",
    amountKobo: amount,
    providerData: input.demoWithholdWebhook ? { demoWithholdWebhook: true } : {},
  });
  try {
    const c = await bank.createCheckout(
      { reference: paymentId, amountKobo: amount, customerName: trader.name, callbackUrl: `${env().PUBLIC_BASE_URL}/pay/return` },
      { paymentId },
    );
    await db()
      .update(s.payments)
      .set({ status: "pending", providerData: { ...(input.demoWithholdWebhook ? { demoWithholdWebhook: true } : {}), checkout: { paymentUrl: c.paymentUrl, ussdCode: c.ussdCode, transferAccount: c.transferAccount, expiresAt: c.expiresAt.toISOString() } } })
      .where(eq(s.payments.id, paymentId));
    return { paymentId, reference: paymentId, amountKobo: amount, ussdCode: c.ussdCode, paymentUrl: c.paymentUrl, transferAccount: c.transferAccount, expiresAt: c.expiresAt, status: "pending" };
  } catch (error) {
    if (error instanceof BankUnknownOutcome) {
      // Rule 5: do not resend. The poller requeries this reference until it is final.
      await db().update(s.payments).set({ status: "unknown" }).where(eq(s.payments.id, paymentId));
      log("warn", "payment.start_unknown", { payment_id: paymentId });
      return { paymentId, reference: paymentId, amountKobo: amount, status: "unknown" };
    }
    await db().update(s.payments).set({ status: "failed" }).where(eq(s.payments.id, paymentId));
    throw error;
  }
}

/** For the period helper users (pay-now codes). */
export const currentDay = (now = new Date()) => periodFor("daily", now);
