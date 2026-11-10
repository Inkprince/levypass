import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "./webhook-signature";

const secret = "whsec_test_only";
const body = '{"event":"payment.successful","event_id":"evt_1","data":{"reference":"pay_x"}}';
const now = 1_794_328_800;
const sign = (ts: number, raw = body, key = secret) => `sha256=${createHmac("sha256", key).update(`${ts}.${raw}`).digest("hex")}`;

describe("verifyWebhookSignature", () => {
  it("accepts a correct signature inside the window", () => {
    expect(verifyWebhookSignature({ secret, rawBody: body, timestamp: String(now - 10), signature: sign(now - 10), nowSeconds: now })).toEqual({ ok: true });
  });

  it("rejects a forged signature", () => {
    expect(verifyWebhookSignature({ secret, rawBody: body, timestamp: String(now), signature: sign(now, body, "wrong"), nowSeconds: now })).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a body changed after signing", () => {
    expect(verifyWebhookSignature({ secret, rawBody: body.replace("pay_x", "pay_y"), timestamp: String(now), signature: sign(now), nowSeconds: now }).ok).toBe(false);
  });

  it("rejects a timestamp older than five minutes, and one too far ahead", () => {
    expect(verifyWebhookSignature({ secret, rawBody: body, timestamp: String(now - 301), signature: sign(now - 301), nowSeconds: now })).toEqual({ ok: false, reason: "stale_timestamp" });
    expect(verifyWebhookSignature({ secret, rawBody: body, timestamp: String(now + 301), signature: sign(now + 301), nowSeconds: now }).ok).toBe(false);
  });

  it.each([undefined, "", "sha256=", "md5=abc", "sha256=zz"])("rejects a malformed signature header %j", (signature) => {
    expect(verifyWebhookSignature({ secret, rawBody: body, timestamp: String(now), signature, nowSeconds: now }).ok).toBe(false);
  });

  it("rejects a missing or non-numeric timestamp", () => {
    expect(verifyWebhookSignature({ secret, rawBody: body, timestamp: undefined, signature: sign(now), nowSeconds: now }).ok).toBe(false);
    expect(verifyWebhookSignature({ secret, rawBody: body, timestamp: "abc", signature: sign(now), nowSeconds: now }).ok).toBe(false);
  });
});
