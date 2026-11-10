import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { qrSvg, traderPassUrl } from "@/server/qr";

export const dynamic = "force-dynamic";

/** TR-07: print-ready QR stickers with trader ID and market. */
export default async function StickersPage() {
  const traders = await db().select({ id: s.traders.id, name: s.traders.name, stall: s.traders.stallOrVehicle, token: s.traders.qrTokenId, market: s.markets.name }).from(s.traders).innerJoin(s.markets, eq(s.markets.id, s.traders.marketId)).orderBy(s.traders.stallOrVehicle).limit(24);
  const cards = await Promise.all(traders.map(async (t) => ({ ...t, svg: await qrSvg(await traderPassUrl(t.id, t.token)) })));
  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">QR stickers</h1>
        <p className="text-sm text-slate-500">Print with your browser (Ctrl or Cmd + P).</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.id} className="flex break-inside-avoid flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-white p-3 text-center">
            <p className="text-xs font-extrabold text-brand-800">LevyPass · scan to verify</p>
            <div className="w-36" dangerouslySetInnerHTML={{ __html: c.svg }} />
            <p className="text-sm font-bold">{c.name}</p>
            <p className="text-xs text-slate-600">
              {c.market} · Stall {c.stall}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
