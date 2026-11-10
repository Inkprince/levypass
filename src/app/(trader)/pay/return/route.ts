import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { settlePayment } from "@/server/payments/settle";

export const dynamic = "force-dynamic";

/** Checkout callback (PY-02). The `status` parameter is ignored: only a server-side verify gives value. */
export async function GET(request: Request): Promise<Response> {
  const reference = new URL(request.url).searchParams.get("reference") ?? "";
  const [p] = await db().select({ id: s.payments.id }).from(s.payments).where(eq(s.payments.providerRef, reference));
  if (!p) redirect("/pass");
  await settlePayment(p.id).catch(() => undefined); // the poller retries if the bank is slow
  redirect(`/pay/${p.id}`);
}
