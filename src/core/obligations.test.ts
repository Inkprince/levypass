import { describe, expect, it } from "vitest";
import { dueObligations, futureObligations, type LevyAssignment } from "./obligations";

const daily: LevyAssignment = { levyTypeId: "lvt_daily", period: "daily", amountKobo: 50_000, startDate: "2026-11-08" };
const weekly: LevyAssignment = { levyTypeId: "lvt_weekly", period: "weekly", amountKobo: 200_000, startDate: "2026-11-08" };

describe("dueObligations", () => {
  it("creates one obligation per period from the start date to now", () => {
    const due = dueObligations(daily, new Date("2026-11-10T15:00:00Z"));
    expect(due).toHaveLength(3);
    expect(due[2]).toMatchObject({ levyTypeId: "lvt_daily", amountDueKobo: 50_000, periodStart: new Date("2026-11-09T23:00:00Z") });
  });

  it("adds the new Lagos day at 00:30, not at 01:00", () => {
    expect(dueObligations(daily, new Date("2026-11-10T23:30:00Z"))).toHaveLength(4);
  });

  it("creates nothing for an exempt trader", () => {
    expect(dueObligations({ ...daily, exemption: "Disability waiver" }, new Date("2026-11-10T15:00:00Z"))).toEqual([]);
  });
});

describe("futureObligations", () => {
  it("merges the next periods of every levy in time order, after a given instant", () => {
    const now = new Date("2026-11-10T15:00:00Z"); // Tuesday in Lagos
    const future = futureObligations([daily, weekly], now, 3);
    expect(future.map((f) => [f.levyTypeId, f.periodStart.toISOString()])).toEqual([
      ["lvt_daily", "2026-11-10T23:00:00.000Z"],
      ["lvt_daily", "2026-11-11T23:00:00.000Z"],
      ["lvt_daily", "2026-11-12T23:00:00.000Z"],
    ]);
    const longer = futureObligations([daily, weekly], now, 7);
    // Next Monday (16 Nov) both levies start; the daily one ends first so it comes first.
    expect(longer.slice(5).map((f) => f.levyTypeId)).toEqual(["lvt_daily", "lvt_weekly"]);
  });

  it("skips exempt levies", () => {
    expect(futureObligations([{ ...daily, exemption: "x" }], new Date("2026-11-10T15:00:00Z"), 2)).toEqual([]);
  });
});
