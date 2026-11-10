import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { newId } from "@/core/ids";
import { lagosDate } from "@/core/periods";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { sessionSecret } from "@/server/keys";
import { ensureObligations } from "@/server/levy/obligations";
import { queueSms } from "@/server/notify/outbox";
import { normalisePhone } from "@/server/phone";
import { t, isLocale } from "@/messages";

export const registrationInput = z.object({
  name: z.string().trim().min(3, "Enter the trader's full name.").max(80),
  phone: z.string().trim().transform((v, ctx) => normalisePhone(v) ?? (ctx.addIssue({ code: "custom", message: "Enter a Nigerian phone number, for example 0803 000 0000." }), z.NEVER)),
  marketId: z.string().min(1, "Choose a market."),
  stallOrVehicle: z.string().trim().min(1, "Enter the stall or vehicle number.").max(30),
  businessType: z.string().trim().min(2, "Enter the type of business.").max(40),
  locale: z.string().default("en"),
});
export type RegistrationInput = z.infer<typeof registrationInput>;

// The pending registration rides in a signed cookie until the OTP is confirmed.
const mac = (v: string) => createHmac("sha256", sessionSecret()).update(`reg:${v}`).digest("base64url");
export const sealRegistration = (r: RegistrationInput) => {
  const v = Buffer.from(JSON.stringify(r)).toString("base64url");
  return `${v}.${mac(v)}`;
};
export function openRegistration(cookie: string | undefined): RegistrationInput | null {
  const [v, m] = (cookie ?? "").split(".");
  if (!v || !m || mac(v) !== m) return null;
  const parsed = registrationInput.safeParse(JSON.parse(Buffer.from(v, "base64url").toString()));
  return parsed.success ? parsed.data : null;
}

export async function phoneTaken(phone: string): Promise<boolean> {
  return (await db().select({ id: s.traders.id }).from(s.traders).where(eq(s.traders.phone, phone))).length > 0;
}

/** TR-01 to TR-03: creates the trader, assigns the market's levies from today, sends the welcome SMS. */
export async function createTrader(r: RegistrationInput, now = new Date()): Promise<string> {
  const id = newId("trd");
  const locale = isLocale(r.locale) ? r.locale : "en";
  await db().transaction(async (tx) => {
    await tx.insert(s.traders).values({ id, phone: r.phone, name: r.name, marketId: r.marketId, stallOrVehicle: r.stallOrVehicle, businessType: r.businessType, qrTokenId: randomBytes(12).toString("hex"), status: "active", locale, phoneVerifiedAt: now });
    const levies = await tx
      .select({ id: s.levyTypes.id })
      .from(s.levyTypeMarkets)
      .innerJoin(s.levyTypes, eq(s.levyTypes.id, s.levyTypeMarkets.levyTypeId))
      .where(and(eq(s.levyTypeMarkets.marketId, r.marketId), eq(s.levyTypes.active, true)));
    if (levies.length) await tx.insert(s.traderLevies).values(levies.map((l) => ({ traderId: id, levyTypeId: l.id, startDate: lagosDate(now) })));
    await ensureObligations(tx, id, now);
    await queueSms(tx, r.phone, "sms.welcome", t(locale, "sms.welcome", { name: r.name.split(" ")[0] ?? r.name, id, ussd: "*347*13#" }));
  });
  return id;
}

export async function markets() {
  return db().select({ id: s.markets.id, name: s.markets.name }).from(s.markets).orderBy(s.markets.name);
}

export async function traderByPhone(phone: string) {
  const [row] = await db().select({ id: s.traders.id, locale: s.traders.locale }).from(s.traders).where(eq(s.traders.phone, phone));
  return row ?? null;
}
