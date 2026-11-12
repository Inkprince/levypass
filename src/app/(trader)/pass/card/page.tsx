import { eq } from "drizzle-orm";
import Link from "next/link";
import { LevyPassCard } from "@/app/_ui/levypass-card";
import { Button, Card, Note, PageShell, buttonClass } from "@/app/_ui/kit";
import { PrintButton } from "@/app/_ui/print-button";
import { StallSticker } from "@/app/_ui/stall-sticker";
import { requireSubject } from "@/server/auth/session";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { qrSvg, traderPassUrl } from "@/server/qr";
import { reissueMyCard } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Print my pass" };

/** The trader prints their own QR: a bank-card-size LevyPass card, or the stall sticker the revenue office prints (TR-07). */
export default async function MyCardPage({ searchParams }: { searchParams: Promise<{ new?: string; replace?: string; format?: string }> }) {
  const q = await searchParams;
  const sticker = q.format === "sticker";
  const traderId = await requireSubject("trader");
  const [t] = await db().select({ id: s.traders.id, name: s.traders.name, stall: s.traders.stallOrVehicle, token: s.traders.qrTokenId, market: s.markets.name }).from(s.traders).innerJoin(s.markets, eq(s.markets.id, s.traders.marketId)).where(eq(s.traders.id, traderId));
  if (!t) return null;
  const svg = await qrSvg(await traderPassUrl(t.id, t.token));
  const tab = (isSticker: boolean, label: string) => (
    <Link href={isSticker ? "/pass/card?format=sticker" : "/pass/card"} aria-current={sticker === isSticker ? "page" : undefined} className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-[14px] font-semibold ${sticker === isSticker ? "bg-forest text-white" : "bg-mist-2 text-ink-2 hover:text-ink"}`}>
      {label}
    </Link>
  );
  return (
    <PageShell back={{ href: "/pass", label: "My pass" }} title="Print my pass" lead="Any officer scans it to see if you have paid. Both show the same QR code as your pass." printBare>
      {q.new ? (
        <Note tone="go" icon="check">
          Your new card is ready. Print it now, and print a new stall sticker too. The old card and any old stall sticker no longer work: officers who scan them see CANCELLED CARD.
        </Note>
      ) : null}
      <nav aria-label="What to print" className="no-print flex gap-2">
        {tab(false, "LevyPass card")}
        {tab(true, "Stall sticker")}
      </nav>
      <p className="no-print text-[14px] text-ink-2">
        {sticker ? "For your stall, shop or vehicle. A6 size: print at 100% scale, cut it out, and cover it with clear tape so rain does not spoil it." : "Bank-card size, to carry with you. Print at 100% scale and cut along the edges."}
      </p>
      <div className="flex justify-center">{sticker ? <StallSticker c={{ name: t.name, market: t.market, stall: t.stall, svg }} large /> : <LevyPassCard c={{ id: t.id, name: t.name, market: t.market, stall: t.stall, svg }} />}</div>
      <div className="no-print flex flex-col gap-4">
        <PrintButton label={sticker ? "Print my stall sticker" : "Print my card"} />
        <Note icon="info">The card and the sticker only show who you are and let an officer check your payments. They hold no money, so losing one costs you nothing.</Note>
        {q.replace ? (
          <Card>
            <p className="font-semibold">Cancel this card and make a new one?</p>
            <p className="mt-1 text-[14px] text-ink-2">Your old card and any stall sticker stop working at once. Anyone who scans them sees CANCELLED CARD. You will get an SMS. Then print the new card and a new stall sticker here.</p>
            <div className="mt-4 flex gap-2">
              <form action={reissueMyCard} className="flex-1">
                <input type="hidden" name="confirm" value="yes" />
                <Button variant="danger" className="w-full" type="submit">
                  Make new card
                </Button>
              </form>
              <a href="/pass/card" className={buttonClass("outline", "md")}>
                Keep my card
              </a>
            </div>
          </Card>
        ) : (
          <a href="/pass/card?replace=1" className="text-center text-[14px] font-semibold text-ink-2 underline underline-offset-4 hover:text-ink">
            Lost or damaged card or sticker? Make a new one
          </a>
        )}
      </div>
    </PageShell>
  );
}
