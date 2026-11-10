"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { verifySecret } from "@/server/auth/password";
import { createSession, endSession } from "@/server/auth/session";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";

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
