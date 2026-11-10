import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Officer PINs and admin passwords. Format: scrypt$N$r$p$<salt b64>$<hash b64>.
const params = { N: 16_384, r: 8, p: 1 } as const;
const keyLength = 32;

function scrypt(secret: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(secret, salt, keyLength, options, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(secret, salt, params);
  return ["scrypt", params.N, params.r, params.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64 ?? "", "base64");
  if (expected.length !== keyLength) return false;
  const key = await scrypt(secret, Buffer.from(saltB64 ?? "", "base64"), { N: Number(n), r: Number(r), p: Number(p) });
  return timingSafeEqual(key, expected);
}
