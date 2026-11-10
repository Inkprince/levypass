// Signed QR tokens (TR-03, OF-07). Ed25519 through WebCrypto, so the same code verifies on the
// server and, later, offline in the officer PWA with only the public key (stretch S1).
//
// Token: v1.<subject id>.<token id>.<base64url signature>, about 130 characters, URL-safe.
// The subject is a trader (trd_) or officer (off_) ID. The token ID lets us cancel a token by
// issuing a new one (TR-08); checking it against the database is the caller's job.

import { isId } from "./ids";

const algorithm = { name: "Ed25519" } as const;
const domain = "levypass-qr:";
const tokenIdPattern = /^[A-Za-z0-9_-]{1,32}$/;

export type TokenClaims = { subjectId: string; tokenId: string };
export type VerifiedToken = TokenClaims & { kind: "trader" | "officer" };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const encode = (text: string) => new TextEncoder().encode(domain + text);

function kindOf(subjectId: string): VerifiedToken["kind"] | null {
  if (isId("trd", subjectId)) return "trader";
  if (isId("off", subjectId)) return "officer";
  return null;
}

/** New private key as base64 PKCS8, for QR_SIGNING_KEY. */
export async function generateSigningKeyPkcs8(): Promise<string> {
  const pair = (await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"])) as CryptoKeyPair;
  return toBase64Url(new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey)));
}

/** Imports QR_SIGNING_KEY and derives its public key. Accepts base64 or base64url. */
export async function importSigningKey(pkcs8: string): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey; publicKeyBase64: string }> {
  const der = fromBase64Url(pkcs8.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  if (!der) throw new Error("QR signing key is not base64");
  const privateKey = await crypto.subtle.importKey("pkcs8", der, algorithm, true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  if (!jwk.x) throw new Error("QR signing key has no public part");
  const publicKeyBase64 = jwk.x; // raw 32-byte public key, base64url
  return { privateKey, publicKey: await importVerifyKey(publicKeyBase64), publicKeyBase64 };
}

export async function importVerifyKey(rawBase64Url: string): Promise<CryptoKey> {
  const raw = fromBase64Url(rawBase64Url);
  if (!raw || raw.length !== 32) throw new Error("not an Ed25519 public key");
  return crypto.subtle.importKey("raw", raw, algorithm, true, ["verify"]);
}

export async function signToken(privateKey: CryptoKey, claims: TokenClaims): Promise<string> {
  if (!kindOf(claims.subjectId)) throw new Error("token subject must be a trader or officer ID");
  if (!tokenIdPattern.test(claims.tokenId)) throw new Error("token ID must be 1 to 32 URL-safe characters");
  const payload = `v1.${claims.subjectId}.${claims.tokenId}`;
  const signature = new Uint8Array(await crypto.subtle.sign(algorithm, privateKey, encode(payload)));
  return `${payload}.${toBase64Url(signature)}`;
}

/** The token's claims if the signature is good, otherwise null. Never throws on bad input. */
export async function verifyToken(publicKey: CryptoKey, token: string): Promise<VerifiedToken | null> {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, subjectId = "", tokenId = "", sig = ""] = parts;
  const kind = kindOf(subjectId);
  if (version !== "v1" || !kind || !tokenIdPattern.test(tokenId)) return null;
  const signature = fromBase64Url(sig);
  if (!signature || signature.length !== 64) return null;
  try {
    const ok = await crypto.subtle.verify(algorithm, publicKey, signature, encode(`v1.${subjectId}.${tokenId}`));
    return ok ? { kind, subjectId, tokenId } : null;
  } catch {
    return null;
  }
}
