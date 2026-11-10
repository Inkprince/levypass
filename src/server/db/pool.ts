import { Pool, type PoolConfig } from "pg";

/** Small pool: one app replica inside a 192Mi request. Fails fast so /readyz never hangs. */
export function createPool(connectionString: string, overrides: PoolConfig = {}): Pool {
  return new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 10_000,
    application_name: "levypass",
    ...overrides,
  });
}
