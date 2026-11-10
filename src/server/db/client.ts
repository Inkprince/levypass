import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { env } from "@/server/env";
import { createPool } from "./pool";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

// Survive Next.js dev hot reloads without opening a new pool each time.
const globalForDb = globalThis as unknown as { levypassPool?: Pool };

export function pool(): Pool {
  const current = globalForDb.levypassPool;
  if (!current || current.ending || current.ended) globalForDb.levypassPool = createPool(env().DATABASE_URL);
  return globalForDb.levypassPool!;
}

export function db(): Db {
  return drizzle({ client: pool(), schema, casing: "snake_case" });
}

/** Cheap readiness probe: one round trip, bounded by the pool's connection timeout. */
export async function pingDatabase(): Promise<void> {
  await pool().query("SELECT 1");
}
