import { requireEnv } from "./load-env";
import { createPool } from "../src/server/db/pool";

// Synthetic data only. The full seed (market, levies, traders, officers) arrives in T5.
const pool = createPool(requireEnv("DATABASE_URL"), { max: 1 });
try {
  await pool.query("SELECT 1");
  console.log(JSON.stringify({ level: "info", msg: "db.seeded", note: "no tables yet" }));
} catch (error) {
  console.error(JSON.stringify({ level: "error", msg: "db.seed_failed", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
