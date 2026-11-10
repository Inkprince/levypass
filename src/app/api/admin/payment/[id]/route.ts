import { eq } from "drizzle-orm";
import { currentSubject } from "@/server/auth/session";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await currentSubject("admin"))) return Response.json({ error: "login required" }, { status: 401 });
  const [p] = await db().select({ status: s.payments.status, settledAt: s.payments.settledAt }).from(s.payments).where(eq(s.payments.id, (await params).id));
  return Response.json(p ?? null, { headers: { "cache-control": "no-store" } });
}
