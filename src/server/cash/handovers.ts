import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { newId } from "@/core/ids";
import { formatNaira, type Kobo } from "@/core/money";
import { periodFor } from "@/core/periods";
import { db, type Db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { sessionSecret } from "@/server/keys";
import { log } from "@/server/log";
import { queueSms } from "@/server/notify/outbox";
import { amountOwed } from "@/server/payments/start";
import { t, isLocale } from "@/messages";

// The trader's half of a cash levy, kept in step with the officer's half (src/server/floats/floats.ts).
//
//   trader asks in the app or by USSD  -> waiting   (the officers of that market see it)
//   officer takes the cash             -> recorded  (same transaction as the settlement)
//   officer takes cash nobody asked for -> recorded  (a new row, so the trader still sees it)
//   trader answers                     -> confirmed, or disputed (a fraud flag on that officer)
//
// Presence. Nobody else sees a waiting request: there is no list of traders who want to pay cash. The
// officer can record cash only with the request's 4-digit cash code, which exists only on the trader's
// phone (their pass page, the USSD reply, an SMS). The officer standing in front of the trader is told it;
// an officer anywhere else has nothing to type. If the trader did not ask first, the officer's "Take cash"
// sends the code to the trader's phone by SMS, valid ten minutes and for that officer only. Five wrong
// codes cancel the request, so a code cannot be guessed from a distance.
//
// No money moves here. The payment, its receipt and the ledger stay the record.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** A request to pay cash lasts until the end of the Lagos day it was made, or its `expiresAt` if sooner. */
const dayStart = (now: Date) => periodFor("daily", now).start;
const live = (now: Date) => and(eq(s.cashHandovers.status, "waiting"), gte(s.cashHandovers.requestedAt, dayStart(now)), or(isNull(s.cashHandovers.expiresAt), gt(s.cashHandovers.expiresAt, now)));

/** How long a code an officer sends by SMS stays usable, and how many wrong codes cancel a request. */
export const sentCodeMinutes = 10;
export const maxCodeAttempts = 5;

/** The request's 4-digit cash code. Derived from its ID with the server secret, so it is never stored. */
export function cashCode(handoverId: string): string {
  const n = createHmac("sha256", sessionSecret()).update(`cash:${handoverId}`).digest().readUInt32BE(0) % 10_000;
  return String(n).padStart(4, "0");
}

export type CashAsk = { id: string; amountKobo: Kobo; requestedAt: Date; officerId: string | null };

/** The trader's open request to pay cash, if any. */
export async function waitingAsk(w: Tx | Db, traderId: string, now = new Date()): Promise<CashAsk | null> {
  const [row] = await w
    .select({ id: s.cashHandovers.id, amountKobo: s.cashHandovers.amountKobo, requestedAt: s.cashHandovers.requestedAt, officerId: s.cashHandovers.officerId })
    .from(s.cashHandovers)
    .where(and(eq(s.cashHandovers.traderId, traderId), live(now)));
  return row ? { id: row.id, amountKobo: row.amountKobo, requestedAt: row.requestedAt!, officerId: row.officerId } : null;
}

/** Requests from an earlier day, or whose sent code ran out, end so a new one can start. */
async function expireStale(tx: Tx, traderId: string, now: Date): Promise<void> {
  await tx
    .update(s.cashHandovers)
    .set({ status: "expired" })
    .where(and(eq(s.cashHandovers.traderId, traderId), eq(s.cashHandovers.status, "waiting"), or(lt(s.cashHandovers.requestedAt, dayStart(now)), lte(s.cashHandovers.expiresAt, now))));
}

async function smsCode(tx: Tx, traderId: string, handoverId: string, amountKobo: Kobo, dedupeKey: string): Promise<void> {
  const [tr] = await tx.select({ phone: s.traders.phone, locale: s.traders.locale }).from(s.traders).where(eq(s.traders.id, traderId));
  if (!tr) return;
  const locale = isLocale(tr.locale) ? tr.locale : "en";
  await queueSms(tx, tr.phone, "sms.cash_code", t(locale, "sms.cash_code", { code: cashCode(handoverId), amount: formatNaira(amountKobo) }), dedupeKey);
}

/** The trader says they will pay cash to an officer. Asking twice on one day returns the same request. */
export async function askToPayCash(traderId: string, now = new Date()): Promise<Result<{ ask: CashAsk }>> {
  const [t] = await db().select({ status: s.traders.status }).from(s.traders).where(eq(s.traders.id, traderId));
  if (!t || t.status === "suspended") return { ok: false, error: "This trader account is suspended. Contact the revenue office." };
  const owed = await amountOwed(traderId, now);
  if (owed.totalKobo <= 0) return { ok: false, error: "You owe nothing now. Do not hand over any cash." };
  try {
    return await db().transaction(async (tx) => {
      await expireStale(tx, traderId, now);
      const open = await waitingAsk(tx, traderId, now);
      if (open) return { ok: true as const, ask: open };
      const id = newId("csh");
      await tx.insert(s.cashHandovers).values({ id, traderId, amountKobo: owed.totalKobo, status: "waiting", requestedAt: now });
      // The code also goes by SMS, so a USSD trader still has it after the session closes.
      await smsCode(tx, traderId, id, owed.totalKobo, `cashcode:${id}`);
      log("info", "cash.asked", { handover_id: id, trader_id: traderId, amount_kobo: owed.totalKobo });
      return { ok: true as const, ask: { id, amountKobo: owed.totalKobo, requestedAt: now, officerId: null } };
    });
  } catch (error) {
    // Two taps at once: the one-waiting-per-trader index let the other one in first.
    const open = await waitingAsk(db(), traderId, now);
    if (open) return { ok: true, ask: open };
    throw error;
  }
}

/**
 * The officer in front of the trader is about to take cash. If the trader asked first, they already
 * hold the code. Otherwise a request bound to this officer is made (or taken over from another officer)
 * and its code goes to the trader's phone by SMS. Returns whether an SMS was sent.
 */
export async function startCash(input: { officerId: string; traderId: string; amountKobo: Kobo; now: Date }): Promise<{ sent: boolean }> {
  const { officerId, traderId, amountKobo, now } = input;
  const expiresAt = new Date(now.getTime() + sentCodeMinutes * 60_000);
  const attempt = () =>
    db().transaction(async (tx) => {
      await expireStale(tx, traderId, now);
      const open = await waitingAsk(tx, traderId, now);
      if (open && open.officerId === null) return { sent: false }; // the trader asked: the code is on their phone
      let id: string;
      if (open) {
        id = open.id;
        await tx.update(s.cashHandovers).set({ officerId, amountKobo, expiresAt }).where(eq(s.cashHandovers.id, id));
      } else {
        id = newId("csh");
        await tx.insert(s.cashHandovers).values({ id, traderId, amountKobo, status: "waiting", requestedAt: now, officerId, expiresAt });
      }
      await smsCode(tx, traderId, id, amountKobo, `cashcode:${id}:${now.getTime()}`);
      log("info", "cash.code_sent", { handover_id: id, trader_id: traderId, officer_id: officerId });
      return { sent: true };
    });
  try {
    return await attempt();
  } catch {
    return attempt(); // another tap made the request at the same moment: use that one
  }
}

/**
 * Inside the cash collection's transaction: the code the officer typed must be the trader's live code,
 * and a code sent for one officer works only for that officer. A wrong code is counted, and committed
 * with the refusal; the fifth cancels the request.
 */
export async function checkCashCode(tx: Tx, input: { traderId: string; officerId: string; code: string; now: Date }): Promise<{ ok: true } | { ok: false; error: string }> {
  const [h] = await tx.select().from(s.cashHandovers).where(and(eq(s.cashHandovers.traderId, input.traderId), live(input.now))).for("update");
  if (!h) return { ok: false, error: "There is no cash code for this trader now. Tap Take cash again." };
  if (h.officerId && h.officerId !== input.officerId) return { ok: false, error: "That code was sent for another officer. Tap Take cash again." };
  const typed = Buffer.from(input.code.trim());
  const want = Buffer.from(cashCode(h.id));
  if (typed.length === want.length && timingSafeEqual(typed, want)) return { ok: true };
  const attempts = h.codeAttempts + 1;
  if (attempts >= maxCodeAttempts) {
    await tx.update(s.cashHandovers).set({ codeAttempts: attempts, status: "cancelled", answeredAt: input.now }).where(eq(s.cashHandovers.id, h.id));
    log("warn", "cash.code_locked", { handover_id: h.id, trader_id: input.traderId, officer_id: input.officerId });
    return { ok: false, error: "Five wrong codes. This cash request is cancelled. Do not take the money." };
  }
  await tx.update(s.cashHandovers).set({ codeAttempts: attempts }).where(eq(s.cashHandovers.id, h.id));
  return { ok: false, error: `That code is wrong. Ask the trader to read it from their phone again (${maxCodeAttempts - attempts} tries left).` };
}

/** The trader changes their mind before an officer comes. */
export async function cancelCashAsk(traderId: string): Promise<void> {
  await db()
    .update(s.cashHandovers)
    .set({ status: "cancelled", answeredAt: new Date() })
    .where(and(eq(s.cashHandovers.traderId, traderId), eq(s.cashHandovers.status, "waiting")));
}

/**
 * Called inside the cash collection's transaction, right after it settles: the trader's waiting request
 * (if they made one) becomes `recorded`; otherwise a new `recorded` row is made, so the trader is asked
 * to confirm every cash payment an officer records against them.
 */
export async function recordHandoverInTx(tx: Tx, input: { traderId: string; officerId: string; paymentId: string; amountKobo: Kobo; now: Date }): Promise<string> {
  const done = await tx
    .update(s.cashHandovers)
    .set({ status: "recorded", officerId: input.officerId, paymentId: input.paymentId, amountKobo: input.amountKobo, recordedAt: input.now })
    .where(and(eq(s.cashHandovers.traderId, input.traderId), eq(s.cashHandovers.status, "waiting")))
    .returning({ id: s.cashHandovers.id });
  if (done[0]) return done[0].id;
  const id = newId("csh");
  await tx.insert(s.cashHandovers).values({ id, traderId: input.traderId, amountKobo: input.amountKobo, status: "recorded", officerId: input.officerId, paymentId: input.paymentId, recordedAt: input.now });
  return id;
}

/** A bank payment settled while the trader was waiting to pay cash: nobody should take cash for it now. */
export async function closeWaitingInTx(tx: Tx, traderId: string): Promise<void> {
  await tx
    .update(s.cashHandovers)
    .set({ status: "closed", answeredAt: sql`now()` })
    .where(and(eq(s.cashHandovers.traderId, traderId), eq(s.cashHandovers.status, "waiting")));
}

/**
 * The trader answers "did you hand this cash to this officer?". A "no" is a fraud flag against the
 * officer, with the payment and receipt, for the revenue office. The payment itself stays: it was paid
 * from the officer's own advance, so the government already holds that money.
 */
export async function answerHandover(traderId: string, handoverId: string, answer: "yes" | "no", now = new Date()): Promise<Result> {
  return db().transaction(async (tx) => {
    const [h] = await tx
      .update(s.cashHandovers)
      .set({ status: answer === "yes" ? "confirmed" : "disputed", answeredAt: now })
      .where(and(eq(s.cashHandovers.id, handoverId), eq(s.cashHandovers.traderId, traderId), eq(s.cashHandovers.status, "recorded")))
      .returning();
    if (!h) return { ok: false as const, error: "You have already answered for this cash payment." };
    if (answer === "no") {
      const [r] = await tx.select({ number: s.receipts.number }).from(s.receipts).where(eq(s.receipts.paymentId, h.paymentId!));
      await tx.insert(s.fraudFlags).values({ id: newId("flg"), type: "cash_disputed", traderId, officerId: h.officerId, paymentId: h.paymentId, receiptNumber: r?.number ?? null, details: { handoverId: h.id, amountKobo: h.amountKobo, recordedAt: h.recordedAt?.toISOString() } });
      log("warn", "cash.disputed", { handover_id: h.id, trader_id: traderId, officer_id: h.officerId, payment_id: h.paymentId });
    }
    return { ok: true as const };
  });
}

export type ToConfirm = { id: string; amountKobo: Kobo; recordedAt: Date; officerName: string; staffId: string; receipt: string | null };

/** What the trader's pass page shows about cash: an open request, and cash an officer recorded that they have not answered. */
export async function traderCash(traderId: string, now = new Date()): Promise<{ waiting: (CashAsk & { code: string }) | null; toConfirm: ToConfirm[] }> {
  const ask = await waitingAsk(db(), traderId, now);
  const waiting = ask ? { ...ask, code: cashCode(ask.id) } : null;
  const rows = await db()
    .select({ id: s.cashHandovers.id, amountKobo: s.cashHandovers.amountKobo, recordedAt: s.cashHandovers.recordedAt, officerName: s.officers.name, staffId: s.officers.staffId, receipt: s.receipts.number })
    .from(s.cashHandovers)
    .innerJoin(s.officers, eq(s.officers.id, s.cashHandovers.officerId))
    .leftJoin(s.receipts, eq(s.receipts.paymentId, s.cashHandovers.paymentId))
    .where(and(eq(s.cashHandovers.traderId, traderId), eq(s.cashHandovers.status, "recorded")))
    .orderBy(desc(s.cashHandovers.recordedAt))
    .limit(5);
  return { waiting, toConfirm: rows.map((r) => ({ ...r, recordedAt: r.recordedAt! })) };
}
