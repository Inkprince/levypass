"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName, PageHeader, channelLabel } from "@/app/_ui/kit";
import type { Summary } from "@/server/admin/summary";

const naira = (k: number) => `₦${(k / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nairaShort = (k: number) => (k >= 1_000_000_00 ? `₦${(k / 1_000_000_00).toFixed(1)}m` : k >= 1_000_00 ? `₦${(k / 1_000_00).toFixed(1)}k` : `₦${(k / 100).toFixed(0)}`);
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });

function Panel({ title, aside, children, className = "" }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-[var(--radius-card)] border border-line bg-paper p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Collections"
        lead="Recomputed from the append-only ledger every 3 seconds. Fees are the amounts the bank reported."
        actions={
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-ink-2">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-go opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-go" />
            </span>
            Live · <span className="tnum">{time(d.asOf)}</span>
          </p>
        }
      />

      {/* KPI band: one hero figure, three supporting ones, split by hairlines. */}
      <section className="grid overflow-hidden rounded-[var(--radius-card)] border border-line bg-line [grid-gap:1px] sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div key={flash} className={`bg-paper p-6 sm:col-span-2 xl:col-span-1 ${flash ? "animate-flash" : ""}`}>
          <p className="text-[13px] font-medium text-ink-2">Collected today</p>
          <p className="money mt-2 text-[40px] leading-none sm:text-[48px]">{naira(d.collected.day)}</p>
          <p className="mt-3 text-[13px] text-ink-3">
            {d.paymentsDay} payments · bank fees {naira(d.feesDay)}
          </p>
        </div>
        <Kpi label="This week" value={naira(d.collected.week)} />
        <Kpi label="This month" value={naira(d.collected.month)} />
        <div className="bg-paper p-6">
          <p className="text-[13px] font-medium text-ink-2">Traders paid today</p>
          <p className="money mt-2 text-[28px] leading-none">{rate}%</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mist-2" role="progressbar" aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100} aria-label="Traders paid today">
            <div className="h-full rounded-full bg-forest transition-all duration-700" style={{ width: `${rate}%` }} />
          </div>
          <p className="mt-2 text-[13px] text-ink-3">
            {totalPaid} of {totalTraders} traders
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Collections, last 14 days" aside={<span className="text-[12px] text-ink-3">Lagos days</span>} className="lg:col-span-2">
          <Chart days={d.days} />
        </Panel>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Compliance today">
            <div className="flex flex-col gap-4">
              {d.compliance.map((c) => (
                <div key={c.market}>
                  <div className="flex justify-between gap-3 text-[14px]">
                    <span className="truncate text-ink-2">{c.market}</span>
                    <span className="font-semibold tnum">{Math.round(c.rate * 100)}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist-2">
                    <div className="h-full rounded-full bg-forest transition-all duration-700" style={{ width: `${Math.round(c.rate * 100)}%` }} />
                  </div>
                </div>
              ))}
              {d.compliance.length === 0 ? <p className="text-[14px] text-ink-3">No active traders yet.</p> : null}
            </div>
          </Panel>
          <Panel title="Revenue by levy, today">
            <dl className="divide-y divide-line text-[14px]">
              {d.byLevy.map((l) => (
                <div key={l.levy} className="flex justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <dt className="text-ink-2">{l.levy}</dt>
                  <dd className="font-semibold tnum">{naira(l.kobo)}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Latest confirmed payments" className="lg:col-span-2">
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[560px] text-[14px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-ink-3">
                  <th className="py-2 pl-5 pr-4 font-medium sm:pl-6">Time</th>
                  <th className="font-medium">Trader</th>
                  <th className="font-medium">Channel</th>
                  <th className="text-right font-medium">Amount</th>
                  <th className="pr-5 text-right font-medium sm:pr-6">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map((p) => (
                  <tr key={p.id} className="animate-fadein border-b border-line last:border-0">
                    <td className="py-3 pl-5 pr-4 text-ink-3 tnum sm:pl-6">{time(p.at)}</td>
                    <td className="font-medium">
                      <span className="flex items-center gap-2">
                        {p.name}
                        {p.flagged ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-semibold text-warn-fg">
                            <Icon name="flag" size={12} stroke={2.2} />
                            Flagged
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td>
                      <span className="rounded-full bg-mist-2 px-2 py-0.5 text-[12px] font-medium text-ink-2">{channelLabel(p.channel)}</span>
                    </td>
                    <td className="text-right font-semibold tnum">{naira(p.amountKobo)}</td>
                    <td className="pr-5 text-right sm:pr-6">
                      {p.receipt ? (
                        <a className="font-mono text-[12px] text-forest hover:underline" href={`/r/${p.receipt}`}>
                          {p.receipt}
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {d.recent.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-ink-3">
                      No confirmed payments yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Needs attention">
          <ul className="-my-1 flex flex-col">
            <Attention href="/admin/fraud" icon="flag" label="Open fraud flags" value={d.open.flags} warn={d.open.flags > 0} />
            <Attention href="/admin/fraud" icon="message" label="Open complaints" value={d.open.complaints} warn={d.open.complaints > 0} />
            <Attention href="/admin/fraud" icon="scale" label="Money to review" value={d.open.review} warn={d.open.review > 0} />
            <Attention href="/admin/officers" icon="scan" label="Officer scans today" value={d.open.scansToday} />
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-6">
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      <p className="money mt-2 text-[28px] leading-none">{value}</p>
    </div>
  );
}

function Attention({ href, icon, label, value, warn = false }: { href: string; icon: IconName; label: string; value: number; warn?: boolean }) {
  return (
    <li>
      <Link href={href} className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-mist">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${warn ? "bg-warn-bg text-warn-fg" : "bg-mist-2 text-ink-2"}`}>
          <Icon name={icon} size={17} />
        </span>
        <span className="flex-1 text-[14px] text-ink-2 group-hover:text-ink">{label}</span>
        <span className="text-[18px] font-bold tracking-[-0.02em] tnum">{value}</span>
        <Icon name="chevronRight" size={16} className="text-ink-3" />
      </Link>
    </li>
  );
}

/** Single-series bars: one hue, today emphasised, recessive grid, hover value, table for screen readers. */
function Chart({ days }: { days: Summary["days"] }) {
  const max = Math.max(...days.map((x) => x.kobo), 1);
  const ticks = [1, 0.5, 0];
  return (
    <figure>
      <div className="flex gap-3">
        <div className="flex h-52 flex-col justify-between py-0 text-right text-[11px] text-ink-3 tnum" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {nairaShort(max * t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} className={`border-t ${t === 0 ? "border-line-2" : "border-dashed border-line"}`} />
            ))}
          </div>
          <div className="relative flex h-52 items-end gap-1 sm:gap-1.5" role="img" aria-label="Daily collections for the last 14 days">
            {days.map((x, i) => {
              const today = i === days.length - 1;
              return (
                <div key={x.date} className="group relative flex h-full flex-1 items-end">
                  <div className={`w-full rounded-t-[4px] transition-colors ${today ? "bg-forest" : "bg-forest/20 group-hover:bg-forest/35"}`} style={{ height: `${Math.max(1.5, (x.kobo / max) * 100)}%` }} />
                  <span className={`pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 ${i < days.length / 2 ? "left-0" : "right-0"}`}>
                    {dayLabel(x.date)} · {naira(x.kobo)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1 text-center text-[11px] text-ink-3 sm:gap-1.5" aria-hidden="true">
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
