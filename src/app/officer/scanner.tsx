"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, buttonClass } from "@/app/_ui/kit";
import { SearchReveal, useSearchReveal, type RevealTiming } from "@/app/_ui/search-reveal";

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

/** Typed lookups get the lens; camera scans skip it, since an officer at a gate needs speed. */
const OFFICER_TIMING: RevealTiming = { search: 600, mark: 400, timeout: 1200 };

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
  const reveal = useSearchReveal(OFFICER_TIMING);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => (geo.current = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const check = useCallback(
    async (params: Record<string, string>, t0: number, withReveal = false) => {
      setBusy(true);
      const q = new URLSearchParams(params);
      if (geo.current) {
        q.set("lat", String(geo.current.lat));
        q.set("lng", String(geo.current.lng));
        q.set("acc", String(Math.round(geo.current.acc)));
      }
      const lookup = async () => {
        const res = await fetch(`/api/verify/trader?${q}`, { cache: "no-store" });
        const body = (await res.json()) as Result;
        setElapsed(performance.now() - t0); // the real check time, not the animation
        return body;
      };
      const show = (body: Result | null) => {
        setResult(body ?? { result: "unknown_trader" });
        setBusy(false);
        reveal.reset();
        if (body && navigator.vibrate) navigator.vibrate(body.result === "paid" ? 80 : [80, 60, 80]);
      };
      if (!withReveal) return show(await lookup().catch(() => null));
      await reveal.run(lookup, (b) => (b.result === "paid" ? true : b.result === "not_paid" ? false : null), show);
    },
    [reveal],
  );

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
    const bg = paid ? "bg-go" : unpaid ? "bg-stop" : "bg-night";
    const word = paid ? "PAID" : unpaid ? "NOT PAID" : result.result === "officer_suspended" ? "YOUR ID IS SUSPENDED" : result.result === "invalid_token" ? "FAKE OR OLD QR" : "UNKNOWN TRADER";
    return (
      <button onClick={next} className={`animate-fadein fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-6 text-center text-white ${bg}`}>
        <span className={`animate-pop flex h-28 w-28 items-center justify-center rounded-full ${paid ? "bg-white text-go" : unpaid ? "bg-white text-stop" : "bg-warn text-night"}`}>
          <Icon name={paid ? "check" : unpaid ? "x" : "alert"} size={60} stroke={3} />
        </span>
        <p className="display text-[56px] leading-none sm:text-[72px]">{word}</p>
        {result.trader ? (
          <div className="flex flex-col gap-1">
            <p className="text-[24px] font-bold tracking-[-0.02em]">{result.trader.name}</p>
            <p className="text-[17px] text-white/85">
              Stall {result.trader.stall}, {result.trader.market}
            </p>
            <p className="text-white/70">Today, {result.date}</p>
            {unpaid && result.owedKobo ? (
              <p className="mt-4 rounded-2xl bg-white/15 px-5 py-3.5 text-[17px]">
                Owes <b className="tnum">{naira(result.owedKobo)}</b>. Pay now: dial <b className="font-mono">{result.payCode}</b>
              </p>
            ) : null}
          </div>
        ) : null}
        {elapsed !== null ? (
          <p className="inline-flex items-center gap-1.5 text-[14px] text-white/75">
            <Icon name="clock" size={15} />
            Checked in {(elapsed / 1000).toFixed(2)} s
          </p>
        ) : null}
        <p className="mt-6 rounded-full bg-white/15 px-6 py-3 font-semibold">Tap to scan the next trader</p>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square overflow-hidden rounded-[28px] bg-night">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-[18%]" aria-hidden="true">
          {["left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-2xl", "right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-2xl", "left-0 bottom-0 border-l-[3px] border-b-[3px] rounded-bl-2xl", "right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-2xl"].map((c) => (
            <span key={c} className={`absolute h-10 w-10 border-lime ${c}`} />
          ))}
        </div>
        {camera !== "on" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center text-white">
            <Icon name="scan" size={36} className="text-white/60" />
            {camera === "unsupported" ? <p className="text-[15px] text-white/80">This browser cannot scan. Use the trader ID or stall number below.</p> : null}
            {camera === "denied" ? <p className="text-[15px] text-white/80">Camera blocked. Allow the camera, or type the ID below.</p> : null}
            <button onClick={() => void start()} className={buttonClass("accent", "lg")}>
              Start scanning
            </button>
          </div>
        ) : null}
      </div>
      <form
        className="flex gap-2 rounded-full border border-line-2 bg-paper p-1.5 pl-5 focus-within:border-forest focus-within:ring-4 focus-within:ring-forest/10"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) void check({ id: manual.trim() }, performance.now(), true);
        }}
      >
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Trader ID or stall (E-07)" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3/70" aria-label="Trader ID or stall number" />
        <button disabled={busy} className={buttonClass("primary", "md")}>
          {busy ? "Checking" : "Check"}
        </button>
      </form>
      <SearchReveal phase={reveal.phase} searching="Looking up the trader" found="Paid" missing="Not paid" />
    </div>
  );
}
