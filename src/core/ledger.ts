import { assertKobo, type Kobo } from "./money";

// Ledger account names. Each ledger row moves an amount from `debitAccount` to `creditAccount`.
// A balance is credits minus debits, so revenue and trader credit are positive and the
// collection account (money the bank holds for the authority) is negative.
export const accounts = {
  trader: (traderId: string) => `trader:${traderId}`,
  levyRevenue: (authorityId: string) => `levy_revenue:${authorityId}`,
  collection: (authorityId: string) => `collection:${authorityId}`,
  bankFees: "bank_fees",
  suspense: "suspense",
  /** Money an officer paid into the government account ahead of taking cash from traders. */
  officerFloat: (officerId: string) => `officer_float:${officerId}`,
} as const;

export type Posting = { debitAccount: string; creditAccount: string; amountKobo: Kobo };

export function balances(postings: readonly Posting[]): Map<string, Kobo> {
  const out = new Map<string, Kobo>();
  for (const p of postings) {
    assertKobo(p.amountKobo);
    out.set(p.creditAccount, (out.get(p.creditAccount) ?? 0) + p.amountKobo);
    out.set(p.debitAccount, (out.get(p.debitAccount) ?? 0) - p.amountKobo);
  }
  return out;
}
