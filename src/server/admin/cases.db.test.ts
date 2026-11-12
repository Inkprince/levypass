import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@/core/ids";
import { db, pool } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { seed, seedId } from "@/server/db/seed";
import { closeCase, complaintRef, traderReports } from "./cases";

afterAll(() => pool().end());

const marketId = seedId("mkt", "market");
const adminId = seedId("adm", "admin:1");
const tag = String(Date.now()).slice(-6);

async function makeTrader(n: number, locale: "en" | "yo" = "en") {
  const id = newId("trd");
  const phone = `+234703${tag}${n}`.slice(0, 14);
  await db().insert(s.traders).values({ id, phone, name: `Case Trader ${n}`, marketId, stallOrVehicle: `K-${tag}-${n}`, businessType: "Test", qrTokenId: newId("trd"), status: "active", locale });
  return { id, phone };
}

const smsFor = (caseId: string) => db().select().from(s.outbox).where(eq(s.outbox.dedupeKey, `case:${caseId}`));

beforeAll(async () => {
  await seed(db(), { now: new Date("2026-11-10T15:00:00Z") });
});

describe("closing a case tells the trader who raised it", () => {
  it("a resolved cash dispute: SMS naming the receipt, once, and the pass page shows it dealt with", async () => {
    const t = await makeTrader(1);
    const id = newId("flg");
    await db().insert(s.fraudFlags).values({ id, type: "cash_disputed", traderId: t.id, receiptNumber: "LP-TEST-00001" });
    expect((await traderReports(t.id))[0]).toMatchObject({ what: "cash", ref: "LP-TEST-00001", status: "open" });

    expect(await closeCase(adminId, "flag", id, "resolved")).toBe(true);
    const sms = await smsFor(id);
    expect(sms).toHaveLength(1);
    expect(sms[0]).toMatchObject({ recipient: t.phone, topic: "sms.report_resolved" });
    expect((sms[0]!.payload as { text: string }).text).toBe("LevyPass: the revenue office has dealt with your report LP-TEST-00001. Thank you for telling us.");
    expect((await traderReports(t.id))[0]).toMatchObject({ status: "resolved" });

    // A second click changes nothing and sends nothing.
    expect(await closeCase(adminId, "flag", id, "dismissed")).toBe(false);
    expect(await smsFor(id)).toHaveLength(1);
    expect((await db().select().from(s.fraudFlags).where(eq(s.fraudFlags.id, id)))[0]).toMatchObject({ status: "resolved" });
  });

  it("a dismissed complaint: SMS in the trader's language with the reference they were given", async () => {
    const t = await makeTrader(2, "yo");
    const id = newId("cmp");
    await db().insert(s.complaints).values({ id, reporterTraderId: t.id, description: "A man took 1000 naira at gate B" });
    expect(await closeCase(adminId, "complaint", id, "dismissed")).toBe(true);
    const [sms] = await smsFor(id);
    expect(sms).toMatchObject({ recipient: t.phone, topic: "sms.report_dismissed" });
    expect((sms!.payload as { text: string }).text).toContain(complaintRef(id));
    expect((sms!.payload as { text: string }).text).toContain("ọ́fíìsì");
    expect((await traderReports(t.id))[0]).toMatchObject({ what: "complaint", ref: complaintRef(id), status: "dismissed" });
  });

  it("LevyPass's own flags and anonymous complaints send no SMS", async () => {
    const t = await makeTrader(3);
    const flag = newId("flg");
    await db().insert(s.fraudFlags).values({ id: flag, type: "double_charge", traderId: t.id });
    const anon = newId("cmp");
    await db().insert(s.complaints).values({ id: anon, description: "Someone without an ID collecting money" });
    expect(await closeCase(adminId, "flag", flag, "resolved")).toBe(true);
    expect(await closeCase(adminId, "complaint", anon, "resolved")).toBe(true);
    expect(await smsFor(flag)).toHaveLength(0);
    expect(await smsFor(anon)).toHaveLength(0);
    expect(await traderReports(t.id)).toEqual([]);
  });
});
