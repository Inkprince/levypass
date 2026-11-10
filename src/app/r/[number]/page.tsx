import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { newId } from "@/core/ids";
import { formatNaira } from "@/core/money";
import { lagosDate } from "@/core/periods";
import { parseReceiptNumber } from "@/core/receipts";
import { Card, LinkButton, PageShell } from "@/app/_ui/kit";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { allow, clientIp } from "@/server/ratelimit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receipt check · LevyPass", robots: { index: false } };

export default async function ReceiptPage({ params }: { params: Promise<{ number: string }> }) {
  if (!allow(`r:${clientIp(await headers())}`, 30, 60_000)) return <PageShell title="Slow down">Too many checks. Wait a minute and try again.</PageShell>;
  const typed = decodeURIComponent((await params).number);
  const number = parseReceiptNumber(typed);
  const [r] = number
    ? await db()
        .select({ number: s.receipts.number, amount: s.receipts.amountKobo, issuedAt: s.receipts.issuedAt, paymentId: s.receipts.paymentId, name: s.traders.name, market: s.markets.name, stall: s.traders.stallOrVehicle, channel: s.payments.channel })
        .from(s.receipts)
        .innerJoin(s.traders, eq(s.traders.id, s.receipts.traderId))
        .innerJoin(s.markets, eq(s.markets.id, s.traders.marketId))
        .innerJoin(s.payments, eq(s.payments.id, s.receipts.paymentId))
        .where(eq(s.receipts.number, number))
    : [];

  if (!r) {
    // FR-02: a number that does not exist. One flag per number per hour.
    const key = number ?? typed.slice(0, 40);
    const recent = await db().select({ id: s.fraudFlags.id }).from(s.fraudFlags).where(and(eq(s.fraudFlags.type, "unknown_receipt"), eq(s.fraudFlags.receiptNumber, key), gt(s.fraudFlags.createdAt, sql`now() - interval '1 hour'`)));
    if (!recent.length) await db().insert(s.fraudFlags).values({ id: newId("flg"), type: "unknown_receipt", receiptNumber: key, details: { typed: typed.slice(0, 40), wellFormed: Boolean(number) } });
    return (
      <PageShell>
        <Card className="flex flex-col items-center gap-2 bg-red-600 text-center text-white">
          <span className="animate-pop flex h-20 w-20 items-center justify-center rounded-full bg-white text-5xl text-red-600" aria-hidden="true">✖</span>
          <p className="text-3xl font-black">NOT GENUINE</p>
          <p className="font-mono">{typed}</p>
          <p className="text-sm opacity-90">{number ? "No LevyPass receipt has this number." : "This is not a LevyPass receipt number. Check for a typing mistake."} The revenue office has been notified.</p>
        </Card>
        <LinkButton href="/r" variant="secondary">
          Check another receipt
        </LinkButton>
      </PageShell>
    );
  }

  const covers = await db()
    .select({ levy: s.levyTypes.name, start: s.obligations.periodStart, amount: s.ledgerEntries.amountKobo })
    .from(s.ledgerEntries)
    .innerJoin(s.obligations, eq(s.obligations.id, s.ledgerEntries.obligationId))
    .innerJoin(s.levyTypes, eq(s.levyTypes.id, s.obligations.levyTypeId))
    .where(and(eq(s.ledgerEntries.paymentId, r.paymentId), inArray(s.ledgerEntries.kind, ["allocation"])));
  const [first, ...rest] = r.name.split(" ");
  return (
    <PageShell>
      <Card className="flex flex-col items-center gap-2 bg-brand-700 text-center text-white">
        <span className="animate-pop flex h-20 w-20 items-center justify-center rounded-full bg-white text-5xl text-brand-700" aria-hidden="true">✔</span>
        <p className="text-3xl font-black">GENUINE RECEIPT</p>
        <p className="font-mono text-lg">{r.number}</p>
      </Card>
      <Card>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-500">Amount</dt>
          <dd className="text-right font-bold tabular-nums">{formatNaira(r.amount)}</dd>
          <dt className="text-slate-500">Paid on</dt>
          <dd className="text-right">{lagosDate(r.issuedAt)}</dd>
          <dt className="text-slate-500">Trader</dt>
          <dd className="text-right">
            {first} {rest.at(-1)?.[0] ?? ""}.
          </dd>
          <dt className="text-slate-500">Market</dt>
          <dd className="text-right">
            {r.market}, stall {r.stall}
          </dd>
          <dt className="text-slate-500">Channel</dt>
          <dd className="text-right capitalize">{r.channel.replace("_", " ")}</dd>
        </dl>
        {covers.length ? (
          <ul className="mt-3 border-t border-slate-100 pt-3 text-sm">
            {covers.map((c, i) => (
              <li key={i} className="flex justify-between py-0.5">
                <span>
                  {c.levy}, {lagosDate(c.start)}
                </span>
                <span className="tabular-nums">{formatNaira(c.amount)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </PageShell>
  );
}
