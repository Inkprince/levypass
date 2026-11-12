import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@/core/ids";
import { db, pool } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { seed, seedId } from "@/server/db/seed";
import { traderFromToken, traderTokenCheck } from "@/server/levy/status";
import { traderPassUrl } from "@/server/qr";
import { reissueCard } from "./reissue";

afterAll(() => pool().end());

const tokenOf = (url: string) => decodeURIComponent(/\/v\/t\/([^/?#]+)/.exec(url)![1]!);
let traderId: string;

beforeAll(async () => {
  await seed(db(), { now: new Date("2026-11-10T15:00:00Z") });
  traderId = newId("trd");
  await db().insert(s.traders).values({ id: traderId, phone: `+234702${String(Date.now()).slice(-7)}`, name: "Card Trader", marketId: seedId("mkt", "market"), stallOrVehicle: "K-1", businessType: "Okada", qrTokenId: "a1b2c3d4e5f6a1b2c3d4e5f6", status: "active", locale: "en" });
});

describe("re-issue a lost LevyPass card (TR-08)", () => {
  it("cancels the old card, makes a new one, audits it and tells the trader by SMS", async () => {
    const [before] = await db().select().from(s.traders).where(eq(s.traders.id, traderId));
    const oldToken = tokenOf(await traderPassUrl(traderId, before!.qrTokenId));
    expect(await traderTokenCheck(oldToken)).toEqual({ kind: "ok", traderId });

    const r = await reissueCard(traderId, { type: "trader", id: traderId });
    expect(r.ok).toBe(true);

    const [after] = await db().select().from(s.traders).where(eq(s.traders.id, traderId));
    expect(after!.qrTokenId).not.toBe(before!.qrTokenId);
    expect(after!.qrTokenId).toMatch(/^[0-9a-f]{24}$/);
    expect(await traderTokenCheck(oldToken)).toEqual({ kind: "cancelled", traderId });
    expect(await traderFromToken(oldToken)).toBeNull();
    const newToken = tokenOf(await traderPassUrl(traderId, after!.qrTokenId));
    expect(await traderFromToken(newToken)).toBe(traderId);

    const audits = await db().select().from(s.auditLog).where(eq(s.auditLog.targetId, traderId));
    expect(audits.map((a) => [a.action, a.actorType])).toContainEqual(["card.reissue", "trader"]);
    expect(JSON.stringify(audits)).not.toContain(after!.qrTokenId); // the live token ID is never logged

    const sms = await db().select().from(s.outbox).where(eq(s.outbox.recipient, after!.phone));
    expect(sms.map((m) => (m.payload as { text: string }).text).join(" ")).toContain("old card and any stall sticker no longer work");
  });

  it("the revenue office can re-issue too, and each re-issue cancels the card before it", async () => {
    const [mid] = await db().select().from(s.traders).where(eq(s.traders.id, traderId));
    const midToken = tokenOf(await traderPassUrl(traderId, mid!.qrTokenId));
    const r = await reissueCard(traderId, { type: "admin", id: seedId("adm", "admin:1") });
    expect(r.ok).toBe(true);
    expect(await traderTokenCheck(midToken)).toEqual({ kind: "cancelled", traderId });
    const audits = await db().select().from(s.auditLog).where(eq(s.auditLog.targetId, traderId));
    expect(audits.map((a) => [a.action, a.actorType])).toContainEqual(["card.reissue", "admin"]);
    const sms = await db().select().from(s.outbox).where(eq(s.outbox.recipient, mid!.phone));
    expect(sms.filter((m) => m.topic === "sms.card_reissued")).toHaveLength(2);
  });

  it("refuses an unknown trader, and treats a forged token as invalid, not cancelled", async () => {
    expect(await reissueCard("trd_00000000000000000000", { type: "admin", id: seedId("adm", "admin:1") })).toEqual({ ok: false, error: "No trader with that ID." });
    expect(await traderTokenCheck("v1.trd_x.abc.def")).toEqual({ kind: "invalid" });
  });
});
