import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { newId } from "@/core/ids";
import { lagosDate } from "@/core/periods";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { log } from "@/server/log";
import { queueSms } from "@/server/notify/outbox";
import { isLocale, t } from "@/messages";

type Actor = { type: "trader" | "admin"; id: string };

/**
 * TR-08: a lost or damaged LevyPass card. A new token ID makes a new QR; the old one stops working
 * at once, because a scan is accepted only when its token ID matches the trader's current one. The
 * trader is told by SMS every time, so a re-issue they did not ask for does not go unnoticed.
 */
export async function reissueCard(traderId: string, actor: Actor, now = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  return db().transaction(async (tx) => {
    const [tr] = await tx.select({ id: s.traders.id, phone: s.traders.phone, locale: s.traders.locale }).from(s.traders).where(eq(s.traders.id, traderId)).for("no key update");
    if (!tr) return { ok: false as const, error: "No trader with that ID." };
    await tx.update(s.traders).set({ qrTokenId: randomBytes(12).toString("hex") }).where(eq(s.traders.id, traderId));
    // The token IDs themselves are never logged: the live one is what makes a card valid.
    await tx.insert(s.auditLog).values({ id: newId("aud"), actorType: actor.type, actorId: actor.id, action: "card.reissue", targetType: "trader", targetId: traderId, before: null, after: { reissuedAt: now.toISOString() } });
    const locale = isLocale(tr.locale) ? tr.locale : "en";
    await queueSms(tx, tr.phone, "sms.card_reissued", t(locale, "sms.card_reissued", { date: lagosDate(now) }), `card:${traderId}:${now.getTime()}`);
    log("info", "card.reissued", { trader_id: traderId, actor_type: actor.type });
    return { ok: true as const };
  });
}
