import "server-only";
import { env } from "@/server/env";
import { fakeBank } from "./fake";
import type { BankPort } from "./port";
import { xtradotBank } from "./xtradot";

let bank: BankPort | undefined;

export function getBank(): BankPort {
  bank ??= env().BANK_ADAPTER === "xtradot" ? xtradotBank() : fakeBank();
  return bank;
}

export * from "./port";
