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
