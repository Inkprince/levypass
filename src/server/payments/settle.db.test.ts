import { createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@/core/ids";
import { lagosDate, periodFor } from "@/core/periods";
import { getBank } from "@/server/bank";
import { resetFakeBank } from "@/server/bank/fake";
import { db, pool } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { seed, seedId } from "@/server/db/seed";
import { webhookSecret, ensureWebhook } from "./webhook-setup";
import { handleBankWebhook } from "./webhook";
import { startPayment } from "./start";

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

  it("keeps the books balanced: the trader account nets to zero and revenue equals obligations paid", async () => {
    const rows = await db().execute<{ account: string; balance: string }>(sql`
      SELECT account, sum(delta)::text AS balance FROM (
        SELECT credit_account AS account, amount_kobo AS delta FROM ledger_entries UNION ALL SELECT debit_account, -amount_kobo FROM ledger_entries) x
      WHERE account = ${`trader:${traderId}`} GROUP BY account`);
    expect(rows.rows[0]?.balance).toBe("0");
  });
});
