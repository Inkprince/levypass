import { describe, expect, it } from "vitest";
import { en, type MessageKey } from "./en";
import { isLocale, t } from "./index";
import { pcm } from "./pcm";
import { yo } from "./yo";

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

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const traderFacing = (Object.keys(en) as MessageKey[]).filter((k) => k.startsWith("sms.") || k.startsWith("ussd."));

describe.each(["pcm", "yo"] as const)("%s dictionary", (locale) => {
  const dict = { pcm, yo }[locale];

  it("has every SMS and USSD string, so nothing a trader reads falls back to English", () => {
    expect(traderFacing.filter((k) => !dict[k])).toEqual([]);
  });

  it("keeps the placeholders of the English string", () => {
    for (const k of traderFacing) expect([k, placeholders(dict[k] ?? "")]).toEqual([k, placeholders(en[k])]);
  });

  it("keeps the menu numbers, because the replies are the same digits in every language", () => {
    for (const k of ["ussd.menu", "ussd.pay_choose", "ussd.language"] as const) {
      const digits = (text: string) => text.split("\n").map((line) => /^(\d)\. /.exec(line)?.[1]).filter(Boolean);
      expect([k, digits(dict[k] ?? "")]).toEqual([k, digits(en[k])]);
    }
  });

  it("fits a USSD screen (182 characters) for the fixed menus", () => {
    for (const k of ["ussd.menu", "ussd.language", "ussd.officer_ask", "ussd.report_ask"] as const) expect((dict[k] ?? "").length).toBeLessThanOrEqual(182);
  });

  it("reads differently from English", () => {
    expect(t(locale, "ussd.menu")).not.toBe(t("en", "ussd.menu"));
    expect(t(locale, "sms.receipt", { number: "LP-1", amount: "₦500.00", levy: "Daily market levy", period: "2026-11-11", url: "u" })).not.toBe(
      t("en", "sms.receipt", { number: "LP-1", amount: "₦500.00", levy: "Daily market levy", period: "2026-11-11", url: "u" }),
    );
  });
});
