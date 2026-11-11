import { eq } from "drizzle-orm";
import { Mark, PageHeader } from "@/app/_ui/kit";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { qrSvg, traderPassUrl } from "@/server/qr";

export const dynamic = "force-dynamic";

/** TR-07: print-ready QR stickers with trader ID and market. */
export default async function StickersPage() {
  const traders = await db().select({ id: s.traders.id, name: s.traders.name, stall: s.traders.stallOrVehicle, token: s.traders.qrTokenId, market: s.markets.name }).from(s.traders).innerJoin(s.markets, eq(s.markets.id, s.traders.marketId)).orderBy(s.traders.stallOrVehicle).limit(24);
  const cards = await Promise.all(traders.map(async (t) => ({ ...t, svg: await qrSvg(await traderPassUrl(t.id, t.token)) })));
  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <PageHeader title="QR stickers" lead="Print with your browser (Ctrl or Cmd + P) and fix one to each stall." />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.id} className="flex break-inside-avoid flex-col overflow-hidden rounded-2xl border border-line bg-paper">
            <div className="flex items-center justify-between bg-forest px-3 py-2 text-white">
              <span className="flex items-center gap-1.5 text-[12px] font-bold">
                <Mark size={16} tone="lime" />
                LevyPass
              </span>
              <span className="text-[11px] text-white/70">Scan to verify</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 text-center">
              <div className="w-full max-w-[150px] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <p className="text-[14px] font-semibold">{c.name}</p>
              <p className="text-[12px] text-ink-2">
                {c.market} · Stall <span className="font-semibold">{c.stall}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
