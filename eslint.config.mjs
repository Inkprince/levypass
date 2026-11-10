import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "import/no-default-export": "off",
    },
  },
  {
    // src/core is pure domain logic: no I/O and no imports from the server or app layers.
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/server/*", "@/app/*", "**/server/**", "**/app/**"], message: "src/core must not import from src/server or src/app." },
            { group: ["pg", "drizzle-orm", "drizzle-orm/*", "next", "next/*", "server-only"], message: "src/core is pure: no I/O or framework imports." },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts", "src/server/db/migrations/**"]),
]);
