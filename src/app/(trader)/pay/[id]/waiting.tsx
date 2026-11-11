"use client";

import { useEffect, useState } from "react";
import { StatusPanel, buttonClass } from "@/app/_ui/kit";

type Status = { status: string; settled: boolean; receipt: string | null };

export function Waiting({ id, startedAt }: { id: string; startedAt: number }) {
  const [s, setS] = useState<Status | null>(null);
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      const res = await fetch(`/api/payments/${id}`, { cache: "no-store" });
      if (res.ok && !stop) setS(await res.json());
    };
    void poll();
    const a = setInterval(poll, 1200);
    const b = setInterval(() => setNow(Date.now()), 250);
    return () => {
      stop = true;
      clearInterval(a);
      clearInterval(b);
    };
  }, [id]);

  if (s?.settled && s.receipt) {
    return (
      <StatusPanel tone="paid" word="Paid" sub="Confirmed with the bank. Your receipt is on its way by SMS.">
        <a href={`/r/${s.receipt}`} className="rounded-full bg-white/15 px-3.5 py-1 font-mono text-[15px] font-semibold hover:bg-white/25">
          {s.receipt}
        </a>
        <a href="/pass" className={buttonClass("accent", "lg", "mt-3")}>
          Back to my pass
        </a>
      </StatusPanel>
    );
  }
  const secs = Math.max(0, Math.round((now - startedAt) / 1000));
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-warn-bg px-4 py-3.5 text-warn-fg" role="status">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-warn-fg/30 border-t-warn-fg" aria-hidden="true" />
      <span className="text-[15px] font-semibold">Waiting for the bank to confirm</span>
      <span className="ml-auto font-mono text-[13px] tnum">{secs}s</span>
    </div>
  );
}
