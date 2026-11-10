import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { normalisePhone } from "@/server/phone";

export const dynamic = "force-dynamic";

/**
 * The simulator's SMS inbox. The simulator stands in for the SMS gateway, so a message shows as soon as
 * its transaction commits (a receipt in under a second), not on the poller's next 8-second tick.
 */
export async function GET(request: Request): Promise<Response> {
  const phone = normalisePhone(new URL(request.url).searchParams.get("phone") ?? "");
  if (!phone) return Response.json([]);
  const rows = await db()
    .select({ id: s.outbox.id, payload: s.outbox.payload, at: sql<Date>`coalesce(${s.outbox.sentAt}, ${s.outbox.createdAt})`, topic: s.outbox.topic })
    .from(s.outbox)
    .where(and(eq(s.outbox.recipient, phone), eq(s.outbox.kind, "sms"), inArray(s.outbox.status, ["pending", "sent"])))
    .orderBy(desc(s.outbox.createdAt))
    .limit(30);
  return Response.json(rows.map((r) => ({ id: r.id, text: (r.payload as { text?: string }).text ?? "", at: r.at, topic: r.topic })), { headers: { "cache-control": "no-store" } });
}
