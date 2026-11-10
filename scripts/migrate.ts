import { requireEnv } from "./load-env";
import { createPool } from "../src/server/db/pool";
import { migrationsFolder, runMigrations } from "../src/server/db/migrate";

const pool = createPool(requireEnv("DATABASE_URL"), { max: 1 });
try {
  // In the container the SQL files sit beside the bundle, not under src/.
  await runMigrations(pool, process.env.MIGRATIONS_DIR ?? migrationsFolder);
  console.log(JSON.stringify({ level: "info", msg: "db.migrated" }));
} catch (error) {
  console.error(JSON.stringify({ level: "error", msg: "db.migrate_failed", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
