import { describe, expect, it } from "vitest";
import { allocate, detectDoubleCharge, type OpenObligation, type FutureObligation } from "./allocation";

const day = (d: number) => new Date(Date.UTC(2026, 10, d - 1, 23)); // Lagos midnight of 2026-11-<d>
const open = (id: string, d: number, due = 50_000, paid = 0, levyTypeId = "lvt_daily"): OpenObligation => ({
  id,
  levyTypeId,
  periodStart: day(d),
  periodEnd: day(d + 1),
  amountDueKobo: due,
  amountPaidKobo: paid,
});
const future = (d: number, due = 50_000): FutureObligation => ({ levyTypeId: "lvt_daily", periodStart: day(d), periodEnd: day(d + 1), amountDueKobo: due });

describe("allocate", () => {
  it("exact pay settles the obligation", () => {
    const r = allocate({ amountKobo: 50_000, open: [open("obl_today", 10)], future: [] });
    expect(r.allocations).toEqual([{ target: { kind: "existing", id: "obl_today" }, amountKobo: 50_000, settles: true }]);
    expect(r.unallocatedKobo).toBe(0);
  });

  it("part pay leaves the obligation part-paid", () => {
    const r = allocate({ amountKobo: 20_000, open: [open("obl_today", 10)], future: [] });
    expect(r.allocations).toEqual([{ target: { kind: "existing", id: "obl_today" }, amountKobo: 20_000, settles: false }]);
  });

  it("completes a part-paid obligation with what is still owed", () => {
    const r = allocate({ amountKobo: 30_000, open: [open("obl_today", 10, 50_000, 20_000)], future: [] });
    expect(r.allocations).toEqual([{ target: { kind: "existing", id: "obl_today" }, amountKobo: 30_000, settles: true }]);
  });

  it("pays the oldest unpaid obligation first, whatever order they arrive in", () => {
    const r = allocate({ amountKobo: 70_000, open: [open("obl_10", 10), open("obl_08", 8), open("obl_09", 9)], future: [] });
    expect(r.allocations.map((a) => [a.target, a.amountKobo, a.settles])).toEqual([
      [{ kind: "existing", id: "obl_08" }, 50_000, true],
      [{ kind: "existing", id: "obl_09" }, 20_000, false],
    ]);
  });

  it("on a shared start, pays the period that ends first (daily before weekly)", () => {
    const weekly = { ...open("obl_week", 9, 200_000, 0, "lvt_weekly"), periodEnd: day(16) };
    const r = allocate({ amountKobo: 50_000, open: [weekly, open("obl_mon", 9)], future: [] });
    expect(r.allocations[0]?.target).toEqual({ kind: "existing", id: "obl_mon" });
  });

  it("overpay settles what is due and carries the rest into future periods", () => {
    const r = allocate({ amountKobo: 80_000, open: [open("obl_today", 10)], future: [future(11), future(12)] });
    expect(r.allocations).toEqual([
      { target: { kind: "existing", id: "obl_today" }, amountKobo: 50_000, settles: true },
      { target: { kind: "new", obligation: future(11) }, amountKobo: 30_000, settles: false },
    ]);
    expect(r.unallocatedKobo).toBe(0);
  });

  it("pay ahead with nothing due fills future periods in order", () => {
    const r = allocate({ amountKobo: 100_000, open: [], future: [future(11), future(12), future(13)] });
    expect(r.allocations.map((a) => [a.target.kind, a.amountKobo, a.settles])).toEqual([
      ["new", 50_000, true],
      ["new", 50_000, true],
    ]);
  });

  it("keeps money it cannot place as unallocated credit, never drops it", () => {
    const r = allocate({ amountKobo: 120_000, open: [open("obl_today", 10)], future: [future(11)] });
    expect(r.unallocatedKobo).toBe(20_000);
    const placed = r.allocations.reduce((s, a) => s + a.amountKobo, 0);
    expect(placed + r.unallocatedKobo).toBe(120_000);
  });

  it("ignores obligations that are already fully paid", () => {
    const r = allocate({ amountKobo: 50_000, open: [open("obl_paid", 9, 50_000, 50_000), open("obl_today", 10)], future: [] });
    expect(r.allocations.map((a) => a.target)).toEqual([{ kind: "existing", id: "obl_today" }]);
  });

  it.each([0, -100, 10.5])("rejects an amount of %s kobo", (amountKobo) => {
    expect(() => allocate({ amountKobo, open: [], future: [] })).toThrow();
  });
});

describe("detectDoubleCharge", () => {
  const now = new Date("2026-11-10T15:00:00Z");
  const paidToday = { id: "obl_today", levyTypeId: "lvt_daily", periodStart: day(10), periodEnd: day(11), amountDueKobo: 50_000, status: "paid" as const };

  it("flags a second payment for a period that is already paid", () => {
    const r = detectDoubleCharge({ amountKobo: 50_000, now, open: [], current: [paidToday] });
    expect(r).toEqual({ obligationId: "obl_today", levyTypeId: "lvt_daily" });
  });

  it("does not flag when the trader still owes something now", () => {
    expect(detectDoubleCharge({ amountKobo: 50_000, now, open: [open("obl_09", 9)], current: [paidToday] })).toBeNull();
  });

  it("does not flag when the current period is unpaid", () => {
    expect(detectDoubleCharge({ amountKobo: 50_000, now, open: [], current: [{ ...paidToday, status: "due" }] })).toBeNull();
  });

  it("does not flag an amount that matches no levy", () => {
    expect(detectDoubleCharge({ amountKobo: 70_000, now, open: [], current: [paidToday] })).toBeNull();
  });

  it("ignores open obligations that only start in the future", () => {
    expect(detectDoubleCharge({ amountKobo: 50_000, now, open: [open("obl_tomorrow", 11)], current: [paidToday] })).not.toBeNull();
  });
});

describe("second payment for a paid period, end to end", () => {
  it("is flagged and credited to the next period", () => {
    const now = new Date("2026-11-10T15:00:00Z");
    const current = [{ id: "obl_today", levyTypeId: "lvt_daily", periodStart: day(10), periodEnd: day(11), amountDueKobo: 50_000, status: "paid" as const }];
    expect(detectDoubleCharge({ amountKobo: 50_000, now, open: [], current })).not.toBeNull();
    const r = allocate({ amountKobo: 50_000, open: [], future: [future(11)] });
    expect(r.allocations).toEqual([{ target: { kind: "new", obligation: future(11) }, amountKobo: 50_000, settles: true }]);
  });
});
