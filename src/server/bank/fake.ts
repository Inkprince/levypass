import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { lagosDate } from "@/core/periods";
import type { Kobo } from "@/core/money";
import { errorFields, log } from "@/server/log";
import { BankError, type BankPort, type Settlement, type VerifiedPayment } from "./port";

// Deterministic stand-in for the sandbox, used locally and in tests. Behaviour copies what T4
// recorded: checkouts, ₦50 flat fee on USSD and transfer, 1.5% on card (capped at ₦2,000),
// partial payments stay pending, overpayments settle only the amount asked, signed webhooks,
// and (captured 11 Nov) the flat fee applies below ₦50 too, and an unpaid checkout expires after 30 minutes.

type FakePayment = {
  reference: string;
  amountKobo: Kobo;
  paidKobo: Kobo;
  status: VerifiedPayment["status"];
  channel: string | null;
  feeKobo: Kobo;
  paidAt: Date | null;
  createdAt: Date;
};

type FakeState = {
  payments: Map<string, FakePayment>;
  settled: Settlement[];
  webhook?: { id: string; secret: string; url: string };
  seq: number;
};

const g = globalThis as unknown as { levypassFakeBank?: FakeState };

// Local demos survive a dev-server restart: the fake bank keeps its state in .data/ (ignored by Git).
// Tests never touch the file.
const file = path.join(process.cwd(), ".data", "fake-bank.json");
const persist = process.env.NODE_ENV !== "test" && !process.env.VITEST;
const reviveDate = (_: string, v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : v);

function load(): FakeState {
  if (persist) {
    try {
      const raw = JSON.parse(readFileSync(file, "utf8"), reviveDate) as { payments: FakePayment[]; settled: Settlement[]; webhook?: FakeState["webhook"]; seq: number };
      return { payments: new Map(raw.payments.map((p) => [p.reference, p])), settled: raw.settled, webhook: raw.webhook, seq: raw.seq };
    } catch {
      // first run
    }
  }
  return { payments: new Map(), settled: [], seq: 0 };
}

function save(): void {
  if (!persist) return;
  const st = state();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ payments: [...st.payments.values()], settled: st.settled, webhook: st.webhook, seq: st.seq }));
}

const state = (): FakeState => (g.levypassFakeBank ??= load());

/** Test helper: make a checkout look as if it was created `ms` ago, to reach its 30-minute expiry. */
export function ageFakePayment(reference: string, ms: number): void {
  const p = state().payments.get(reference);
  if (!p) throw new Error(`No fake payment ${reference}`);
  p.createdAt = new Date(new Date(p.createdAt).getTime() - ms);
  save();
}

const CHECKOUT_TTL_MS = 30 * 60_000;
/** Like the sandbox: a checkout nobody completed within 30 minutes reports "expired" from then on. */
function expireIfDue(p: FakePayment): FakePayment {
  if (p.status === "pending" && Date.now() - new Date(p.createdAt).getTime() > CHECKOUT_TTL_MS) {
    p.status = "expired";
    save();
  }
  return p;
}

/** Test helper: start from an empty bank. */
export function resetFakeBank(): void {
  g.levypassFakeBank = { payments: new Map(), settled: [], seq: 0 };
  save();
}

const fee = (channel: string, amount: Kobo) => (channel === "card" ? Math.min(Math.round(amount * 0.015), 200_000) : 5_000);
const naira = (k: Kobo) => k / 100;

function eventData(p: FakePayment) {
  return { reference: p.reference, amount: naira(p.amountKobo), amount_paid: naira(p.paidKobo), currency: "NGN", status: p.status, channel: p.channel, merchant_id: "mer_fake", metadata: null };
}

/** Delivers a signed webhook to our own handler, a moment later, like the real bank. */
function deliver(event: string, data: Record<string, unknown>): void {
  const hook = state().webhook;
  if (!hook) return;
  const body = JSON.stringify({ event, event_id: `evt_F${randomBytes(5).toString("hex").toUpperCase()}${(++state().seq).toString(36).toUpperCase()}`, created_at: new Date().toISOString(), data, attempt: 1 });
  setTimeout(() => {
    void (async () => {
      const ts = String(Math.floor(Date.now() / 1000));
      const sig = `sha256=${createHmac("sha256", hook.secret).update(`${ts}.${body}`).digest("hex")}`;
      const { handleBankWebhook } = await import("@/server/payments/webhook");
      const res = await handleBankWebhook(body, new Headers({ "x-forge-event": event, "x-forge-timestamp": ts, "x-forge-signature": sig }));
      log(res.status === 200 ? "debug" : "warn", "fakebank.delivered", { event, status: res.status, body: res.body });
    })().catch((error) => log("error", "fakebank.deliver_failed", { event, ...errorFields(error) }));
  }, 250);
}

function pay(reference: string, channel: string, paidKobo?: Kobo): FakePayment {
  const found = state().payments.get(reference);
  if (!found) throw new BankError("NOT_FOUND", 404, `No payment with reference ${reference}`);
  const p = expireIfDue(found);
  if (p.status === "expired") throw new BankError("CHECKOUT_EXPIRED", 422, `Checkout ${reference} has expired`);
  const amount = paidKobo ?? p.amountKobo - p.paidKobo;
  p.paidKobo += amount;
  p.channel = channel;
  if (p.paidKobo >= p.amountKobo) {
    p.status = "successful";
    p.feeKobo = fee(channel, p.amountKobo);
    p.paidAt = new Date();
    deliver("payment.successful", eventData(p));
    if (p.paidKobo > p.amountKobo) deliver("payment.overpaid", eventData(p));
  } else {
    deliver("payment.partial", eventData(p));
  }
  save();
  return p;
}

