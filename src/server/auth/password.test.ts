import { describe, expect, it } from "vitest";
import { hashSecret, verifySecret } from "./password";

describe("hashSecret / verifySecret", () => {
  it("verifies the right secret and rejects a wrong one", async () => {
    const hash = await hashSecret("1357");
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain("1357");
    expect(await verifySecret("1357", hash)).toBe(true);
    expect(await verifySecret("1358", hash)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashSecret("same")).not.toBe(await hashSecret("same"));
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    expect(await verifySecret("x", "not-a-hash")).toBe(false);
  });
});
