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

  it("detects Igbo, though it shares the letter ọ with Yoruba", () => {
    expect(detectLanguage("Otu nwoke nara m ego n'ahịa, o nyeghị m risiti")).toBe("ig");
    expect(detectLanguage("Onye ọrụ ahụ were ego m")).toBe("ig");
  });

  it("detects Hausa", () => {
    expect(detectLanguage("Wani mutum ya karɓi kuɗi a kasuwa bai ba ni rasidi ba")).toBe("ha");
    expect(detectLanguage("Jami'in ya ce in biya naira dubu biyu")).toBe("ha");
  });

  it("still reads Yoruba with ọ as Yoruba", () => {
    expect(detectLanguage("Ọ̀gá kan gba owó lọ́wọ́ mi")).toBe("yo");
  });

  it("always returns a usable result", () => {
    expect(fallbackTriage("")).toMatchObject({ category: "other", severity: "low", language: "en" });
  });
});
