import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "./db/client";
import { appSettings } from "./db/schema";

export async function getSetting(key: string): Promise<string | undefined> {
  const [row] = await db().select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key));
  return row?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db()
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: sql`now()` } });
}
