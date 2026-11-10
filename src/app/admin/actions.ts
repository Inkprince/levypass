"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { newId } from "@/core/ids";
import { nairaToKobo } from "@/core/money";
import { audit } from "@/server/admin/audit";
import * as failures from "@/server/admin/failures";
import { hashSecret, verifySecret } from "@/server/auth/password";
import { createSession, endSession, requireSubject, revokeAllSessions } from "@/server/auth/session";
import { getBank } from "@/server/bank";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";

export async function adminLogin(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const [a] = await db().select().from(s.admins).where(eq(s.admins.email, email));
  if (!a || !(await verifySecret(String(form.get("password") ?? ""), a.passwordHash))) return { error: "Email or password is wrong." };
  await createSession("admin", a.id);
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  await endSession("admin");
  redirect("/admin/login");
}

/** OF-08: suspend or reinstate at once. Suspension also ends every session the officer has. */
export async function setOfficerStatus(form: FormData): Promise<void> {
  const adminId = await requireSubject("admin");
  const id = String(form.get("officerId"));
  const status = form.get("status") === "suspended" ? "suspended" : "active";
  const [before] = await db().select({ status: s.officers.status }).from(s.officers).where(eq(s.officers.id, id));
  await db().update(s.officers).set({ status, suspendedAt: status === "suspended" ? new Date() : null }).where(eq(s.officers.id, id));
  if (status === "suspended") await revokeAllSessions("officer", id);
  await audit(adminId, status === "suspended" ? "officer.suspend" : "officer.reinstate", "officer", id, before, { status });
  revalidatePath("/admin/officers");
}

const officerInput = z.object({ name: z.string().trim().min(3), staffId: z.string().trim().min(3).max(20), pin: z.string().regex(/^\d{4,8}$/), marketId: z.string().min(1) });

export async function createOfficer(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const adminId = await requireSubject("admin");
  const parsed = officerInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a name, a staff ID and a PIN of 4 to 8 digits." };
  const d = parsed.data;
  const staffId = d.staffId.toUpperCase();
  if ((await db().select({ id: s.officers.id }).from(s.officers).where(eq(s.officers.staffId, staffId))).length) return { error: "That staff ID is taken." };
  const [m] = await db().select({ authorityId: s.markets.authorityId }).from(s.markets).where(eq(s.markets.id, d.marketId));
  const id = newId("off");
  await db().insert(s.officers).values({ id, authorityId: m!.authorityId, staffId, name: d.name, pinHash: await hashSecret(d.pin), qrTokenId: randomBytes(12).toString("hex") });
  await db().insert(s.officerMarkets).values({ officerId: id, marketId: d.marketId });
  await audit(adminId, "officer.create", "officer", id, null, { staffId, name: d.name });
  revalidatePath("/admin/officers");
  return {};
}

const levyInput = z.object({
  name: z.string().trim().min(3),
  amountNaira: z.coerce.number().int().positive(),
  period: z.enum(["daily", "weekly", "monthly", "yearly"]),
  legalBasis: z.string().trim().min(5),
  marketId: z.string().min(1),
});

/** LV-01, LV-06: levies are whole naira and record their legal basis. */
export async function createLevy(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const adminId = await requireSubject("admin");
  const parsed = levyInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a name, a whole-naira amount, a period and the legal basis." };
  const d = parsed.data;
  const [m] = await db().select({ authorityId: s.markets.authorityId }).from(s.markets).where(eq(s.markets.id, d.marketId));
  const id = newId("lvt");
  await db().insert(s.levyTypes).values({ id, authorityId: m!.authorityId, name: d.name, amountKobo: nairaToKobo(d.amountNaira), period: d.period, legalBasis: d.legalBasis });
  await db().insert(s.levyTypeMarkets).values({ levyTypeId: id, marketId: d.marketId });
  await audit(adminId, "levy.create", "levy_type", id, null, d);
  revalidatePath("/admin/levies");
  return {};
}

export async function updateLevy(form: FormData): Promise<void> {
  const adminId = await requireSubject("admin");
  const id = String(form.get("levyId"));
  const amount = z.coerce.number().int().positive().safeParse(form.get("amountNaira"));
  const [before] = await db().select().from(s.levyTypes).where(eq(s.levyTypes.id, id));
  if (!before || !amount.success) return;
  const after = { amountKobo: nairaToKobo(amount.data), legalBasis: String(form.get("legalBasis") ?? before.legalBasis), active: form.get("active") === "on" };
  await db().update(s.levyTypes).set(after).where(eq(s.levyTypes.id, id));
  await audit(adminId, "levy.update", "levy_type", id, { amountKobo: before.amountKobo, legalBasis: before.legalBasis, active: before.active }, after);
  revalidatePath("/admin/levies");
}

/** AD-04: resolve or dismiss a flag, complaint or review item. */
export async function closeCase(form: FormData): Promise<void> {
  const adminId = await requireSubject("admin");
  const kind = String(form.get("kind"));
  const id = String(form.get("id"));
  const status = form.get("status") === "dismissed" ? "dismissed" : "resolved";
  const table = kind === "flag" ? s.fraudFlags : kind === "complaint" ? s.complaints : s.reviewItems;
  await db().update(table).set({ status, resolvedAt: new Date(), resolvedBy: adminId }).where(eq(table.id, id));
  await audit(adminId, `${kind}.${status}`, kind, id, { status: "open" }, { status });
  revalidatePath("/admin/fraud");
}

export async function runSettlement(): Promise<void> {
  const adminId = await requireSubject("admin");
  const batches = await getBank().runSettlements();
  await audit(adminId, "settlement.run", "bank", "settlements", null, { batches: batches.map((b) => b.settlementId) });
  revalidatePath("/admin/reconciliation");
}

export async function runFailure(scenario: string): Promise<failures.Run> {
  await requireSubject("admin");
  const run = { withheld: failures.withheldWebhook, replayed: failures.replayedWebhook, forged: failures.forgedSignature, double: failures.secondPayment }[scenario];
  if (!run) return { scenario, steps: [{ who: "check", text: "Unknown scenario.", ok: false }] };
  return run();
}
