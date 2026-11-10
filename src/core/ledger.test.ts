import { describe, expect, it } from "vitest";
import { accounts, balances, type Posting } from "./ledger";

describe("accounts", () => {
  it("names the ledger accounts in one place", () => {
    expect(accounts.trader("trd_x")).toBe("trader:trd_x");
    expect(accounts.levyRevenue("aut_x")).toBe("levy_revenue:aut_x");
    expect(accounts.collection("aut_x")).toBe("collection:aut_x");
    expect(accounts.bankFees).toBe("bank_fees");
    expect(accounts.suspense).toBe("suspense");
  });
});

describe("balances", () => {
  it("credits minus debits per account, summing to zero overall", () => {
    const postings: Posting[] = [
      { debitAccount: "collection:a", creditAccount: "trader:t", amountKobo: 50_000 },
      { debitAccount: "bank_fees", creditAccount: "collection:a", amountKobo: 5_000 },
      { debitAccount: "trader:t", creditAccount: "levy_revenue:a", amountKobo: 50_000 },
    ];
    const b = balances(postings);
    expect(b.get("levy_revenue:a")).toBe(50_000);
    expect(b.get("collection:a")).toBe(-45_000);
    expect(b.get("trader:t")).toBe(0);
    expect(b.get("bank_fees")).toBe(-5_000);
    expect([...b.values()].reduce((s, v) => s + v, 0)).toBe(0);
  });
});
