// Money rule 1: integer kobo inside, NGN with two decimals at the bank boundary.
// This file is the one place that converts. Nothing here multiplies a float by 100.

export type Kobo = number;

export function assertKobo(value: number): Kobo {
  if (!Number.isSafeInteger(value)) throw new RangeError(`not a whole, safe kobo amount: ${value}`);
  return value;
}

/** Kobo to the bank's NGN string, for example 50000 -> "500.00". */
export function koboToNgn(kobo: Kobo): string {
  assertKobo(kobo);
  const sign = kobo < 0 ? "-" : "";
  const abs = Math.abs(kobo);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const ngnPattern = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/**
 * An NGN amount from the bank (string such as "500.00", or a JSON number such as 500.5) to kobo.
 * Numbers are read through their shortest decimal representation, so 1.13 becomes 113, not 112.
 * Throws on anything with more than two decimals, separators, exponents or stray characters.
 */
export function ngnToKobo(value: string | number, options: { allowNegative?: boolean } = {}): Kobo {
  let text: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError(`not a finite amount: ${value}`);
    text = String(value);
    if (/e/i.test(text)) throw new RangeError(`amount out of range: ${value}`);
  } else {
    text = value;
  }
  const m = ngnPattern.exec(text);
  if (!m) throw new RangeError(`not an NGN amount with at most two decimals: ${JSON.stringify(value)}`);
  const [, sign, whole = "", fraction = ""] = m;
  if (sign && !options.allowNegative) throw new RangeError(`negative amount not allowed: ${text}`);
  const kobo = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(kobo)) throw new RangeError(`amount out of range: ${text}`);
  return sign ? -kobo : kobo;
}

/** Whole naira (levy amounts are always whole naira) to kobo. */
export function nairaToKobo(naira: number): Kobo {
  if (!Number.isSafeInteger(naira)) throw new RangeError(`levy amounts are whole naira: ${naira}`);
  return assertKobo(naira * 100);
}

/** For people: "₦1,500.00". */
export function formatNaira(kobo: Kobo): string {
  const ngn = koboToNgn(kobo);
  const negative = ngn.startsWith("-");
  const [whole = "0", fraction = "00"] = (negative ? ngn.slice(1) : ngn).split(".");
  return `${negative ? "-" : ""}₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
