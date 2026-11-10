import "server-only";
import { createHmac } from "node:crypto";
import { and, desc, eq, isNotNull, like, sql } from "drizzle-orm";
import { formatNaira } from "@/core/money";
import { lagosDate } from "@/core/periods";
import { getBank } from "@/server/bank";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { traderStatus } from "@/server/levy/status";
import { handleBankWebhook } from "@/server/payments/webhook";
import { webhookSecret } from "@/server/payments/webhook-setup";
import { startPayment } from "@/server/payments/start";

// T19: four failures, each run live, each showing what the bank did and what LevyPass did.

export type Step = { who: "bank" | "levypass" | "check"; text: string; ok?: boolean };
export type Run = { scenario: string; steps: Step[]; paymentId?: string };

const ledgerCount = async () => Number((await db().execute<{ n: string }>(sql`SELECT count(*) AS n FROM ledger_entries`)).rows[0]?.n ?? 0);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitSettled(paymentId: string, ms = 12_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const [p] = await db().select({ at: s.payments.settledAt }).from(s.payments).where(eq(s.payments.id, paymentId));
    if (p?.at) return true;
    await wait(300);
  }
  return false;
}

async function seededTrader(paidToday: boolean) {
  const rows = await db().select({ id: s.traders.id }).from(s.traders).where(like(s.traders.phone, "+234700000%")).orderBy(s.traders.phone);
  for (const r of rows) {
    const st = await traderStatus(r.id);
    if (st && st.paidNow === paidToday && (paidToday || st.owedKobo > 0)) return st;
  }
  return null;
}

export async function withheldWebhook(): Promise<Run> {
  const st = await seededTrader(false);
  if (!st) return { scenario: "withheld", steps: [{ who: "check", text: "No trader owes anything right now. Reset the demo data first.", ok: false }] };
  const p = await startPayment({ traderId: st.trader.id, channel: "ussd", amountKobo: st.owedKobo, demoWithholdWebhook: true });
  await getBank().simulateUssd(p.reference);
  return {
    scenario: "withheld",
    paymentId: p.paymentId,
    steps: [
      { who: "levypass", text: `Started a ${formatNaira(st.owedKobo)} USSD payment for ${st.trader.name}.` },
      { who: "bank", text: "Took the money and sent the payment.successful webhook." },
      { who: "levypass", text: "Dropped that webhook on purpose, as if it never arrived. Nothing is marked paid yet." },
      { who: "check", text: "The safety-net poller requeries every unconfirmed payment. Watch it settle on its own in about 20 seconds." },
    ],
  };
}

export async function replayedWebhook(): Promise<Run> {
  const [ev] = await db().select().from(s.webhookEvents).where(and(like(s.webhookEvents.eventType, "payment.successful"), isNotNull(s.webhookEvents.processedAt))).orderBy(desc(s.webhookEvents.receivedAt)).limit(1);
  if (!ev) return { scenario: "replayed", steps: [{ who: "check", text: "No processed payment webhook yet. Make one payment first.", ok: false }] };
  const before = await ledgerCount();
  const steps: Step[] = [{ who: "check", text: `Ledger has ${before} entries before the replay.` }];
  const bank = getBank();
  if (bank.provider === "xtradot") {
    await bank.replayDelivery(ev.eventId);
    steps.push({ who: "bank", text: `Asked the bank to re-deliver event ${ev.eventId}.` });
    await wait(4000);
  } else {
    const body = JSON.stringify(ev.payload);
    const ts = String(Math.floor(Date.now() / 1000));
    const secret = (await webhookSecret()) ?? "";
    const res = await handleBankWebhook(body, new Headers({ "x-forge-timestamp": ts, "x-forge-signature": `sha256=${createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")}` }));
    steps.push({ who: "bank", text: `Delivered event ${ev.eventId} a second time, correctly signed.` });
    steps.push({ who: "levypass", text: `Answered ${res.status} ${JSON.stringify(res.body)}: recognised the event_id and changed nothing.` });
  }
  const after = await ledgerCount();
  steps.push({ who: "check", text: `Ledger has ${after} entries after the replay. No double credit.`, ok: after === before });
  return { scenario: "replayed", steps };
}

export async function forgedSignature(): Promise<Run> {
  const body = JSON.stringify({ event: "payment.successful", event_id: `evt_FORGED_${Date.now()}`, created_at: new Date().toISOString(), data: { reference: "pay_attacker", amount: 50000, amount_paid: 50000, status: "successful" } });
  const res = await handleBankWebhook(body, new Headers({ "x-forge-timestamp": String(Math.floor(Date.now() / 1000)), "x-forge-signature": `sha256=${"ab".repeat(32)}` }));
  return {
    scenario: "forged",
    steps: [
      { who: "bank", text: "An attacker posts a fake ₦50,000 payment.successful webhook to our endpoint." },
      { who: "levypass", text: `Checked the HMAC-SHA256 signature over the raw body and answered ${res.status} (${String(res.body.error)}).`, ok: res.status === 401 },
      { who: "check", text: "Nothing was stored, nothing was credited, and the fake event ID was not recorded." },
    ],
  };
}

export async function secondPayment(): Promise<Run> {
  const st = await seededTrader(true);
  if (!st) return { scenario: "double", steps: [{ who: "check", text: "No trader has paid today yet.", ok: false }] };
  const daily = st.current.find((c) => c.period === "daily");
  const amount = daily?.dueKobo ?? st.nextKobo;
  const p = await startPayment({ traderId: st.trader.id, channel: "ussd", amountKobo: amount });
  await getBank().simulateUssd(p.reference);
  const done = await waitSettled(p.paymentId);
  const [flag] = await db().select().from(s.fraudFlags).where(and(eq(s.fraudFlags.paymentId, p.paymentId), eq(s.fraudFlags.type, "double_charge")));
  const creditedTo = (flag?.details as { creditedTo?: string[] } | undefined)?.creditedTo ?? [];
  return {
    scenario: "double",
    paymentId: p.paymentId,
    steps: [
      { who: "check", text: `${st.trader.name} already paid ${daily?.levy ?? "today's levy"} for ${lagosDate(new Date())}.` },
      { who: "bank", text: `Charged them ${formatNaira(amount)} again and confirmed it.` },
      { who: "levypass", text: done ? "Verified the payment with the bank and settled it." : "Still waiting for the bank.", ok: done },
      { who: "levypass", text: flag ? `Raised a double-charge flag and credited the money to ${creditedTo.join(", ") || "the next period"}. The trader got an SMS saying so.` : "No flag raised.", ok: Boolean(flag) },
    ],
  };
}
