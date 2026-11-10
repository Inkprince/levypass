import { describe, expect, it } from "vitest";
import { lagosDate, lagosMidnight, nextPeriod, periodFor, periodsFrom } from "./periods";

const iso = (d: Date) => d.toISOString();

describe("lagosDate", () => {
  it("23:30 in Lagos is still that Lagos day", () => {
    expect(lagosDate(new Date("2026-11-10T22:30:00Z"))).toBe("2026-11-10");
  });

  it("00:30 in Lagos is the next Lagos day although UTC is still the day before", () => {
    expect(lagosDate(new Date("2026-11-10T23:30:00Z"))).toBe("2026-11-11");
  });
});

describe("lagosMidnight", () => {
  it("is 23:00 UTC the day before", () => {
    expect(iso(lagosMidnight("2026-11-11"))).toBe("2026-11-10T23:00:00.000Z");
  });

  it("rejects an impossible date", () => {
    expect(() => lagosMidnight("2026-02-30")).toThrow();
    expect(() => lagosMidnight("11/10/2026")).toThrow();
  });
});

describe("periodFor daily", () => {
  it("at 23:30 Lagos the period is the same Lagos day", () => {
    const p = periodFor("daily", new Date("2026-11-10T22:30:00Z"));
    expect(iso(p.start)).toBe("2026-11-09T23:00:00.000Z");
    expect(iso(p.end)).toBe("2026-11-10T23:00:00.000Z");
    expect(p.startDate).toBe("2026-11-10");
  });

  it("at 00:30 Lagos the period is the new day", () => {
    const p = periodFor("daily", new Date("2026-11-10T23:30:00Z"));
    expect(iso(p.start)).toBe("2026-11-10T23:00:00.000Z");
    expect(p.startDate).toBe("2026-11-11");
  });

  it("midnight exactly belongs to the new day", () => {
    expect(periodFor("daily", new Date("2026-11-10T23:00:00Z")).startDate).toBe("2026-11-11");
  });
});

describe("periodFor weekly (Monday to Sunday, Lagos)", () => {
  it("Sunday 23:30 Lagos is still the week that began on Monday", () => {
    const p = periodFor("weekly", new Date("2026-11-15T22:30:00Z"));
    expect(p.startDate).toBe("2026-11-09");
    expect(iso(p.end)).toBe("2026-11-15T23:00:00.000Z");
  });

  it("Monday 00:30 Lagos starts the next week", () => {
    expect(periodFor("weekly", new Date("2026-11-15T23:30:00Z")).startDate).toBe("2026-11-16");
  });
});

describe("periodFor monthly and yearly", () => {
  it("00:30 Lagos on 1 December is December", () => {
    const p = periodFor("monthly", new Date("2026-11-30T23:30:00Z"));
    expect(p.startDate).toBe("2026-12-01");
    expect(iso(p.end)).toBe("2026-12-31T23:00:00.000Z");
  });

  it("00:30 Lagos on 1 January is the new year", () => {
    const p = periodFor("yearly", new Date("2026-12-31T23:30:00Z"));
    expect(p.startDate).toBe("2027-01-01");
    expect(iso(p.end)).toBe("2027-12-31T23:00:00.000Z");
  });
});

describe("nextPeriod and periodsFrom", () => {
  it("steps to the following period", () => {
    const today = periodFor("daily", new Date("2026-11-10T15:00:00Z"));
    expect(nextPeriod("daily", today).startDate).toBe("2026-11-11");
    const month = periodFor("monthly", new Date("2026-01-31T12:00:00Z"));
    expect(nextPeriod("monthly", month).startDate).toBe("2026-02-01");
  });

  it("lists every period from a start date up to the one containing asOf", () => {
    const days = periodsFrom("daily", "2026-11-08", new Date("2026-11-10T15:00:00Z"));
    expect(days.map((p) => p.startDate)).toEqual(["2026-11-08", "2026-11-09", "2026-11-10"]);
    // 00:30 Lagos on the 11th adds the 11th.
    expect(periodsFrom("daily", "2026-11-08", new Date("2026-11-10T23:30:00Z"))).toHaveLength(4);
    // A start date in the future gives nothing yet.
    expect(periodsFrom("daily", "2026-11-12", new Date("2026-11-10T15:00:00Z"))).toEqual([]);
  });

  it("starts with the period that contains the start date", () => {
    // 2026-11-11 is a Wednesday; its week began on Monday 9 November.
    const weeks = periodsFrom("weekly", "2026-11-11", new Date("2026-11-17T12:00:00Z"));
    expect(weeks.map((p) => p.startDate)).toEqual(["2026-11-09", "2026-11-16"]);
  });
});
