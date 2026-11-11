import "server-only";
import { createHmac } from "node:crypto";
import { and, desc, eq, isNotNull, like, notLike, sql } from "drizzle-orm";
import { formatNaira, nairaToKobo, type Kobo } from "@/core/money";
import { lagosDate } from "@/core/periods";
import { getBank } from "@/server/bank";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { traderStatus, type TraderStatus } from "@/server/levy/status";
import { handleBankWebhook } from "@/server/payments/webhook";
import { webhookSecret } from "@/server/payments/webhook-setup";
import { settlePayment } from "@/server/payments/settle";
import { startPayment } from "@/server/payments/start";

// T19: four failures, each run live with inputs the person at the panel chooses, each showing
// what the bank did, what LevyPass did, and the evidence (timestamps, ledger counts, raw HTTP).

export type Step = { who: "bank" | "levypass" | "check"; text: string; ok?: boolean; at: string };
export type Exchange = { label: string; request: string; response: string };
export type Run = {
  scenario: string;
  steps: Step[];
  paymentId?: string;
  startedAt: string;
  ms: number;
  ledger?: { before: number; after: number };
  exchanges?: Exchange[];
};

export type DrillTrader = { id: string; name: string; stall: string; owedKobo: Kobo; dailyKobo: Kobo };
export type DrillEvent = { eventId: string; reference: string; amountKobo: number | null; receivedAt: string };
export type DrillOptions = { owing: DrillTrader[]; paidToday: DrillTrader[]; events: DrillEvent[]; provider: string };

export type ForgeAttack = "wrong_key" | "tampered" | "stale";
export type ForgeInput = { attack?: ForgeAttack; amountNaira?: number; guessedKey?: string; staleMinutes?: number; targetRealPayment?: boolean };

const ledgerCount = async () => Number((await db().execute<{ n: string }>(sql`SELECT count(*) AS n FROM ledger_entries`)).rows[0]?.n ?? 0);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sign = (secret: string, ts: string, body: string) => `sha256=${createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")}`;

/** Collects steps with the server clock at the moment each one happened. */
function recorder(scenario: string) {
  const t0 = Date.now();
  const steps: Step[] = [];
  return {
    steps,
    add(who: Step["who"], text: string, ok?: boolean) {
      steps.push({ who, text, at: new Date().toISOString(), ...(ok === undefined ? {} : { ok }) });
    },
    done(extra: Partial<Run> = {}): Run {
      return { scenario, steps, startedAt: new Date(t0).toISOString(), ms: Date.now() - t0, ...extra };
    },
  };
}

async function waitSettled(paymentId: string, ms = 12_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const [p] = await db().select({ at: s.payments.settledAt }).from(s.payments).where(eq(s.payments.id, paymentId));
    if (p?.at) return true;
    await wait(300);
  }
  return false;
}

const SEEDED = "+234700000%";

async function statuses(ids: { id: string }[]): Promise<TraderStatus[]> {
  const out: TraderStatus[] = [];
  for (const r of ids) {
    const st = await traderStatus(r.id);
    if (st) out.push(st);
  }
  return out;
}

/** The seeded market. A drill run without a chosen trader takes one of these, never somebody who just registered. */
async function seededStatuses(): Promise<TraderStatus[]> {
  return statuses(await db().select({ id: s.traders.id }).from(s.traders).where(like(s.traders.phone, SEEDED)).orderBy(s.traders.phone).limit(60));
}

/** Traders who registered through the app, newest first, so the trader from demo step 1 can be picked by name. */
async function registeredStatuses(): Promise<TraderStatus[]> {
  return statuses(await db().select({ id: s.traders.id }).from(s.traders).where(notLike(s.traders.phone, SEEDED)).orderBy(desc(s.traders.createdAt)).limit(12));
}

const asDrillTrader = (st: TraderStatus): DrillTrader => ({
  id: st.trader.id,
  name: st.trader.name,
  stall: st.trader.stallOrVehicle,
  owedKobo: st.owedKobo,
  dailyKobo: st.current.find((c) => c.period === "daily")?.dueKobo ?? st.nextKobo,
});

