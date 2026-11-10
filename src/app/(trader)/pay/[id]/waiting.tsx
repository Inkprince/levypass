"use client";

import { useEffect, useState } from "react";

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
      <div className="animate-fadein flex flex-col items-center gap-3 rounded-2xl bg-brand-700 p-6 text-center text-white">
        <div className="animate-pop flex h-20 w-20 items-center justify-center rounded-full bg-white text-5xl text-brand-700" aria-hidden="true">
          ✔
        </div>
        <p className="text-2xl font-extrabold">PAID</p>
        <p className="text-sm opacity-90">Confirmed with the bank. Receipt sent by SMS.</p>
        <a href={`/r/${s.receipt}`} className="rounded-lg bg-white/15 px-3 py-1 font-mono text-lg font-bold">
          {s.receipt}
        </a>
        <a href="/pass" className="mt-2 rounded-xl bg-white px-5 py-3 font-semibold text-brand-800">
          Back to my pass
        </a>
      </div>
    );
  }
  const secs = Math.max(0, Math.round((now - startedAt) / 1000));
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" aria-hidden="true" />
      <span className="font-semibold">Waiting for the bank to confirm... {secs}s</span>
    </div>
  );
}
