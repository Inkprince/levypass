import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";

export const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

/** Applies pending SQL migrations. Safe to run repeatedly and from several processes. */
export async function runMigrations(pool: Pool, folder: string = migrationsFolder): Promise<void> {
  const client = await pool.connect();
  try {
    // Serialise concurrent runs (for example two pods starting together).
    await client.query("SELECT pg_advisory_lock(hashtext('levypass_migrations'))");
    try {
      await migrate(drizzle({ client }), { migrationsFolder: folder });
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext('levypass_migrations'))");
    }
  } finally {
    client.release();
  }
}
