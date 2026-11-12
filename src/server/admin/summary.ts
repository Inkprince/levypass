import "server-only";
import { sql } from "drizzle-orm";
import { periodFor } from "@/core/periods";
import { db } from "@/server/db/client";

// AD-01, AD-02. Every number here is recomputed from ledger_entries and obligations (money rule 2).

const num = (v: unknown) => Number(v ?? 0);

export type Summary = Awaited<ReturnType<typeof dashboardSummary>>;

export async function dashboardSummary(now = new Date()) {
  const day = periodFor("daily", now).start;
  const week = periodFor("weekly", now).start;
  const month = periodFor("monthly", now).start;
  const today = periodFor("daily", now);

  const [totals] = (
    await db().execute(sql`
    SELECT
      coalesce(sum(amount_kobo) FILTER (WHERE kind IN ('inflow', 'cash_collection') AND created_at >= ${day}), 0) AS in_day,
      coalesce(sum(amount_kobo) FILTER (WHERE kind IN ('inflow', 'cash_collection') AND created_at >= ${week}), 0) AS in_week,
      coalesce(sum(amount_kobo) FILTER (WHERE kind IN ('inflow', 'cash_collection') AND created_at >= ${month}), 0) AS in_month,
      coalesce(sum(amount_kobo) FILTER (WHERE kind = 'fee' AND created_at >= ${day}), 0) AS fee_day,
      count(DISTINCT payment_id) FILTER (WHERE kind IN ('inflow', 'cash_collection') AND created_at >= ${day}) AS payments_day
    FROM ledger_entries`)
  ).rows as Record<string, unknown>[];

  const byLevy = (
    await db().execute(sql`
    SELECT l.name AS levy, coalesce(sum(e.amount_kobo), 0) AS kobo
    FROM levy_types l
    LEFT JOIN obligations o ON o.levy_type_id = l.id
    LEFT JOIN ledger_entries e ON e.obligation_id = o.id AND e.kind = 'allocation' AND e.created_at >= ${day}
    GROUP BY l.name ORDER BY l.name`)
  ).rows as { levy: string; kobo: unknown }[];

  const compliance = (
    await db().execute(sql`
    SELECT m.name AS market,
      count(DISTINCT t.id) AS traders,
      count(DISTINCT t.id) FILTER (WHERE o.status = 'paid') AS paid
    FROM markets m
    JOIN traders t ON t.market_id = m.id AND t.status = 'active'
    JOIN trader_levies tl ON tl.trader_id = t.id
    JOIN levy_types l ON l.id = tl.levy_type_id AND l.period = 'daily' AND l.active
    LEFT JOIN obligations o ON o.trader_id = t.id AND o.levy_type_id = l.id AND o.period_start = ${today.start}
    GROUP BY m.name ORDER BY m.name`)
  ).rows as { market: string; traders: unknown; paid: unknown }[];

  const series = (
    await db().execute(sql`
    SELECT to_char(created_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS d, sum(amount_kobo) AS kobo
    FROM ledger_entries WHERE kind IN ('inflow', 'cash_collection') AND created_at >= ${new Date(day.getTime() - 13 * 86_400_000)}
    GROUP BY 1 ORDER BY 1`)
  ).rows as { d: string; kobo: unknown }[];

  const recent = (
    await db().execute(sql`
    SELECT p.id, p.amount_kobo, p.fee_kobo, p.channel, p.settled_at, t.name, r.number,
      EXISTS (SELECT 1 FROM fraud_flags f WHERE f.payment_id = p.id) AS flagged
    FROM payments p JOIN traders t ON t.id = p.trader_id LEFT JOIN receipts r ON r.payment_id = p.id
    WHERE p.settled_at IS NOT NULL ORDER BY p.settled_at DESC LIMIT 8`)
  ).rows as { id: string; amount_kobo: unknown; fee_kobo: unknown; channel: string; settled_at: string; name: string; number: string | null; flagged: boolean }[];

  const [cases] = (
    await db().execute(sql`
    SELECT (SELECT count(*) FROM fraud_flags WHERE status = 'open') AS flags,
           (SELECT count(*) FROM complaints WHERE status = 'open') AS complaints,
           (SELECT count(*) FROM review_items WHERE status = 'open') AS review,
           (SELECT count(*) FROM scans WHERE scanned_at >= ${day}) AS scans`)
  ).rows as Record<string, unknown>[];

  const days: { date: string; kobo: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = periodFor("daily", new Date(now.getTime() - i * 86_400_000)).startDate;
    days.push({ date: d, kobo: num(series.find((x) => x.d === d)?.kobo) });
  }

  return {
    asOf: now.toISOString(),
    collected: { day: num(totals?.in_day), week: num(totals?.in_week), month: num(totals?.in_month) },
    feesDay: num(totals?.fee_day),
    paymentsDay: num(totals?.payments_day),
    byLevy: byLevy.map((l) => ({ levy: l.levy, kobo: num(l.kobo) })),
    compliance: compliance.map((c) => ({ market: c.market, traders: num(c.traders), paid: num(c.paid), rate: num(c.traders) ? num(c.paid) / num(c.traders) : 0 })),
    days,
    recent: recent.map((r) => ({ id: r.id, name: r.name, amountKobo: num(r.amount_kobo), feeKobo: num(r.fee_kobo), channel: r.channel, at: r.settled_at, receipt: r.number, flagged: r.flagged })),
    open: { flags: num(cases?.flags), complaints: num(cases?.complaints), review: num(cases?.review), scansToday: num(cases?.scans) },
  };
}
