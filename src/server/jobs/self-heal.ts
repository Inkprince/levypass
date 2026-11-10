import "server-only";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";
import * as schema from "@/server/db/schema";
import { seed } from "@/server/db/seed";
import { log } from "@/server/log";

// Demo safety net (AUTO_SEED=on). While the cluster cannot give Postgres a volume, a Postgres pod
// restart leaves an empty database under a running app. The poller notices and rebuilds the
// schema and the synthetic seed. It only ever acts on a database with no authority in it, so it
// never touches live data.

export type DemoDataOptions = {
  migrationsFolder?: string;
  adminPassword?: string;
  officerPin?: string;
  publicBaseUrl?: string;
  production?: boolean;
};

async function hasData(pool: Pool): Promise<boolean> {
  const { rows } = await pool.query<{ present: boolean }>("SELECT to_regclass('public.authorities') IS NOT NULL AS present");
  if (!rows[0]?.present) return false;
  const found = await pool.query("SELECT 1 FROM authorities LIMIT 1");
  return (found.rowCount ?? 0) > 0;
}

export async function ensureDemoData(pool: Pool, options: DemoDataOptions = {}): Promise<"present" | "rebuilt"> {
  if (await hasData(pool)) return "present";
  if (options.production && (!options.adminPassword || !options.officerPin)) {
    throw new Error("SEED_ADMIN_PASSWORD and SEED_OFFICER_PIN are required to rebuild demo data in production");
  }

  const folder = options.migrationsFolder ?? path.join(process.cwd(), "src", "server", "db", "migrations");
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('levypass_migrations'))");
    try {
      await migrate(drizzle({ client }), { migrationsFolder: folder });
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext('levypass_migrations'))");
    }
  } finally {
    client.release();
  }

  if (await hasData(pool)) return "present"; // another process seeded while we migrated
  const inserted = await seed(drizzle({ client: pool, schema, casing: "snake_case" }), {
    adminPassword: options.adminPassword,
    officerPin: options.officerPin,
    publicBaseUrl: options.publicBaseUrl,
  });
  log("warn", "demo_data.rebuilt", { reason: "database was empty", inserted });
  return "rebuilt";
}
