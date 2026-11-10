import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { newId } from "@/core/ids";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { env } from "@/server/env";
import { sessionSecret } from "@/server/keys";

// Signed httpOnly cookies backed by the sessions table, so a suspension ends a session at once.
// One cookie per role, so an officer and an admin can be signed in on the same demo laptop.

export type Role = "trader" | "officer" | "admin";
const cookieName = (role: Role) => `lp_${role}`;
const ttlHours: Record<Role, number> = { trader: 24 * 30, officer: 14, admin: 12 };
const sign = (id: string) => createHmac("sha256", sessionSecret()).update(id).digest("base64url");

export async function createSession(role: Role, subjectId: string): Promise<void> {
  const id = newId("ses");
  const expiresAt = new Date(Date.now() + ttlHours[role] * 3_600_000);
  await db().insert(s.sessions).values({ id, subjectType: role, subjectId, expiresAt });
  (await cookies()).set(cookieName(role), `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

function parse(value: string | undefined): string | null {
  if (!value) return null;
  const [id, mac] = value.split(".");
  if (!id || !mac) return null;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}

/** The session row for a role, valid or not (the scan API needs to know a revoked officer). */
export async function sessionRow(role: Role) {
  const id = parse((await cookies()).get(cookieName(role))?.value);
  if (!id) return null;
  const [row] = await db().select().from(s.sessions).where(and(eq(s.sessions.id, id), eq(s.sessions.subjectType, role)));
  return row ?? null;
}

export async function currentSubject(role: Role): Promise<string | null> {
  const id = parse((await cookies()).get(cookieName(role))?.value);
  if (!id) return null;
  const [row] = await db()
    .select({ subjectId: s.sessions.subjectId })
    .from(s.sessions)
    .where(and(eq(s.sessions.id, id), eq(s.sessions.subjectType, role), isNull(s.sessions.revokedAt), gt(s.sessions.expiresAt, new Date())));
  return row?.subjectId ?? null;
}

export async function requireSubject(role: Role): Promise<string> {
  const id = await currentSubject(role);
  if (!id) redirect(role === "trader" ? "/login" : `/${role}/login`);
  return id;
}

export async function endSession(role: Role): Promise<void> {
  const id = parse((await cookies()).get(cookieName(role))?.value);
  if (id) await db().update(s.sessions).set({ revokedAt: sql`now()` }).where(eq(s.sessions.id, id));
  (await cookies()).delete(cookieName(role));
}

export async function revokeAllSessions(role: Role, subjectId: string): Promise<void> {
  await db().update(s.sessions).set({ revokedAt: sql`now()` }).where(and(eq(s.sessions.subjectType, role), eq(s.sessions.subjectId, subjectId), isNull(s.sessions.revokedAt)));
}
