// How often the poller asks the bank about a payment that is not final yet (PY-04, money rule 5).
// Every question is one of our 60 requests a minute, so the gap grows with the payment's age:
// a withheld webhook still settles within seconds, and a pay page somebody opened and left
// costs about 40 calls before the bank expires it instead of one call every tick.

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

/** Leave the first seconds to the webhook. */
export const REQUERY_FIRST_MS = 15 * SECOND;
/** After this the payment is left for a person to look at. */
export const REQUERY_GIVE_UP_MS = 6 * 60 * MINUTE;

/** The shortest time between two questions about one payment of this age. Zero means every tick. */
export function requeryGapMs(ageMs: number): number {
  if (ageMs < 2 * MINUTE) return 0;
  if (ageMs < 10 * MINUTE) return 30 * SECOND;
  return 2 * MINUTE;
}

export function requeryDue(payment: { ageMs: number; sinceLastTryMs: number }): boolean {
  if (payment.ageMs < REQUERY_FIRST_MS || payment.ageMs >= REQUERY_GIVE_UP_MS) return false;
  return payment.sinceLastTryMs >= requeryGapMs(payment.ageMs);
}
