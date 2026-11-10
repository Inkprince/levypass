import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { Kobo } from "@/core/money";
import { getBank, type Reconciliation, type Settlement } from "@/server/bank";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";

// AD-05, PY-05: compare what our ledger says was collected on a Lagos day with what the bank
// says it settled. Our records are the bank-provider payments settled that day.

export type ReconcileView = {
  date: string;
  ledger: { count: number; grossKobo: Kobo; feesKobo: Kobo; netKobo: Kobo };
  bank: { count: number; grossKobo: Kobo; feesKobo: Kobo; netKobo: Kobo; settledKobo: Kobo; batches: Settlement[] };
  rec: Reconciliation;
  gapKobo: Kobo;
};

export async function reconcileDay(date: string): Promise<ReconcileView> {
  const bank = getBank();
  const rows = await db()
    .select({ ref: s.payments.providerRef, amount: s.payments.amountKobo, fee: s.payments.feeKobo })
    .from(s.payments)
    .where(and(eq(s.payments.provider, bank.provider), isNotNull(s.payments.settledAt), sql`to_char(${s.payments.paidAt} AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') = ${date}`));
  const records = rows.map((r) => ({ reference: r.ref, amountKobo: r.amount }));
  const [rec, settlements] = await Promise.all([bank.reconcile(date, records), bank.listSettlements()]);
  const batches = settlements.filter((b) => b.salesDate === date);
  const lines = batches.flatMap((b) => b.transactions);
  const ledgerGross = rows.reduce((x, r) => x + r.amount, 0);
  const ledgerFees = rows.reduce((x, r) => x + (r.fee ?? 0), 0);
  const bankGross = lines.reduce((x, l) => x + l.amountKobo, 0);
  const bankFees = lines.reduce((x, l) => x + l.feeKobo, 0);
  return {
    date,
    ledger: { count: rows.length, grossKobo: ledgerGross, feesKobo: ledgerFees, netKobo: ledgerGross - ledgerFees },
    bank: { count: lines.length, grossKobo: bankGross, feesKobo: bankFees, netKobo: bankGross - bankFees, settledKobo: batches.filter((b) => b.status === "settled").reduce((x, b) => x + b.netKobo, 0), batches },
    rec,
    gapKobo: ledgerGross - ledgerFees - (bankGross - bankFees),
  };
}
