import "server-only";
import { eq, sql } from "drizzle-orm";
import { newId } from "@/core/ids";
import { verifyWebhookSignature } from "@/core/webhook-signature";
import { webhookBody, paymentEventData } from "@/server/bank/schemas";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { errorFields, log } from "@/server/log";
import { settlePayment } from "./settle";
import { webhookSecret } from "./webhook-setup";

export type WebhookResult = { status: number; body: Record<string, unknown> };

/**
 * POST /api/webhooks/bank. Signature over the raw body first (rule 8), then de-duplication on
 * event_id (rule 4), then a fast 2xx. Settlement runs after the response and verifies with the
 * bank itself (rule 3); the poller retries anything that does not finish.
 */
export async function handleBankWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
  const secret = await webhookSecret();
  if (!secret) return { status: 503, body: { error: "webhook not configured" } };
  const check = verifyWebhookSignature({
    secret,
    rawBody,
    timestamp: headers.get("x-forge-timestamp"),
    signature: headers.get("x-forge-signature"),
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!check.ok) {
    log("warn", "webhook.rejected", { reason: check.reason, event: headers.get("x-forge-event") });
    return { status: 401, body: { error: check.reason } };
  }

  let parsed;
  try {
    parsed = webhookBody.parse(JSON.parse(rawBody));
  } catch {
    return { status: 400, body: { error: "malformed body" } };
  }
  const inserted = await db()
    .insert(s.webhookEvents)
    .values({ id: newId("whe"), eventId: parsed.event_id, eventType: parsed.event, payload: parsed as unknown as object })
    .onConflictDoNothing()
    .returning({ id: s.webhookEvents.id });
  if (!inserted.length) {
    log("info", "webhook.duplicate", { event_id: parsed.event_id, event: parsed.event });
    return { status: 200, body: { duplicate: true } };
  }

  void processEvent(inserted[0]!.id, parsed.event, parsed.data).catch((error) => log("error", "webhook.process_failed", { event_id: parsed.event_id, ...errorFields(error) }));
  return { status: 200, body: { received: true } };
}

async function markProcessed(rowId: string, error?: string) {
  await db().update(s.webhookEvents).set({ processedAt: sql`now()`, processingError: error ?? null, attempts: sql`${s.webhookEvents.attempts} + 1` }).where(eq(s.webhookEvents.id, rowId));
}

async function processEvent(rowId: string, event: string, data: Record<string, unknown>): Promise<void> {
  if (event.startsWith("payment.")) {
    const d = paymentEventData.safeParse(data);
    if (!d.success) return markProcessed(rowId, "unexpected payment event shape");
    const [payment] = await db().select().from(s.payments).where(eq(s.payments.providerRef, d.data.reference));
    if (!payment) {
      // Money rule 7: a payment we did not start. Keep it for review with its reference.
      if (event === "payment.successful") {
        await db().insert(s.reviewItems).values({ id: newId("rev"), kind: "unknown_reference", provider: "xtradot", providerRef: d.data.reference, amountKobo: d.data.amount, details: { event } });
      }
      return markProcessed(rowId, "unknown reference");
    }
    if ((payment.providerData as { demoWithholdWebhook?: boolean }).demoWithholdWebhook) {
      return markProcessed(rowId, "withheld for the failure demo: the poller must settle this payment");
    }
    if (event === "payment.successful" || event === "payment.overpaid" || event === "payment.partial" || event === "payment.failed") {
      const outcome = await settlePayment(payment.id);
      return markProcessed(rowId, outcome.kind === "settled" || outcome.kind === "already_settled" ? undefined : `not settled: ${outcome.kind}`);
    }
    return markProcessed(rowId);
  }
  if (event === "virtual_account.credited") {
    // LevyPass collects through checkouts; an inflow to a virtual account is unmatched money.
    const ref = typeof data.session_id === "string" ? data.session_id : "unknown";
    await db().insert(s.reviewItems).values({ id: newId("rev"), kind: "virtual_account_inflow", provider: "xtradot", providerRef: ref, details: data as object });
    return markProcessed(rowId);
  }
  return markProcessed(rowId); // webhook.test, settlement.completed and others: recorded only
}
