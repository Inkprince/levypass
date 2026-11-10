import { describe, expect, it } from "vitest";
import { assertKobo, formatNaira, koboToNgn, nairaToKobo, ngnToKobo } from "./money";

describe("koboToNgn (to the bank)", () => {
  it.each([
    [50_000, "500.00"],
    [1, "0.01"],
    [10, "0.10"],
    [0, "0.00"],
    [123_456_789, "1234567.89"],
    [-150, "-1.50"],
  ])("%i kobo is %s", (kobo, ngn) => {
    expect(koboToNgn(kobo)).toBe(ngn);
  });

  it("refuses a fractional or unsafe kobo amount", () => {
    expect(() => koboToNgn(1.5)).toThrow();
    expect(() => koboToNgn(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => koboToNgn(Number.NaN)).toThrow();
  });
});

describe("ngnToKobo (from the bank)", () => {
  it.each([
    ["500.00", 50_000],
    ["500", 50_000],
    ["500.5", 50_050],
    ["0.01", 1],
    ["1234567.89", 123_456_789],
    [500, 50_000],
    [500.5, 50_050],
    [0.07, 7],
    [1234567.89, 123_456_789],
  ] as const)("%s naira is %i kobo", (ngn, kobo) => {
    expect(ngnToKobo(ngn)).toBe(kobo);
  });

  it("never goes through floating-point multiplication", () => {
    // 0.07 * 100 === 7.000000000000001 and 1.13 * 100 === 112.99999999999999 in floating point.
    expect(ngnToKobo(1.13)).toBe(113);
    expect(ngnToKobo("19.99")).toBe(1_999);
  });

  it.each(["500.001", "1,000.00", "abc", "", " 500.00", "1e3", "5.", ".5", "-5.00", "+5.00", "0x10"])("rejects %j", (bad) => {
    expect(() => ngnToKobo(bad)).toThrow();
  });

  it("rejects a float with more than two decimals", () => {
    expect(() => ngnToKobo(0.1 + 0.2)).toThrow();
    expect(() => ngnToKobo(Number.NaN)).toThrow();
    expect(() => ngnToKobo(-1)).toThrow();
  });

  it("accepts a negative amount only when asked", () => {
    expect(ngnToKobo("-5.00", { allowNegative: true })).toBe(-500);
  });
});

describe("nairaToKobo", () => {
  it("converts whole naira levy amounts", () => {
    expect(nairaToKobo(500)).toBe(50_000);
    expect(nairaToKobo(2_000)).toBe(200_000);
    expect(() => nairaToKobo(500.5)).toThrow();
  });
});

describe("formatNaira (for people)", () => {
  it("adds the naira sign and thousands separators", () => {
    expect(formatNaira(150_000)).toBe("₦1,500.00");
    expect(formatNaira(5)).toBe("₦0.05");
    expect(formatNaira(-250_000)).toBe("-₦2,500.00");
  });
});

describe("assertKobo", () => {
  it("passes integers and rejects anything else", () => {
    expect(assertKobo(5)).toBe(5);
    expect(() => assertKobo(0.5)).toThrow();
  });
});
