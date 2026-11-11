"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName, buttonClass } from "@/app/_ui/kit";
import type { Run } from "@/server/admin/failures";
import { runFailure } from "../../actions";

const scenarios: readonly (readonly [string, string, string, IconName])[] = [
  ["withheld", "Withheld webhook", "The bank takes the money but its webhook never arrives.", "clock"],
  ["replayed", "Replayed webhook", "The bank delivers the same event twice.", "refresh"],
  ["forged", "Forged signature", "An attacker posts a fake payment webhook.", "lock"],
  ["double", "Paid twice for one day", "A trader is charged again for a day already paid.", "flag"],
];

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
    <li className="animate-pop flex gap-2.5 rounded-xl bg-go-bg px-3 py-2.5 font-semibold text-go-fg">
      <Icon name="check" size={16} stroke={2.6} className="mt-0.5" /> LevyPass: the poller asked the bank, verified the payment and settled it after {secs} s. No webhook needed.
    </li>
  ) : (
    <li className="flex items-center gap-2.5 rounded-xl bg-warn-bg px-3 py-2.5 text-warn-fg">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-warn-fg/30 border-t-warn-fg" aria-hidden="true" /> Waiting for the safety net... {secs} s
    </li>
  );
}

const whoStyle: Record<string, string> = {
  bank: "bg-mist-2 text-ink-2",
  levypass: "bg-forest text-lime",
};

export function Drills() {
  const [runs, setRuns] = useState<Record<string, Run | "running">>({});
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {scenarios.map(([key, title, blurb, icon]) => {
        const run = runs[key];
        return (
          <section key={key} className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-paper p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mist-2 text-forest">
                <Icon name={icon} size={20} />
              </span>
              <div>
                <p className="text-[17px] font-semibold tracking-[-0.02em]">{title}</p>
                <p className="mt-0.5 text-[14px] text-ink-2">{blurb}</p>
              </div>
            </div>
            <button
              disabled={run === "running"}
              onClick={async () => {
                setRuns((r) => ({ ...r, [key]: "running" }));
                const result = await runFailure(key);
                setRuns((r) => ({ ...r, [key]: result }));
              }}
              className={buttonClass(run && run !== "running" ? "outline" : "primary", "md", "w-full")}
            >
              {run === "running" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                  Running
                </>
              ) : run ? (
                "Run it again"
              ) : (
                "Run it live"
              )}
            </button>
            {run && run !== "running" ? (
              <ol className="flex flex-col gap-2.5 border-t border-line pt-5 text-[14px]">
                {run.steps.map((s, i) => (
                  <li key={i} className="animate-fadein flex gap-3" style={{ animationDelay: `${i * 150}ms` }}>
                    <span className={`mt-px h-fit shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${whoStyle[s.who] ?? "bg-warn-bg text-warn-fg"}`}>{s.who}</span>
                    <span className="flex gap-1.5 text-ink">
                      {s.ok === true ? <Icon name="check" size={16} stroke={2.6} className="mt-0.5 text-go" /> : s.ok === false ? <Icon name="x" size={16} stroke={2.6} className="mt-0.5 text-stop" /> : null}
                      <span>{s.text}</span>
                    </span>
                  </li>
                ))}
                {run.scenario === "withheld" && run.paymentId ? <Settled id={run.paymentId} /> : null}
              </ol>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
