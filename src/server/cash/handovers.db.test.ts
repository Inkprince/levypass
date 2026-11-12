import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@/core/ids";
import { lagosDate } from "@/core/periods";
import { getBank } from "@/server/bank";
import { resetFakeBank } from "@/server/bank/fake";
import { db, pool } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { seed, seedId } from "@/server/db/seed";
import { collectCash, decideFloat, requestFloat, startCashCollection, startFloatDeposit } from "@/server/floats/floats";
import { startPayment } from "@/server/payments/start";
import { ensureWebhook } from "@/server/payments/webhook-setup";
import { ussdReply } from "@/server/ussd/menu";
import { answerHandover, askToPayCash, cancelCashAsk, cashCode, traderCash } from "./handovers";

afterAll(() => pool().end());

const marketId = seedId("mkt", "market");
const adminId = seedId("adm", "admin:1");
const tag = String(Date.now()).slice(-6);

const waitFor = async (check: () => Promise<boolean>, ms = 6000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("timed out waiting");
};

async function makeOfficer(n: number, inMarket = true) {
  const id = newId("off");
  const [aut] = await db().select({ id: s.authorities.id }).from(s.authorities).limit(1);
  await db().insert(s.officers).values({ id, authorityId: aut!.id, staffId: `CSH-${tag}-${n}`, name: `Cash Officer ${n}`, pinHash: "x", qrTokenId: randomBytes(12).toString("hex") });
  if (inMarket) await db().insert(s.officerMarkets).values({ officerId: id, marketId });
  return id;
}

/** Loads a ₦20,000 advance the way an officer does: request, approval, bank-verified deposit. */
async function loadAdvance(officerId: string) {
  const req = await requestFloat(officerId, 2_000_000);
  if (!req.ok) throw new Error(req.error);
  await decideFloat(adminId, req.floatId, "approved");
  const dep = await startFloatDeposit(officerId, req.floatId);
  if (!dep.ok) throw new Error(dep.error);
  await getBank().simulateUssd(dep.deposit.paymentId);
  await waitFor(async () => (await db().select().from(s.floats).where(eq(s.floats.id, req.floatId)))[0]?.status === "loaded");
}

async function makeTrader(n: number) {
  const id = newId("trd");
  await db().insert(s.traders).values({ id, phone: `+234702${tag.slice(-5)}${String(n).padStart(2, "0")}`, name: `Handover Trader ${n}`, marketId, stallOrVehicle: `H-${tag}-${n}`, businessType: "Test", qrTokenId: newId("trd"), status: "active" });
  await db().insert(s.traderLevies).values({ traderId: id, levyTypeId: seedId("lvt", "levy:daily"), startDate: lagosDate(new Date()) });
  return id;
}

async function scan(officerId: string, traderId: string, at = new Date()) {
  const id = newId("scn");
  await db().insert(s.scans).values({ id, officerId, traderId, result: "not_paid", scannedAt: at });
  return id;
}

const handoversOf = (traderId: string) => db().select().from(s.cashHandovers).where(eq(s.cashHandovers.traderId, traderId));
const phoneOf = async (traderId: string) => (await db().select({ phone: s.traders.phone }).from(s.traders).where(eq(s.traders.id, traderId)))[0]!.phone;
const smsTo = async (traderId: string, topic: string) => (await db().select().from(s.outbox).where(and(eq(s.outbox.recipient, await phoneOf(traderId)), eq(s.outbox.topic, topic)))).map((m) => (m.payload as { text: string }).text);
/** The code exactly as the trader's own phone shows it. */
const codeOnTraderPhone = async (traderId: string) => (await traderCash(traderId)).waiting?.code ?? null;

/** The officer in front of the trader: "Take cash", the trader reads the code from their phone, "I have the cash". */
async function takeCash(officerId: string, traderId: string, expectedKobo = 50_000) {
  const scanId = await scan(officerId, traderId);
  const started = await startCashCollection({ officerId, scanId, expectedKobo });
  if (!started.ok) return started;
  return collectCash({ officerId, scanId, expectedKobo, code: (await codeOnTraderPhone(traderId))! });
}

