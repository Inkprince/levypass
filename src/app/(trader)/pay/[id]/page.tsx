import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { formatNaira } from "@/core/money";
import { Button, Icon, type IconName, PageShell, buttonClass } from "@/app/_ui/kit";
import { requireSubject } from "@/server/auth/session";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { completeUssd } from "../../actions";
import { Waiting } from "./waiting";

export const dynamic = "force-dynamic";

type Checkout = { ussdCode?: string; paymentUrl?: string; transferAccount?: { accountNumber: string; accountName: string; bankName: string } };

function Option({ n, icon, title, children }: { n: number; icon: IconName; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mist-2 text-forest">
          <Icon name={icon} size={18} />
        </span>
        <p className="text-[15px] font-semibold">{title}</p>
        <span className="ml-auto font-mono text-[12px] text-ink-3">0{n}</span>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const traderId = await requireSubject("trader");
  const { id } = await params;
  const [p] = await db().select().from(s.payments).where(eq(s.payments.id, id));
  if (!p || p.traderId !== traderId) notFound();
  const c = ((p.providerData as { checkout?: Checkout }).checkout ?? {}) as Checkout;

  return (
    <PageShell back={{ href: "/pass", label: "My pass" }}>
      <div className="mb-1">
        <p className="text-[14px] font-medium text-ink-2">You are paying</p>
        <p className="money mt-1 text-[48px] leading-none">{formatNaira(p.amountKobo)}</p>
      </div>
      <Waiting id={p.id} startedAt={p.createdAt.getTime()} />
      {!p.settledAt && p.status !== "failed" && p.status !== "reversed" ? (
        <>
          <Option n={1} icon="hash" title="USSD on any phone">
            <p className="rounded-xl bg-mist px-4 py-3 text-center font-mono text-[28px] font-bold tracking-wide">{c.ussdCode ?? "..."}</p>
            <p className="mt-2 text-[14px] text-ink-2">Dial this code and approve with your bank PIN.</p>
            <form action={completeUssd} className="mt-4">
              <input type="hidden" name="paymentId" value={p.id} />
              <Button variant="outline" className="w-full" type="submit">
                Sandbox: approve this USSD payment
              </Button>
            </form>
          </Option>
          {c.transferAccount ? (
            <Option n={2} icon="transfer" title="Bank transfer">
              <p className="font-mono text-[24px] font-bold tracking-wide">{c.transferAccount.accountNumber}</p>
              <p className="mt-1 text-[14px] text-ink-2">
                {c.transferAccount.accountName}, {c.transferAccount.bankName}
              </p>
            </Option>
          ) : null}
          {c.paymentUrl ? (
            <Option n={c.transferAccount ? 3 : 2} icon="card" title="Debit card">
              <a href={c.paymentUrl} className={buttonClass("primary", "lg", "w-full")}>
                Pay by card
              </a>
            </Option>
          ) : null}
          <p className="flex items-start justify-center gap-2 px-2 text-center text-[13px] text-ink-3">
            <Icon name="lock" size={15} className="mt-px" />
            Payments go straight to the government collection account. LevyPass never holds your money.
          </p>
        </>
      ) : null}
    </PageShell>
  );
}
