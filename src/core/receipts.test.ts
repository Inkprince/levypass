import { describe, expect, it } from "vitest";
import { newReceiptNumber, parseReceiptNumber } from "./receipts";

const fixed = (n: number) => () => new Uint8Array(8).fill(n);

describe("newReceiptNumber", () => {
  it("has the LP-XXXX-XXXXC shape", () => {
    const n = newReceiptNumber();
    expect(n).toMatch(/^LP-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{5}$/);
  });

  it("is deterministic for given random bytes", () => {
    expect(newReceiptNumber(fixed(7))).toBe(newReceiptNumber(fixed(7)));
    expect(newReceiptNumber(fixed(7))).not.toBe(newReceiptNumber(fixed(8)));
  });

  it("parses back to itself", () => {
    for (let i = 0; i < 200; i++) {
      const n = newReceiptNumber();
      expect(parseReceiptNumber(n)).toBe(n);
    }
  });
});

describe("parseReceiptNumber", () => {
  const n = newReceiptNumber(fixed(3)); // stable sample

  it("accepts the number typed loosely: lower case, spaces, no prefix, O for 0, I or L for 1", () => {
    const body = n.slice(3).replace("-", "");
    expect(parseReceiptNumber(n.toLowerCase())).toBe(n);
    expect(parseReceiptNumber(` ${body.slice(0, 4)} ${body.slice(4)} `)).toBe(n);
    expect(parseReceiptNumber(n.replaceAll("0", "O").replaceAll("1", "l"))).toBe(n);
  });

  it("catches a single wrong character", () => {
    const body = n.slice(3).replace("-", "");
    for (let pos = 0; pos < body.length; pos++) {
      const swapped = body.slice(0, pos) + (body[pos] === "Z" ? "Y" : "Z") + body.slice(pos + 1);
      expect(parseReceiptNumber(swapped)).toBeNull();
    }
  });

  it("catches two adjacent characters swapped", () => {
    const body = "7K3M9QX2";
    const valid = parseReceiptNumber(body + checkFor(body));
    expect(valid).not.toBeNull();
    const swapped = "K73M9QX2";
    expect(parseReceiptNumber(swapped + checkFor(body))).toBeNull();
  });

  it.each(["", "LP-", "LP-1234", "hello world", "LP-UUUU-UUUUU", "LP-12345-67890-1"])("rejects %j", (bad) => {
    expect(parseReceiptNumber(bad)).toBeNull();
  });
});

// Finds the check character for a body by trying all 32 (test helper, avoids re-implementing it).
function checkFor(body: string): string {
  for (const c of "0123456789ABCDEFGHJKMNPQRSTVWXYZ") if (parseReceiptNumber(body + c)) return c;
  throw new Error("no check character");
}
