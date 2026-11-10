import { createHmac, timingSafeEqual } from "node:crypto";

// Money rule 8: HMAC-SHA256 over "{timestamp}.{raw_body}", constant-time compare, 5-minute window.
// Matches the guide's reference check (page 10): "sha256=" + hex digest.

export type SignatureCheck = { ok: true } | { ok: false; reason: "missing_headers" | "stale_timestamp" | "bad_signature" };

export function verifyWebhookSignature(input: {
  secret: string;
  rawBody: string;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
  nowSeconds: number;
  toleranceSeconds?: number;
}): SignatureCheck {
  const { secret, rawBody, timestamp, signature, nowSeconds } = input;
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return { ok: false, reason: "missing_headers" };
  if (Math.abs(nowSeconds - Number(timestamp)) > (input.toleranceSeconds ?? 300)) return { ok: false, reason: "stale_timestamp" };
  const m = /^sha256=([0-9a-f]{64})$/.exec(signature.trim());
  if (!m) return { ok: false, reason: "bad_signature" };
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  const given = Buffer.from(m[1]!, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected) ? { ok: true } : { ok: false, reason: "bad_signature" };
}