function pendingSettlements(): Settlement[] {
  const byDate = new Map<string, FakePayment[]>();
  const settledRefs = new Set(state().settled.flatMap((s) => s.transactions.map((t) => t.reference)));
  for (const p of state().payments.values()) {
    if (p.status !== "successful" || settledRefs.has(p.reference) || !p.paidAt) continue;
    const d = lagosDate(p.paidAt);
    byDate.set(d, [...(byDate.get(d) ?? []), p]);
  }
  return [...byDate.entries()].map(([date, ps]) => {
    const gross = ps.reduce((s, p) => s + p.amountKobo, 0);
    const fees = ps.reduce((s, p) => s + p.feeKobo, 0);
    return {
      settlementId: null,
      salesDate: date,
      status: "pending",
      scheduledFor: null,
      settledAt: null,
      settlementAccount: "0123456793",
      grossKobo: gross,
      feesKobo: fees,
      netKobo: gross - fees,
      transactions: ps.map((p) => ({ reference: p.reference, channel: p.channel ?? "unknown", amountKobo: p.amountKobo, feeKobo: p.feeKobo })),
    };
  });
}

export function fakeBank(): BankPort {
  return {
    provider: "fake",
    async createCheckout(req) {
      if (req.reference.startsWith("DUP-") || state().payments.has(req.reference)) throw new BankError("DUPLICATE_REQUEST", 409, `Reference ${req.reference} has already been used`);
      const p: FakePayment = { reference: req.reference, amountKobo: req.amountKobo, paidKobo: 0, status: "pending", channel: null, feeKobo: 0, paidAt: null, createdAt: new Date() };
      state().payments.set(req.reference, p);
      save();
      deliver("payment.pending", eventData(p));
      const code = String(1000 + (state().payments.size % 9000));
      return {
        reference: req.reference,
        status: "pending",
        paymentUrl: `/sim/checkout/${encodeURIComponent(req.reference)}`,
        ussdCode: `*7272*000*${code}#`,
        transferAccount: { accountNumber: `99${String(Date.now()).slice(-8)}`, accountName: "FORGE / LEVYPASS COLLECTIONS", bankName: "Xtradot Bank" },
        expiresAt: new Date(Date.now() + 30 * 60_000),
      };
    },
    async verifyPayment(reference) {
      const found = state().payments.get(reference);
      if (!found) return null;
      const p = expireIfDue(found);
      return { reference, status: p.status, amountKobo: p.amountKobo, amountPaidKobo: p.paidKobo, feeKobo: p.status === "successful" ? p.feeKobo : 0, settlementKobo: p.status === "successful" ? p.amountKobo - p.feeKobo : 0, channel: p.channel, paidAt: p.paidAt };
    },
    async simulateUssd(reference) {
      pay(reference, "ussd");
    },
    async simulateTransfer(reference, amountKobo) {
      pay(reference, "bank_transfer", amountKobo);
    },
    async listSettlements() {
      return [...state().settled, ...pendingSettlements()];
    },
    async runSettlements() {
      const now = new Date();
      const batches = pendingSettlements().map((s) => ({ ...s, settlementId: `stl_fake${String(state().settled.length + 1).padStart(3, "0")}`, status: "settled", settledAt: now }));
      state().settled.push(...batches);
      save();
      for (const b of batches) deliver("settlement.completed", { settlement_id: b.settlementId, sales_date: b.salesDate, gross_amount: naira(b.grossKobo), fees: naira(b.feesKobo), net_amount: naira(b.netKobo) });
      return batches;
    },
    async reconcile(date, records) {
      const bankLines = (await this.listSettlements()).filter((s) => s.salesDate === date).flatMap((s) => s.transactions);
      const bank = new Map(bankLines.map((t) => [t.reference, t.amountKobo]));
      const ours = new Map(records.map((r) => [r.reference, r.amountKobo]));
      return {
        matched: records.filter((r) => bank.get(r.reference) === r.amountKobo),
        amountMismatch: records.filter((r) => bank.has(r.reference) && bank.get(r.reference) !== r.amountKobo).map((r) => ({ reference: r.reference, levypassKobo: r.amountKobo, bankKobo: bank.get(r.reference)! })),
        onlyInLevypass: records.filter((r) => !bank.has(r.reference)),
        onlyAtBank: bankLines.filter((t) => !ours.has(t.reference)).map((t) => ({ reference: t.reference, amountKobo: t.amountKobo })),
      };
    },
    async registerWebhook(url) {
      const hook = { id: `whk_fake${randomBytes(3).toString("hex")}`, secret: randomBytes(24).toString("hex"), url };
      state().webhook = hook;
      save();
      return { id: hook.id, secret: hook.secret };
    },
    async deleteWebhook(id) {
      if (state().webhook?.id === id) state().webhook = undefined;
      save();
    },
    async replayDelivery() {
      throw new BankError("NOT_SUPPORTED", 400, "The fake bank replays through the failure panel instead");
    },
  };
}

/** The fake bank's current webhook secret, so a restarted dev server can re-register. */
export function fakeWebhookRegistered(): boolean {
  return Boolean(state().webhook);
}
