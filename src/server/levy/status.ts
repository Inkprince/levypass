import "server-only";
import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { verifyToken } from "@/core/tokens";
import type { Kobo } from "@/core/money";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { qrSigningKeys } from "@/server/keys";
import { amountOwed } from "@/server/payments/start";

export type TraderStatus = {
  trader: { id: string; name: string; phone: string; stallOrVehicle: string; businessType: string; market: string; status: string; locale: string; qrTokenId: string };
  paidNow: boolean;
  current: { levy: string; period: string; status: string; dueKobo: Kobo; paidKobo: Kobo }[];
  owedKobo: Kobo;
  nextKobo: Kobo;
};

/** "Paid" means every levy's current period is paid (OF-02). Reads our database only. */
export async function traderStatus(traderId: string, now = new Date()): Promise<TraderStatus | null> {
  const [t] = await db()
    .select({ id: s.traders.id, name: s.traders.name, phone: s.traders.phone, stallOrVehicle: s.traders.stallOrVehicle, businessType: s.traders.businessType, market: s.markets.name, status: s.traders.status, locale: s.traders.locale, qrTokenId: s.traders.qrTokenId })
    .from(s.traders)
    .innerJoin(s.markets, eq(s.markets.id, s.traders.marketId))
    .where(eq(s.traders.id, traderId));
  if (!t) return null;
  const owed = await amountOwed(traderId, now);
  const current = await db()
    .select({ levy: s.levyTypes.name, period: s.levyTypes.period, status: s.obligations.status, dueKobo: s.obligations.amountDueKobo, paidKobo: s.obligations.amountPaidKobo })
    .from(s.obligations)
    .innerJoin(s.levyTypes, eq(s.levyTypes.id, s.obligations.levyTypeId))
    .where(and(eq(s.obligations.traderId, traderId), lte(s.obligations.periodStart, now), gt(s.obligations.periodEnd, now)));
  const paidNow = current.length > 0 && current.every((c) => c.status === "paid" || c.status === "waived") && owed.totalKobo === 0;
  return { trader: t, paidNow, current, owedKobo: owed.totalKobo, nextKobo: owed.nextKobo };
}

export type TokenCheck = { kind: "ok"; traderId: string } | { kind: "cancelled"; traderId: string } | { kind: "invalid" };

/**
 * A scanned trader QR: current (`ok`), genuinely signed but replaced by a newer card (`cancelled`,
 * TR-08), or forged, malformed or for an unknown trader (`invalid`).
 */
export async function traderTokenCheck(token: string): Promise<TokenCheck> {
  const claims = await verifyToken((await qrSigningKeys()).publicKey, token);
  if (!claims || claims.kind !== "trader") return { kind: "invalid" };
  const [t] = await db().select({ id: s.traders.id, tokenId: s.traders.qrTokenId }).from(s.traders).where(eq(s.traders.id, claims.subjectId));
  if (!t) return { kind: "invalid" };
  return t.tokenId === claims.tokenId ? { kind: "ok", traderId: t.id } : { kind: "cancelled", traderId: t.id };
}

/** Resolves a scanned QR token to a trader ID, or null when forged, malformed or re-issued (TR-08). */
export async function traderFromToken(token: string): Promise<string | null> {
  const c = await traderTokenCheck(token);
  return c.kind === "ok" ? c.traderId : null;
}

export async function officerFromToken(token: string) {
  const claims = await verifyToken((await qrSigningKeys()).publicKey, token);
  if (!claims || claims.kind !== "officer") return null;
  const [o] = await db().select().from(s.officers).where(and(eq(s.officers.id, claims.subjectId), eq(s.officers.qrTokenId, claims.tokenId)));
  return o ?? null;
}

/** The trader's latest receipts. `cashStaffId` names the officer for cash, so the trader sees who took it. */
export async function recentReceipts(traderId: string, limit = 5) {
  return db()
    .select({ id: s.receipts.id, number: s.receipts.number, amountKobo: s.receipts.amountKobo, issuedAt: s.receipts.issuedAt, cashStaffId: sql<string | null>`CASE WHEN ${s.payments.channel} = 'cash' THEN ${s.payments.providerData}->>'staffId' END` })
    .from(s.receipts)
    .leftJoin(s.payments, eq(s.payments.id, s.receipts.paymentId))
    .where(eq(s.receipts.traderId, traderId))
    .orderBy(desc(s.receipts.issuedAt))
    .limit(limit);
}
