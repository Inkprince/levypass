import { describe, expect, it } from "vitest";
import { generateSigningKeyPkcs8, importSigningKey, importVerifyKey, signToken, verifyToken } from "./tokens";

const keys = await importSigningKey(await generateSigningKeyPkcs8());
const subjectId = "trd_0123456789abcdefghjk";

describe("signToken / verifyToken (Ed25519)", () => {
  it("round-trips a trader token", async () => {
    const token = await signToken(keys.privateKey, { subjectId, tokenId: "a1b2c3d4e5f6" });
    expect(token).toMatch(/^[A-Za-z0-9._-]+$/); // URL-safe for /v/t/<token>
    expect(token.length).toBeLessThan(160); // keeps the QR small
    expect(await verifyToken(keys.publicKey, token)).toEqual({ kind: "trader", subjectId, tokenId: "a1b2c3d4e5f6" });
  });

  it("knows an officer token by its subject prefix", async () => {
    const token = await signToken(keys.privateKey, { subjectId: "off_0123456789abcdefghjk", tokenId: "t1" });
    expect((await verifyToken(keys.publicKey, token))?.kind).toBe("officer");
  });

  it("rejects a tampered subject", async () => {
    const token = await signToken(keys.privateKey, { subjectId, tokenId: "t1" });
    const forged = token.replace(subjectId, "trd_zzzzzzzzzzzzzzzzzzzz");
    expect(forged).not.toBe(token);
    expect(await verifyToken(keys.publicKey, forged)).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const token = await signToken(keys.privateKey, { subjectId, tokenId: "t1" });
    const last = token.at(-2) === "A" ? "B" : "A";
    expect(await verifyToken(keys.publicKey, token.slice(0, -2) + last + token.slice(-1))).toBeNull();
  });

  it("rejects a token signed with another key", async () => {
    const other = await importSigningKey(await generateSigningKeyPkcs8());
    const token = await signToken(other.privateKey, { subjectId, tokenId: "t1" });
    expect(await verifyToken(keys.publicKey, token)).toBeNull();
  });

  it.each(["", "garbage", "v1.trd_x.t1.sig", "v9.trd_0123456789abcdefghjk.t1.AAAA", "v1..t1.AAAA"])("returns null for %j", async (bad) => {
    expect(await verifyToken(keys.publicKey, bad)).toBeNull();
  });

  it("refuses to sign a subject that is not a trader or officer ID", async () => {
    await expect(signToken(keys.privateKey, { subjectId: "pay_0123456789abcdefghjk", tokenId: "t1" })).rejects.toThrow();
    await expect(signToken(keys.privateKey, { subjectId, tokenId: "has.dot" })).rejects.toThrow();
  });

  it("verifies with the exported public key alone (for offline officer mode)", async () => {
    const token = await signToken(keys.privateKey, { subjectId, tokenId: "t1" });
    const publicOnly = await importVerifyKey(keys.publicKeyBase64);
    expect(await verifyToken(publicOnly, token)).not.toBeNull();
  });
});