let officerId: string;
let farOfficerId: string;

beforeAll(async () => {
  await seed(db(), { now: new Date("2026-11-10T15:00:00Z") });
  resetFakeBank();
  await ensureWebhook(true);
  officerId = await makeOfficer(1);
  farOfficerId = await makeOfficer(2); // same market, but not standing at this trader's stall
  await loadAdvance(officerId);
  await loadAdvance(farOfficerId);
});

describe("trader asks to pay cash; only the officer they give the code to can take it", () => {
  let traderId: string;
  let askId: string;

  it("asking shows a 4-digit code on the trader's phone and sends it by SMS; asking again is the same request", async () => {
    traderId = await makeTrader(1);
    const a = await askToPayCash(traderId);
    if (!a.ok) throw new Error(a.error);
    askId = a.ask.id;
    const code = await codeOnTraderPhone(traderId);
    expect(code).toMatch(/^\d{4}$/);
    expect(code).toBe(cashCode(askId));
    expect(await smsTo(traderId, "sms.cash_code")).toEqual([expect.stringContaining(`LevyPass cash code: ${code}.`)]);
    const b = await askToPayCash(traderId);
    expect(b.ok && b.ask.id).toBe(askId);
    expect(await smsTo(traderId, "sms.cash_code")).toHaveLength(1);
  });

  it("an officer without the code cannot record it, however they reach the trader", async () => {
    const scanId = await scan(farOfficerId, traderId);
    const started = await startCashCollection({ officerId: farOfficerId, scanId, expectedKobo: 50_000 });
    expect(started).toEqual({ ok: true, sent: false, amountKobo: 50_000 }); // nothing is sent: the trader holds the code
    const wrong = cashCode(askId) === "0000" ? "0001" : "0000";
    expect(await collectCash({ officerId: farOfficerId, scanId, expectedKobo: 50_000, code: wrong })).toMatchObject({ ok: false, error: expect.stringContaining("That code is wrong") });
    expect((await handoversOf(traderId))[0]).toMatchObject({ status: "waiting", codeAttempts: 1 });
    expect(await db().select().from(s.payments).where(and(eq(s.payments.provider, "cash"), eq(s.payments.traderId, traderId)))).toHaveLength(0);
  });

  it("the officer the trader reads the code to records it; the request becomes recorded in the same transaction", async () => {
    const r = await takeCash(officerId, traderId);
    if (!r.ok) throw new Error(r.error);
    const [h] = await handoversOf(traderId);
    expect(h).toMatchObject({ id: askId, status: "recorded", officerId, amountKobo: 50_000 });
    const [p] = await db().select().from(s.payments).where(eq(s.payments.id, h!.paymentId!));
    expect(p).toMatchObject({ channel: "cash", status: "successful", traderId });
    const view = await traderCash(traderId);
    expect(view.waiting).toBeNull();
    expect(view.toConfirm).toEqual([expect.objectContaining({ id: askId, amountKobo: 50_000, staffId: `CSH-${tag}-1`, officerName: "Cash Officer 1", receipt: r.receiptNumber })]);
  });

  it("the trader confirms once", async () => {
    expect(await answerHandover(traderId, askId, "yes")).toEqual({ ok: true });
    expect(await answerHandover(traderId, askId, "no")).toMatchObject({ ok: false });
    expect((await handoversOf(traderId))[0]).toMatchObject({ status: "confirmed" });
    expect((await traderCash(traderId)).toConfirm).toEqual([]);
  });

  it("a trader who owes nothing cannot ask", async () => {
    expect(await askToPayCash(traderId)).toMatchObject({ ok: false });
  });
});

