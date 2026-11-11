"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IlloBadge, IlloCoins, IlloStall } from "@/app/_ui/illustrations";
import { Icon, type IconName, Tag, buttonClass, channelLabel } from "@/app/_ui/kit";
import type { Summary } from "@/server/admin/summary";

const naira = (k: number) => `₦${(k / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nairaShort = (k: number) => (k >= 1_000_000_00 ? `₦${(k / 1_000_000_00).toFixed(1)}m` : k >= 1_000_00 ? `₦${(k / 1_000_00).toFixed(1)}k` : `₦${(k / 100).toFixed(0)}`);
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });
const lagosHour = (iso: string) => Number(new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", hour12: false }));
const greeting = (iso: string) => {
  const h = lagosHour(iso);
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};
const channelIcon = (c: string): IconName => (c === "ussd" ? "hash" : c === "card" ? "card" : "transfer");

export function LiveDashboard({ initial }: { initial: Summary }) {
  const [d, setD] = useState(initial);
  const [flash, setFlash] = useState(0);
  const last = useRef(initial.collected.day);
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch("/api/admin/summary", { cache: "no-store" });
      if (!r.ok) return;
      const next = (await r.json()) as Summary;
      if (next.collected.day !== last.current) {
        last.current = next.collected.day;
        setFlash((n) => n + 1);
      }
      setD(next);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const totalTraders = d.compliance.reduce((x, c) => x + c.traders, 0);
  const totalPaid = d.compliance.reduce((x, c) => x + c.paid, 0);
  const rate = totalTraders ? Math.round((totalPaid / totalTraders) * 100) : 0;
  const today = d.collected.day > 0;

  return (
    <div className="-mx-4 -my-8 sm:-mx-6 lg:-mx-10 lg:-my-10 2xl:-mx-14">
      {/* Hero panel */}
      <section className="relative overflow-hidden bg-mist-2 px-4 py-8 sm:px-6 lg:mx-10 lg:mt-10 lg:rounded-[28px] lg:px-10 lg:py-10 2xl:mx-14">
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true">
          <path className="lp-draw" pathLength={1} d="M520 -10 C 560 160, 700 300, 1010 330" fill="none" stroke="#0f3d2e" strokeOpacity="0.35" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="relative grid gap-8 xl:grid-cols-[1fr_auto] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[16px] text-ink">{greeting(d.asOf)}, revenue office.</p>
              <span className="inline-flex items-center gap-2 rounded-full bg-paper px-2.5 py-1 text-[12px] font-medium text-ink-2">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-go opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-go" />
                </span>
                Live at <span className="tnum">{time(d.asOf)}</span>
              </span>
            </div>
            <h1 key={flash} className={`mt-5 max-w-[15ch] text-[44px] font-medium leading-[0.98] tracking-[-0.055em] sm:text-[60px] ${flash ? "animate-flash" : ""}`}>
              <span className="tnum">{naira(today ? d.collected.day : d.collected.month)}</span> collected {today ? "today" : "this month"}
            </h1>
            <p className="mt-4 max-w-xl text-[16px] text-ink-2">
              {d.paymentsDay} {d.paymentsDay === 1 ? "payment" : "payments"} today, bank fees {naira(d.feesDay)}.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link href="/admin/reconciliation" className={buttonClass("primary", "lg", "pr-5")}>
                Reconcile with the bank
                <Icon name="arrowUpRight" size={15} stroke={2.4} />
              </Link>
              <Link href="/admin/fraud" className={buttonClass("outline", "lg")}>
                Review flags
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:w-[620px]">
            <HeroTile n="01" label="This week" value={naira(d.collected.week)} tone="cream" art={<IlloCoins className="h-[96px] w-auto" />} />
            <HeroTile n="02" label="Traders paid today" value={`${rate}%`} sub={`${totalPaid} of ${totalTraders}`} tone="lime" art={<IlloStall className="h-[96px] w-auto" />} />
            <HeroTile n="03" label="Officer scans today" value={String(d.open.scansToday)} tone="forest" art={<IlloBadge className="h-[96px] w-auto" />} />
          </div>
        </div>
      </section>

      {/* Main column and right rail */}
      <div className="mt-10 grid lg:grid-cols-[1fr_340px] 2xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 border-t border-line px-4 sm:px-6 lg:pl-10 lg:pr-10 2xl:pl-14">
          <section className="py-9">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-[14px] text-ink-2">Last 14 days, Lagos time</p>
                <h2 className="mt-1 text-[28px] font-medium tracking-[-0.045em]">Collections</h2>
              </div>
              <p className="text-[14px] text-ink-2">
                This month <span className="font-semibold text-ink tnum">{naira(d.collected.month)}</span>
              </p>
            </div>
            <div className="mt-7">
              <Chart days={d.days} />
            </div>
          </section>

          <section className="border-t border-line py-9">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[28px] font-medium tracking-[-0.045em]">Latest confirmed payments</h2>
              <span className="text-[14px] text-ink-2">Verified with the bank</span>
            </div>
            <ol className="mt-6 flex flex-col">
              {d.recent.map((p, i) => (
                <li key={p.id} className="animate-fadein grid grid-cols-[48px_1fr_auto] items-center gap-4 py-2.5 sm:grid-cols-[48px_1fr_1fr_auto]">
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-line bg-paper text-forest">
                    <Icon name={channelIcon(p.channel)} size={18} />
                    {i < d.recent.length - 1 ? <span className="absolute left-1/2 top-full h-5 w-[1.5px] -translate-x-1/2 bg-ink/25" aria-hidden="true" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[16px] font-medium tracking-[-0.02em]">
                      <span className="truncate">{p.name}</span>
                      {p.flagged ? <Tag tone="warn">Flagged</Tag> : null}
                    </span>
                    <span className="text-[13px] text-ink-2">
                      {channelLabel(p.channel)}, <span className="tnum">{time(p.at)}</span>
                    </span>
                  </span>
                  <span className="hidden text-[13px] text-ink-2 sm:block">
                    {p.receipt ? (
                      <a className="font-mono text-ink hover:underline" href={`/r/${p.receipt}`}>
                        {p.receipt}
                      </a>
                    ) : null}
                    <span className="block">bank fee {naira(p.feeKobo)}</span>
                  </span>
                  <span className="text-right text-[17px] font-semibold tracking-[-0.02em] tnum">{naira(p.amountKobo)}</span>
                </li>
              ))}
              {d.recent.length === 0 ? <li className="rounded-[var(--radius-card)] border border-dashed border-line-2 p-6 text-[15px] text-ink-2">No confirmed payments yet.</li> : null}
            </ol>
          </section>
        </div>

        <aside className="border-t border-line px-4 py-9 sm:px-6 lg:border-l lg:px-8">
          <h2 className="text-[28px] font-medium tracking-[-0.045em]">Needs attention</h2>
          <div className="mt-6 flex flex-col gap-2.5">
            <RailCard href="/admin/fraud" title="Open fraud flags" value={d.open.flags} tag={<Tag tone={d.open.flags ? "warn" : "paid"}>{d.open.flags ? "Review" : "Clear"}</Tag>} />
            <RailCard href="/admin/fraud" title="Open complaints" value={d.open.complaints} tag={<Tag tone={d.open.complaints ? "warn" : "paid"}>{d.open.complaints ? "Waiting" : "Clear"}</Tag>} />
            <RailCard href="/admin/fraud" title="Money to review" value={d.open.review} tag={<Tag tone={d.open.review ? "unpaid" : "paid"}>{d.open.review ? "Unmatched" : "All matched"}</Tag>} />
          </div>

          <h3 className="mt-10 text-[15px] text-ink-2">Compliance today</h3>
          <div className="mt-3 flex flex-col gap-2.5">
            {d.compliance.map((c) => (
              <div key={c.market} className="rounded-[var(--radius-card)] bg-mist-2 p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[16px] font-medium tracking-[-0.02em]">{c.market}</span>
                  <span className="text-[15px] font-semibold tnum">{Math.round(c.rate * 100)}%</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuenow={Math.round(c.rate * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.market} compliance`}>
                  <div className="h-full rounded-full bg-forest transition-all duration-700" style={{ width: `${Math.round(c.rate * 100)}%` }} />
                </div>
                <p className="mt-2 text-[13px] text-ink-2">
                  {c.paid} of {c.traders} traders paid
                </p>
              </div>
            ))}
            {d.compliance.length === 0 ? <p className="text-[14px] text-ink-2">No active traders yet.</p> : null}
          </div>

          <h3 className="mt-10 text-[15px] text-ink-2">Revenue by levy, today</h3>
          <dl className="mt-3 rounded-[var(--radius-card)] bg-mist-2 px-5">
            {d.byLevy.map((l) => (
              <div key={l.levy} className="flex justify-between gap-3 border-b border-line py-3.5 text-[15px] last:border-0">
                <dt>{l.levy}</dt>
                <dd className="font-semibold tnum">{naira(l.kobo)}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}

const tileTone = {
  cream: "bg-cream text-ink",
  lime: "bg-lime text-ink",
  forest: "bg-forest text-white",
};

function HeroTile({ n, label, value, sub, tone, art }: { n: string; label: string; value: string; sub?: string; tone: keyof typeof tileTone; art: ReactNode }) {
  return (
    <div className={`relative flex min-h-[132px] min-w-0 flex-col overflow-hidden rounded-[20px] p-4 sm:min-h-[230px] ${tileTone[tone]}`}>
      <span className="text-[14px] font-medium">{n}</span>
      <span className="mt-3 text-[15px] font-medium leading-tight tracking-[-0.02em]">{label}</span>
      <span className="money mt-1 text-[26px] leading-none sm:truncate">{value}</span>
      {sub ? <span className={`mt-1 text-[12px] ${tone === "forest" ? "text-white/70" : "text-ink/65"}`}>{sub}</span> : null}
      <span className="absolute bottom-0 right-3 sm:static sm:-mb-2 sm:mt-auto sm:flex sm:justify-end">{art}</span>
    </div>
  );
}

function RailCard({ href, title, value, tag }: { href: string; title: string; value: number; tag: ReactNode }) {
  return (
    <Link href={href} className="group flex items-center justify-between gap-4 rounded-[var(--radius-card)] bg-mist-2 p-5 hover:bg-fill-2">
      <span>
        <span className="block text-[16px] font-medium tracking-[-0.02em]">{title}</span>
        <span className="mt-2 block">{tag}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-[34px] font-medium leading-none tracking-[-0.05em] tnum">{value}</span>
        <Icon name="arrowUpRight" size={14} stroke={2.2} className="text-ink-2 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/** Single-series bars: one hue, today emphasised, recessive grid, hover value, table for screen readers. */
function Chart({ days }: { days: Summary["days"] }) {
  const max = Math.max(...days.map((x) => x.kobo), 1);
  const ticks = [1, 0.5, 0];
  return (
    <figure>
      <div className="flex gap-3">
        <div className="flex h-56 flex-col justify-between text-right text-[11px] text-ink-3 tnum" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {nairaShort(max * t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} className={`border-t ${t === 0 ? "border-ink/40" : "border-dashed border-line-2"}`} />
            ))}
          </div>
          <div className="relative flex h-56 items-end gap-1 sm:gap-2" role="img" aria-label="Daily collections for the last 14 days">
            {days.map((x, i) => {
              const isToday = i === days.length - 1;
              return (
                <div key={x.date} className="group relative flex h-full flex-1 items-end">
                  <div className={`w-full rounded-t-[4px] transition-colors ${isToday ? "bg-forest" : "bg-forest/20 group-hover:bg-forest/35"}`} style={{ height: `${Math.max(1.5, (x.kobo / max) * 100)}%` }} />
                  <span className={`pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 ${i < days.length / 2 ? "left-0" : "right-0"}`}>
                    {dayLabel(x.date)}: {naira(x.kobo)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1 text-center text-[11px] text-ink-3 sm:gap-2" aria-hidden="true">
            {days.map((x, i) => (
              <span key={x.date} className={`flex-1 tnum ${i === days.length - 1 ? "font-semibold text-ink" : ""}`}>
                {i === days.length - 1 ? "Today" : i % 2 === 1 ? "" : x.date.slice(8)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>Daily collections</caption>
        <tbody>
          {days.map((x) => (
            <tr key={x.date}>
              <th>{x.date}</th>
              <td>{naira(x.kobo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
