import { desc, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";

export const dynamic = "force-dynamic";

/**
 * SIM cards the simulator can switch between: the newest traders, and before them any number that was
 * sent an SMS in the last 10 minutes without being a trader yet. That is somebody halfway through
 * registration, whose code would otherwise have no phone to arrive on.
 */
export async function GET(): Promise<Response> {
  const traders = await db().select({ phone: s.traders.phone, name: s.traders.name }).from(s.traders).orderBy(desc(s.traders.createdAt)).limit(60);
  const waiting = await db().execute<{ phone: string }>(sql`
    SELECT o.recipient AS phone
    FROM outbox o
    WHERE o.kind = 'sms' AND o.recipient IS NOT NULL AND o.created_at > now() - interval '10 minutes'
      AND NOT EXISTS (SELECT 1 FROM traders t WHERE t.phone = o.recipient)
    GROUP BY o.recipient
    ORDER BY max(o.created_at) DESC
    LIMIT 10`);
  const rows = [...waiting.rows.map((w) => ({ phone: w.phone, name: "New number" })), ...traders];
  return Response.json(rows, { headers: { "cache-control": "no-store" } });
}
