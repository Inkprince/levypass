import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@/core/ids";
import { accounts } from "@/core/ledger";
import { lagosDate, periodFor } from "@/core/periods";
import { getBank } from "@/server/bank";
import { resetFakeBank } from "@/server/bank/fake";
import { db, pool } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { seed, seedId } from "@/server/db/seed";
import { ensureWebhook } from "@/server/payments/webhook-setup";
import { cashCode } from "@/server/cash/handovers";
import { cashAheadOptions, collectCash as recordCash, decideFloat, officerFloat, requestFloat, startCashCollection, startFloatDeposit } from "./floats";

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
  await db().insert(s.officers).values({ id, authorityId: aut!.id, staffId: `FLT-${tag}-${n}`, name: `Float Officer ${n}`, pinHash: "x", qrTokenId: randomBytes(12).toString("hex") });
  if (inMarket) await db().insert(s.officerMarkets).values({ officerId: id, marketId });
  return id;
}

async function makeTrader(n: number) {
  const id = newId("trd");
  await db().insert(s.traders).values({ id, phone: `+234701${tag}${n}`.slice(0, 14), name: `Cash Trader ${n}`, marketId, stallOrVehicle: `C-${n}`, businessType: "Test", qrTokenId: newId("trd"), status: "active" });
  await db().insert(s.traderLevies).values({ traderId: id, levyTypeId: seedId("lvt", "levy:daily"), startDate: lagosDate(new Date()) });
  return id;
}

async function scan(officerId: string, traderId: string, at = new Date()) {
  const id = newId("scn");
  await db().insert(s.scans).values({ id, officerId, traderId, result: "not_paid", scannedAt: at });
  return id;
}

