// npm run demo:reset: back to a clean demo. Rebuilds OUR database from migrations (the ledger is
// append-only, so this is the only way to clear it), re-seeds, and removes our old bank webhook.
// The running app re-registers its webhook on the next poller tick (self-heal).
// It never calls the sandbox's POST /admin/reset.
import { rmSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { requireEnv } from "./load-env";
import { createPool } from "../src/server/db/pool";
import { migrationsFolder, runMigrations } from "../src/server/db/migrate";
import * as schema from "../src/server/db/schema";
import { seed } from "../src/server/db/seed";

const pool = createPool(requireEnv("DATABASE_URL"), { max: 1 });
try {
  const adapter = process.env.BANK_ADAPTER ?? "fake";
  const old = await pool.query<{ value: string }>("SELECT value FROM app_settings WHERE key = $1", [`bank.${adapter}.webhook_id`]).catch(() => ({ rows: [] }));
  const oldId = old.rows[0]?.value;
  if (oldId && adapter === "xtradot") {
    const { xtradotBank } = await import("../src/server/bank/xtradot");
    await xtradotBank().deleteWebhook(oldId).catch((e) => console.error(JSON.stringify({ level: "warn", msg: "demo_reset.webhook_delete_failed", error: String(e) })));
  }
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await runMigrations(pool, process.env.MIGRATIONS_DIR ?? migrationsFolder);
  const inserted = await seed(drizzle({ client: pool, schema, casing: "snake_case" }), {
    adminPassword: process.env.SEED_ADMIN_PASSWORD,
    officerPin: process.env.SEED_OFFICER_PIN,
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
  });
  rmSync(path.join(process.cwd(), ".data", "fake-bank.json"), { force: true });
  console.log(JSON.stringify({ level: "info", msg: "demo_reset.done", removed_webhook: oldId ?? null, traders: inserted.traders }));
} catch (error) {
  console.error(JSON.stringify({ level: "error", msg: "demo_reset.failed", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
