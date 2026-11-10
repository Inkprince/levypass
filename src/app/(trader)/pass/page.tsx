import { formatNaira } from "@/core/money";
import { lagosDate } from "@/core/periods";
import { Badge, Button, Card, PageShell } from "@/app/_ui/kit";
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

  return (
    <PageShell>
      {welcome ? (
        <p className="animate-fadein rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900">Welcome to LevyPass. Your pass is ready. Show this QR code to any officer.</p>
      ) : null}
      <Card className="overflow-hidden p-0">
        <div className={`px-5 py-4 text-white ${status.paidNow ? "bg-brand-700" : "bg-red-600"}`}>
          <p className="text-sm opacity-90">{trader.market}</p>
          <p className="text-2xl font-extrabold">{trader.name}</p>
          <p className="text-sm opacity-90">
            Stall {trader.stallOrVehicle} · {trader.businessType}
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 px-5 py-5">
          <div className="w-60" dangerouslySetInnerHTML={{ __html: svg }} />
          <Badge tone={status.paidNow ? "paid" : "unpaid"}>{status.paidNow ? "Paid today" : "Not paid today"}</Badge>
          <p className="font-mono text-xs text-slate-500">{trader.id}</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">What you owe</h2>
        {status.owedKobo > 0 ? (
          <>
            <p className="mt-1 text-3xl font-extrabold text-red-700">{formatNaira(status.owedKobo)}</p>
            <form action={payNow} className="mt-4">
              <Button className="w-full" type="submit">
                Pay {formatNaira(status.owedKobo)} now
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-1 text-slate-600">Nothing is due right now. Thank you.</p>
            <form action={payNow} className="mt-4">
              <input type="hidden" name="amountKobo" value={status.nextKobo} />
              <input type="hidden" name="purpose" value="ahead" />
              <Button variant="secondary" className="w-full" type="submit">
                Pay ahead {formatNaira(status.nextKobo)}
              </Button>
            </form>
          </>
        )}
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {status.current.map((c) => (
            <li key={c.levy} className="flex items-center justify-between py-2">
              <span>
                {c.levy} <span className="text-slate-400">({c.period})</span>
              </span>
              <Badge tone={c.status === "paid" ? "paid" : c.status === "part_paid" ? "warn" : "unpaid"}>{c.status.replace("_", " ")}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Recent receipts</h2>
        {receipts.length ? (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {receipts.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <a href={`/r/${r.number}`} className="font-mono font-semibold text-brand-800">
                  {r.number}
                </a>
                <span className="tabular-nums">
                  {formatNaira(r.amountKobo)} · {lagosDate(r.issuedAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-slate-500">No receipts yet.</p>
        )}
      </Card>
      <p className="text-center text-sm text-slate-500">Feature phone? Dial *347*13# to pay by USSD.</p>
      <form action={traderLogout} className="text-center">
        <button className="text-sm font-semibold text-slate-500">Log out</button>
      </form>
    </PageShell>
  );
}
