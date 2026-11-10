"use client";

import { useEffect, useState } from "react";
import type { Run } from "@/server/admin/failures";
import { runFailure } from "../../actions";

const scenarios = [
  ["withheld", "Withheld webhook", "The bank takes the money but its webhook never arrives."],
  ["replayed", "Replayed webhook", "The bank delivers the same event twice."],
  ["forged", "Forged signature", "An attacker posts a fake payment webhook."],
  ["double", "Paid twice for one day", "A trader is charged again for a day already paid."],
] as const;

function Settled({ id }: { id: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(async () => {
      setSecs(Math.round((Date.now() - started) / 1000));
      const r = await fetch(`/api/admin/payment/${id}`, { cache: "no-store" });
      const p = (await r.json()) as { settledAt: string | null } | null;
      if (p?.settledAt) {
        setDone(p.settledAt);
        clearInterval(t);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [id]);
  return done ? (
    <li className="animate-pop flex gap-2 font-semibold text-brand-800">
      <span aria-hidden="true">✔</span> LevyPass: the poller asked the bank, verified the payment and settled it after {secs} s. No webhook needed.
    </li>
  ) : (
    <li className="flex gap-2 text-amber-800">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" aria-hidden="true" /> Waiting for the safety net... {secs} s
    </li>
  );
}

export function Drills() {
  const [runs, setRuns] = useState<Record<string, Run | "running">>({});
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {scenarios.map(([key, title, blurb]) => {
        const run = runs[key];
        return (
          <div key={key} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-lg font-bold">{title}</p>
              <p className="text-sm text-slate-500">{blurb}</p>
            </div>
            <button
              disabled={run === "running"}
              onClick={async () => {
                setRuns((r) => ({ ...r, [key]: "running" }));
                const result = await runFailure(key);
                setRuns((r) => ({ ...r, [key]: result }));
              }}
              className="min-h-11 rounded-xl bg-ink font-semibold text-white disabled:opacity-60"
            >
              {run === "running" ? "Running..." : "Run it live"}
            </button>
            {run && run !== "running" ? (
              <ol className="flex flex-col gap-2 text-sm">
                {run.steps.map((s, i) => (
                  <li key={i} className="animate-fadein flex gap-2" style={{ animationDelay: `${i * 150}ms` }}>
                    <span className={`shrink-0 rounded px-1.5 text-xs font-bold uppercase ${s.who === "bank" ? "bg-slate-200 text-slate-800" : s.who === "levypass" ? "bg-brand-100 text-brand-900" : "bg-amber-100 text-amber-900"}`}>{s.who}</span>
                    <span>
                      {s.ok === true ? "✔ " : s.ok === false ? "✖ " : ""}
                      {s.text}
                    </span>
                  </li>
                ))}
                {run.scenario === "withheld" && run.paymentId ? <Settled id={run.paymentId} /> : null}
              </ol>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
