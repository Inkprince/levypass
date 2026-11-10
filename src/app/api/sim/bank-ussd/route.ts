import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { formatNaira } from "@/core/money";
import { getBank } from "@/server/bank";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { normalisePhone } from "@/server/phone";

export const dynamic = "force-dynamic";

/** Plays the trader's bank: dialling the checkout's *7272*...# code approves that payment (sandbox simulate-ussd). */
export async function POST(request: Request): Promise<Response> {
  const { phone, code } = (await request.json()) as { phone?: string; code?: string };
  const p164 = normalisePhone(phone ?? "");
  const [p] = await db()
    .select({ id: s.payments.id, amount: s.payments.amountKobo })
    .from(s.payments)
    .innerJoin(s.traders, eq(s.traders.id, s.payments.traderId))
    .where(and(eq(s.traders.phone, p164 ?? ""), inArray(s.payments.status, ["pending"]), sql`${s.payments.providerData}->'checkout'->>'ussdCode' = ${code ?? ""}`))
    .orderBy(desc(s.payments.createdAt))
    .limit(1);
  if (!p) return new Response("END Xtradot Bank: no pending payment for this code.", { headers: { "content-type": "text/plain" } });
  await getBank().simulateUssd(p.id);
  return new Response(`END Xtradot Bank: ${formatNaira(p.amount)} paid to LEVY COLLECTION. Ref ${p.id.slice(-8)}.`, { headers: { "content-type": "text/plain" } });
}
