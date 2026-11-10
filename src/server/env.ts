import "server-only";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    PUBLIC_BASE_URL: z.url().default("http://localhost:3000"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    BANK_ADAPTER: z.enum(["fake", "xtradot"]).default("fake"),
    BANK_API_BASE_URL: z.url().default("http://bank-api.ingress-apisix.svc.cluster.local/v1"),
    MAAS_BASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    MAAS_MODEL: z.string().min(1).default("deepseek-v4.1-flash"),
    GATEWAY_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    QR_SIGNING_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SESSION_SECRET: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
    BANK_MERCHANT_ID: z.string().min(1).default("mer_204"),
    WEBHOOK_URL: z.url().default("http://app.team13.svc.cluster.local/api/webhooks/bank"),
    POLLER: z.enum(["on", "off"]).default("on"),
    // Rebuild schema and synthetic seed when the database is found empty (cluster only, see jobs/self-heal.ts).
    AUTO_SEED: z.enum(["on", "off"]).default("off"),
    MIGRATIONS_DIR: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SEED_ADMIN_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SEED_OFFICER_PIN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  })
  .superRefine((env, ctx) => {
    if (env.BANK_ADAPTER === "xtradot" && !env.GATEWAY_KEY) {
      ctx.addIssue({ code: "custom", path: ["GATEWAY_KEY"], message: "GATEWAY_KEY is required when BANK_ADAPTER=xtradot" });
    }
    if (env.NODE_ENV === "production") {
      for (const key of ["QR_SIGNING_KEY", "SESSION_SECRET"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required in production` });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Parses an environment object. Error messages name the variable, never its value. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${problems}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Lazily parsed so that `next build` and `/healthz` do not need a database URL. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
