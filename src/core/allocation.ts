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
