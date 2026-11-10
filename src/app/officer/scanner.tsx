"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Result = {
  result: "paid" | "not_paid" | "unknown_trader" | "invalid_token" | "officer_suspended" | "login_required";
  ms?: number;
  trader?: { id: string; name: string; stall: string; market: string; business: string };
  date?: string;
  levies?: { levy: string; status: string }[];
  owedKobo?: number;
  payCode?: string;
};

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

const naira = (k: number) => `₦${(k / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

export function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"off" | "on" | "unsupported" | "denied">("off");
  const [result, setResult] = useState<Result | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const geo = useRef<{ lat: number; lng: number; acc: number } | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => (geo.current = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const check = useCallback(async (params: Record<string, string>, t0: number) => {
    setBusy(true);
    const q = new URLSearchParams(params);
    if (geo.current) {
      q.set("lat", String(geo.current.lat));
      q.set("lng", String(geo.current.lng));
      q.set("acc", String(Math.round(geo.current.acc)));
    }
    const res = await fetch(`/api/verify/trader?${q}`, { cache: "no-store" });
    const body = (await res.json()) as Result;
    setResult(body);
    setElapsed(performance.now() - t0);
    setBusy(false);
    if (navigator.vibrate) navigator.vibrate(body.result === "paid" ? 80 : [80, 60, 80]);
  }, []);

  const start = useCallback(async () => {
    if (!window.BarcodeDetector) return setCamera("unsupported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (!video.current) return;
      video.current.srcObject = stream;
      await video.current.play();
      setCamera("on");
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const loop = async () => {
        if (!video.current?.srcObject) return;
        if (!lock.current && video.current.readyState >= 2) {
          const t0 = performance.now();
          const codes = await detector.detect(video.current).catch(() => []);
          if (codes[0]?.rawValue) {
            lock.current = true;
            await check({ token: codes[0].rawValue }, t0);
          }
        }
        setTimeout(loop, 200);
      };
      void loop();
    } catch {
      setCamera("denied");
    }
  }, [check]);

  useEffect(() => {
    const v = video.current;
    return () => (v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
  }, []);

  const next = () => {
    setResult(null);
    lock.current = false;
  };

  if (result) {
    const paid = result.result === "paid";
    const unpaid = result.result === "not_paid";
    const bg = paid ? "bg-brand-700" : unpaid ? "bg-red-600" : "bg-slate-800";
    const word = paid ? "PAID" : unpaid ? "NOT PAID" : result.result === "officer_suspended" ? "YOUR ID IS SUSPENDED" : result.result === "invalid_token" ? "FAKE OR OLD QR" : "UNKNOWN TRADER";
    return (
      <button onClick={next} className={`animate-fadein fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6 text-center text-white ${bg}`}>
        <div className="animate-pop flex h-28 w-28 items-center justify-center rounded-full bg-white text-6xl font-black" style={{ color: paid ? "#027a48" : unpaid ? "#dc2626" : "#1e293b" }} aria-hidden="true">
          {paid ? "✔" : unpaid ? "✖" : "!"}
        </div>
        <p className="text-5xl font-black tracking-tight">{word}</p>
        {result.trader ? (
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold">{result.trader.name}</p>
            <p className="text-lg opacity-90">
              Stall {result.trader.stall} · {result.trader.market}
            </p>
            <p className="opacity-80">Today, {result.date}</p>
            {unpaid && result.owedKobo ? (
              <p className="mt-3 rounded-xl bg-white/15 px-4 py-3 text-lg">
                Owes <b>{naira(result.owedKobo)}</b>. Pay now: dial <b className="font-mono">{result.payCode}</b>
              </p>
            ) : null}
          </div>
        ) : null}
        {elapsed !== null ? <p className="mt-2 text-sm opacity-75">Checked in {(elapsed / 1000).toFixed(2)} s</p> : null}
        <p className="mt-6 rounded-full bg-white/20 px-5 py-2 font-semibold">Tap to scan the next trader</p>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-900">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        {camera !== "on" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            {camera === "unsupported" ? <p>This browser cannot scan. Use the trader ID or stall number below.</p> : null}
            {camera === "denied" ? <p>Camera blocked. Allow the camera, or type the ID below.</p> : null}
            <button onClick={() => void start()} className="rounded-xl bg-brand-600 px-6 py-3 text-lg font-bold">
              Start scanning
            </button>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-10 rounded-2xl border-4 border-white/80" aria-hidden="true" />
        )}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) void check({ id: manual.trim() }, performance.now());
        }}
      >
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Trader ID or stall (E-07)" className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-4" aria-label="Trader ID or stall number" />
        <button disabled={busy} className="rounded-xl bg-ink px-5 font-semibold text-white">
          Check
        </button>
      </form>
    </div>
  );
}
