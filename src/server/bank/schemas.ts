import { z } from "zod";
import { ngnToKobo } from "@/core/money";

// Zod schemas for the sandbox responses captured in T4 (docs/bank-api-notes.md).
// Unknown extra fields are allowed and ignored. Amounts are JSON numbers in naira.

const ngn = z.number().nonnegative().transform((n) => ngnToKobo(n));
// What is left after the bank's fee. The ₦50 flat fee is charged whatever the amount, so a payment
// under ₦50 comes back negative (captured 11 Nov: amount 20, merchant_fee 50, settlement_amount -30).
const netNgn = z.number().transform((n) => ngnToKobo(n, { allowNegative: true }));
const isoDate = z.string().transform((s) => new Date(s));

export const errorEnvelope = z.object({
  status: z.literal("error"),
  error: z.object({ code: z.string(), message: z.string(), field: z.string().optional() }),
  request_id: z.string().optional(),
});

export function successEnvelope<T extends z.ZodType>(data: T) {
  return z.object({ status: z.literal("success"), message: z.string().optional(), data, request_id: z.string() });
}

export const checkoutData = z.object({
  reference: z.string(),
  amount: ngn,
  status: z.string(),
  payment_url: z.string(),
  expires_at: isoDate,
  ussd: z.object({ code: z.string() }),
  bank_transfer: z.object({ account_number: z.string(), account_name: z.string(), bank_name: z.string() }),
});

export const paymentData = z.object({
  reference: z.string(),
  // "expired" is what verify reports once an unpaid checkout passes expires_at (captured 11 Nov).
  status: z.enum(["pending", "successful", "failed", "reversed", "expired"]),
  amount: ngn,
  amount_paid: ngn,
  merchant_fee: ngn,
  settlement_amount: netNgn,
  channel: z.string().nullable(),
  paid_at: z.string().nullable().transform((s) => (s ? new Date(s) : null)),
});

export const settlementData = z.object({
  settlement_id: z.string().nullable(),
  sales_date: z.string(),
  status: z.string(),
  scheduled_for: z.string().nullable().optional().transform((s) => (s ? new Date(s) : null)),
  settled_at: z.string().nullable().transform((s) => (s ? new Date(s) : null)),
  settlement_account: z.string(),
  gross_amount: ngn,
  fees: ngn,
  // gross_amount - fees. Not yet captured below zero, but a batch holding only sub-₦50 payments must be.
  net_amount: netNgn,
  transactions: z.array(z.object({ reference: z.string(), channel: z.string(), amount: ngn, fee: ngn })),
});

const recRecord = z.object({ reference: z.string(), amount: ngn });
export const reconciliationData = z.object({
  matched: z.array(recRecord),
  amount_mismatch: z.array(z.object({ reference: z.string(), yours: ngn, ours: ngn })),
  missing_in_ledger: z.array(recRecord),
  missing_in_yours: z.array(recRecord),
});

export const webhookRegistered = z.object({ webhook_id: z.string(), url: z.string(), webhook_secret: z.string() });

/** Webhook body: {event, event_id, created_at, data, attempt}. */
export const webhookBody = z.object({
  event: z.string(),
  event_id: z.string(),
  created_at: z.string(),
  data: z.record(z.string(), z.unknown()),
  attempt: z.number().optional(),
});

export const paymentEventData = z.object({ reference: z.string(), status: z.string(), amount: ngn, amount_paid: ngn });
