import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { newId } from "@/core/ids";
import { formatNaira } from "@/core/money";
import { lagosDate } from "@/core/periods";
import { parseReceiptNumber } from "@/core/receipts";
import { Card, CardTitle, LinkButton, Note, PageShell, Rows, StatusPanel, channelLabel } from "@/app/_ui/kit";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { allow, clientIp } from "@/server/ratelimit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receipt check", robots: { index: false } };

export default async function ReceiptPage({ params }: { params: Promise<{ number: string }> }) {
  if (!allow(`r:${clientIp(await headers())}`, 30, 60_000)) return <PageShell title="Too many checks" lead="This connection has made too many checks. Try again in a minute." />;
  const typed = decodeURIComponent((await params).number);
  const number = parseReceiptNumber(typed);
  const [r] = number
    ? await db()
        .select({ number: s.receipts.number, amount: s.receipts.amountKobo, issuedAt: s.receipts.issuedAt, paymentId: s.receipts.paymentId, name: s.traders.name, market: s.markets.name, stall: s.traders.stallOrVehicle, channel: s.payments.channel, cashOfficer: sql<string | null>`${s.payments.providerData}->>'staffId'` })
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
      <PageShell back={{ href: "/r", label: "Check another" }}>
        <StatusPanel tone="unpaid" word="Not genuine" sub={number ? "No LevyPass receipt has this number." : "This is not a LevyPass receipt number. Check for a typing mistake."}>
          <p className="rounded-full bg-white/15 px-3.5 py-1 font-mono text-[15px] font-semibold">{typed}</p>
        </StatusPanel>
        <Note icon="flag" tone="warn">LevyPass has told the revenue office. Do not accept this receipt as proof of payment.</Note>
        <LinkButton href="/r" variant="outline" size="lg">
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
    <PageShell back={{ href: "/r", label: "Check another" }}>
      <StatusPanel tone="paid" word="Genuine" sub={r.channel === "cash" ? "LevyPass issued this receipt for cash paid to an officer. The officer's advance remittance, already confirmed by the bank, paid the government." : "LevyPass issued this receipt after the bank confirmed the payment."}>
        <p className="rounded-full bg-white/15 px-3.5 py-1 font-mono text-[15px] font-semibold">{r.number}</p>
      </StatusPanel>
      <Card>
        <p className="text-[13px] font-medium text-ink-2">Amount paid</p>
        <p className="money mt-1 text-[40px] leading-none">{formatNaira(r.amount)}</p>
        <Rows
          className="mt-6"
          rows={[
            ["Paid on", lagosDate(r.issuedAt)],
            ["Trader", `${first} ${rest.at(-1)?.[0] ?? ""}.`],
            ["Market", `${r.market}, stall ${r.stall}`],
            ["Channel", r.channel === "cash" && r.cashOfficer ? `Cash to officer ${r.cashOfficer}` : channelLabel(r.channel)],
          ]}
        />
      </Card>
      {covers.length ? (
        <Card>
          <CardTitle>What it paid for</CardTitle>
          <Rows rows={covers.map((c) => [`${c.levy}, ${lagosDate(c.start)}`, formatNaira(c.amount)])} />
        </Card>
      ) : null}
    </PageShell>
  );
}
