import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { createPool } from "../server/db/pool";
import * as schema from "../server/db/schema";

/** A pool and Drizzle client on the test database. Close the pool in afterAll. */
export function testDb(): { pool: Pool; db: ReturnType<typeof drizzle<typeof schema>> } {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  const pool = createPool(url, { max: 2 });
  return { pool, db: drizzle({ client: pool, schema, casing: "snake_case" }) };
}
