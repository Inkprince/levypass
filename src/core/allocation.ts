import { assertKobo, type Kobo } from "./money";
import { compareObligations, type NewObligation } from "./obligations";

export type OpenObligation = {
  id: string;
  levyTypeId: string;
  periodStart: Date;
  periodEnd: Date;
  amountDueKobo: Kobo;
  amountPaidKobo: Kobo;
};

export type FutureObligation = NewObligation;

export type Allocation = {
  target: { kind: "existing"; id: string } | { kind: "new"; obligation: FutureObligation };
  amountKobo: Kobo;
  /** True when this allocation makes the obligation fully paid. */
  settles: boolean;
};

export type AllocationResult = { allocations: Allocation[]; unallocatedKobo: Kobo };

/**
 * Splits a verified payment across obligations: the oldest unpaid first (part-paid ones are
 * completed), then future periods in order (pay ahead and overpayment). Whatever is left is
 * returned as unallocated credit; the caller keeps it on the trader's ledger account.
 * The sum of allocations plus `unallocatedKobo` always equals `amountKobo`.
 */
export function allocate(input: { amountKobo: Kobo; open: readonly OpenObligation[]; future: readonly FutureObligation[] }): AllocationResult {
  assertKobo(input.amountKobo);
  if (input.amountKobo <= 0) throw new RangeError(`payment must be positive: ${input.amountKobo}`);

  let remaining = input.amountKobo;
  const allocations: Allocation[] = [];

  for (const o of [...input.open].sort(compareObligations)) {
    if (remaining === 0) break;
    const owed = o.amountDueKobo - o.amountPaidKobo;
    if (owed <= 0) continue;
    const amount = Math.min(owed, remaining);
    allocations.push({ target: { kind: "existing", id: o.id }, amountKobo: amount, settles: amount === owed });
    remaining -= amount;
  }

  for (const f of [...input.future].sort(compareObligations)) {
    if (remaining === 0) break;
    const amount = Math.min(f.amountDueKobo, remaining);
    allocations.push({ target: { kind: "new", obligation: f }, amountKobo: amount, settles: amount === f.amountDueKobo });
    remaining -= amount;
  }

  return { allocations, unallocatedKobo: remaining };
}

export type AheadQuote = { amountKobo: Kobo; periods: number; throughEnd: Date | null };

/**
 * What it costs to pay a trader ahead up to `cutoff`: the periods `allocate` fills first, in its own
 * order (open, then future), taken while each starts before `cutoff`. Paying exactly this amount
 * settles every quoted period and leaves nothing unallocated, so the trader gets what they were told.
 */
export function aheadQuote(input: { open: readonly OpenObligation[]; future: readonly FutureObligation[]; cutoff: Date }): AheadQuote {
  let amount = 0;
  let periods = 0;
  let throughEnd: Date | null = null;
  const queue = [...[...input.open].sort(compareObligations).map((o) => ({ start: o.periodStart, end: o.periodEnd, owed: o.amountDueKobo - o.amountPaidKobo })), ...[...input.future].sort(compareObligations).map((f) => ({ start: f.periodStart, end: f.periodEnd, owed: f.amountDueKobo }))];
  for (const item of queue) {
    if (item.owed <= 0) continue;
    if (item.start >= input.cutoff) break;
    amount += assertKobo(item.owed);
    periods++;
    if (!throughEnd || item.end > throughEnd) throughEnd = item.end;
  }
  return { amountKobo: amount, periods, throughEnd };
}

export type CurrentObligation = {
  id: string;
  levyTypeId: string;
  periodStart: Date;
  periodEnd: Date;
  amountDueKobo: Kobo;
  status: "due" | "part_paid" | "paid" | "waived";
};

/**
 * FR-01: a payment is a double charge when the trader owes nothing now and the amount equals a
 * levy whose current period is already paid. The money is still credited forward by `allocate`;
 * this only decides whether to raise a `double_charge` flag. A deliberate pay-ahead of exactly
 * one period also matches, which is acceptable: the flag goes to review, nothing is blocked.
 */
export function detectDoubleCharge(input: {
  amountKobo: Kobo;
  now: Date;
  open: readonly OpenObligation[];
  current: readonly CurrentObligation[];
}): { obligationId: string; levyTypeId: string } | null {
  const owesNow = input.open.some((o) => o.periodStart <= input.now && o.amountDueKobo > o.amountPaidKobo);
  if (owesNow) return null;
  const match = input.current.find(
    (c) => c.status === "paid" && c.periodStart <= input.now && input.now < c.periodEnd && c.amountDueKobo === input.amountKobo,
  );
  return match ? { obligationId: match.id, levyTypeId: match.levyTypeId } : null;
}
