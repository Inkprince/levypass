"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifySecret } from "@/server/auth/password";
import { createSession, endSession, requireSubject } from "@/server/auth/session";
import { getBank } from "@/server/bank";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { cashAheadOptions, collectCash, requestFloat, startCashCollection, startFloatDeposit, type AheadOption } from "@/server/floats/floats";

export async function officerLogin(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const staffId = String(form.get("staffId") ?? "").trim().toUpperCase();
  const pin = String(form.get("pin") ?? "");
  const [o] = await db().select().from(s.officers).where(eq(s.officers.staffId, staffId));
  if (!o || !(await verifySecret(pin, o.pinHash))) return { error: "Staff ID or PIN is wrong." };
  if (o.status === "suspended") return { error: "This officer ID is suspended. Contact the revenue office." };
  await createSession("officer", o.id);
  redirect("/officer");
}

export async function officerLogout(): Promise<void> {
  await endSession("officer");
  redirect("/officer/login");
}

export type StartCashResult = { ok: true; sent: boolean; amountKobo: number } | { ok: false; error: string };

/** "Take cash": checks the cash can be taken and makes sure the trader holds a cash code (SMS if they did not ask first). */
export async function startCashAction(scanId: string, expectedKobo: number, aheadDays?: number): Promise<StartCashResult> {
  const officerId = await requireSubject("officer");
  if (typeof scanId !== "string" || !Number.isSafeInteger(expectedKobo) || expectedKobo <= 0) return { ok: false, error: "Scan the trader again." };
  if (aheadDays !== undefined && !Number.isSafeInteger(aheadDays)) return { ok: false, error: "Choose tomorrow or the next 7 days." };
  try {
    return await startCashCollection({ officerId, scanId, expectedKobo, aheadDays });
  } catch {
    return { ok: false, error: "Could not start the cash payment. Do not take the money yet. Try again." };
  }
}

export type CashResult = { ok: true; receiptNumber: string; amountKobo: number; traderName: string; balanceKobo: number } | { ok: false; error: string };

/** Cash handed to the officer, recorded with the trader's cash code. Paid from the officer's prepaid float. */
export async function collectCashAction(scanId: string, expectedKobo: number, code: string, aheadDays?: number): Promise<CashResult> {
  const officerId = await requireSubject("officer");
  if (typeof scanId !== "string" || !Number.isSafeInteger(expectedKobo) || expectedKobo <= 0) return { ok: false, error: "Scan the trader again." };
  if (typeof code !== "string" || !/^\d{4}$/.test(code.trim())) return { ok: false, error: "Type the 4-digit cash code from the trader's phone." };
  if (aheadDays !== undefined && !Number.isSafeInteger(aheadDays)) return { ok: false, error: "Choose tomorrow or the next 7 days." };
  try {
    const r = await collectCash({ officerId, scanId, expectedKobo, code: code.trim(), aheadDays });
    return r.ok ? { ok: true, receiptNumber: r.receiptNumber, amountKobo: r.amountKobo, traderName: r.traderName, balanceKobo: r.balanceKobo } : r;
  } catch {
    return { ok: false, error: "The cash could not be recorded. Do not take the money yet. Try again." };
  }
}

export type AheadResult = { ok: true; options: AheadOption[] } | { ok: false; error: string };

/** What the officer can offer a trader who is paid up today: tomorrow, or the next 7 days. */
export async function cashAheadOptionsAction(scanId: string): Promise<AheadResult> {
  const officerId = await requireSubject("officer");
  if (typeof scanId !== "string") return { ok: false, error: "Scan the trader again." };
  try {
    return await cashAheadOptions({ officerId, scanId });
  } catch {
    return { ok: false, error: "Could not work out the amount. Try again." };
  }
}

export async function requestFloatAction(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const officerId = await requireSubject("officer");
  const r = await requestFloat(officerId, Number(form.get("amountKobo")));
  if (!r.ok) return { error: r.error };
  revalidatePath("/officer/advance");
  return {};
}

export async function startDepositAction(form: FormData): Promise<void> {
  const officerId = await requireSubject("officer");
  await startFloatDeposit(officerId, String(form.get("floatId")));
  revalidatePath("/officer/advance");
}

/** Sandbox only: approve the deposit's USSD prompt, as the officer's bank would. */
export async function approveDepositAction(form: FormData): Promise<void> {
  await requireSubject("officer");
  await getBank().simulateUssd(String(form.get("paymentId")));
  redirect("/officer/advance");
}
