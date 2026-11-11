"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { formatNaira } from "@/core/money";
import { Icon, type IconName, buttonClass, inputClass } from "@/app/_ui/kit";
import type { DrillOptions, ForgeAttack, Run } from "@/server/admin/failures";
import { requeryDrillPayment, runFailure } from "../../actions";

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) + `.${String(new Date(iso).getMilliseconds()).padStart(3, "0")}`;

const whoStyle: Record<string, string> = {
  bank: "bg-paper text-ink-2",
  levypass: "bg-forest text-lime",
};

/* ---------------------------------------------------------------- controls */

function Pick({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
    </label>
  );
}

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${value === v ? "bg-forest text-white" : "bg-paper text-ink-2 hover:text-ink"}`}
        >
          {value === v ? <Icon name="check" size={14} stroke={2.6} /> : null}
          {text}
        </button>
      ))}
    </div>
  );
}

const field = `${inputClass} !min-h-11 !py-2 text-[15px]`;

/* ------------------------------------------------------------------ result */

/** Polls our own database for the withheld payment, and lets the judge ask the bank directly. */
function Settled({ id, startedAt }: { id: string; startedAt: string }) {
  const [done, setDone] = useState<{ secs: number; by: "poller" | "you" } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const t0 = new Date(startedAt).getTime();

  useEffect(() => {
    if (done) return;
    const t = setInterval(async () => {
      setNow(Date.now());
      const r = await fetch(`/api/admin/payment/${id}`, { cache: "no-store" });
      const p = (await r.json()) as { settledAt: string | null } | null;
      if (p?.settledAt) setDone((d) => d ?? { secs: Math.round((new Date(p.settledAt!).getTime() - t0) / 1000), by: "poller" });
    }, 1000);
    return () => clearInterval(t);
  }, [id, t0, done]);

  if (done) {
    return (
      <li className="animate-pop flex gap-2.5 rounded-xl bg-go-bg px-3 py-2.5 font-semibold text-go-fg">
        <Icon name="check" size={16} stroke={2.6} className="mt-0.5 shrink-0" />
        {done.by === "you"
          ? `You asked: LevyPass called the bank's verify endpoint, got a confirmed payment, and settled it ${done.secs} s after the drill started.`
          : `The poller asked the bank, verified the payment and settled it ${done.secs} s after the drill started. No webhook needed.`}
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-2.5 rounded-xl bg-warn-bg px-3 py-2.5 text-warn-fg">
      <span className="flex items-center gap-2.5">
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-warn-fg/30 border-t-warn-fg" aria-hidden="true" />
        Not paid yet. Waiting for the safety net: {Math.max(0, Math.round((now - t0) / 1000))} s
      </span>
      <button
        type="button"
        disabled={asking}
        onClick={async () => {
          setAsking(true);
          const r = await requeryDrillPayment(id);
          setAsking(false);
          if (r.settled) setDone({ secs: Math.round((Date.now() - t0) / 1000), by: "you" });
          else setAnswer(`The bank did not confirm it yet (${r.kind.replaceAll("_", " ")}). Try again in a moment.`);
        }}
        className={buttonClass("outline", "sm", "self-start")}
      >
        <Icon name="bank" size={15} />
        {asking ? "Asking the bank" : "Ask the bank now"}
      </button>
      {answer ? <span className="text-[13px]">{answer}</span> : null}
    </li>
  );
}

