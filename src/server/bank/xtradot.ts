import "server-only";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { koboToNgn } from "@/core/money";
import { newId } from "@/core/ids";
import { db } from "@/server/db/client";
import { bankCalls } from "@/server/db/schema";
import { env } from "@/server/env";
import { errorFields, log } from "@/server/log";
import { acquireSlot } from "@/server/outbound";
import { BankError, BankUnknownOutcome, type BankPort, type Settlement } from "./port";
import * as S from "./schemas";

const timeoutMs = 25_000; // the gateway gives up at 30 s

type CallOptions = { operation: string; body?: unknown; paymentId?: string; reference?: string };

function redact(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null).replace(/"webhook_secret":"[^"]*"/g, '"webhook_secret":"[redacted]"'));
}

/**
 * One HTTP call to the sandbox. POSTs carry an Idempotency-Key that is written to bank_calls
 * before the request leaves (money rule 4). A timeout, network error or 504 is recorded as
 * `unknown` and surfaces as BankUnknownOutcome: callers requery and never resend (rule 5).
 */
async function call<T extends z.ZodType>(method: "GET" | "POST" | "DELETE", path: string, data: T, opts: CallOptions): Promise<z.infer<T>> {
  const e = env();
  const key = method === "POST" ? crypto.randomUUID() : undefined;
  const callId = newId("bkc");
  if (key) {
    await db().insert(bankCalls).values({
      id: callId,
      idempotencyKey: key,
      operation: opts.operation,
      method,
      path,
      requestBody: (opts.body ?? null) as object | null,
      paymentId: opts.paymentId,
    });
  }
  const finish = async (status: "succeeded" | "failed" | "unknown", httpStatus: number | null, requestId: string | null, body: unknown) => {
    if (!key) return;
    await db()
      .update(bankCalls)
      .set({ status, httpStatus, requestId, responseBody: redact(body) as object, completedAt: sql`now()` })
      .where(eq(bankCalls.id, callId));
  };

  await acquireSlot();
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${e.BANK_API_BASE_URL}${path}`, {
      method,
      headers: {
        "x-api-key": e.GATEWAY_KEY ?? "",
        "content-type": "application/json",
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    await finish("unknown", null, null, { error: String(error) });
    log("warn", "bank.call_unknown", { operation: opts.operation, path, ms: Date.now() - started, ...errorFields(error) });
    throw new BankUnknownOutcome(`${opts.operation}: no response from the bank`, opts.reference);
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  const requestId = (json as { request_id?: string }).request_id ?? res.headers.get("x-request-id");
  log("info", "bank.call", { operation: opts.operation, method, path, status: res.status, request_id: requestId, ms: Date.now() - started, replayed: res.headers.get("idempotent-replayed") === "true" });

  if (res.status === 504) {
    await finish("unknown", 504, requestId, json);
    throw new BankUnknownOutcome(`${opts.operation}: bank timed out (504)`, opts.reference);
  }
  if (!res.ok) {
    await finish("failed", res.status, requestId, json);
    const err = S.errorEnvelope.safeParse(json);
    throw new BankError(err.success ? err.data.error.code : `HTTP_${res.status}`, res.status, err.success ? err.data.error.message : `Bank returned ${res.status}`, requestId ?? undefined);
  }
  const parsed = S.successEnvelope(data).safeParse(json);
  if (!parsed.success) {
    await finish("failed", res.status, requestId, json);
    log("error", "bank.unexpected_shape", { operation: opts.operation, request_id: requestId, issues: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`) });
    throw new BankError("UNEXPECTED_SHAPE", res.status, `${opts.operation}: response did not match the recorded shape`, requestId ?? undefined);
  }
  await finish("succeeded", res.status, requestId, json);
  return (parsed.data as { data: z.infer<T> }).data;
}

const toSettlement = (s: z.infer<typeof S.settlementData>): Settlement => ({
  settlementId: s.settlement_id,
  salesDate: s.sales_date,
  status: s.status,
  scheduledFor: s.scheduled_for,
  settledAt: s.settled_at,
  settlementAccount: s.settlement_account,
  grossKobo: s.gross_amount,
  feesKobo: s.fees,
  netKobo: s.net_amount,
  transactions: s.transactions.map((t) => ({ reference: t.reference, channel: t.channel, amountKobo: t.amount, feeKobo: t.fee })),
});

