import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetFakeBank } from "@/server/bank/fake";
import { issueOtp, verifyOtp } from "@/server/auth/otp";
import { db, pool } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { seed, seedId } from "@/server/db/seed";
import { requeryPayments } from "@/server/jobs/poller";
import { traderStatus } from "@/server/levy/status";
import { ensureWebhook } from "@/server/payments/webhook-setup";
import { createTrader } from "@/server/traders/register";
import { forgedSignature, replayedWebhook, secondPayment, withheldWebhook } from "./failures";

afterAll(() => pool().end());
beforeAll(async () => {
  await seed(db(), { now: new Date("2026-11-10T15:00:00Z") });
  resetFakeBank();
  await ensureWebhook(true);
});

describe("trader registration (TR-01 to TR-03)", () => {
  it("verifies the phone by OTP, then creates the trader with today's levies due", async () => {
    const phone = `+2347005${String(Date.now()).slice(-6)}`;
    await issueOtp(phone, "register");
    const [sms] = await db().select().from(s.outbox).where(and(eq(s.outbox.recipient, phone), eq(s.outbox.topic, "sms.otp")));
    const code = /(\d{6})/.exec((sms?.payload as { text: string }).text)?.[1] ?? "";
    expect(await verifyOtp(phone, "register", "000000" === code ? "111111" : "000000")).toBe(false);
    expect(await verifyOtp(phone, "register", code)).toBe(true);
    expect(await verifyOtp(phone, "register", code)).toBe(false); // single use
    const id = await createTrader({ name: "Bisi Adewale", phone, marketId: seedId("mkt", "market"), stallOrVehicle: "B-99", businessType: "Fabrics", locale: "pcm" });
    const st = await traderStatus(id);
    expect(st?.paidNow).toBe(false);
    expect(st?.owedKobo).toBeGreaterThan(0);
    const welcome = await db().select().from(s.outbox).where(and(eq(s.outbox.recipient, phone), eq(s.outbox.topic, "sms.welcome")));
    expect(welcome).toHaveLength(1);
  });
});

describe("failure drills (T19)", () => {
  it("withheld webhook: nothing is paid until the safety-net poller verifies and settles it", async () => {
    const run = await withheldWebhook();
    expect(run.paymentId).toBeTruthy();
    await new Promise((r) => setTimeout(r, 800)); // the fake bank delivers the webhook; we drop it
    const [before] = await db().select().from(s.payments).where(eq(s.payments.id, run.paymentId!));
    expect(before?.settledAt).toBeNull();
    await db().update(s.payments).set({ createdAt: sql`now() - interval '30 seconds'` }).where(eq(s.payments.id, run.paymentId!));
    await requeryPayments(10);
    const [after] = await db().select().from(s.payments).where(eq(s.payments.id, run.paymentId!));
    expect(after?.settledAt).not.toBeNull();
  });

  it("replayed webhook leaves the ledger unchanged", async () => {
    const run = await replayedWebhook();
    expect(run.steps.at(-1)?.ok).toBe(true);
  });

  it("forged signature is rejected with 401", async () => {
    const run = await forgedSignature();
    expect(run.steps.find((x) => x.ok !== undefined)?.ok).toBe(true);
  });

  it("replaying one event three times still leaves the ledger unchanged", async () => {
    const run = await replayedWebhook({ times: 3 });
    expect(run.exchanges).toHaveLength(3);
    expect(run.ledger?.after).toBe(run.ledger?.before);
    expect(run.steps.every((x) => x.ok !== false)).toBe(true);
  });

  it.each([
    ["wrong_key", "bad_signature"],
    ["tampered", "bad_signature"],
    ["stale", "stale_timestamp"],
  ] as const)("forged webhook, %s, is rejected as %s and stores nothing", async (attack, reason) => {
    const run = await forgedSignature({ attack, amountNaira: 75_000, guessedKey: "letmein", staleMinutes: 10, targetRealPayment: true });
    expect(run.exchanges?.[0]?.response).toBe(`401 {"error":"${reason}"}`);
    expect(run.steps.every((x) => x.ok !== false)).toBe(true);
    expect(run.ledger?.after).toBe(run.ledger?.before);
  });

  it("second payment for a paid day raises a double-charge flag", async () => {
    const run = await secondPayment();
    expect(run.steps.every((x) => x.ok !== false)).toBe(true);
    const flags = await db().select().from(s.fraudFlags).where(and(eq(s.fraudFlags.paymentId, run.paymentId!), eq(s.fraudFlags.type, "double_charge")));
    expect(flags).toHaveLength(1);
  });
});