const ledgerCount = async () => (await db().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM ledger_entries`)).rows[0]!.n;

/**
 * What the officer's phone does: "Take cash" (which makes sure the trader holds a cash code), then the
 * cash with the code the trader reads out. The code is read the way the trader's phone gets it.
 */
async function collectCash(input: { officerId: string; scanId: string; expectedKobo: number; aheadDays?: number }) {
  const started = await startCashCollection(input);
  if (!started.ok) return started;
  const [sc] = await db().select({ traderId: s.scans.traderId }).from(s.scans).where(eq(s.scans.id, input.scanId));
  const [h] = await db().select({ id: s.cashHandovers.id }).from(s.cashHandovers).where(and(eq(s.cashHandovers.traderId, sc!.traderId!), eq(s.cashHandovers.status, "waiting")));
  return recordCash({ ...input, code: h ? cashCode(h.id) : "0000" });
}

let officerId: string;
let floatId: string;

beforeAll(async () => {
  await seed(db(), { now: new Date("2026-11-10T15:00:00Z") });
  resetFakeBank();
  await ensureWebhook(true);
  officerId = await makeOfficer(1);
});

describe("officer float: request, approve, deposit", () => {
  it("accepts only the listed amounts and one open request at a time", async () => {
    expect(await requestFloat(officerId, 1_234_500)).toMatchObject({ ok: false });
    const first = await requestFloat(officerId, 2_000_000);
    expect(first.ok).toBe(true);
    floatId = first.ok ? first.floatId : "";
    expect(await requestFloat(officerId, 1_000_000)).toEqual({ ok: false, error: "You already have an advance remittance open. Finish it first." });
  });

  it("will not take a deposit before the revenue office approves", async () => {
    expect(await startFloatDeposit(officerId, floatId)).toMatchObject({ ok: false });
    expect(await decideFloat(adminId, floatId, "approved")).toEqual({ ok: true });
    expect(await decideFloat(adminId, floatId, "declined")).toMatchObject({ ok: false });
  });

  it("loads the float only after the bank confirms the deposit", async () => {
    const started = await startFloatDeposit(officerId, floatId);
    if (!started.ok) throw new Error(started.error);
    expect(started.deposit).toMatchObject({ amountKobo: 2_000_000 });
    expect(started.deposit.ussdCode).toBeTruthy();
    // Asking again reuses the open checkout instead of opening a second one.
    const again = await startFloatDeposit(officerId, floatId);
    expect(again.ok && again.deposit.paymentId).toBe(started.deposit.paymentId);

    expect((await officerFloat(officerId)).balanceKobo).toBe(0);
    await getBank().simulateUssd(started.deposit.paymentId);
    await waitFor(async () => (await db().select().from(s.floats).where(eq(s.floats.id, floatId)))[0]?.status === "loaded");

    const entries = await db().select().from(s.ledgerEntries).where(eq(s.ledgerEntries.paymentId, started.deposit.paymentId));
    expect(entries.map((e) => [e.kind, e.amountKobo, e.creditAccount]).sort()).toEqual([
      ["fee", 5_000, expect.stringMatching(/^collection:/)],
      ["float_load", 2_000_000, accounts.officerFloat(officerId)],
    ]);
    const [p] = await db().select().from(s.payments).where(eq(s.payments.id, started.deposit.paymentId));
    expect(p).toMatchObject({ traderId: null, status: "successful" });
    expect(await db().select().from(s.reviewItems).where(eq(s.reviewItems.paymentId, p!.id))).toHaveLength(0);
    expect((await officerFloat(officerId)).balanceKobo).toBe(2_000_000);
  });
});

describe("officer float: cash collection", () => {
  let traderId: string;
  let scanId: string;
  let receipt: string;

  it("pays the trader's levy from the float and sends a receipt naming the officer", async () => {
    traderId = await makeTrader(1);
    scanId = await scan(officerId, traderId);
    const r = await collectCash({ officerId, scanId, expectedKobo: 50_000 });
    if (!r.ok) throw new Error(r.error);
    expect(r).toMatchObject({ amountKobo: 50_000, traderName: "Cash Trader 1", balanceKobo: 1_950_000, repeated: false });
    receipt = r.receiptNumber;

    const today = periodFor("daily", new Date());
    const [o] = await db().select().from(s.obligations).where(and(eq(s.obligations.traderId, traderId), eq(s.obligations.periodStart, today.start)));
    expect(o).toMatchObject({ status: "paid", amountPaidKobo: 50_000 });
    const [p] = await db().select().from(s.payments).where(and(eq(s.payments.provider, "cash"), eq(s.payments.providerRef, scanId)));
    expect(p).toMatchObject({ channel: "cash", status: "successful", feeKobo: 0, traderId });
    const entries = await db().select().from(s.ledgerEntries).where(eq(s.ledgerEntries.paymentId, p!.id));
    expect(entries.map((e) => [e.kind, e.debitAccount]).sort()).toEqual([
      ["allocation", accounts.trader(traderId)],
      ["cash_collection", accounts.officerFloat(officerId)],
    ]);
    const [sms] = await db().select().from(s.outbox).where(eq(s.outbox.dedupeKey, `receipt:${p!.id}`));
    expect(JSON.stringify(sms)).toContain(`FLT-${tag}-1`);
  });

  it("a second tap on the same scan changes nothing", async () => {
    const before = await ledgerCount();
    // The officer taps "I have the cash" again: same receipt back, nothing moves.
    const r = await recordCash({ officerId, scanId, expectedKobo: 50_000, code: "0000" });
    expect(r).toMatchObject({ ok: true, repeated: true, receiptNumber: receipt });
    expect(await ledgerCount()).toBe(before);
  });

  it("two taps at the same moment record the cash once", async () => {
    const t = await makeTrader(2);
    const id = await scan(officerId, t);
    const before = await ledgerCount();
    const [a, b] = await Promise.all([collectCash({ officerId, scanId: id, expectedKobo: 50_000 }), collectCash({ officerId, scanId: id, expectedKobo: 50_000 })]);
    expect(a.ok && b.ok).toBe(true);
    expect(a.ok && b.ok && a.receiptNumber === b.receiptNumber).toBe(true);
    expect(await ledgerCount()).toBe(before + 2);
  });

  it("two officers at the same trader at the same moment: only one takes the cash", async () => {
    const second = await makeOfficer(6);
    const g = await requestFloat(second, 1_000_000);
    if (!g.ok) throw new Error(g.error);
    await decideFloat(adminId, g.floatId, "approved");
    const dep = await startFloatDeposit(second, g.floatId);
    if (!dep.ok) throw new Error(dep.error);
    await getBank().simulateUssd(dep.deposit.paymentId);
    await waitFor(async () => (await officerFloat(second)).balanceKobo === 1_000_000);

    const t = await makeTrader(6);
    const [a, b] = await Promise.all([collectCash({ officerId, scanId: await scan(officerId, t), expectedKobo: 50_000 }), collectCash({ officerId: second, scanId: await scan(second, t), expectedKobo: 50_000 })]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    // The loser is refused either because the levy is paid, or because the trader's code was re-sent for the other officer.
    expect(["This trader owes nothing now. Do not take cash.", "That code was sent for another officer. Tap Take cash again."]).toContain((([a, b].find((r) => !r.ok) ?? {}) as { error?: string }).error);
    expect(await db().select().from(s.payments).where(and(eq(s.payments.provider, "cash"), eq(s.payments.traderId, t)))).toHaveLength(1);
  });

  it("refuses cash from a trader who owes nothing", async () => {
    const r = await collectCash({ officerId, scanId: await scan(officerId, traderId), expectedKobo: 50_000 });
    expect(r).toEqual({ ok: false, error: "This trader owes nothing now. Do not take cash." });
  });

  it("refuses when the amount changed since the scan", async () => {
    const t = await makeTrader(3);
    const r = await collectCash({ officerId, scanId: await scan(officerId, t), expectedKobo: 40_000 });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("₦500.00") });
  });

  it("refuses a stale scan, another officer's scan, and a trader outside the officer's market", async () => {
    const t = await makeTrader(4);
    const old = await scan(officerId, t, new Date(Date.now() - 20 * 60_000));
    expect(await collectCash({ officerId, scanId: old, expectedKobo: 50_000 })).toMatchObject({ ok: false, error: expect.stringContaining("15 minutes") });
    const other = await makeOfficer(2);
    expect(await collectCash({ officerId: other, scanId: await scan(officerId, t), expectedKobo: 50_000 })).toMatchObject({ ok: false, error: expect.stringContaining("Scan the trader") });
    const outside = await makeOfficer(3, false);
    expect(await collectCash({ officerId: outside, scanId: await scan(outside, t), expectedKobo: 50_000 })).toMatchObject({ ok: false, error: expect.stringContaining("outside your market") });
  });

  it("never lets a float go below zero", async () => {
    const empty = await makeOfficer(4);
    const t = await makeTrader(5);
    const before = await ledgerCount();
    const r = await collectCash({ officerId: empty, scanId: await scan(empty, t), expectedKobo: 50_000 });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("Make a new advance remittance") });
    expect(await ledgerCount()).toBe(before);
    expect(await db().select().from(s.payments).where(and(eq(s.payments.provider, "cash"), eq(s.payments.traderId, t)))).toHaveLength(0);
  });

  it("accounts for the float: each collection listed against it, balance equal to the ledger", async () => {
    const f = await officerFloat(officerId);
    const used = f.statements[0]!.lines.reduce((x, l) => x + l.amountKobo, 0);
    expect([100_000, 150_000]).toContain(used); // traders 1 and 2, and trader 6 if this officer won the race
    expect(f.balanceKobo).toBe(2_000_000 - used);
    expect(f.overspentKobo).toBe(0);
    expect(f.statements).toHaveLength(1);
    expect(f.statements[0]).toMatchObject({ id: floatId, label: `FLT-${tag}-1-R01`, usedKobo: used, remainingKobo: 2_000_000 - used, usedUp: false });
    expect(f.statements[0]!.lines.map((l) => l.traderName)).toEqual(expect.arrayContaining(["Cash Trader 1", "Cash Trader 2"]));
    expect(f.statements[0]!.lines.every((l) => l.receipt?.startsWith("LP-"))).toBe(true);
    const [sum] = (await db().execute<{ total: string }>(sql`SELECT coalesce(sum(CASE WHEN credit_account = ${accounts.officerFloat(officerId)} THEN amount_kobo ELSE -amount_kobo END), 0) AS total FROM ledger_entries WHERE credit_account = ${accounts.officerFloat(officerId)} OR debit_account = ${accounts.officerFloat(officerId)}`)).rows;
    expect(Number(sum!.total)).toBe(f.balanceKobo);
  });

  it("pays ahead in cash once today is paid: exactly the quoted days, no double-charge flag", async () => {
    // Trader 1 paid today in cash above, and has only the ₦500 daily levy.
    const id = await scan(officerId, traderId);
    const quote = await cashAheadOptions({ officerId, scanId: id });
    if (!quote.ok) throw new Error(quote.error);
    expect(quote.options.map((o) => [o.days, o.amountKobo])).toEqual([
      [1, 50_000],
      [7, 350_000],
    ]);
    const before = (await officerFloat(officerId)).balanceKobo;
    const r = await collectCash({ officerId, scanId: id, expectedKobo: 350_000, aheadDays: 7 });
    if (!r.ok) throw new Error(r.error);
    expect(r.amountKobo).toBe(350_000);
    expect(r.balanceKobo).toBe(before - 350_000);

    const tomorrow = periodFor("daily", new Date(Date.now() + 86_400_000));
    const paidAhead = await db().select().from(s.obligations).where(and(eq(s.obligations.traderId, traderId), eq(s.obligations.status, "paid"), sql`${s.obligations.periodStart} >= ${tomorrow.start}`));
    expect(paidAhead).toHaveLength(7);
    const [p] = await db().select().from(s.payments).where(and(eq(s.payments.provider, "cash"), eq(s.payments.providerRef, id)));
    expect(await db().select().from(s.fraudFlags).where(eq(s.fraudFlags.paymentId, p!.id))).toHaveLength(0);
    expect((await db().select().from(s.ledgerEntries).where(and(eq(s.ledgerEntries.paymentId, p!.id), eq(s.ledgerEntries.kind, "allocation")))).length).toBe(7);

    // Those seven days are now paid, so there is nothing left to offer for them.
    const again = await cashAheadOptions({ officerId, scanId: await scan(officerId, traderId) });
    expect(again).toEqual({ ok: true, options: [] });
  });

  it("will not take pay-ahead cash from a trader who still owes today, or for a changed amount", async () => {
    const t = await makeTrader(7);
    const id = await scan(officerId, t);
    expect(await cashAheadOptions({ officerId, scanId: id })).toMatchObject({ ok: false, error: expect.stringContaining("Take that first") });
    expect(await collectCash({ officerId, scanId: id, expectedKobo: 50_000, aheadDays: 1 })).toMatchObject({ ok: false, error: expect.stringContaining("Take that first") });
    expect(await collectCash({ officerId, scanId: id, expectedKobo: 50_000, aheadDays: 3 })).toMatchObject({ ok: false, error: "Choose tomorrow or the next 7 days." });
    const paid = await collectCash({ officerId, scanId: id, expectedKobo: 50_000 });
    expect(paid.ok).toBe(true);
    const next = await scan(officerId, t);
    expect(await collectCash({ officerId, scanId: next, expectedKobo: 40_000, aheadDays: 1 })).toMatchObject({ ok: false, error: expect.stringContaining("₦500.00") });
    expect(await collectCash({ officerId, scanId: next, expectedKobo: 50_000, aheadDays: 1 })).toMatchObject({ ok: true, amountKobo: 50_000 });
  });

  it("a declined request can be followed by a new one", async () => {
    const o = await makeOfficer(5);
    const a = await requestFloat(o, 1_000_000);
    if (!a.ok) throw new Error(a.error);
    expect(await decideFloat(adminId, a.floatId, "declined", "Too many open floats in this market")).toEqual({ ok: true });
    const b = await requestFloat(o, 1_000_000);
    expect(b.ok).toBe(true);
    const rows = await db().select().from(s.floats).where(eq(s.floats.officerId, o));
    expect(rows.map((r) => [r.seq, r.status]).sort()).toEqual([
      [1, "declined"],
      [2, "requested"],
    ]);
  });
});