export function xtradotBank(): BankPort {
  const merchant = () => env().BANK_MERCHANT_ID;
  return {
    provider: "xtradot",
    async createCheckout(req, ctx) {
      const body = {
        merchant_id: merchant(),
        amount: Number(koboToNgn(req.amountKobo)),
        reference: req.reference,
        customer: { name: req.customerName },
        ...(req.callbackUrl ? { callback_url: req.callbackUrl } : {}),
      };
      const d = await call("POST", "/payments/checkout", S.checkoutData, { operation: "create_checkout", body, paymentId: ctx?.paymentId, reference: req.reference });
      return {
        reference: d.reference,
        status: d.status,
        paymentUrl: d.payment_url,
        ussdCode: d.ussd.code,
        transferAccount: { accountNumber: d.bank_transfer.account_number, accountName: d.bank_transfer.account_name, bankName: d.bank_transfer.bank_name },
        expiresAt: d.expires_at,
      };
    },
    async verifyPayment(reference) {
      try {
        const d = await call("GET", `/payments/${encodeURIComponent(reference)}/verify`, S.paymentData, { operation: "verify", reference });
        return { reference: d.reference, status: d.status, amountKobo: d.amount, amountPaidKobo: d.amount_paid, feeKobo: d.merchant_fee, settlementKobo: d.settlement_amount, channel: d.channel, paidAt: d.paid_at };
      } catch (error) {
        if (error instanceof BankError && error.httpStatus === 404) return null;
        throw error;
      }
    },
    async simulateUssd(reference) {
      await call("POST", `/payments/${encodeURIComponent(reference)}/simulate-ussd`, S.paymentData, { operation: "simulate_ussd", body: {}, reference });
    },
    async simulateTransfer(reference, amountKobo) {
      const body = amountKobo === undefined ? {} : { amount: Number(koboToNgn(amountKobo)) };
      await call("POST", `/payments/${encodeURIComponent(reference)}/simulate-transfer`, S.paymentData, { operation: "simulate_transfer", body, reference });
    },
    async listSettlements() {
      const d = await call("GET", `/settlements?merchant_id=${encodeURIComponent(merchant())}`, z.array(S.settlementData), { operation: "list_settlements" });
      return d.map(toSettlement);
    },
    async runSettlements() {
      const d = await call("POST", "/admin/settlements/run", z.array(S.settlementData), { operation: "run_settlements", body: {} });
      return d.map(toSettlement);
    },
    async reconcile(date, records) {
      const body = { merchant_id: merchant(), date, records: records.map((r) => ({ reference: r.reference, amount: Number(koboToNgn(r.amountKobo)) })) };
      const d = await call("POST", "/reconciliation", S.reconciliationData, { operation: "reconcile", body });
      return {
        matched: d.matched.map((r) => ({ reference: r.reference, amountKobo: r.amount })),
        amountMismatch: d.amount_mismatch.map((r) => ({ reference: r.reference, levypassKobo: r.yours, bankKobo: r.ours })),
        onlyInLevypass: d.missing_in_ledger.map((r) => ({ reference: r.reference, amountKobo: r.amount })),
        onlyAtBank: d.missing_in_yours.map((r) => ({ reference: r.reference, amountKobo: r.amount })),
      };
    },
    async registerWebhook(url) {
      const d = await call("POST", "/webhooks", S.webhookRegistered, { operation: "register_webhook", body: { url, events: ["*"] } });
      return { id: d.webhook_id, secret: d.webhook_secret };
    },
    async deleteWebhook(id) {
      await call("DELETE", `/webhooks/${encodeURIComponent(id)}`, z.unknown(), { operation: "delete_webhook" });
    },
    async replayDelivery(eventId) {
      await call("POST", `/webhooks/deliveries/${encodeURIComponent(eventId)}/replay`, z.unknown(), { operation: "replay_delivery", body: {} });
    },
  };
}
