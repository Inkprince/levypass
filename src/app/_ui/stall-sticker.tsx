import { Mark } from "./kit";

export type StickerData = { name: string; market: string; stall: string; svg: string };

/**
 * The stall sticker (TR-07): the trader's signed QR to fix on a stall or vehicle. The same QR as the
 * pass and the LevyPass card, so re-issuing a card cancels the sticker too. On the revenue office's sheet
 * it fills a grid cell; `large` prints one at A6 width (100 mm, QR 70 mm) from the trader's own phone,
 * big enough to scan from a step or two away.
 */
export function StallSticker({ c, large = false }: { c: StickerData; large?: boolean }) {
  if (!large) {
    return (
      <div className="flex break-inside-avoid flex-col overflow-hidden rounded-2xl border border-line bg-paper">
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
            {c.market}, Stall <span className="font-semibold">{c.stall}</span>
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 break-inside-avoid flex-col overflow-hidden rounded-[4mm] border border-line bg-paper text-ink print:border-ink/40" style={{ width: "100mm" }}>
      <div className="flex items-center justify-between bg-forest text-white" style={{ padding: "3mm 5mm" }}>
        <span className="flex items-center gap-2 font-bold" style={{ fontSize: "5mm" }}>
          <Mark size={22} tone="lime" />
          LevyPass
        </span>
        <span className="text-white/75" style={{ fontSize: "3.4mm" }}>
          Scan to verify
        </span>
      </div>
      <div className="flex flex-col items-center text-center" style={{ gap: "1.5mm", padding: "5mm" }}>
        <div className="[&_svg]:h-full [&_svg]:w-full" style={{ width: "70mm", height: "70mm" }} dangerouslySetInnerHTML={{ __html: c.svg }} />
        <p className="font-bold leading-tight" style={{ fontSize: "6mm", marginTop: "2mm" }}>
          {c.name}
        </p>
        <p className="leading-tight text-ink-2" style={{ fontSize: "4mm" }}>
          {c.market}, Stall <span className="font-bold text-ink">{c.stall}</span>
        </p>
      </div>
    </div>
  );
}
