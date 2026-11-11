"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./kit";

/*
 * A short search moment: a sheet of paper with a lens moving over it while the real lookup
 * runs, then a check (found) or a cross (not found), then the caller shows the result.
 * The mark always reflects the real answer; a slow or failed lookup skips the mark and goes
 * straight to the result, so the whole thing stays under 2 seconds.
 */

export type RevealPhase = "idle" | "searching" | "found" | "missing";
export type RevealTiming = { search: number; mark: number; timeout: number };

/** Receipt search: lens for at least 0.8 s, mark for 0.45 s, give up waiting at 1.3 s. */
export const RECEIPT_TIMING: RevealTiming = { search: 800, mark: 450, timeout: 1300 };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useSearchReveal(timing: RevealTiming = RECEIPT_TIMING) {
  const [phase, setPhase] = useState<RevealPhase>("idle");
  const busy = useRef(false);

  /**
   * Runs `lookup` under the animation. `judge` turns its answer into found (true), not found
   * (false) or no mark (null). `then` receives the answer, or null after a timeout or error.
   */
  const run = useCallback(
    async <T,>(lookup: () => Promise<T>, judge: (t: T) => boolean | null, then: (t: T | null) => void) => {
      if (busy.current) return;
      busy.current = true;
      const reduce = reducedMotion();
      const search = reduce ? 0 : timing.search;
      setPhase("searching");
      const t0 = performance.now();
      type Outcome = { ok: true; value: T } | { ok: false };
      const answer: Outcome = await Promise.race([
        lookup().then((value): Outcome => ({ ok: true, value }), (): Outcome => ({ ok: false })),
        sleep(timing.timeout).then((): Outcome => ({ ok: false })),
      ]);
      const left = search - (performance.now() - t0);
      if (left > 0) await sleep(left);
      const verdict = answer.ok ? judge(answer.value) : null;
      if (verdict !== null) {
        setPhase(verdict ? "found" : "missing");
        await sleep(reduce ? 250 : timing.mark);
      }
      busy.current = false;
      then(answer.ok ? answer.value : null);
    },
    [timing],
  );

  const reset = useCallback(() => setPhase("idle"), []);
  return { phase, run, reset };
}

/** Full-screen overlay for the search moment. Renders nothing while idle. */
export function SearchReveal({ phase, searching, found, missing }: { phase: RevealPhase; searching: string; found: string; missing: string }) {
  if (phase === "idle") return null;
  const word = phase === "found" ? found : phase === "missing" ? missing : searching;
  return createPortal(
    <div className="animate-fadein fixed inset-0 z-50 flex items-center justify-center bg-paper/85 px-6 backdrop-blur-sm" role="status" aria-live="assertive">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-[200px] w-[200px]">
          <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
            <ellipse cx={100} cy={182} rx={52} ry={6} fill="#0c1c15" opacity={0.08} />
            <path d="M52 22 h96 v148 l-12 -8 l-12 8 l-12 -8 l-12 8 l-12 -8 l-12 8 l-12 -8 l-12 8 z" fill="#ffffff" stroke="#0c1c15" strokeWidth={3} strokeLinejoin="round" />
            <path d="M52 30 a8 8 0 0 1 8 -8 h80 a8 8 0 0 1 8 8 v12 h-96 z" fill="#a8e86b" stroke="#0c1c15" strokeWidth={3} strokeLinejoin="round" />
            {[62, 78, 94, 110, 126].map((y, i) => (
              <path key={y} d={`M66 ${y} h${[68, 52, 60, 40, 56][i]}`} stroke="#0c1c15" strokeWidth={4} strokeLinecap="round" opacity={0.18} />
            ))}
            <path d="M66 146 h30" stroke="#0c1c15" strokeWidth={6} strokeLinecap="round" opacity={0.35} />
            {phase === "searching" ? (
              <g className="lp-lens">
                <path d="M118 116 L146 144" stroke="#0c1c15" strokeWidth={15} strokeLinecap="round" />
                <path d="M118 116 L146 144" stroke="#0f3d2e" strokeWidth={9} strokeLinecap="round" />
                <circle cx={100} cy={98} r={27} fill="#cfe6ef" fillOpacity={0.55} stroke="#0c1c15" strokeWidth={5} />
                <path d="M86 88 a17 17 0 0 1 12 -8" fill="none" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" />
              </g>
            ) : null}
          </svg>
          {phase !== "searching" ? (
            <span
              className={`animate-pop absolute left-1/2 top-[46%] flex h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-ink ${phase === "found" ? "bg-lime text-ink" : "bg-stop text-white"}`}
            >
              <Icon name={phase === "found" ? "check" : "x"} size={46} />
            </span>
          ) : null}
        </div>
        <p key={phase} className="animate-fadein text-[18px] font-semibold tracking-[-0.02em] text-ink">
          {word}
        </p>
      </div>
    </div>,
    document.body,
  );
}