/** What the panel offers to pick from: real traders and real webhook events, read now. */
export async function drillOptions(): Promise<DrillOptions> {
  const all = [...(await registeredStatuses()), ...(await seededStatuses())];
  const events = await db()
    .select({ eventId: s.webhookEvents.eventId, payload: s.webhookEvents.payload, receivedAt: s.webhookEvents.receivedAt })
    .from(s.webhookEvents)
    .where(and(like(s.webhookEvents.eventType, "payment.successful"), isNotNull(s.webhookEvents.processedAt)))
    .orderBy(desc(s.webhookEvents.receivedAt))
    .limit(8);
  return {
    owing: all.filter((st) => !st.paidNow && st.owedKobo > 0).map(asDrillTrader),
    paidToday: all.filter((st) => st.paidNow).map(asDrillTrader),
    events: events.map((e) => {
      const d = (e.payload as { data?: { reference?: unknown; amount?: unknown } }).data;
      return { eventId: e.eventId, reference: String(d?.reference ?? "?"), amountKobo: typeof d?.amount === "number" ? d.amount : null, receivedAt: e.receivedAt.toISOString() };
    }),
    provider: getBank().provider,
  };
}

async function pickTrader(traderId: string | undefined, paidToday: boolean): Promise<TraderStatus | null> {
  const fits = (st: TraderStatus | null) => Boolean(st && st.paidNow === paidToday && (paidToday || st.owedKobo > 0));
  if (traderId) {
    const st = await traderStatus(traderId);
    return fits(st) ? st : null;
  }
  return (await seededStatuses()).find(fits) ?? null;
}

export async function withheldWebhook(input: { traderId?: string } = {}): Promise<Run> {
  const r = recorder("withheld");
  const st = await pickTrader(input.traderId, false);
  if (!st) {
    r.add("check", input.traderId ? "That trader owes nothing right now. Pick another, or reset the demo data." : "No trader owes anything right now. Reset the demo data first.", false);
    return r.done();
  }
  const before = await ledgerCount();
  const p = await startPayment({ traderId: st.trader.id, channel: "ussd", amountKobo: st.owedKobo, demoWithholdWebhook: true });
  r.add("levypass", `Started a ${formatNaira(st.owedKobo)} USSD payment for ${st.trader.name}, reference ${p.reference}.`);
  await getBank().simulateUssd(p.reference);
  r.add("bank", "Took the money and sent the payment.successful webhook.");
  r.add("levypass", "Dropped that webhook on purpose, as if it never arrived. Nothing is marked paid yet.");
  r.add("check", `Ledger has ${before} entries. The safety-net poller requeries every unconfirmed payment older than 15 s. Wait for it, or ask the bank yourself.`);
  return r.done({ paymentId: p.paymentId, ledger: { before, after: await ledgerCount() } });
}

/** The panel's "ask the bank now" button: verify one withheld payment server to server (rule 3). */
export async function requeryNow(paymentId: string): Promise<{ kind: string; settled: boolean }> {
  const [p] = await db().select({ data: s.payments.providerData }).from(s.payments).where(eq(s.payments.id, paymentId));
  if (!(p?.data as { demoWithholdWebhook?: boolean } | undefined)?.demoWithholdWebhook) return { kind: "not_a_drill_payment", settled: false };
  const outcome = await settlePayment(paymentId);
  return { kind: outcome.kind, settled: outcome.kind === "settled" || outcome.kind === "already_settled" };
}

