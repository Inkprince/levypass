import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@/core/ids";
import { testDb } from "@/test/db";
import { seed } from "./seed";
import * as s from "./schema";

const { pool, db } = testDb();
afterAll(() => pool.end());

const now = new Date("2026-11-10T15:00:00Z"); // 16:00 in Lagos

/** Runs a statement and returns the Postgres error it raised, if any. */
async function pgError(statement: Promise<unknown>): Promise<{ code?: string; message: string } | undefined> {
  try {
    await statement;
    return undefined;
  } catch (e) {
    const cause = (e as { cause?: unknown }).cause ?? e;
    return { code: (cause as { code?: string }).code, message: (cause as Error).message };
  }
}

describe("seed", () => {
  let first: Record<string, number>;
  beforeAll(async () => {
    first = await seed(db, { now });
  });

  it("creates the demo data set", () => {
    expect(first).toMatchObject({ authorities: 1, markets: 1, levy_types: 2, traders: 40, officers: 3, admins: 1 });
    expect(first.ledger_entries).toBeGreaterThan(0);
  });

  it("is repeatable: a second run inserts nothing", async () => {
    const second = await seed(db, { now });
    expect(Object.values(second).every((n) => n === 0)).toBe(true);
  });

  it("has a mix of paid, due and part-paid obligations today", async () => {
    const rows = await db.execute<{ status: string; n: number }>(sql`
      SELECT o.status, count(*)::int AS n FROM obligations o JOIN levy_types l ON l.id = o.levy_type_id
      WHERE l.period = 'daily' AND o.period_start <= ${now} AND o.period_end > ${now} GROUP BY o.status`);
    const byStatus = Object.fromEntries(rows.rows.map((r) => [r.status, r.n]));
    expect(byStatus).toEqual({ paid: 24, due: 12, part_paid: 4 });
  });

  it("balances: ledger revenue, obligation cache and trader accounts agree", async () => {
    // Revenue on the ledger equals what the obligations say was paid: totals are recomputable.
    const totals = await db.execute<{ revenue: string; paid: string }>(sql`
      SELECT (SELECT coalesce(sum(amount_kobo),0) FROM ledger_entries WHERE credit_account LIKE 'levy_revenue:%')
           - (SELECT coalesce(sum(amount_kobo),0) FROM ledger_entries WHERE debit_account LIKE 'levy_revenue:%') AS revenue,
             (SELECT coalesce(sum(amount_paid_kobo),0) FROM obligations) AS paid`);
    expect(Number(totals.rows[0]?.revenue)).toBeGreaterThan(0);
    expect(totals.rows[0]?.revenue).toBe(totals.rows[0]?.paid);

    const mismatch = await db.execute(sql`
      SELECT o.id FROM obligations o
      LEFT JOIN (SELECT obligation_id, sum(amount_kobo) AS paid FROM ledger_entries WHERE kind = 'allocation' GROUP BY obligation_id) a
        ON a.obligation_id = o.id
      WHERE o.amount_paid_kobo <> coalesce(a.paid, 0)`);
    expect(mismatch.rows).toHaveLength(0);

    // Every trader account nets to zero: all seeded money was allocated.
    const traderBalances = await db.execute(sql`
      SELECT account, sum(delta) AS balance FROM (
        SELECT credit_account AS account, amount_kobo AS delta FROM ledger_entries
        UNION ALL SELECT debit_account, -amount_kobo FROM ledger_entries) x
      WHERE account LIKE 'trader:%' GROUP BY account HAVING sum(delta) <> 0`);
    expect(traderBalances.rows).toHaveLength(0);
  });
});

describe("ledger_entries is append-only", () => {
  let entryId: string;
  beforeAll(async () => {
    const [entry] = await db.select({ id: s.ledgerEntries.id }).from(s.ledgerEntries).limit(1);
    if (!entry) throw new Error("seed first");
    entryId = entry.id;
  });

  it("rejects UPDATE", async () => {
    const err = await pgError(db.execute(sql`UPDATE ledger_entries SET amount_kobo = 1 WHERE id = ${entryId}`));
    expect(err?.message).toMatch(/append-only: UPDATE/);
    expect(err?.code).toBe("23001");
  });

  it("rejects DELETE", async () => {
    const err = await pgError(db.execute(sql`DELETE FROM ledger_entries WHERE id = ${entryId}`));
    expect(err?.message).toMatch(/append-only: DELETE/);
  });

  it("rejects TRUNCATE", async () => {
    const err = await pgError(db.execute(sql`TRUNCATE ledger_entries CASCADE`));
    expect(err?.message).toMatch(/append-only: TRUNCATE/);
  });

  it("still accepts new entries", async () => {
    const id = newId("led");
    await db.insert(s.ledgerEntries).values({ id, journalId: newId("jnl"), kind: "correction", debitAccount: "suspense", creditAccount: "bank_fees", amountKobo: 1 });
    await db.insert(s.ledgerEntries).values({ id: newId("led"), journalId: newId("jnl"), kind: "correction", debitAccount: "bank_fees", creditAccount: "suspense", amountKobo: 1, reversesEntryId: id });
  });

  it("rejects an amount of zero and an entry to the same account", async () => {
    const base = { journalId: newId("jnl"), kind: "correction" as const };
    expect(await pgError(db.insert(s.ledgerEntries).values({ ...base, id: newId("led"), debitAccount: "a", creditAccount: "b", amountKobo: 0 }))).toMatchObject({ code: "23514" });
    expect(await pgError(db.insert(s.ledgerEntries).values({ ...base, id: newId("led"), debitAccount: "a", creditAccount: "a", amountKobo: 5 }))).toMatchObject({ code: "23514" });
  });
});

describe("unique indexes", () => {
  it("allow one obligation per trader, levy and period", async () => {
    const [o] = await db.select().from(s.obligations).limit(1);
    if (!o) throw new Error("seed first");
    const err = await pgError(db.insert(s.obligations).values({ ...o, id: newId("obl") }));
    expect(err).toMatchObject({ code: "23505" });
    expect(err?.message).toMatch(/obligations_trader_levy_period_uq/);
  });

  it("allow one payment per provider reference", async () => {
    const [p] = await db.select().from(s.payments).limit(1);
    if (!p) throw new Error("seed first");
    const err = await pgError(db.insert(s.payments).values({ ...p, id: newId("pay") }));
    expect(err?.message).toMatch(/payments_provider_ref_uq/);
  });

  it("allow one webhook event per event_id", async () => {
    const row = { eventType: "webhook.test", payload: {}, eventId: "evt_dup_1" };
    await db.insert(s.webhookEvents).values({ ...row, id: newId("whe") });
    const err = await pgError(db.insert(s.webhookEvents).values({ ...row, id: newId("whe") }));
    expect(err?.message).toMatch(/webhook_events_event_id_uq/);
  });

  it("allow one receipt per number", async () => {
    const [r] = await db.select().from(s.receipts).limit(1);
    if (!r) throw new Error("seed first");
    const [p] = await db.select().from(s.payments).limit(1);
    const paymentId = newId("pay");
    await db.insert(s.payments).values({ ...p!, id: paymentId, providerRef: `TEST-${paymentId}` });
    const err = await pgError(db.insert(s.receipts).values({ ...r, id: newId("rcp"), paymentId }));
    expect(err?.message).toMatch(/receipts_number_uq/);
  });
});
