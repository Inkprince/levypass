import { eq, ilike, or } from "drizzle-orm";
import Link from "next/link";
import { LevyPassCard } from "@/app/_ui/levypass-card";
import { Note, PageHeader, buttonClass, inputClass } from "@/app/_ui/kit";
import { StallSticker } from "@/app/_ui/stall-sticker";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { qrSvg, traderPassUrl } from "@/server/qr";
import { reissueCardAction } from "../../actions";

export const dynamic = "force-dynamic";

/** TR-07: print-ready QR stickers for stalls, or wallet-sized LevyPass cards for riders and hawkers. */
export default async function StickersPage({ searchParams }: { searchParams: Promise<{ format?: string; q?: string; confirm?: string; done?: string }> }) {
  const sp = await searchParams;
  const format = sp.format === "card" ? "card" : "sticker";
  const q = (sp.q ?? "").trim().slice(0, 60);
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const traders = await db()
    .select({ id: s.traders.id, name: s.traders.name, stall: s.traders.stallOrVehicle, token: s.traders.qrTokenId, market: s.markets.name })
    .from(s.traders)
    .innerJoin(s.markets, eq(s.markets.id, s.traders.marketId))
    .where(q ? or(ilike(s.traders.name, like), ilike(s.traders.stallOrVehicle, like), ilike(s.traders.id, like)) : undefined)
    .orderBy(s.traders.stallOrVehicle)
    .limit(24);
  const doneName = sp.done ? traders.find((t) => t.id === sp.done)?.name : undefined;
  const here = (extra: string) => `/admin/stickers?format=${format}&q=${encodeURIComponent(q)}${extra}`;
  const cards = await Promise.all(traders.map(async (t) => ({ ...t, svg: await qrSvg(await traderPassUrl(t.id, t.token)) })));
  const tab = (f: "sticker" | "card", label: string) => (
    <Link href={f === "card" ? "/admin/stickers?format=card" : "/admin/stickers"} aria-current={format === f ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-semibold ${format === f ? "bg-forest text-white" : "bg-mist-2 text-ink-2 hover:text-ink"}`}>
      {label}
    </Link>
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="no-print flex flex-col gap-4">
        <PageHeader
          title={format === "card" ? "LevyPass cards" : "QR stickers"}
          lead={format === "card" ? "Bank-card size (85.6 × 54 mm) for riders and hawkers with no stall. Print at 100% scale with your browser (Ctrl or Cmd + P) and cut along the edges." : "Print with your browser (Ctrl or Cmd + P) and fix one to each stall."}
        />
        <div className="flex flex-wrap items-center gap-2">
          {tab("sticker", "Stall stickers")}
          {tab("card", "LevyPass cards")}
          <form className="ml-auto flex gap-2">
            {format === "card" ? <input type="hidden" name="format" value="card" /> : null}
            <input name="q" defaultValue={q} placeholder="Name, stall or trader ID" aria-label="Find a trader" className={`${inputClass} h-10 w-56 text-[14px]`} />
            <button className={buttonClass("outline", "sm")}>Find</button>
          </form>
        </div>
        {doneName ? (
          <Note tone="go" icon="check">
            New card made for {doneName}. Print it below. The old card and stall sticker are cancelled, so print a new sticker too if the trader has one. The trader gets an SMS.
          </Note>
        ) : null}
      </div>
      {format === "card" ? (
        <div className="flex flex-wrap gap-4 print:gap-[4mm]">
          {cards.map((c) => (
            <div key={c.id} className="flex flex-col gap-2">
              <LevyPassCard c={{ id: c.id, name: c.name, market: c.market, stall: c.stall, svg: c.svg }} />
              <div className="no-print">
                {sp.confirm === c.id ? (
                  <form action={reissueCardAction} className="flex items-center gap-2 text-[13px]">
                    <input type="hidden" name="traderId" value={c.id} />
                    <input type="hidden" name="q" value={q} />
                    <span className="text-ink-2">Cancel the old card and stall sticker?</span>
                    <button className={buttonClass("danger", "sm")}>Yes, re-issue</button>
                    <a href={here("")} className={buttonClass("ghost", "sm")}>
                      No
                    </a>
                  </form>
                ) : (
                  <a href={here(`&confirm=${encodeURIComponent(c.id)}`)} className="text-[13px] font-semibold text-ink-2 underline underline-offset-4 hover:text-ink">
                    Lost or damaged? Re-issue card
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {cards.map((c) => (
            <StallSticker key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
