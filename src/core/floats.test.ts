import { describe, expect, it } from "vitest";
import { floatLabel, floatStatements } from "./floats";

const at = (h: number) => new Date(Date.UTC(2026, 10, 12, h));

describe("floatStatements", () => {
  it("charges each cash collection to the oldest float that still has money", () => {
    const out = floatStatements(
      [
        { id: "f1", amountKobo: 100_000, loadedAt: at(8) },
        { id: "f2", amountKobo: 100_000, loadedAt: at(12) },
      ],
      [
        { paymentId: "p1", amountKobo: 50_000, at: at(9) },
        { paymentId: "p2", amountKobo: 50_000, at: at(10) },
        { paymentId: "p3", amountKobo: 20_000, at: at(13) },
      ],
    );
    expect(out.floats.map((f) => [f.id, f.usedKobo, f.remainingKobo, f.usedUp])).toEqual([
      ["f1", 100_000, 0, true],
      ["f2", 20_000, 80_000, false],
    ]);
    expect(out.floats[0]!.collections.map((c) => c.paymentId)).toEqual(["p1", "p2"]);
    expect(out.floats[1]!.collections.map((c) => c.paymentId)).toEqual(["p3"]);
    expect(out.balanceKobo).toBe(80_000);
    expect(out.overspentKobo).toBe(0);
  });

  it("splits a collection that crosses from one float into the next", () => {
    const out = floatStatements(
      [
        { id: "f1", amountKobo: 30_000, loadedAt: at(8) },
        { id: "f2", amountKobo: 100_000, loadedAt: at(9) },
      ],
      [{ paymentId: "p1", amountKobo: 50_000, at: at(10) }],
    );
    expect(out.floats[0]!.collections).toEqual([{ paymentId: "p1", amountKobo: 30_000, at: at(10) }]);
    expect(out.floats[1]!.collections).toEqual([{ paymentId: "p1", amountKobo: 20_000, at: at(10) }]);
    expect(out.balanceKobo).toBe(80_000);
  });

  it("orders by time whatever order the rows arrive in", () => {
    const out = floatStatements(
      [
        { id: "f2", amountKobo: 10_000, loadedAt: at(12) },
        { id: "f1", amountKobo: 10_000, loadedAt: at(8) },
      ],
      [{ paymentId: "p1", amountKobo: 10_000, at: at(9) }],
    );
    expect(out.floats.map((f) => [f.id, f.usedUp])).toEqual([
      ["f1", true],
      ["f2", false],
    ]);
  });

  it("reports money spent beyond every float instead of hiding it", () => {
    const out = floatStatements([{ id: "f1", amountKobo: 10_000, loadedAt: at(8) }], [{ paymentId: "p1", amountKobo: 15_000, at: at(9) }]);
    expect(out.overspentKobo).toBe(5_000);
    expect(out.balanceKobo).toBe(-5_000);
  });

  it("an officer with no floats has nothing", () => {
    expect(floatStatements([], [])).toEqual({ floats: [], balanceKobo: 0, overspentKobo: 0 });
  });

  it("refuses fractional kobo", () => {
    expect(() => floatStatements([{ id: "f1", amountKobo: 10.5, loadedAt: at(8) }], [])).toThrow();
  });
});

describe("floatLabel", () => {
  it("names an advance remittance by officer and sequence", () => {
    expect(floatLabel("OTT-001", 3)).toBe("OTT-001-R03");
    expect(floatLabel("OTT-001", 12)).toBe("OTT-001-R12");
  });
});
