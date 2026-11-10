import { describe, expect, it } from "vitest";
import { isLocale, t } from "./index";

describe("t", () => {
  it("returns the English string", () => {
    expect(t("en", "app.name")).toBe("LevyPass");
  });

  it("falls back to English when a locale lacks the key", () => {
    expect(t("yo", "app.name")).toBe("LevyPass");
  });

  it("recognises supported locales only", () => {
    expect(isLocale("pcm")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
});
