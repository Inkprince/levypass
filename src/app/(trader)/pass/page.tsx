import { formatNaira } from "@/core/money";
import { lagosDate } from "@/core/periods";
import { Badge, Button, Card, CardTitle, Icon, Mark, Note, PageShell } from "@/app/_ui/kit";
import { requireSubject } from "@/server/auth/session";
import { recentReceipts, traderStatus } from "@/server/levy/status";
import { qrSvg, traderPassUrl } from "@/server/qr";
import { payNow, traderLogout } from "../actions";

export const dynamic = "force-dynamic";

export default async function PassPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const traderId = await requireSubject("trader");
  const status = await traderStatus(traderId);
  if (!status) return null;
  const { trader } = status;
  const url = await traderPassUrl(trader.id, trader.qrTokenId);
  const svg = await qrSvg(url);
  const receipts = await recentReceipts(trader.id);
  const welcome = (await searchParams).welcome;
  const paid = status.paidNow;

  return (
    <PageShell>
      {welcome ? (
        <Note tone="go" icon="check">
          Welcome to LevyPass. Your pass is ready. Show this QR code to any officer.
        </Note>
      ) : null}

      {/* The pass itself: what an officer looks at. */}
      <section className="animate-rise overflow-hidden rounded-[28px] bg-forest text-white shadow-[0_24px_60px_-30px_rgb(12_28_21/0.55)]">
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div className="min-w-0">
            <p className="text-[13px] text-white/65">{trader.market}</p>
            <p className="mt-1 truncate text-[24px] font-bold tracking-[-0.03em]">{trader.name}</p>
            <p className="text-[14px] text-white/75">
              Stall {trader.stallOrVehicle}, {trader.businessType}
            </p>
          </div>
          <Mark size={34} tone="lime" />
        </div>
        <div className="mx-4 mb-4 mt-6 rounded-[22px] bg-paper p-5 text-ink">
          <div className={`mb-4 flex items-center justify-center gap-2 rounded-full py-2 text-[14px] font-bold uppercase tracking-wide ${paid ? "bg-go-bg text-go-fg" : "bg-stop-bg text-stop-fg"}`}>
            <Icon name={paid ? "check" : "x"} size={18} stroke={2.6} />
            {paid ? "Paid today" : "Not paid today"}
          </div>
          <div className="mx-auto w-full max-w-[240px] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-3 text-center font-mono text-[12px] text-ink-3">{trader.id}</p>
        </div>
      </section>

      <Card>
        <CardTitle>{status.owedKobo > 0 ? "What you owe" : "All paid up"}</CardTitle>
        {status.owedKobo > 0 ? (
          <>
            <p className="money text-[40px] leading-none text-stop-fg">{formatNaira(status.owedKobo)}</p>
            <form action={payNow} className="mt-5">
              <Button className="w-full" size="lg" type="submit">
                Pay {formatNaira(status.owedKobo)} now
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="text-[15px] text-ink-2">Nothing is due right now. Thank you.</p>
            <form action={payNow} className="mt-5">
              <input type="hidden" name="amountKobo" value={status.nextKobo} />
              <input type="hidden" name="purpose" value="ahead" />
              <Button variant="secondary" size="lg" className="w-full" type="submit">
                Pay ahead {formatNaira(status.nextKobo)}
              </Button>
            </form>
          </>
        )}
        <ul className="mt-5 divide-y divide-line border-t border-line text-[15px]">
          {status.current.map((c) => (
            <li key={c.levy} className="flex items-center justify-between gap-3 py-3 last:pb-0">
              <span className="min-w-0">
                {c.levy} <span className="text-ink-3">{c.period}</span>
              </span>
              <Badge tone={c.status === "paid" ? "paid" : c.status === "part_paid" ? "warn" : "unpaid"}>{c.status.replace("_", " ")}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Recent receipts</CardTitle>
        {receipts.length ? (
          <ul className="divide-y divide-line text-[15px]">
            {receipts.map((r) => (
              <li key={r.id} className="first:pt-0 last:pb-0">
                <a href={`/r/${r.number}`} className="flex items-center justify-between gap-3 py-3 hover:text-forest">
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mist-2 text-forest">
                      <Icon name="receipt" size={17} />
                    </span>
                    <span className="leading-tight">
                      <span className="block font-mono text-[13px] font-semibold">{r.number}</span>
                      <span className="text-[13px] text-ink-3">{lagosDate(r.issuedAt)}</span>
                    </span>
                  </span>
                  <span className="font-semibold tnum">{formatNaira(r.amountKobo)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-ink-3">No receipts yet. Your first one arrives by SMS when you pay.</p>
        )}
      </Card>

      <p className="flex items-center justify-center gap-2 text-center text-[14px] text-ink-2">
        <Icon name="phone" size={17} className="text-forest" />
        Feature phone? Dial <span className="font-mono font-semibold text-ink">*347*13#</span> to pay.
      </p>
      <form action={traderLogout} className="text-center">
        <button className="rounded-full px-4 py-2 text-[14px] font-semibold text-ink-3 hover:bg-fill hover:text-ink">Log out</button>
      </form>
    </PageShell>
  );
}
