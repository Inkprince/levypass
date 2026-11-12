import { assertKobo, type Kobo } from "./money";

// Officer cash floats. An officer pays a float into the government account first; each cash levy they
// take afterwards is paid out of that float, so the government already holds the money before any
// cash changes hands. Floats are accounted one by one: every cash collection is charged to the
// oldest float that still has money, so each float ends with a list of the receipts it paid for.

export type FloatLoad = { id: string; amountKobo: Kobo; loadedAt: Date };
export type CashSpend = { paymentId: string; amountKobo: Kobo; at: Date };

export type FloatStatement = {
  id: string;
  amountKobo: Kobo;
  loadedAt: Date;
  usedKobo: Kobo;
  remainingKobo: Kobo;
  usedUp: boolean;
  /** The part of each cash collection this float paid for. One collection can span two floats. */
  collections: CashSpend[];
};

export type FloatStatements = {
  floats: FloatStatement[];
  balanceKobo: Kobo;
  /** Cash recorded beyond every loaded float. Never expected; shown, not hidden, if it happens. */
  overspentKobo: Kobo;
};

export function floatStatements(loads: readonly FloatLoad[], spends: readonly CashSpend[]): FloatStatements {
  for (const l of loads) assertKobo(l.amountKobo);
  for (const s of spends) assertKobo(s.amountKobo);

  const floats: FloatStatement[] = [...loads]
    .sort((a, b) => a.loadedAt.getTime() - b.loadedAt.getTime() || a.id.localeCompare(b.id))
    .map((l) => ({ id: l.id, amountKobo: l.amountKobo, loadedAt: l.loadedAt, usedKobo: 0, remainingKobo: l.amountKobo, usedUp: l.amountKobo === 0, collections: [] }));

  let overspent = 0;
  let i = 0;
  for (const spend of [...spends].sort((a, b) => a.at.getTime() - b.at.getTime() || a.paymentId.localeCompare(b.paymentId))) {
    let left = spend.amountKobo;
    while (left > 0 && i < floats.length) {
      const f = floats[i]!;
      const take = Math.min(left, f.remainingKobo);
      if (take > 0) {
        f.collections.push({ paymentId: spend.paymentId, amountKobo: take, at: spend.at });
        f.usedKobo += take;
        f.remainingKobo -= take;
        left -= take;
      }
      if (f.remainingKobo === 0) {
        f.usedUp = true;
        i++;
      }
    }
    overspent += left;
  }

  const loaded = floats.reduce((x, f) => x + f.amountKobo, 0);
  const spent = spends.reduce((x, s) => x + s.amountKobo, 0);
  return { floats, balanceKobo: loaded - spent, overspentKobo: overspent };
}

/** "OTT-001-R03": the officer's staff ID and the number of this advance remittance for that officer. */
export function floatLabel(staffId: string, seq: number): string {
  return `${staffId}-R${String(seq).padStart(2, "0")}`;
}

/** Float amounts an officer can ask the revenue office for. Whole naira (money rule 11). */
export const floatAmountsKobo: readonly Kobo[] = [1_000_000, 2_000_000, 5_000_000];
