"use client";

import { useEffect, useRef, useState } from "react";
import type { Summary } from "@/server/admin/summary";

const naira = (k: number) => `₦${(k / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nairaShort = (k: number) => (k >= 100_000_00 ? `₦${(k / 100_000_00).toFixed(1)}m` : k >= 1_000_00 ? `₦${(k / 1_000_00).toFixed(1)}k` : `₦${(k / 100).toFixed(0)}`);
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Tile({ label, value, sub, flash }: { label: string; value: string; sub?: string; flash?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm transition ${flash ? "border-brand-500 ring-4 ring-brand-100" : "border-slate-200"}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums text-ink">{value}</p>
      {sub ? <p className="mt-1 text-sm text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function LiveDashboard({ initial }: { initial: Summary }) {
  const [d, setD] = useState(initial);
  const [flash, setFlash] = useState(false);
  const last = useRef(initial.collected.day);
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch("/api/admin/summary", { cache: "no-store" });
      if (!r.ok) return;
      const next = (await r.json()) as Summary;
      if (next.collected.day !== last.current) {
        last.current = next.collected.day;
        setFlash(true);
        setTimeout(() => setFlash(false), 1500);
      }
      setD(next);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const max = Math.max(...d.days.map((x) => x.kobo), 1);
  const totalTraders = d.compliance.reduce((x, c) => x + c.traders, 0);
  const totalPaid = d.compliance.reduce((x, c) => x + c.paid, 0);
  const rate = totalTraders ? Math.round((totalPaid / totalTraders) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Collections dashboard</h1>
          <p className="text-slate-500">Recomputed from the append-only ledger. Updates every 3 seconds.</p>
        </div>
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-800">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-600" />
          </span>
          LIVE · {time(d.asOf)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Collected today" value={naira(d.collected.day)} sub={`${d.paymentsDay} payments · fees ${naira(d.feesDay)}`} flash={flash} />
        <Tile label="This week" value={naira(d.collected.week)} />
        <Tile label="This month" value={naira(d.collected.month)} />
        <Tile label="Paid today" value={`${rate}%`} sub={`${totalPaid} of ${totalTraders} traders`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <p className="font-bold">Collections, last 14 days</p>
          <div className="mt-4 flex h-48 items-end gap-1.5" role="img" aria-label="Daily collections for the last 14 days">
            {d.days.map((x, i) => (
              <div key={x.date} className="group flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100">{nairaShort(x.kobo)}</span>
                <div className={`w-full rounded-t-md ${i === d.days.length - 1 ? "bg-brand-600" : "bg-brand-100"}`} style={{ height: `${Math.max(2, (x.kobo / max) * 160)}px` }} />
                <span className="text-[10px] text-slate-400">{x.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-bold">Compliance today</p>
            {d.compliance.map((c) => (
              <div key={c.market} className="mt-3">
                <div className="flex justify-between text-sm">
                  <span>{c.market}</span>
                  <span className="font-semibold tabular-nums">{Math.round(c.rate * 100)}%</span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-600 transition-all duration-700" style={{ width: `${Math.round(c.rate * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-bold">Revenue by levy, today</p>
            {d.byLevy.map((l) => (
              <p key={l.levy} className="mt-2 flex justify-between text-sm">
                <span>{l.levy}</span>
                <span className="font-semibold tabular-nums">{naira(l.kobo)}</span>
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <p className="font-bold">Latest confirmed payments</p>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1 font-medium">Time</th>
                <th className="font-medium">Trader</th>
                <th className="font-medium">Channel</th>
                <th className="text-right font-medium">Amount</th>
                <th className="text-right font-medium">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {d.recent.map((p) => (
                <tr key={p.id} className="animate-fadein border-t border-slate-100">
                  <td className="py-2 tabular-nums text-slate-500">{time(p.at)}</td>
                  <td className="font-medium">
                    {p.name} {p.flagged ? <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs font-bold text-amber-900">! flagged</span> : null}
                  </td>
                  <td className="capitalize text-slate-600">{p.channel.replace("_", " ")}</td>
                  <td className="text-right font-semibold tabular-nums">{naira(p.amountKobo)}</td>
                  <td className="text-right">
                    {p.receipt ? (
                      <a className="font-mono text-xs text-brand-800" href={`/r/${p.receipt}`}>
                        {p.receipt}
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <a href="/admin/fraud" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-900">! Open fraud flags</p>
            <p className="text-3xl font-extrabold text-amber-950">{d.open.flags}</p>
          </a>
          <a href="/admin/fraud" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Complaints · review queue</p>
            <p className="text-3xl font-extrabold">
              {d.open.complaints} · {d.open.review}
            </p>
          </a>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Officer scans today</p>
            <p className="text-3xl font-extrabold">{d.open.scansToday}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
