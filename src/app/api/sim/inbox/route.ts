import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { normalisePhone } from "@/server/phone";

export const dynamic = "force-dynamic";

/** The simulator's SMS inbox: messages the poller has delivered to this number. */
export async function GET(request: Request): Promise<Response> {
  const phone = normalisePhone(new URL(request.url).searchParams.get("phone") ?? "");
  if (!phone) return Response.json([]);
  const rows = await db()
    .select({ id: s.outbox.id, payload: s.outbox.payload, at: s.outbox.sentAt, topic: s.outbox.topic })
    .from(s.outbox)
    .where(and(eq(s.outbox.recipient, phone), eq(s.outbox.kind, "sms"), eq(s.outbox.status, "sent")))
    .orderBy(desc(s.outbox.createdAt))
    .limit(30);
  return Response.json(rows.map((r) => ({ id: r.id, text: (r.payload as { text?: string }).text ?? "", at: r.at, topic: r.topic })), { headers: { "cache-control": "no-store" } });
}
