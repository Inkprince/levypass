import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createPool } from "@/server/db/pool";
import { ensureDemoData } from "./self-heal";

// A database of its own: this test starts from nothing, the way a wiped Postgres pod does.
const name = "levypass_selfheal_test";
const base = process.env.TEST_DATABASE_URL!;
const url = (db: string) => Object.assign(new URL(base), { pathname: `/${db}` }).toString();

let admin: Pool;
let target: Pool;

beforeAll(async () => {
  admin = createPool(base, { max: 1 });
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${name}`);
  target = createPool(url(name), { max: 2, statement_timeout: 60_000 });
});

afterAll(async () => {
  await target?.end();
  await admin?.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin?.end();
});

describe("ensureDemoData", () => {
  it("rebuilds an empty database with migrations and seed data", async () => {
    expect(await ensureDemoData(target, { adminPassword: "test-admin-pass", officerPin: "2468" })).toBe("rebuilt");
    const { rows } = await target.query<{ n: string }>("SELECT count(*) AS n FROM traders");
    expect(Number(rows[0]!.n)).toBe(40);
  }, 60_000);

  it("leaves a seeded database alone", async () => {
    const before = await target.query<{ n: string }>("SELECT count(*) AS n FROM ledger_entries");
    expect(await ensureDemoData(target, { adminPassword: "test-admin-pass", officerPin: "2468" })).toBe("present");
    const after = await target.query<{ n: string }>("SELECT count(*) AS n FROM ledger_entries");
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
  });

  it("refuses to seed without demo credentials in production", async () => {
    const empty = "levypass_selfheal_empty";
    await admin.query(`DROP DATABASE IF EXISTS ${empty} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${empty}`);
    const p = createPool(url(empty), { max: 1 });
    try {
      await expect(ensureDemoData(p, { production: true })).rejects.toThrow(/SEED_ADMIN_PASSWORD/);
    } finally {
      await p.end();
      await admin.query(`DROP DATABASE IF EXISTS ${empty} WITH (FORCE)`);
    }
  });
});
