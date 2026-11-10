import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatNaira } from "@/core/money";
import { Button, Card, PageShell } from "@/app/_ui/kit";
import { requireSubject } from "@/server/auth/session";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { completeUssd } from "../../actions";
import { Waiting } from "./waiting";

export const dynamic = "force-dynamic";

type Checkout = { ussdCode?: string; paymentUrl?: string; transferAccount?: { accountNumber: string; accountName: string; bankName: string } };

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const traderId = await requireSubject("trader");
  const { id } = await params;
  const [p] = await db().select().from(s.payments).where(eq(s.payments.id, id));
  if (!p || p.traderId !== traderId) notFound();
  const c = ((p.providerData as { checkout?: Checkout }).checkout ?? {}) as Checkout;

  return (
    <PageShell title={`Pay ${formatNaira(p.amountKobo)}`} back={{ href: "/pass", label: "My pass" }}>
      <Waiting id={p.id} startedAt={p.createdAt.getTime()} />
      {!p.settledAt ? (
        <>
          <Card>
            <p className="text-sm font-semibold text-slate-500">Option 1: USSD on any phone</p>
            <p className="mt-1 font-mono text-3xl font-extrabold tracking-wide text-ink">{c.ussdCode ?? "..."}</p>
            <p className="mt-1 text-sm text-slate-600">Dial this code and approve with your bank PIN.</p>
            <form action={completeUssd} className="mt-3">
              <input type="hidden" name="paymentId" value={p.id} />
              <Button variant="secondary" className="w-full" type="submit">
                Sandbox: approve this USSD payment
              </Button>
            </form>
          </Card>
          {c.transferAccount ? (
            <Card>
              <p className="text-sm font-semibold text-slate-500">Option 2: bank transfer</p>
              <p className="mt-1 font-mono text-2xl font-bold">{c.transferAccount.accountNumber}</p>
              <p className="text-sm text-slate-600">
                {c.transferAccount.accountName} · {c.transferAccount.bankName}
              </p>
            </Card>
          ) : null}
          {c.paymentUrl ? (
            <Card>
              <p className="text-sm font-semibold text-slate-500">Option 3: card</p>
              <a href={c.paymentUrl} className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ink px-5 font-semibold text-white">
                Pay by card
              </a>
            </Card>
          ) : null}
          <p className="text-center text-xs text-slate-500">Payments go straight to the government collection account. LevyPass never holds your money.</p>
        </>
      ) : null}
    </PageShell>
  );
}
