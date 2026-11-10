import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Load .env.local the way `next dev` does, so database tests find TEST_DATABASE_URL.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: rely on the process environment.
}

const src = fileURLToPath(new URL("./src", import.meta.url));
const serverOnlyStub = fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url));

const resolve = { alias: { "@": src, "server-only": serverOnlyStub } };

export default defineConfig({
  resolve,
  test: {
    projects: [
      {
        resolve,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
          exclude: ["**/*.db.test.ts", "node_modules/**"],
          environment: "node",
        },
      },
      {
        resolve,
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts", "scripts/**/*.db.test.ts"],
          environment: "node",
          globalSetup: ["src/test/db-global-setup.ts"],
          // One database: run files one after another.
          fileParallelism: false,
          testTimeout: 20_000,
        },
      },
    ],
  },
});
