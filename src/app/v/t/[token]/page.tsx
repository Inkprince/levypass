import { headers } from "next/headers";
import { lagosDate } from "@/core/periods";
import { Badge, Card, CardTitle, Icon, PageShell, StatusPanel } from "@/app/_ui/kit";
import { traderFromToken, traderStatus } from "@/server/levy/status";
import { allow, clientIp } from "@/server/ratelimit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Levy status · LevyPass", robots: { index: false } };

/** What any phone camera sees after scanning a trader's QR: a limited, public view. */
export default async function TraderPublicPage({ params }: { params: Promise<{ token: string }> }) {
  if (!allow(`vt:${clientIp(await headers())}`, 60, 60_000)) return <PageShell title="Slow down" lead="Too many checks from this connection. Wait a minute and try again." />;
  const { token } = await params;
  const traderId = await traderFromToken(decodeURIComponent(token));
  const status = traderId ? await traderStatus(traderId) : null;
  if (!status) {
    return (
      <PageShell>
        <StatusPanel tone="warn" word="Not a valid pass" sub="This QR code is fake, damaged or has been replaced. Ask the trader for their current LevyPass." />
      </PageShell>
    );
  }
  const [first, ...rest] = status.trader.name.split(" ");
  const shortName = `${first} ${rest.at(-1)?.[0] ?? ""}.`;
  return (
    <PageShell>
      <StatusPanel tone={status.paidNow ? "paid" : "unpaid"} word={status.paidNow ? "Paid" : "Not paid"} sub={`For today, ${lagosDate(new Date())}`} />
      <Card>
        <p className="text-[22px] font-semibold tracking-[-0.02em]">{shortName}</p>
        <p className="mt-0.5 text-[15px] text-ink-2">
          {status.trader.market} · Stall {status.trader.stallOrVehicle}
        </p>
        <div className="mt-5 border-t border-line pt-4">
          <CardTitle>Levies this period</CardTitle>
          <ul className="flex flex-col gap-3 text-[15px]">
            {status.current.map((c) => (
              <li key={c.levy} className="flex items-center justify-between gap-3">
                {c.levy}
                <Badge tone={c.status === "paid" ? "paid" : c.status === "part_paid" ? "warn" : "unpaid"}>{c.status.replace("_", " ")}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </Card>
      <p className="flex items-center justify-center gap-1.5 text-center text-[13px] text-ink-3">
        <Icon name="shield" size={15} />
        Checked against the revenue office ledger just now.
      </p>
    </PageShell>
  );
}
