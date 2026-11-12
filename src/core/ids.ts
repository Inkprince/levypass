// Prefixed, random, URL-safe IDs: `trd_` + 20 Crockford base32 characters (100 bits).

export const idPrefixes = [
  "aut", // authority
  "mkt", // market
  "lvt", // levy type
  "trd", // trader
  "va", // virtual account
  "obl", // obligation
  "pay", // payment
  "led", // ledger entry
  "jnl", // ledger journal (entries posted together)
  "rcp", // receipt
  "off", // officer
  "adm", // admin
  "scn", // scan
  "flg", // fraud flag
  "cmp", // complaint
  "aud", // audit log
  "whe", // webhook event
  "obx", // outbox message
  "bkc", // bank call
  "otp", // one-time code
  "rev", // review item
  "ses", // session
  "flt", // officer cash float
  "csh", // cash handover (trader asked to pay cash, or confirms cash an officer took)
] as const;

export type IdPrefix = (typeof idPrefixes)[number];

const alphabet = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford base32, lower case
const bodyLength = 20;

/** Encodes the low 5 bits of each byte. Callers pass uniformly random or hashed bytes. */
export function encodeIdBody(bytes: Uint8Array): string {
  if (bytes.length < bodyLength) throw new Error(`need ${bodyLength} bytes, got ${bytes.length}`);
  let out = "";
  for (let i = 0; i < bodyLength; i++) out += alphabet[(bytes[i] ?? 0) & 31];
  return out;
}

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${encodeIdBody(crypto.getRandomValues(new Uint8Array(bodyLength)))}`;
}

const pattern = /^([a-z]{2,3})_([0-9a-hjkmnp-tv-z]{20})$/;

export function isId(prefix: IdPrefix, value: string): boolean {
  const m = pattern.exec(value);
  return m !== null && m[1] === prefix;
}

export function idPrefixOf(value: string): IdPrefix | undefined {
  const p = pattern.exec(value)?.[1];
  return (idPrefixes as readonly string[]).includes(p ?? "") ? (p as IdPrefix) : undefined;
}
