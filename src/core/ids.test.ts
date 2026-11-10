import { describe, expect, it } from "vitest";
import { idPrefixOf, isId, newId } from "./ids";

describe("newId", () => {
  it("prefixes the ID so a pasted ID says what it is", () => {
    const id = newId("trd");
    expect(id).toMatch(/^trd_[0-9a-hjkmnp-tv-z]{20}$/);
    expect(idPrefixOf(id)).toBe("trd");
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId("pay")));
    expect(ids.size).toBe(1000);
  });
});

describe("isId", () => {
  it("accepts only the expected prefix", () => {
    const id = newId("off");
    expect(isId("off", id)).toBe(true);
    expect(isId("trd", id)).toBe(false);
    expect(isId("off", "off_short")).toBe(false);
  });
});
