import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const base = { DATABASE_URL: "postgres://u:p@localhost:5432/levypass" };

describe("parseEnv", () => {
  it("applies defaults for local development", () => {
    const env = parseEnv(base);
    expect(env.BANK_ADAPTER).toBe("fake");
    expect(env.PORT).toBe(3000);
  });

  it("requires a database URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("requires the gateway key for the real bank adapter", () => {
    expect(() => parseEnv({ ...base, BANK_ADAPTER: "xtradot" })).toThrow(/GATEWAY_KEY/);
  });

  it("never echoes a secret value in the error", () => {
    const secret = "sk_should_not_appear";
    try {
      parseEnv({ ...base, NODE_ENV: "production", GATEWAY_KEY: secret, SESSION_SECRET: "short" });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).not.toContain(secret);
      expect(String(e)).toMatch(/SESSION_SECRET/);
    }
  });
});
