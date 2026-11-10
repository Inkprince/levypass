import { assertKobo, type Kobo } from "./money";
import { nextPeriod, periodFor, periodForDate, periodsFrom, type LevyPeriod, type Period } from "./periods";

/** A levy as it applies to one trader (trader_levies joined to levy_types). */
export type LevyAssignment = {
  levyTypeId: string;
  period: LevyPeriod;
  amountKobo: Kobo;
  startDate: string; // Lagos date
  exemption?: string | null;
};

export type NewObligation = { levyTypeId: string; periodStart: Date; periodEnd: Date; amountDueKobo: Kobo };

const toObligation = (a: LevyAssignment, p: Period): NewObligation => ({
  levyTypeId: a.levyTypeId,
  periodStart: p.start,
  periodEnd: p.end,
  amountDueKobo: assertKobo(a.amountKobo),
});

/**
 * Obligations a trader owes up to now: one per period from the one containing the start date to
 * the one containing `asOf`. The period containing the start date is owed in full. Exempt: none.
 */
export function dueObligations(a: LevyAssignment, asOf: Date): NewObligation[] {
  if (a.exemption) return [];
  return periodsFrom(a.period, a.startDate, asOf).map((p) => toObligation(a, p));
}

export function compareObligations(
  x: { periodStart: Date; periodEnd: Date; levyTypeId: string },
  y: { periodStart: Date; periodEnd: Date; levyTypeId: string },
): number {
  return (
    x.periodStart.getTime() - y.periodStart.getTime() ||
    x.periodEnd.getTime() - y.periodEnd.getTime() ||
    (x.levyTypeId < y.levyTypeId ? -1 : x.levyTypeId > y.levyTypeId ? 1 : 0)
  );
}

/**
 * The next `count` obligations after the period containing `after`, across all levies, in the
 * order allocation fills them: earliest start first, then the period that ends first.
 */
export function futureObligations(assignments: readonly LevyAssignment[], after: Date, count: number): NewObligation[] {
  const all: NewObligation[] = [];
  for (const a of assignments) {
    if (a.exemption) continue;
    const firstOwed = periodForDate(a.period, a.startDate);
    let p = nextPeriod(a.period, periodFor(a.period, after));
    if (firstOwed.start > p.start) p = firstOwed;
    for (let i = 0; i < count; i++, p = nextPeriod(a.period, p)) all.push(toObligation(a, p));
  }
  return all.sort(compareObligations).slice(0, count);
}
