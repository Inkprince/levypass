import "server-only";

type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold = (): number => order[(process.env.LOG_LEVEL as Level | undefined) ?? "info"] ?? order.info;

/** Structured JSON logs. Callers must not pass secrets or full phone numbers. */
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (order[level] < threshold()) return;
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...fields });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

/** Loggable summary of an unknown error: name, message and code (pg and Node set `code`). */
export function errorFields(error: unknown): Record<string, string> {
  if (!(error instanceof Error)) return { error: String(error) };
  const code = (error as { code?: unknown }).code;
  const nested = error instanceof AggregateError ? error.errors.map((e: unknown) => (e instanceof Error ? e.message : String(e))).join("; ") : "";
  return {
    error_name: error.name,
    error: error.message || nested || "(no message)",
    ...(typeof code === "string" ? { error_code: code } : {}),
  };
}
