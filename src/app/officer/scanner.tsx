"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, buttonClass } from "@/app/_ui/kit";
import { SearchReveal, useSearchReveal, type RevealTiming } from "@/app/_ui/search-reveal";
import { cashAheadOptionsAction, collectCashAction, startCashAction } from "./actions";

type Result = {
  result: "paid" | "not_paid" | "unknown_trader" | "invalid_token" | "officer_suspended" | "login_required";
  scanId?: string;
  cancelled?: boolean;
  cancelledName?: string;
  cancelledStall?: string;
  ms?: number;
  trader?: { id: string; name: string; stall: string; market: string; business: string };
  date?: string;
  levies?: { levy: string; status: string }[];
  owedKobo?: number;
  payCode?: string;
  cashAsk?: { requestedAt: string };
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

type Pick = { amountKobo: number; days?: number; throughEnd?: string };
type AheadOption = { days: number; amountKobo: number; throughEnd: string };
type Cash =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "choose"; options: AheadOption[] }
  | { phase: "starting"; pick: Pick }
  // `sent`: LevyPass just sent the code to the trader by SMS; otherwise the trader asked and it is on their screen.
  | { phase: "code"; pick: Pick; sent: boolean; code: string; error?: string }
  | { phase: "busy"; pick: Pick; sent: boolean; code: string }
  | { phase: "done"; receipt: string; pick: Pick }
  | { phase: "error"; message: string };

/** "19 Nov": the last Lagos day a pay-ahead covers (`throughEnd` is the exclusive end of that day). */
const lastDay = (throughEnd: string) => new Date(new Date(throughEnd).getTime() - 1).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short" });

const lagosTime = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });

