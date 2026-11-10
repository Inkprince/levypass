import { describe, expect, it } from "vitest";
import { z } from "zod";
import captured from "./fixtures/sandbox-captured.json";
import * as S from "./schemas";

// Every response here is a real sandbox capture from T4 (docs/bank-api-notes.md).
const ok = <T extends z.ZodType>(schema: T, fixture: { body: unknown }) => (S.successEnvelope(schema).parse(fixture.body) as { data: z.infer<T> }).data;

describe("bank schemas parse the captured sandbox responses", () => {
  it("checkout", () => {
    const d = ok(S.checkoutData, captured.checkout_created);
    expect(d).toMatchObject({ reference: "LPPROBE-PAY-001", amount: 50_000, ussd: { code: "*7272*000*8455#" } });
  });

  it("verify: pending, successful with the bank's fee, and 404", () => {
    expect(ok(S.paymentData, captured.verify_pending)).toMatchObject({ status: "pending", amount_paid: 0, merchant_fee: 0 });
    expect(ok(S.paymentData, captured.verify_successful_ussd)).toMatchObject({ status: "successful", amount: 50_000, merchant_fee: 5_000, settlement_amount: 45_000, channel: "ussd" });
    expect(S.errorEnvelope.parse(captured.verify_not_found.body).error.code).toBe("NOT_FOUND");
  });

  it("partial and overpaid payments", () => {
    expect(ok(S.paymentData, captured.partial)).toMatchObject({ status: "pending", amount_paid: 30_000 });
    expect(ok(S.paymentData, captured.overpaid)).toMatchObject({ amount: 50_000, amount_paid: 80_000, settlement_amount: 45_000 });
    expect(ok(S.paymentData, captured.card_success)).toMatchObject({ merchant_fee: 3_000, channel: "card" });
  });

  it("settlements, the settlement run and reconciliation", () => {
    const list = ok(z.array(S.settlementData), captured.settlements);
    expect(list[0]).toMatchObject({ gross_amount: 150_005, fees: 15_000, net_amount: 135_005 });
    expect(ok(z.array(S.settlementData), captured.settlement_run)[0]?.settlement_id).toBe("stl_0091");
    const rec = ok(S.reconciliationData, captured.reconciliation);
    expect(rec.amount_mismatch[0]).toEqual({ reference: "LPPROBE-PAY-002", yours: 70_000, ours: 50_000 });
    expect(rec.missing_in_yours[0]?.amount).toBe(50_005);
  });

  it("idempotency conflict and BVN mismatch errors", () => {
    expect(S.errorEnvelope.parse(captured.idempotency_conflict.body).error.code).toBe("DUPLICATE_REQUEST");
    expect(S.errorEnvelope.parse(captured.va_bvn_mismatch.body).error.code).toBe("BVN_MISMATCH");
  });

  it("webhook bodies, as delivered", () => {
    for (const raw of Object.values(captured.webhooks)) expect(S.webhookBody.parse(JSON.parse(raw)).event_id).toMatch(/^evt_/);
    const paid = S.webhookBody.parse(JSON.parse(captured.webhooks["payment.successful"]));
    expect(S.paymentEventData.parse(paid.data)).toMatchObject({ status: "successful", amount: 50_000 });
  });
});
