import { drizzle } from "drizzle-orm/node-postgres";
import { requireEnv } from "./load-env";
import { createPool } from "../src/server/db/pool";
import * as schema from "../src/server/db/schema";
import { seed } from "../src/server/db/seed";

// Synthetic data only. Demo credentials come from the environment in production.
const production = process.env.NODE_ENV === "production";
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const officerPin = process.env.SEED_OFFICER_PIN;
if (production && (!adminPassword || !officerPin)) {
  console.error("SEED_ADMIN_PASSWORD and SEED_OFFICER_PIN are required when NODE_ENV=production.");
  process.exit(1);
}

const pool = createPool(requireEnv("DATABASE_URL"), { max: 1 });
try {
  const inserted = await seed(drizzle({ client: pool, schema, casing: "snake_case" }), {
    adminPassword,
    officerPin,
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
  });
  console.log(JSON.stringify({ level: "info", msg: "db.seeded", inserted }));
} catch (error) {
  console.error(JSON.stringify({ level: "error", msg: "db.seed_failed", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
