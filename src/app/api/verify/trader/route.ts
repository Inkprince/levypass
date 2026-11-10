import { and, eq, inArray, sql } from "drizzle-orm";
import { isId, newId } from "@/core/ids";
import { lagosDate } from "@/core/periods";
import { sessionRow } from "@/server/auth/session";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { traderFromToken, traderStatus } from "@/server/levy/status";
import { raiseOfficerFlag } from "@/server/ussd/menu";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** OF-02, OF-03, OF-06: the officer's scan. Small response (well under 5 KB), every scan logged. */
export async function GET(request: Request): Promise<Response> {
  const started = Date.now();
  const q = new URL(request.url).searchParams;
  const row = await sessionRow("officer");
  if (!row) return json({ result: "login_required" }, 401);
  const [officer] = await db().select().from(s.officers).where(eq(s.officers.id, row.subjectId));
  if (!officer || officer.status === "suspended" || row.revokedAt || row.expiresAt < new Date()) {
    if (officer?.status === "suspended") await raiseOfficerFlag(officer.id, null, "scan");
    return json({ result: "officer_suspended" }, 403);
  }

  const token = q.get("token")?.trim();
  const manual = q.get("id")?.trim();
  let traderId: string | null = null;
  let result: "paid" | "not_paid" | "unknown_trader" | "invalid_token" = "unknown_trader";
  if (token) {
    const fromUrl = /\/v\/t\/([^/?#]+)/.exec(token)?.[1] ?? token;
    traderId = await traderFromToken(decodeURIComponent(fromUrl));
    if (!traderId) result = "invalid_token";
  } else if (manual) {
    if (isId("trd", manual)) traderId = manual;
    else {
      const markets = (await db().select({ id: s.officerMarkets.marketId }).from(s.officerMarkets).where(eq(s.officerMarkets.officerId, officer.id))).map((m) => m.id);
      const found = await db()
        .select({ id: s.traders.id })
        .from(s.traders)
        .where(and(sql`upper(${s.traders.stallOrVehicle}) = ${manual.toUpperCase()}`, markets.length ? inArray(s.traders.marketId, markets) : sql`true`))
        .limit(2);
      traderId = found.length === 1 ? found[0]!.id : null;
    }
  }

  const status = traderId ? await traderStatus(traderId) : null;
  if (status) result = status.paidNow ? "paid" : "not_paid";
  const lat = Number(q.get("lat"));
  const lng = Number(q.get("lng"));
  await db().insert(s.scans).values({
    id: newId("scn"),
    officerId: officer.id,
    traderId: status ? status.trader.id : null,
    result,
    latitude: Number.isFinite(lat) && q.get("lat") ? lat : null,
    longitude: Number.isFinite(lng) && q.get("lng") ? lng : null,
    accuracyMetres: q.get("acc") ? Number(q.get("acc")) : null,
    scannedAt: new Date(),
  });

  if (!status) return json({ result, ms: Date.now() - started });
  return json({
    result,
    ms: Date.now() - started,
    trader: { id: status.trader.id, name: status.trader.name, stall: status.trader.stallOrVehicle, market: status.trader.market, business: status.trader.businessType },
    date: lagosDate(new Date()),
    levies: status.current.map((c) => ({ levy: c.levy, status: c.status })),
    owedKobo: status.owedKobo,
    payCode: "*347*13#",
  });
}
