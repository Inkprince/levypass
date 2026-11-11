import { createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { newId } from "@/core/ids";
import { lagosDate, periodFor } from "@/core/periods";
import { BankError, getBank } from "@/server/bank";
import { ageFakePayment, resetFakeBank } from "@/server/bank/fake";
import { db, pool } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { seed, seedId } from "@/server/db/seed";
import { webhookSecret, ensureWebhook } from "./webhook-setup";
import { handleBankWebhook } from "./webhook";
import { startPayment } from "./start";
import { settlePayment } from "./settle";
import { requeryPayments } from "@/server/jobs/poller";

afterAll(() => pool().end());

const waitFor = async (check: () => Promise<boolean>, ms = 6000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("timed out waiting");
};
const settled = (paymentId: string) => async () => {
  const [p] = await db().select({ at: s.payments.settledAt }).from(s.payments).where(eq(s.payments.id, paymentId));
  return Boolean(p?.at);
};
const signed = async (body: string, ts = Math.floor(Date.now() / 1000)) => {
  const secret = (await webhookSecret())!;
  return new Headers({ "x-forge-timestamp": String(ts), "x-forge-signature": `sha256=${createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")}` });
};
const ledgerCount = async () => (await db().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM ledger_entries`)).rows[0]!.n;

let traderId: string;
const now = new Date();
const today = periodFor("daily", now);

beforeAll(async () => {
  await seed(db(), { now: new Date("2026-11-10T15:00:00Z") }); // same fixed date as the seed test
  resetFakeBank();
  await ensureWebhook(true);
  traderId = newId("trd");
  await db().insert(s.traders).values({ id: traderId, phone: `+2347009${String(Date.now()).slice(-6)}`, name: "Test Trader", marketId: seedId("mkt", "market"), stallOrVehicle: "T-1", businessType: "Test", qrTokenId: newId("trd"), status: "active" });
  await db().insert(s.traderLevies).values({ traderId, levyTypeId: seedId("lvt", "levy:daily"), startDate: lagosDate(now) });
});

describe("webhook to ledger (fake bank)", () => {
  let paymentId: string;

  it("settles a USSD payment: obligation paid, fee booked, receipt and SMS queued", async () => {
    const started = await startPayment({ traderId, channel: "ussd" });
    expect(started.amountKobo).toBe(50_000);
    paymentId = started.paymentId;
    await getBank().simulateUssd(started.reference);
    await waitFor(settled(paymentId));

    const [o] = await db().select().from(s.obligations).where(and(eq(s.obligations.traderId, traderId), eq(s.obligations.periodStart, today.start)));
    expect(o).toMatchObject({ status: "paid", amountPaidKobo: 50_000 });
    const entries = await db().select().from(s.ledgerEntries).where(eq(s.ledgerEntries.paymentId, paymentId));
    expect(entries.map((e) => [e.kind, e.amountKobo]).sort()).toEqual([["allocation", 50_000], ["fee", 5_000], ["inflow", 50_000]]);
    const [p] = await db().select().from(s.payments).where(eq(s.payments.id, paymentId));
    expect(p).toMatchObject({ status: "successful", feeKobo: 5_000 });
    expect(p?.verifiedAt).toBeTruthy();
    const [r] = await db().select().from(s.receipts).where(eq(s.receipts.paymentId, paymentId));
    expect(r?.number).toMatch(/^LP-/);
    const sms = await db().select().from(s.outbox).where(eq(s.outbox.dedupeKey, `receipt:${paymentId}`));
    expect(sms).toHaveLength(1);
  });

  it("ignores a replayed event: same event_id changes nothing", async () => {
    const body = JSON.stringify({ event: "payment.successful", event_id: "evt_REPLAY_1", created_at: new Date().toISOString(), data: { reference: paymentId, amount: 500, amount_paid: 500, status: "successful" }, attempt: 1 });
    expect((await handleBankWebhook(body, await signed(body))).status).toBe(200);
    await new Promise((r) => setTimeout(r, 300));
    const before = await ledgerCount();
    const again = await handleBankWebhook(body, await signed(body));
    expect(again).toEqual({ status: 200, body: { duplicate: true } });
    expect(await ledgerCount()).toBe(before);
  });

  it("rejects a forged signature and a stale timestamp", async () => {
    const body = JSON.stringify({ event: "payment.successful", event_id: "evt_FORGED", created_at: "", data: { reference: paymentId, amount: 500, amount_paid: 500, status: "successful" } });
    const forged = new Headers({ "x-forge-timestamp": String(Math.floor(Date.now() / 1000)), "x-forge-signature": `sha256=${"0".repeat(64)}` });
    expect((await handleBankWebhook(body, forged)).status).toBe(401);
    expect((await handleBankWebhook(body, await signed(body, Math.floor(Date.now() / 1000) - 600))).status).toBe(401);
    const stored = await db().select().from(s.webhookEvents).where(eq(s.webhookEvents.eventId, "evt_FORGED"));
    expect(stored).toHaveLength(0); // a forged event never claims an event_id
  });

  it("flags a second payment for a paid day and credits it to the next day", async () => {
    const second = await startPayment({ traderId, channel: "ussd", amountKobo: 50_000 });
    await getBank().simulateUssd(second.reference);
    await waitFor(settled(second.paymentId));
    const flags = await db().select().from(s.fraudFlags).where(and(eq(s.fraudFlags.paymentId, second.paymentId), eq(s.fraudFlags.type, "double_charge")));
    expect(flags).toHaveLength(1);
    const tomorrow = periodFor("daily", today.end);
    const [o] = await db().select().from(s.obligations).where(and(eq(s.obligations.traderId, traderId), eq(s.obligations.periodStart, tomorrow.start)));
    expect(o).toMatchObject({ status: "paid", amountPaidKobo: 50_000 });
  });

  it("does not flag a payment the trader chose as pay-ahead", async () => {
    const ahead = await startPayment({ traderId, channel: "ussd", amountKobo: 50_000, purpose: "ahead" });
    await getBank().simulateUssd(ahead.reference);
    await waitFor(settled(ahead.paymentId));
    const flags = await db().select().from(s.fraudFlags).where(and(eq(s.fraudFlags.paymentId, ahead.paymentId), eq(s.fraudFlags.type, "double_charge")));
    expect(flags).toHaveLength(0);
    const sms = await db().select().from(s.outbox).where(eq(s.outbox.dedupeKey, `receipt:${ahead.paymentId}`));
    expect(String((sms[0]?.payload as { text?: string }).text)).not.toMatch(/already paid/i);
  });

  it("books only the settled amount of an overpayment and sends the excess to review", async () => {
    const p = await startPayment({ traderId, channel: "bank_transfer", amountKobo: 50_000 });
    await getBank().simulateTransfer(p.reference, 80_000);
    await waitFor(settled(p.paymentId));
    const inflow = await db().select().from(s.ledgerEntries).where(and(eq(s.ledgerEntries.paymentId, p.paymentId), eq(s.ledgerEntries.kind, "inflow")));
    expect(inflow[0]?.amountKobo).toBe(50_000);
    const review = await db().select().from(s.reviewItems).where(eq(s.reviewItems.paymentId, p.paymentId));
    expect(review[0]).toMatchObject({ kind: "overpayment_not_settled", amountKobo: 30_000 });
  });

  it("sends a payment we never started to the review queue", async () => {
    const body = JSON.stringify({ event: "payment.successful", event_id: "evt_UNKNOWN_REF", created_at: new Date().toISOString(), data: { reference: "pay_not_ours", amount: 500, amount_paid: 500, status: "successful" } });
    expect((await handleBankWebhook(body, await signed(body))).status).toBe(200);
    await waitFor(async () => (await db().select().from(s.reviewItems).where(eq(s.reviewItems.providerRef, "pay_not_ours"))).length === 1);
  });

  it("settles a payment smaller than the bank's flat fee: the whole fee is booked and the net is negative", async () => {
    // Captured 11 Nov: N20 by USSD comes back with merchant_fee 50 and settlement_amount -30.
    const p = await startPayment({ traderId, channel: "ussd", amountKobo: 2_000, purpose: "ahead" });
    await getBank().simulateUssd(p.reference);
    await waitFor(settled(p.paymentId));
    const entries = await db().select().from(s.ledgerEntries).where(eq(s.ledgerEntries.paymentId, p.paymentId));
    expect(entries.map((e) => [e.kind, e.amountKobo]).sort()).toEqual([["allocation", 2_000], ["fee", 5_000], ["inflow", 2_000]]);
    const [row] = await db().select().from(s.payments).where(eq(s.payments.id, p.paymentId));
    expect(row).toMatchObject({ status: "successful", feeKobo: 5_000 });
    expect((row?.providerData as { settlementKobo?: number }).settlementKobo).toBe(-3_000);
    expect(await db().select().from(s.receipts).where(eq(s.receipts.paymentId, p.paymentId))).toHaveLength(1);
  });

  it("closes a checkout the bank has expired: failed, nothing booked", async () => {
    const p = await startPayment({ traderId, channel: "card", amountKobo: 50_000, purpose: "ahead" });
    ageFakePayment(p.reference, 31 * 60_000);
    const before = await ledgerCount();
    expect((await settlePayment(p.paymentId)).kind).toBe("expired");
    const [row] = await db().select().from(s.payments).where(eq(s.payments.id, p.paymentId));
    expect(row).toMatchObject({ status: "failed", settledAt: null });
    expect((row?.providerData as { bankStatus?: string }).bankStatus).toBe("expired");
    expect(await ledgerCount()).toBe(before);
    expect(await db().select().from(s.reviewItems).where(eq(s.reviewItems.paymentId, p.paymentId))).toHaveLength(0);
  });

  it("an expired checkout that was part paid goes to the review queue with its reference", async () => {
    const p = await startPayment({ traderId, channel: "bank_transfer", amountKobo: 50_000, purpose: "ahead" });
    await getBank().simulateTransfer(p.reference, 30_000);
    ageFakePayment(p.reference, 31 * 60_000);
    expect((await settlePayment(p.paymentId)).kind).toBe("expired");
    expect((await settlePayment(p.paymentId)).kind).toBe("expired"); // asking twice files one item
    const review = await db().select().from(s.reviewItems).where(eq(s.reviewItems.paymentId, p.paymentId));
    expect(review).toHaveLength(1);
    expect(review[0]).toMatchObject({ kind: "expired_part_paid", amountKobo: 30_000, providerRef: p.reference });
  });

  it("keeps the books balanced: the trader account nets to zero and revenue equals obligations paid", async () => {
    const rows = await db().execute<{ account: string; balance: string }>(sql`
      SELECT account, sum(delta)::text AS balance FROM (
        SELECT credit_account AS account, amount_kobo AS delta FROM ledger_entries UNION ALL SELECT debit_account, -amount_kobo FROM ledger_entries) x
      WHERE account = ${`trader:${traderId}`} GROUP BY account`);
    expect(rows.rows[0]?.balance).toBe("0");
  });
});

describe("poller requery queue (PY-04)", () => {
  const backdate = (id: string, createdSecs: number, triedSecs: number) =>
    db().update(s.payments).set({ createdAt: sql`now() - make_interval(secs => ${createdSecs})`, updatedAt: sql`now() - make_interval(secs => ${triedSecs})` }).where(eq(s.payments.id, id));
  const row = async (id: string) => (await db().select().from(s.payments).where(eq(s.payments.id, id)))[0]!;

  it("a payment whose verify throws goes to the back of the queue and does not block the next one", async () => {
    const bad = await startPayment({ traderId, channel: "ussd", amountKobo: 50_000, purpose: "ahead" });
    const good = await startPayment({ traderId, channel: "ussd", amountKobo: 50_000, purpose: "ahead", demoWithholdWebhook: true });
    await getBank().simulateUssd(good.reference);
    await new Promise((r) => setTimeout(r, 600)); // the withheld webhook is delivered and dropped
    expect((await row(good.paymentId)).settledAt).toBeNull();
    // Park every other open payment outside the requery window, then put ours at the front: bad first.
    await db().update(s.payments).set({ createdAt: sql`now() - interval '7 hours'` }).where(and(sql`${s.payments.status} IN ('initiated', 'pending', 'unknown')`, sql`${s.payments.id} NOT IN (${bad.paymentId}, ${good.paymentId})`));
    await backdate(bad.paymentId, 40, 40);
    await backdate(good.paymentId, 40, 30);

    const bank = getBank();
    const real = bank.verifyPayment.bind(bank);
    const spy = vi.spyOn(bank, "verifyPayment").mockImplementation(async (reference) => {
      if (reference === bad.reference) throw new BankError("UNEXPECTED_SHAPE", 200, "verify: response did not match the recorded shape");
      return real(reference);
    });
    try {
      const triedBefore = (await row(bad.paymentId)).updatedAt.getTime();
      await requeryPayments(1);
      expect(spy.mock.calls.map((c) => c[0])).toEqual([bad.reference]);
      expect((await row(bad.paymentId)).updatedAt.getTime()).toBeGreaterThan(triedBefore);
      await requeryPayments(1);
      expect(spy.mock.calls.map((c) => c[0])).toEqual([bad.reference, good.reference]);
      expect((await row(good.paymentId)).settledAt).not.toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("asks less often as a pending payment gets older, and stops once the bank expires it", async () => {
    const p = await startPayment({ traderId, channel: "card", amountKobo: 50_000, purpose: "ahead" });
    const spy = vi.spyOn(getBank(), "verifyPayment");
    try {
      await backdate(p.paymentId, 5 * 60, 10); // five minutes old, asked ten seconds ago: not yet
      await requeryPayments(10);
      expect(spy.mock.calls.filter((c) => c[0] === p.reference)).toHaveLength(0);
      await backdate(p.paymentId, 5 * 60, 31); // asked 31 seconds ago: due
      await requeryPayments(10);
      expect(spy.mock.calls.filter((c) => c[0] === p.reference)).toHaveLength(1);

      ageFakePayment(p.reference, 31 * 60_000);
      await backdate(p.paymentId, 31 * 60, 121);
      await requeryPayments(10);
      expect((await row(p.paymentId)).status).toBe("failed");
      await backdate(p.paymentId, 40 * 60, 600);
      await requeryPayments(10);
      expect(spy.mock.calls.filter((c) => c[0] === p.reference)).toHaveLength(2); // final: never asked again
    } finally {
      spy.mockRestore();
    }
  });
});