export function Scanner({ floatKobo: initialFloat }: { floatKobo: number }) {
  const [floatKobo, setFloatKobo] = useState(initialFloat);
  const [cash, setCash] = useState<Cash>({ phase: "idle" });
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"off" | "on" | "unsupported" | "denied">("off");
  const [result, setResult] = useState<Result | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const geo = useRef<{ lat: number; lng: number; acc: number } | null>(null);
  const lock = useRef(false);
  // The QR just shown stays in front of the lens for a moment after the officer taps on.
  // Do not read it straight back: ignore that same code for a few seconds.
  const last = useRef<{ code: string; until: number }>({ code: "", until: 0 });
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
        lock.current = true; // a typed lookup also pauses the camera until the officer taps on
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
      // If the phone takes the camera away (another app, a call), show the start button again.
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", () => setCamera("off")));
      await video.current.play();
      setCamera("on");
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const loop = async () => {
        if (!video.current?.srcObject) return;
        if (!lock.current && video.current.readyState >= 2) {
          const t0 = performance.now();
          const codes = await detector.detect(video.current).catch(() => []);
          const code = codes[0]?.rawValue;
          if (code && !(code === last.current.code && Date.now() < last.current.until)) {
            lock.current = true;
            last.current = { code, until: Number.POSITIVE_INFINITY }; // held until the officer taps on
            await check({ token: code }, t0);
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
    setCash({ phase: "idle" });
    last.current = { ...last.current, until: Date.now() + 3000 };
    lock.current = false;
  };

  // The result covers the screen but the scanner underneath stays mounted. It used to be replaced by
  // the result, which threw away the <video> and its camera stream: after "tap to scan the next
  // trader" the square was black, with no camera and no button, until the page was reloaded.
  let overlay: ReactNode = null;
  if (result) {
    const cashDone = cash.phase === "done";
    const paid = result.result === "paid" || cashDone;
    const unpaid = result.result === "not_paid" && !cashDone;
    const canCash = unpaid && Boolean(result.owedKobo && result.scanId);
    // A trader who is paid up today can still hand over cash for tomorrow or the coming week.
    const canAhead = result.result === "paid" && !cashDone && Boolean(result.scanId);
    // Step one: make sure the trader holds a cash code. Only the officer they tell it to can record the cash.
    const beginCash = async (pick: Pick) => {
      setCash({ phase: "starting", pick });
      const r = await startCashAction(result.scanId!, pick.amountKobo, pick.days).catch(() => ({ ok: false as const, error: "No network. Do not take the money yet. Try again." }));
      if (r.ok) setCash({ phase: "code", pick: { ...pick, amountKobo: r.amountKobo }, sent: r.sent, code: "" });
      else setCash({ phase: "error", message: r.error });
    };
    // Step two: the cash and the code, together.
    const takeCash = async (pick: Pick, sent: boolean, code: string) => {
      setCash({ phase: "busy", pick, sent, code });
      const r = await collectCashAction(result.scanId!, pick.amountKobo, code, pick.days).catch(() => ({ ok: false as const, error: "No network. Do not take the money yet. Try again." }));
      if (r.ok) {
        setFloatKobo(r.balanceKobo);
        setCash({ phase: "done", receipt: r.receiptNumber, pick: { ...pick, amountKobo: r.amountKobo } });
        if (navigator.vibrate) navigator.vibrate(80);
      } else setCash({ phase: "code", pick, sent, code: "", error: r.error });
    };
    const loadAhead = async () => {
      setCash({ phase: "loading" });
      const r = await cashAheadOptionsAction(result.scanId!).catch(() => ({ ok: false as const, error: "No network. Try again." }));
      if (!r.ok) return setCash({ phase: "error", message: r.error });
      if (r.options.length === 0) return setCash({ phase: "error", message: "This trader has already paid ahead for the coming week." });
      setCash({ phase: "choose", options: r.options });
    };
    const bg = paid ? "bg-go" : unpaid ? "bg-stop" : "bg-night";
    const word = cashDone ? "PAID IN CASH" : paid ? "PAID" : unpaid ? "NOT PAID" : result.result === "officer_suspended" ? "YOUR ID IS SUSPENDED" : result.result === "invalid_token" ? (result.cancelled ? "CANCELLED CARD" : "FAKE OR OLD QR") : "UNKNOWN TRADER";
    // A tap anywhere moves on, except while a cash levy is still possible: a stray tap there would
    // throw the scan away and the officer would have to scan the trader again to take the cash.
    const tapAway = (cash.phase === "idle" && !canCash) || cash.phase === "done";
    overlay = (
      <div role="dialog" aria-modal="true" aria-live="assertive" aria-label={word} onClick={tapAway ? next : undefined} className={`animate-fadein fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-8 text-center text-white ${bg}`}>
        <span className={`animate-pop flex h-28 w-28 items-center justify-center rounded-full ${paid ? "bg-white text-go" : unpaid ? "bg-white text-stop" : "bg-warn text-night"}`}>
          <Icon name={paid ? "check" : unpaid ? "x" : "alert"} size={60} />
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
              result.cashAsk ? (
                <p className="mt-4 rounded-2xl bg-white px-5 py-3.5 text-[17px] text-ink">
                  <Icon name="clock" size={18} className="-mt-0.5 mr-1.5 inline text-warn-fg" />
                  Asked in the app at {lagosTime(result.cashAsk.requestedAt)} to pay <b className="tnum">{naira(result.owedKobo)}</b> cash.
                </p>
              ) : (
                <p className="mt-4 rounded-2xl bg-white/15 px-5 py-3.5 text-[17px]">
                  Owes <b className="tnum">{naira(result.owedKobo)}</b>. Pay now: dial <b className="font-mono">{result.payCode}</b>
                </p>
              )
            ) : null}
            {cashDone ? (
              <p className="mt-4 rounded-2xl bg-white/15 px-5 py-3.5 text-[17px]">
                <b className="tnum">{naira(cash.pick.amountKobo)}</b> cash recorded{cash.pick.throughEnd ? <>, paid ahead to <b className="whitespace-nowrap">{lastDay(cash.pick.throughEnd)}</b></> : null}. Receipt <b className="whitespace-nowrap font-mono">{cash.receipt}</b> is on its way to the trader by SMS, and their app asks them to confirm it.
                <span className="mt-1 block text-[14px] text-white/80">Advance left: {naira(floatKobo)}</span>
              </p>
            ) : null}
            {canCash || canAhead ? (
              <div className="mt-3 flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {cash.phase === "idle" && canCash ? (
                  <button onClick={() => void beginCash({ amountKobo: result.owedKobo! })} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-stop">
                    <Icon name="receipt" size={18} />
                    {result.cashAsk ? "Take" : "No bank? Take"} {naira(result.owedKobo!)} cash
                  </button>
                ) : null}
                {(cash.phase === "idle" || cash.phase === "loading") && canAhead ? (
                  <button disabled={cash.phase === "loading"} onClick={() => void loadAhead()} className="inline-flex min-h-11 items-center gap-2 px-3 text-[15px] font-semibold text-white/90 underline underline-offset-4 hover:text-white disabled:opacity-60">
                    <Icon name="clock" size={18} />
                    {cash.phase === "loading" ? "Working it out" : "Take cash to pay ahead"}
                  </button>
                ) : null}
                {cash.phase === "choose" ? (
                  <div className="flex w-full max-w-sm flex-col gap-2 rounded-2xl bg-white p-4 text-left text-ink">
                    <p className="text-[16px] font-semibold">Pay ahead for {result.trader?.name}</p>
                    <p className="text-[13px] text-ink-3">Includes every levy that falls due in those days.</p>
                    {cash.options.map((o) => (
                      <button key={o.days} onClick={() => void beginCash(o)} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line px-4 text-left hover:border-forest">
                        <span>
                          <span className="block font-semibold">{o.days === 1 ? "Tomorrow" : `Next ${o.days} days`}</span>
                          <span className="block text-[13px] text-ink-3">Covers to {lastDay(o.throughEnd)}</span>
                        </span>
                        <b className="tnum">{naira(o.amountKobo)}</b>
                      </button>
                    ))}
                    <button onClick={() => setCash({ phase: "idle" })} className={buttonClass("outline", "md")}>
                      Cancel
                    </button>
                  </div>
                ) : null}
                {cash.phase === "starting" ? (
                  <p className="rounded-2xl bg-white px-5 py-3 text-[15px] font-semibold text-ink" role="status">
                    Getting the trader&apos;s cash code
                  </p>
                ) : null}
                {cash.phase === "code" || cash.phase === "busy" ? (
                  <form
                    className="flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-white p-4 text-left text-ink"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (cash.phase === "code" && /^\d{4}$/.test(cash.code)) void takeCash(cash.pick, cash.sent, cash.code);
                    }}
                  >
                    <p className="text-[16px] font-semibold">
                      Take {naira(cash.pick.amountKobo)} cash from {result.trader?.name}
                      {cash.pick.throughEnd ? `, paying ahead to ${lastDay(cash.pick.throughEnd)}` : ""}
                    </p>
                    <p className="text-[14px] text-ink-2">
                      {cash.sent ? "LevyPass has sent a 4-digit cash code to the trader's phone by SMS." : "The trader asked to pay cash. Their 4-digit cash code is on their phone."} Take the cash, then type the code the trader shows you. Never accept a code from anyone else.
                    </p>
                    <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
                      Cash code from the trader&apos;s phone
                      <input
                        value={cash.code}
                        onChange={(e) => cash.phase === "code" && setCash({ ...cash, code: e.target.value.replace(/\D/g, "").slice(0, 4), error: undefined })}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={4}
                        autoFocus
                        disabled={cash.phase === "busy"}
                        aria-invalid={cash.phase === "code" && Boolean(cash.error)}
                        className="rounded-xl border border-line-2 px-4 py-3 text-center font-mono text-[28px] font-bold tracking-[0.4em] outline-none focus:border-forest focus:ring-4 focus:ring-forest/10"
                      />
                    </label>
                    {cash.phase === "code" && cash.error ? (
                      <p className="flex items-start gap-2 text-[14px] font-semibold text-stop-fg" role="alert">
                        <Icon name="alert" size={17} className="mt-0.5 shrink-0" />
                        {cash.error}
                      </p>
                    ) : null}
                    <p className="text-[13px] text-ink-3">Paid from your advance ({naira(floatKobo)} left). The trader gets an SMS receipt with your staff ID.</p>
                    <div className="flex gap-2">
                      <button type="submit" disabled={cash.phase === "busy" || !/^\d{4}$/.test(cash.code)} className={buttonClass("primary", "md", "flex-1")}>
                        {cash.phase === "busy" ? "Recording" : "I have the cash"}
                      </button>
                      <button type="button" disabled={cash.phase === "busy"} onClick={() => setCash({ phase: "idle" })} className={buttonClass("outline", "md")}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
                {cash.phase === "error" ? (
                  <div className="flex max-w-sm flex-col gap-3 rounded-2xl bg-white p-4 text-left text-ink" role="alert">
                    <p className="flex items-start gap-2 text-[15px] font-semibold">
                      <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-stop" />
                      {cash.message}
                    </p>
                    <button onClick={() => setCash({ phase: "idle" })} className={buttonClass("outline", "md")}>
                      Back
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {result.cancelled ? (
          <p className="max-w-sm rounded-2xl bg-white/15 px-5 py-3.5 text-[17px]">
            This card {result.cancelledName ? `for ${result.cancelledName}, ${result.cancelledStall},` : ""} was replaced. Ask for the new card. Do not take cash against this one.
          </p>
        ) : null}
        {elapsed !== null ? (
          <p className="inline-flex items-center gap-1.5 text-[14px] text-white/75">
            <Icon name="clock" size={15} />
            Checked in {(elapsed / 1000).toFixed(2)} s
          </p>
        ) : null}
        <button onClick={next} disabled={cash.phase === "busy"} className="mt-6 rounded-full bg-white/15 px-6 py-3 font-semibold hover:bg-white/25 disabled:opacity-50">
          Scan the next trader
        </button>
      </div>
    );
  }

  return (
    <>
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
      {overlay}
    </>
  );
}
