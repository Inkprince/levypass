import { describe, expect, it } from "vitest";
import { requeryDue, requeryGapMs } from "./requery";

const s = 1_000;
const min = 60 * s;

describe("requery schedule for payments that are not final yet", () => {
  it("never asks in the first 15 seconds: the webhook normally arrives first", () => {
    expect(requeryDue({ ageMs: 0, sinceLastTryMs: 0 })).toBe(false);
    expect(requeryDue({ ageMs: 14 * s, sinceLastTryMs: 14 * s })).toBe(false);
    expect(requeryDue({ ageMs: 15 * s, sinceLastTryMs: 15 * s })).toBe(true);
  });

  it("asks on every poller tick for the first two minutes, so a withheld webhook settles in seconds", () => {
    expect(requeryGapMs(20 * s)).toBe(0);
    expect(requeryDue({ ageMs: 30 * s, sinceLastTryMs: 8 * s })).toBe(true);
    expect(requeryDue({ ageMs: 119 * s, sinceLastTryMs: 1 * s })).toBe(true);
  });

  it("slows to every 30 seconds up to ten minutes", () => {
    expect(requeryGapMs(2 * min)).toBe(30 * s);
    expect(requeryDue({ ageMs: 3 * min, sinceLastTryMs: 8 * s })).toBe(false);
    expect(requeryDue({ ageMs: 3 * min, sinceLastTryMs: 29 * s })).toBe(false);
    expect(requeryDue({ ageMs: 3 * min, sinceLastTryMs: 30 * s })).toBe(true);
  });

  it("slows to every two minutes after that", () => {
    expect(requeryGapMs(10 * min)).toBe(2 * min);
    expect(requeryDue({ ageMs: 25 * min, sinceLastTryMs: 119 * s })).toBe(false);
    expect(requeryDue({ ageMs: 25 * min, sinceLastTryMs: 2 * min })).toBe(true);
  });

  it("stops after six hours", () => {
    expect(requeryDue({ ageMs: 6 * 60 * min, sinceLastTryMs: 10 * min })).toBe(false);
  });

  it("an abandoned checkout costs about 40 calls before the bank expires it, not 225", () => {
    // Walk a payment that stays pending for 30 minutes, with the poller ticking every 8 seconds.
    let calls = 0;
    let lastTry = 0;
    for (let t = 8 * s; t <= 30 * min; t += 8 * s) {
      if (requeryDue({ ageMs: t, sinceLastTryMs: t - lastTry })) {
        calls += 1;
        lastTry = t;
      }
    }
    expect(calls).toBeGreaterThan(30);
    expect(calls).toBeLessThan(45);
  });
});
