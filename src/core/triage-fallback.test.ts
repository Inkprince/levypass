import { describe, expect, it } from "vitest";
import { detectLanguage, fallbackTriage } from "./triage-fallback";

describe("fallbackTriage", () => {
  it("reads a Pidgin report of a fake collector and the amount taken", () => {
    const r = fallbackTriage("One man wey no get ID card come collect 1000 naira from me for market, e no give me receipt.");
    expect(r).toMatchObject({ category: "fake_collector", severity: "medium", language: "pcm" });
    expect(r.summary).toContain("₦1,000");
  });

  it("marks violence as high severity", () => {
    expect(fallbackTriage("The collector threatened me and seized my goods").severity).toBe("high");
  });

  it("detects Yoruba", () => {
    expect(detectLanguage("Ọkunrin kan gba owo lọwọ mi ko fun mi ni risiti")).toBe("yo");
  });

  it("always returns a usable result", () => {
    expect(fallbackTriage("")).toMatchObject({ category: "other", severity: "low", language: "en" });
  });
});