function Result({ run }: { run: Run }) {
  return (
    <div className="flex flex-col gap-4 border-t border-ink/15 pt-5">
      <div className="flex flex-wrap gap-2 text-[12px] font-semibold">
        <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-ink-2">
          <Icon name="clock" size={13} /> Ran at {clock(run.startedAt)} Lagos, {run.ms} ms on the server
        </span>
        {run.ledger ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${run.ledger.before === run.ledger.after ? "bg-go-bg text-go-fg" : "bg-paper text-ink-2"}`}>
            <Icon name="ledger" size={13} /> Ledger {run.ledger.before.toLocaleString("en-NG")} → {run.ledger.after.toLocaleString("en-NG")}
          </span>
        ) : null}
      </div>
      <ol className="flex flex-col gap-2.5 text-[14px]">
        {run.steps.map((s, i) => (
          <li key={i} className="animate-fadein flex gap-3" style={{ animationDelay: `${i * 120}ms` }}>
            <span className="flex w-[74px] shrink-0 flex-col gap-1">
              <span className={`h-fit w-fit rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${whoStyle[s.who] ?? "bg-warn-bg text-warn-fg"}`}>{s.who}</span>
              <span className="font-mono text-[10.5px] text-ink-3 tnum">{clock(s.at)}</span>
            </span>
            <span className="flex min-w-0 gap-1.5 text-ink">
              {s.ok === true ? <Icon name="check" size={16} stroke={2.6} className="mt-0.5 shrink-0 text-go" /> : s.ok === false ? <Icon name="x" size={16} stroke={2.6} className="mt-0.5 shrink-0 text-stop" /> : null}
              <span className="break-words">{s.text}</span>
            </span>
          </li>
        ))}
        {run.scenario === "withheld" && run.paymentId ? <Settled id={run.paymentId} startedAt={run.startedAt} /> : null}
      </ol>
      {run.exchanges?.length ? (
        <details className="group rounded-xl bg-paper">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[13px] font-semibold text-ink-2">
            <Icon name="chevronRight" size={14} stroke={2.4} className="transition group-open:rotate-90" />
            Raw HTTP ({run.exchanges.length})
          </summary>
          <div className="flex flex-col gap-3 px-3 pb-3">
            {run.exchanges.map((x) => (
              <div key={x.label} className="flex flex-col gap-1.5">
                <p className="text-[12px] font-bold text-ink-3">{x.label}</p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-night p-3 font-mono text-[11.5px] leading-relaxed text-white/85">{x.request}</pre>
                <pre className="whitespace-pre-wrap break-all rounded-lg bg-mist-2 p-3 font-mono text-[11.5px] text-ink">{x.response}</pre>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- cards */

function Drill({ icon, title, blurb, controls, run, input }: { icon: IconName; title: string; blurb: string; controls: ReactNode; run: string; input: () => Record<string, unknown> }) {
  const router = useRouter();
  const [state, setState] = useState<Run | "running" | null>(null);
  const [count, setCount] = useState(0);
  return (
    <section className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-mist-2 p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper text-forest">
          <Icon name={icon} size={20} />
        </span>
        <div>
          <p className="text-[17px] font-semibold tracking-[-0.02em]">{title}</p>
          <p className="mt-0.5 text-[14px] text-ink-2">{blurb}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3.5">{controls}</div>
      <button
        type="button"
        disabled={state === "running"}
        onClick={async () => {
          setState("running");
          const result = await runFailure(run, input());
          setState(result);
          setCount((n) => n + 1);
          router.refresh(); // trader and event lists change after every run
        }}
        className={buttonClass(state && state !== "running" ? "outline" : "primary", "md", "w-full")}
      >
        {state === "running" ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            Running
          </>
        ) : state ? (
          "Run it again with these choices"
        ) : (
          "Run it live"
        )}
      </button>
      {state && state !== "running" ? <Result key={count} run={state} /> : null}
    </section>
  );
}

const traderLabel = (t: { name: string; stall: string }, extra: string) => `${t.name}, ${t.stall}: ${extra}`;
const wholeNaira = (v: string) => (/^\d{1,8}$/.test(v.trim()) ? Number(v.trim()) : undefined);

export function Drills({ options }: { options: DrillOptions }) {
  const [withheldTrader, setWithheldTrader] = useState("");
  const [eventId, setEventId] = useState("");
  const [times, setTimes] = useState("2");
  const [attack, setAttack] = useState<ForgeAttack>("wrong_key");
  const [forgeAmount, setForgeAmount] = useState("50000");
  const [guessedKey, setGuessedKey] = useState("");
  const [staleMinutes, setStaleMinutes] = useState("10");
  const [realTarget, setRealTarget] = useState(false);
  const [doubleTrader, setDoubleTrader] = useState("");
  const [doubleAmount, setDoubleAmount] = useState("");
  const maxReplays = options.provider === "xtradot" ? 3 : 5;

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-start gap-2.5 rounded-2xl border border-line bg-paper px-4 py-3 text-[14px] text-ink-2">
        <Icon name="info" size={18} className="mt-0.5 shrink-0 text-forest" />
        <span>
          Nothing here is scripted. Pick the trader, the event, the attack and the amount yourself. Every run uses the {options.provider === "xtradot" ? "Xtradot sandbox" : "fake bank"}, our real webhook handler and the live ledger, and prints the server clock and ledger count so you can check
          them on the other screens.
        </span>
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <Drill
          icon="clock"
          title="Withheld webhook"
          blurb="The bank takes the money but its webhook never arrives."
          run="withheld"
          input={() => ({ traderId: withheldTrader || undefined })}
          controls={
            <Pick label="Trader who pays">
              <select value={withheldTrader} onChange={(e) => setWithheldTrader(e.target.value)} className={field}>
                <option value="">First trader who owes</option>
                {options.owing.map((t) => (
                  <option key={t.id} value={t.id}>
                    {traderLabel(t, `owes ${formatNaira(t.owedKobo)}`)}
                  </option>
                ))}
              </select>
            </Pick>
          }
        />
        <Drill
          icon="refresh"
          title="Replayed webhook"
          blurb="The bank delivers the same event again, correctly signed."
          run="replayed"
          input={() => ({ eventId: eventId || undefined, times: Number(times) })}
          controls={
            <>
              <Pick label="Event to replay">
                <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={`${field} font-mono !text-[13px]`}>
                  <option value="">Latest processed payment event</option>
                  {options.events.map((e) => (
                    <option key={e.eventId} value={e.eventId}>
                      {clock(e.receivedAt).slice(0, 8)} {e.amountKobo !== null ? formatNaira(e.amountKobo) : ""} {e.eventId}
                    </option>
                  ))}
                </select>
              </Pick>
              <Pick label="How many times">
                <Choice label="How many times" value={times} onChange={setTimes} options={Array.from({ length: maxReplays }, (_, i) => [String(i + 1), `${i + 1}×`] as const)} />
              </Pick>
            </>
          }
        />
        <Drill
          icon="lock"
          title="Forged webhook"
          blurb="An attacker posts a fake payment to our webhook endpoint."
          run="forged"
          input={() => ({ attack, amountNaira: wholeNaira(forgeAmount) ?? 500, guessedKey: guessedKey || undefined, staleMinutes: Number(staleMinutes), targetRealPayment: realTarget })}
          controls={
            <>
              <Pick label="How the attacker tries">
                <Choice
                  label="How the attacker tries"
                  value={attack}
                  onChange={setAttack}
                  options={[
                    ["wrong_key", "Guesses the key"],
                    ["tampered", "Edits the amount"],
                    ["stale", "Replays an old one"],
                  ]}
                />
              </Pick>
              <div className="grid gap-3 sm:grid-cols-2">
                <Pick label="Fake amount (₦, whole naira)">
                  <input inputMode="numeric" value={forgeAmount} onChange={(e) => setForgeAmount(e.target.value.replace(/\D/g, ""))} className={`${field} tnum`} />
                </Pick>
                {attack === "wrong_key" ? (
                  <Pick label="Key the attacker guesses">
                    <input value={guessedKey} onChange={(e) => setGuessedKey(e.target.value)} maxLength={64} placeholder="type anything" autoComplete="off" className={`${field} font-mono`} />
                  </Pick>
                ) : attack === "stale" ? (
                  <Pick label="Captured how long ago">
                    <select value={staleMinutes} onChange={(e) => setStaleMinutes(e.target.value)} className={field}>
                      {[6, 10, 30, 60, 1440].map((m) => (
                        <option key={m} value={m}>
                          {m === 1440 ? "1 day" : `${m} minutes`}
                        </option>
                      ))}
                    </select>
                  </Pick>
                ) : (
                  <p className="self-end pb-2 text-[13px] text-ink-3">The bank signed one tenth of this amount. The attacker raises it in transit.</p>
                )}
              </div>
              <label className="flex items-center gap-2.5 text-[14px] text-ink-2">
                <input type="checkbox" checked={realTarget} onChange={(e) => setRealTarget(e.target.checked)} className="h-4 w-4 accent-forest" />
                Aim it at a real trader&apos;s payment reference
              </label>
            </>
          }
        />
        <Drill
          icon="flag"
          title="Paid twice for one day"
          blurb="The bank charges a trader again for a day already paid."
          run="double"
          input={() => ({ traderId: doubleTrader || undefined, amountNaira: wholeNaira(doubleAmount) })}
          controls={
            <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
              <Pick label="Trader who already paid today">
                <select value={doubleTrader} onChange={(e) => setDoubleTrader(e.target.value)} className={field}>
                  <option value="">First trader who has paid</option>
                  {options.paidToday.map((t) => (
                    <option key={t.id} value={t.id}>
                      {traderLabel(t, `daily ${formatNaira(t.dailyKobo)}`)}
                    </option>
                  ))}
                </select>
              </Pick>
              <Pick label="Charge (₦)">
                <input inputMode="numeric" value={doubleAmount} onChange={(e) => setDoubleAmount(e.target.value.replace(/\D/g, ""))} placeholder="one day" className={`${field} tnum`} />
              </Pick>
            </div>
          }
        />
      </div>
    </div>
  );
}
