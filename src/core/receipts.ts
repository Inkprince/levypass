// Receipt numbers: LP-XXXX-XXXXC. Eight random Crockford base32 characters (40 bits) and a
// Luhn mod 32 check character, so a mistyped number is told apart from a made-up one before
// any database lookup. Genuineness is still decided by the database (RC-03, FR-02).

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const n = alphabet.length; // 32
const bodyLength = 8;

function luhnSum(codes: readonly number[], startFactor: 1 | 2): number {
  let factor = startFactor;
  let sum = 0;
  for (let i = codes.length - 1; i >= 0; i--) {
    const addend = factor * (codes[i] ?? 0);
    sum += Math.floor(addend / n) + (addend % n);
    factor = factor === 2 ? 1 : 2;
  }
  return sum;
}

function checkCharacter(codes: readonly number[]): string {
  return alphabet[(n - (luhnSum(codes, 2) % n)) % n]!;
}

const format = (chars: string) => `LP-${chars.slice(0, 4)}-${chars.slice(4)}`;

export function newReceiptNumber(randomBytes: () => Uint8Array = () => crypto.getRandomValues(new Uint8Array(bodyLength))): string {
  const bytes = randomBytes();
  const codes = Array.from({ length: bodyLength }, (_, i) => (bytes[i] ?? 0) & 31);
  return format(codes.map((c) => alphabet[c]).join("") + checkCharacter(codes));
}

/**
 * Normalises what a person typed (case, spaces, hyphens, the LP prefix, O for 0, I or L for 1)
 * and returns the canonical number, or null if it cannot be a LevyPass receipt number.
 */
export function parseReceiptNumber(input: string): string | null {
  let s = input.replace(/[\s-]/g, "").toUpperCase();
  if (s.length === bodyLength + 3 && s.startsWith("LP")) s = s.slice(2);
  if (s.length !== bodyLength + 1) return null;
  s = s.replace(/O/g, "0").replace(/[IL]/g, "1");
  const codes = [...s].map((c) => alphabet.indexOf(c));
  if (codes.some((c) => c < 0)) return null;
  return luhnSum(codes, 1) % n === 0 ? format(s) : null;
}