export async function replayedWebhook(input: { eventId?: string; times?: number } = {}): Promise<Run> {
  const r = recorder("replayed");
  const times = Math.min(5, Math.max(1, Math.trunc(input.times ?? 1)));
  const base = and(like(s.webhookEvents.eventType, "payment.successful"), isNotNull(s.webhookEvents.processedAt));
  const [ev] = await db()
    .select()
    .from(s.webhookEvents)
    .where(input.eventId ? and(base, eq(s.webhookEvents.eventId, input.eventId)) : base)
    .orderBy(desc(s.webhookEvents.receivedAt))
    .limit(1);
  if (!ev) {
    r.add("check", "No processed payment webhook yet. Make one payment first.", false);
    return r.done();
  }
  const before = await ledgerCount();
  r.add("check", `Ledger has ${before} entries before the replay.`);
  const bank = getBank();
  const exchanges: Exchange[] = [];
  if (bank.provider === "xtradot") {
    // Each re-delivery is one call against the shared 60 a minute budget, so at most three.
    const n = Math.min(times, 3);
    for (let i = 0; i < n; i++) {
      await bank.replayDelivery(ev.eventId);
      r.add("bank", `Re-delivered event ${ev.eventId} (${i + 1} of ${n}).`);
    }
    await wait(4000);
    const [row] = await db().select({ attempts: s.webhookEvents.attempts }).from(s.webhookEvents).where(eq(s.webhookEvents.eventId, ev.eventId));
    r.add("levypass", `Still one stored row for ${ev.eventId} (processed ${row?.attempts ?? 1} time). Every repeat was recognised by its event_id.`);
  } else {
    const body = JSON.stringify(ev.payload);
    const secret = (await webhookSecret()) ?? "";
    for (let i = 0; i < times; i++) {
      const ts = String(Math.floor(Date.now() / 1000));
      const signature = sign(secret, ts, body);
      const res = await handleBankWebhook(body, new Headers({ "x-forge-timestamp": ts, "x-forge-signature": signature }));
      r.add("bank", `Delivered event ${ev.eventId} again, correctly signed (${i + 1} of ${times}).`);
      r.add("levypass", `Answered ${res.status} ${JSON.stringify(res.body)}: recognised the event_id and changed nothing.`, res.status === 200 && res.body.duplicate === true);
      exchanges.push({
        label: `Delivery ${i + 1}`,
        request: `POST /api/webhooks/bank\nx-forge-timestamp: ${ts}\nx-forge-signature: ${signature.slice(0, 23)}...\n\n${body}`,
        response: `${res.status} ${JSON.stringify(res.body)}`,
      });
    }
  }
  const after = await ledgerCount();
  r.add("check", `Ledger has ${after} entries after the replay. No double credit.`, after === before);
  return r.done({ ledger: { before, after }, exchanges });
}

const ATTACKS: Record<ForgeAttack, string> = {
  wrong_key: "signs the fake webhook with a key it guessed",
  tampered: "catches a genuinely signed webhook and raises the amount before passing it on",
  stale: "replays a genuinely signed webhook captured some minutes ago",
};

export async function forgedSignature(input: ForgeInput = {}): Promise<Run> {
  const r = recorder("forged");
  const attack = input.attack ?? "wrong_key";
  const amountKobo = nairaToKobo(Math.min(10_000_000, Math.max(1, Math.trunc(input.amountNaira ?? 500))));
  const before = await ledgerCount();
  const reviewBefore = Number((await db().execute<{ n: string }>(sql`SELECT count(*) AS n FROM review_items`)).rows[0]?.n ?? 0);

  let reference = `pay_attacker_${Date.now().toString(36)}`;
  if (input.targetRealPayment) {
    const [latest] = await db().select({ ref: s.payments.providerRef }).from(s.payments).where(sql`${s.payments.provider} <> 'seed'`).orderBy(desc(s.payments.createdAt)).limit(1);
    if (latest) reference = latest.ref;
  }
  const eventId = `evt_FORGED_${Date.now()}`;
  const event = (amount: number) =>
    JSON.stringify({ event: "payment.successful", event_id: eventId, created_at: new Date().toISOString(), data: { reference, amount, amount_paid: amount, status: "successful" } });

  const now = Math.floor(Date.now() / 1000);
  let ts = String(now);
  let body = event(amountKobo);
  let signature: string;
  const secret = (await webhookSecret()) ?? "";
  if (attack === "wrong_key") {
    signature = sign(input.guessedKey?.slice(0, 64) || "levypass", ts, body);
  } else if (attack === "tampered") {
    const original = event(Math.max(100, Math.round(amountKobo / 100)));
    signature = sign(secret, ts, original); // what the bank would have signed
    body = original.replace(/"amount":\d+,"amount_paid":\d+/, `"amount":${amountKobo},"amount_paid":${amountKobo}`);
  } else {
    // Older than the 5-minute window, so even a correct signature must not be enough.
    const minutes = Math.min(1440, Math.max(6, Math.trunc(input.staleMinutes ?? 10)));
    ts = String(now - minutes * 60);
    signature = sign(secret, ts, body);
  }

  r.add("bank", `An attacker ${ATTACKS[attack]}: ${formatNaira(amountKobo)} for ${input.targetRealPayment ? `a real payment, ${reference}` : `made-up reference ${reference}`}.`);
  const res = await handleBankWebhook(body, new Headers({ "x-forge-timestamp": ts, "x-forge-signature": signature }));
  const expected = attack === "stale" ? "stale_timestamp" : "bad_signature";
  r.add("levypass", `Checked the timestamp and the HMAC-SHA256 signature over the raw body, answered ${res.status} (${String(res.body.error ?? JSON.stringify(res.body))}).`, res.status === 401 && res.body.error === expected);

  const [stored] = await db().select({ id: s.webhookEvents.id }).from(s.webhookEvents).where(eq(s.webhookEvents.eventId, eventId));
  const after = await ledgerCount();
  const reviewAfter = Number((await db().execute<{ n: string }>(sql`SELECT count(*) AS n FROM review_items`)).rows[0]?.n ?? 0);
  r.add("check", `Event stored: ${stored ? "yes" : "no"}. Ledger ${before} → ${after}. Review queue ${reviewBefore} → ${reviewAfter}.`, !stored && after === before && reviewAfter === reviewBefore);
  return r.done({
    ledger: { before, after },
    exchanges: [{ label: "The attacker's request", request: `POST /api/webhooks/bank\nx-forge-timestamp: ${ts}\nx-forge-signature: ${signature}\n\n${body}`, response: `${res.status} ${JSON.stringify(res.body)}` }],
  });
}

