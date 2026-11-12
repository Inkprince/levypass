"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { formatNaira } from "@/core/money";
import { BankStamp } from "@/app/_ui/illustrations";
import { Icon, type IconName, buttonClass, channelLabel } from "@/app/_ui/kit";

/**
 * A real, settled payment from our own ledger, anonymised on the server before it reaches the browser:
 * no trader name, no receipt number and no payment ID. Fees are what the bank reported.
 */
export type HeroPayment = { key: string; channel: string; at: string; amountKobo: number; feeKobo: number };

/** The shape of a receipt number, with every character hidden: a real one would open that trader's receipt. */
const MASKED_RECEIPT = "LP-••••-•••••";

const STEP_MS = 4200;
const lagosTime = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });
const lagosDay = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short" });

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** Tweens a whole-kobo amount towards its target. The settled value is always exact. */
function useTween(target: number, duration = 700, from?: number) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(from ?? target);
  const current = useRef(from ?? target);
  useEffect(() => {
    if (reduce) {
      current.current = target;
      return;
    }
    const start = current.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = p === 1 ? target : Math.round(start + (target - start) * eased);
      current.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);
  return reduce ? target : value;
}

function Row({ icon, label, note, children, strong = false }: { icon: IconName; label: string; note?: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-2">
        <Icon name={icon} size={17} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className={`block text-[14px] ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>{label}</span>
        {note ? <span className="text-[12px] text-ink-3">{note}</span> : null}
      </span>
      <span className={`text-right tnum ${strong ? "text-[17px] font-extrabold tracking-[-0.02em]" : "text-[14px] font-semibold"}`}>{children}</span>
    </div>
  );
}

/**
 * Cycles through the most recent settled payments, each broken down Wise-style:
 * what the trader paid, the bank's fee, what reached the government account.
 */
export function PaymentCarousel({ payments }: { payments: HeroPayment[] }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const p = payments[i] ?? payments[0]!;
  const paused = hold || reduce || payments.length < 2;

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((n) => (n + 1) % payments.length), STEP_MS);
    return () => clearTimeout(t);
  }, [i, paused, payments.length]);

  const amount = useTween(p.amountKobo);
  const fee = useTween(p.feeKobo);
  const net = useTween(p.amountKobo - p.feeKobo);
  const today = lagosDay(p.at) === lagosDay(new Date().toISOString());

  return (
    <div
      className="relative overflow-hidden rounded-[28px] border border-line bg-paper shadow-[0_24px_60px_-28px_rgb(12_28_21/0.35)]"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <div className="relative bg-forest px-6 pb-6 pt-6 text-white">
        <BankStamp className="absolute right-3 top-3 h-[80px] w-[80px] -rotate-[10deg] sm:right-4 sm:top-4 sm:h-[96px] sm:w-[96px]" />
        <p className="money mt-[72px] text-[52px] leading-none sm:mt-9">
          <span aria-hidden="true">{formatNaira(amount)}</span>
          <span className="sr-only">{formatNaira(p.amountKobo)}</span>
        </p>
        <p key={p.key} className="lp-slot mt-2 text-[14px] text-white/75">
          A trader, {channelLabel(p.channel)}, {today ? "" : `${lagosDay(p.at)}, `}
          {lagosTime(p.at)}
        </p>
        {payments.length > 1 ? (
          <div className="-mx-1 mt-3 flex items-center">
            {payments.map((x, n) => (
              <button
                key={x.key}
                type="button"
                onClick={() => setI(n)}
                aria-label={`Show payment ${n + 1} of ${payments.length}`}
                aria-current={n === i ? "true" : undefined}
                className="group flex h-8 items-center px-1"
              >
                <span className={`relative block h-1.5 overflow-hidden rounded-full transition-all duration-300 ${n === i ? "w-8 bg-white/20" : "w-1.5 bg-white/30 group-hover:bg-white/50"}`}>
                  {n === i ? <span key={`${x.key}-${i}`} className="lp-progress absolute inset-0 origin-left rounded-full bg-lime" style={{ animationDuration: `${STEP_MS}ms`, animationPlayState: paused ? "paused" : "running" }} /> : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 px-6 pb-6 pt-5">
        <Row icon="bank" label="Bank fee" note="read from the bank">
          − {formatNaira(fee)}
        </Row>
        <Row icon="shield" label="Government account receives" strong>
          {formatNaira(net)}
        </Row>
        <Row icon="receipt" label="Receipt">
          <span className="inline-block font-mono text-[13px] text-ink-2" aria-label="Receipt number hidden">
            {MASKED_RECEIPT}
          </span>
        </Row>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/r" className={buttonClass("accent", "md", "w-full")}>
            Check receipt
          </Link>
          <Link href="/register" className={buttonClass("secondary", "md", "w-full")}>
            Get a pass
          </Link>
        </div>
      </div>
    </div>
  );
}
