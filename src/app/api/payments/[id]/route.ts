import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { currentSubject } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** Payment status for the waiting screen. Reads our database only; the trader must own it. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const traderId = await currentSubject("trader");
  const { id } = await params;
  const [p] = await db().select().from(s.payments).where(eq(s.payments.id, id));
  if (!p || !traderId || p.traderId !== traderId) return Response.json({ error: "not found" }, { status: 404 });
  const [r] = await db().select({ number: s.receipts.number }).from(s.receipts).where(eq(s.receipts.paymentId, id));
  return Response.json({ status: p.status, settled: Boolean(p.settledAt), receipt: r?.number ?? null, amountKobo: p.amountKobo, feeKobo: p.feeKobo }, { headers: { "cache-control": "no-store" } });
}
