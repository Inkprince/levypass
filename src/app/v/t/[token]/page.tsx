import { headers } from "next/headers";
import { lagosDate } from "@/core/periods";
import { Badge, Card, PageShell } from "@/app/_ui/kit";
import { traderFromToken, traderStatus } from "@/server/levy/status";
import { allow, clientIp } from "@/server/ratelimit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Levy status · LevyPass", robots: { index: false } };

/** What any phone camera sees after scanning a trader's QR: a limited, public view. */
export default async function TraderPublicPage({ params }: { params: Promise<{ token: string }> }) {
  if (!allow(`vt:${clientIp(await headers())}`, 60, 60_000)) return <PageShell title="Slow down">Too many checks. Wait a minute and try again.</PageShell>;
  const { token } = await params;
  const traderId = await traderFromToken(decodeURIComponent(token));
  const status = traderId ? await traderStatus(traderId) : null;
  if (!status) {
    return (
      <PageShell>
        <Card className="flex flex-col items-center gap-3 bg-slate-900 text-center text-white">
          <span className="text-5xl" aria-hidden="true">!</span>
          <p className="text-2xl font-black">NOT A VALID LEVYPASS</p>
          <p className="text-sm opacity-80">This QR code is fake, damaged or has been replaced. Ask the trader for their current pass.</p>
        </Card>
      </PageShell>
    );
  }
  const [first, ...rest] = status.trader.name.split(" ");
  const shortName = `${first} ${rest.at(-1)?.[0] ?? ""}.`;
  return (
    <PageShell>
      <Card className={`flex flex-col items-center gap-2 text-center text-white ${status.paidNow ? "bg-brand-700" : "bg-red-600"}`}>
        <span className="animate-pop flex h-20 w-20 items-center justify-center rounded-full bg-white text-5xl" style={{ color: status.paidNow ? "#027a48" : "#dc2626" }} aria-hidden="true">
          {status.paidNow ? "✔" : "✖"}
        </span>
        <p className="text-4xl font-black">{status.paidNow ? "PAID" : "NOT PAID"}</p>
        <p className="text-sm opacity-90">for today, {lagosDate(new Date())}</p>
      </Card>
      <Card>
        <p className="text-xl font-bold">{shortName}</p>
        <p className="text-slate-600">
          {status.trader.market} · Stall {status.trader.stallOrVehicle}
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {status.current.map((c) => (
            <li key={c.levy} className="flex items-center justify-between">
              {c.levy}
              <Badge tone={c.status === "paid" ? "paid" : "unpaid"}>{c.status.replace("_", " ")}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-center text-xs text-slate-500">Verified by LevyPass against the revenue office ledger.</p>
    </PageShell>
  );
}