export async function secondPayment(input: { traderId?: string; amountNaira?: number } = {}): Promise<Run> {
  const r = recorder("double");
  const st = await pickTrader(input.traderId, true);
  if (!st) {
    r.add("check", input.traderId ? "That trader has not paid for today yet. Pick one who has." : "No trader has paid today yet.", false);
    return r.done();
  }
  const daily = st.current.find((c) => c.period === "daily");
  const amount = input.amountNaira ? nairaToKobo(Math.min(50_000, Math.max(1, Math.trunc(input.amountNaira)))) : (daily?.dueKobo ?? st.nextKobo);
  const before = await ledgerCount();
  r.add("check", `${st.trader.name} already paid ${daily?.levy ?? "today's levy"} for ${lagosDate(new Date())}. Ledger has ${before} entries.`);
  const p = await startPayment({ traderId: st.trader.id, channel: "ussd", amountKobo: amount });
  await getBank().simulateUssd(p.reference);
  r.add("bank", `Charged them ${formatNaira(amount)} again (reference ${p.reference}) and confirmed it.`);
  const done = await waitSettled(p.paymentId);
  r.add("levypass", done ? "Verified the payment with the bank and settled it." : "Still waiting for the bank.", done);
  const [flag] = await db().select().from(s.fraudFlags).where(and(eq(s.fraudFlags.paymentId, p.paymentId), eq(s.fraudFlags.type, "double_charge")));
  const creditedTo = (flag?.details as { creditedTo?: string[] } | undefined)?.creditedTo ?? [];
  r.add("levypass", flag ? `Raised double-charge flag ${flag.id} and credited the money to ${creditedTo.join(", ") || "the next period"}. The trader got an SMS saying so.` : "No flag raised.", Boolean(flag));
  const after = await ledgerCount();
  const now = new Date();
  const onToday = Number(
    (
      await db().execute<{ n: string }>(
        sql`SELECT count(*) AS n FROM ledger_entries e JOIN obligations o ON o.id = e.obligation_id
            WHERE e.payment_id = ${p.paymentId} AND e.kind = 'allocation' AND o.period_start <= ${now} AND o.period_end > ${now}`,
      )
    ).rows[0]?.n ?? 0,
  );
  r.add("check", `Ledger ${before} → ${after}. Allocations from this payment to ${lagosDate(now)}: ${onToday}.`, onToday === 0);
  return r.done({ paymentId: p.paymentId, ledger: { before, after } });
}
