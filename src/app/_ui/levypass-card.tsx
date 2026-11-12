import { Mark } from "./kit";

export type CardData = { id: string; name: string; market: string; stall: string; svg: string };

/**
 * The LevyPass card: the trader's signed QR at bank-card size (85.6 × 54 mm), for riders and
 * hawkers who have no stall to stick a QR on. It proves payment; it holds no money.
 */
export function LevyPassCard({ c }: { c: CardData }) {
  return (
    <div className="flex shrink-0 break-inside-avoid flex-col overflow-hidden rounded-[3.2mm] border border-line bg-paper text-ink print:border-ink/40" style={{ width: "85.6mm", height: "54mm" }}>
      <div className="flex items-center justify-between bg-forest text-white" style={{ padding: "1.6mm 3mm" }}>
        <span className="flex items-center gap-1.5 font-bold" style={{ fontSize: "3.2mm" }}>
          <Mark size={14} tone="lime" />
          LevyPass card
        </span>
        <span className="text-white/75" style={{ fontSize: "2.3mm" }}>
          Scan to check payment
        </span>
      </div>
      <div className="flex min-h-0 flex-1 items-center" style={{ gap: "2.6mm", padding: "2.2mm 3mm" }}>
        <div className="shrink-0 [&_svg]:h-full [&_svg]:w-full" style={{ width: "30mm", height: "30mm" }} dangerouslySetInnerHTML={{ __html: c.svg }} />
        <div className="flex min-w-0 flex-col" style={{ gap: "0.8mm" }}>
          <p className="truncate font-bold leading-tight" style={{ fontSize: "3.6mm" }}>
            {c.name}
          </p>
          <p className="leading-tight text-ink-2" style={{ fontSize: "2.6mm" }}>
            {c.market}
          </p>
          <p className="font-semibold leading-tight" style={{ fontSize: "2.8mm" }}>
            Stall or vehicle {c.stall}
          </p>
          <p className="break-all font-mono leading-tight text-ink-3" style={{ fontSize: "2.1mm" }}>
            {c.id}
          </p>
        </div>
      </div>
      <p className="border-t border-line text-ink-2" style={{ fontSize: "2.1mm", padding: "1.2mm 3mm" }}>
        Pay by USSD <b className="font-mono">*347*13#</b>. Cash to an officer counts only with an SMS receipt.
      </p>
    </div>
  );
}
