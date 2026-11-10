import { desc } from "drizzle-orm";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const rows = await db().select({ phone: s.traders.phone, name: s.traders.name }).from(s.traders).orderBy(desc(s.traders.createdAt)).limit(60);
  return Response.json(rows, { headers: { "cache-control": "no-store" } });
}
