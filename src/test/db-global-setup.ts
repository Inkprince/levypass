// Vitest global setup for *.db.test.ts: rebuild the test database from migrations on every run.
// The ledger is append-only, so a fresh schema is the only way to start clean.
import { createPool } from "../server/db/pool";
import { runMigrations } from "../server/db/migrate";

export async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example). Database tests need their own database.");
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL: the test run drops its schema.");
  const pool = createPool(url, { max: 1 });
  try {
    await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}
