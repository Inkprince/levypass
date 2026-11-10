import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { newId } from "@/core/ids";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { sessionSecret } from "@/server/keys";
import { queueSms } from "@/server/notify/outbox";
import { t, type Locale } from "@/messages";

// TR-02: six-digit codes, hashed at rest, ten minutes, five attempts. Delivered through the outbox.
const hash = (phone: string, code: string) => createHmac("sha256", sessionSecret()).update(`otp:${phone}:${code}`).digest("hex");

export async function issueOtp(phone: string, purpose: "register" | "login", locale: Locale = "en"): Promise<void> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db().insert(s.otpCodes).values({ id: newId("otp"), phone, purpose, codeHash: hash(phone, code), expiresAt: new Date(Date.now() + 10 * 60_000) });
  await queueSms(db(), phone, "sms.otp", t(locale, "sms.otp", { code }));
}

export async function verifyOtp(phone: string, purpose: "register" | "login", code: string): Promise<boolean> {
  const [row] = await db()
    .select()
    .from(s.otpCodes)
    .where(and(eq(s.otpCodes.phone, phone), eq(s.otpCodes.purpose, purpose), isNull(s.otpCodes.consumedAt)))
    .orderBy(desc(s.otpCodes.createdAt))
    .limit(1);
  if (!row || row.expiresAt < new Date() || row.attempts >= 5) return false;
  const ok = timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(hash(phone, code.trim())));
  await db().update(s.otpCodes).set(ok ? { consumedAt: sql`now()` } : { attempts: sql`${s.otpCodes.attempts} + 1` }).where(eq(s.otpCodes.id, row.id));
  return ok;
}