describe("cash the trader did not ask to pay in the app", () => {
  it("cannot be recorded until the officer taps Take cash, which texts the code to the trader's phone", async () => {
    const traderId = await makeTrader(2);
    const scanId = await scan(officerId, traderId);
    expect(await collectCash({ officerId, scanId, expectedKobo: 50_000, code: "1234" })).toMatchObject({ ok: false, error: expect.stringContaining("no cash code") });

    expect(await startCashCollection({ officerId, scanId, expectedKobo: 50_000 })).toEqual({ ok: true, sent: true, amountKobo: 50_000 });
    const code = await codeOnTraderPhone(traderId);
    expect(await smsTo(traderId, "sms.cash_code")).toEqual([expect.stringContaining(`LevyPass cash code: ${code}.`)]);
    expect((await traderCash(traderId)).waiting).toMatchObject({ officerId });
    const r = await collectCash({ officerId, scanId, expectedKobo: 50_000, code: code! });
    expect(r).toMatchObject({ ok: true, repeated: false });
  });

  it("a code sent for one officer does not work for another, even typed correctly", async () => {
    const traderId = await makeTrader(3);
    await startCashCollection({ officerId, scanId: await scan(officerId, traderId), expectedKobo: 50_000 });
    const code = (await codeOnTraderPhone(traderId))!;
    const farScan = await scan(farOfficerId, traderId);
    expect(await collectCash({ officerId: farOfficerId, scanId: farScan, expectedKobo: 50_000, code })).toEqual({ ok: false, error: "That code was sent for another officer. Tap Take cash again." });
  });

  it("a sent code lasts ten minutes", async () => {
    const traderId = await makeTrader(4);
    const t0 = new Date();
    const scanId = await scan(officerId, traderId, t0);
    await startCashCollection({ officerId, scanId, expectedKobo: 50_000, now: t0 });
    const code = (await codeOnTraderPhone(traderId))!;
    const later = new Date(t0.getTime() + 11 * 60_000);
    expect(await collectCash({ officerId, scanId, expectedKobo: 50_000, code, now: later })).toMatchObject({ ok: false, error: expect.stringContaining("no cash code") });
  });

  it("five wrong codes cancel the request, so a code cannot be guessed", async () => {
    const traderId = await makeTrader(5);
    const scanId = await scan(officerId, traderId);
    await startCashCollection({ officerId, scanId, expectedKobo: 50_000 });
    const code = (await codeOnTraderPhone(traderId))!;
    const wrong = code === "0000" ? "0001" : "0000";
    for (let i = 1; i <= 4; i++) expect(await collectCash({ officerId, scanId, expectedKobo: 50_000, code: wrong })).toMatchObject({ ok: false, error: expect.stringContaining(`${5 - i} tries left`) });
    expect(await collectCash({ officerId, scanId, expectedKobo: 50_000, code: wrong })).toMatchObject({ ok: false, error: expect.stringContaining("cancelled") });
    expect((await handoversOf(traderId))[0]).toMatchObject({ status: "cancelled", codeAttempts: 5 });
    // The right code is no use now; a new request means a new code.
    expect(await collectCash({ officerId, scanId, expectedKobo: 50_000, code })).toMatchObject({ ok: false, error: expect.stringContaining("no cash code") });
    expect(await db().select().from(s.payments).where(and(eq(s.payments.provider, "cash"), eq(s.payments.traderId, traderId)))).toHaveLength(0);
  });

  it("the trader can still say they never handed it over: a fraud flag on the officer, with the receipt", async () => {
    const traderId = await makeTrader(6);
    const r = await takeCash(officerId, traderId);
    if (!r.ok) throw new Error(r.error);
    const [h] = await handoversOf(traderId);
    expect(h).toMatchObject({ status: "recorded", officerId });
    expect(await answerHandover(traderId, h!.id, "no")).toEqual({ ok: true });
    const [flag] = await db().select().from(s.fraudFlags).where(and(eq(s.fraudFlags.traderId, traderId), eq(s.fraudFlags.type, "cash_disputed")));
    expect(flag).toMatchObject({ officerId, paymentId: h!.paymentId, receiptNumber: r.receiptNumber, status: "open" });
  });

  it("another trader cannot answer for it", async () => {
    const a = await makeTrader(7);
    const b = await makeTrader(8);
    const r = await takeCash(officerId, a);
    if (!r.ok) throw new Error(r.error);
    const [h] = await handoversOf(a);
    expect(await answerHandover(b, h!.id, "no")).toMatchObject({ ok: false });
    expect((await handoversOf(a))[0]).toMatchObject({ status: "recorded" });
  });
});

