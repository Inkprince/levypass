import "server-only";
import { createHash } from "node:crypto";
import { importSigningKey } from "@/core/tokens";
import { env } from "./env";

// Ed25519 PKCS8 prefix for a raw 32-byte seed. Used only to derive a stable development key.
const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");

function devSeedKey(label: string): string {
  const seed = createHash("sha256").update(`levypass-dev:${label}`).digest();
  return Buffer.concat([pkcs8Prefix, seed]).toString("base64");
}

type Keys = Awaited<ReturnType<typeof importSigningKey>>;
let qrKeys: Promise<Keys> | undefined;

/** QR signing keys: QR_SIGNING_KEY in production, a fixed development key otherwise. */
export function qrSigningKeys(): Promise<Keys> {
  qrKeys ??= importSigningKey(env().QR_SIGNING_KEY ?? devSeedKey("qr"));
  return qrKeys;
}

/** Session HMAC secret: SESSION_SECRET in production, a fixed development value otherwise. */
export function sessionSecret(): string {
  return env().SESSION_SECRET ?? createHash("sha256").update("levypass-dev:session").digest("hex");
}