describe("a waiting request that never meets an officer", () => {
  it("closes when the trader pays through the bank instead", async () => {
    const traderId = await makeTrader(9);
    const a = await askToPayCash(traderId);
    if (!a.ok) throw new Error(a.error);
    const p = await startPayment({ traderId, channel: "ussd", purpose: "owed" });
    await getBank().simulateUssd(p.reference);
    await waitFor(async () => (await handoversOf(traderId))[0]?.status === "closed");
    expect((await traderCash(traderId)).waiting).toBeNull();
  });

  it("can be cancelled by the trader", async () => {
    const traderId = await makeTrader(10);
    await askToPayCash(traderId);
    await cancelCashAsk(traderId);
    expect((await handoversOf(traderId))[0]).toMatchObject({ status: "cancelled" });
    expect((await traderCash(traderId)).waiting).toBeNull();
  });

  it("ends with its Lagos day, and the next day's ask is a new request with a new code", async () => {
    const traderId = await makeTrader(11);
    const old = newId("csh");
    await db().insert(s.cashHandovers).values({ id: old, traderId, amountKobo: 50_000, status: "waiting", requestedAt: new Date(Date.now() - 86_400_000) });
    expect((await traderCash(traderId)).waiting).toBeNull();
    const a = await askToPayCash(traderId);
    if (!a.ok) throw new Error(a.error);
    expect(a.ask.id).not.toBe(old);
    expect((await handoversOf(traderId)).map((r) => r.status).sort()).toEqual(["expired", "waiting"]);
  });
});

describe("USSD", () => {
  it("option 7 gives a no-smartphone trader their cash code on screen and by SMS", async () => {
    const traderId = await makeTrader(12);
    const phone = await phoneOf(traderId);
    expect(await ussdReply({ phoneNumber: phone, text: "" })).toContain("7. Pay cash to officer");
    const reply = await ussdReply({ phoneNumber: phone, text: "7" });
    const code = await codeOnTraderPhone(traderId);
    expect(reply).toBe(`END Your cash code is ${code}. Hand ₦500.00 to the LevyPass officer in front of you, then tell them the code. Check their ID first (option 4). No SMS receipt means you have not paid.`);
    expect(await smsTo(traderId, "sms.cash_code")).toEqual([expect.stringContaining(code!)]);
    expect(await takeCash(officerId, traderId)).toMatchObject({ ok: true });
    expect(await ussdReply({ phoneNumber: phone, text: "7" })).toMatch(/^END You owe nothing today/);
  });

  it("option 8 asks about cash an officer recorded; a 'no' is a dispute, and the receipt SMS says how", async () => {
    const traderId = await makeTrader(13);
    const phone = await phoneOf(traderId);
    expect(await ussdReply({ phoneNumber: phone, text: "8" })).toBe("END No cash payment is waiting for your answer.");
    const r = await takeCash(officerId, traderId);
    if (!r.ok) throw new Error(r.error);
    expect(JSON.stringify(await smsTo(traderId, "sms.receipt"))).toContain("Did not pay this? Dial *347*13#, choose 8.");
    expect(await ussdReply({ phoneNumber: phone, text: "8" })).toMatch(new RegExp(`^CON Did you hand ₦500\\.00 cash to officer CSH-${tag}-1 on \\d{4}-\\d{2}-\\d{2}\\?\\n1\\. Yes, I paid\\n2\\. No, I did not$`));
    expect(await ussdReply({ phoneNumber: phone, text: "8*2" })).toMatch(/^END Thank you\. The revenue office will look into/);
    expect((await handoversOf(traderId))[0]).toMatchObject({ status: "disputed" });
    expect(await ussdReply({ phoneNumber: phone, text: "8" })).toBe("END No cash payment is waiting for your answer.");
  });
});
