import { formatNaira } from "@/core/money";
import { lagosDate } from "@/core/periods";
import { Badge, Button, Card, CardTitle, Icon, PageHeader, Rows, buttonClass, inputClass } from "@/app/_ui/kit";
import { reconcileDay } from "@/server/admin/reconcile";
import { errorFields } from "@/server/log";
import { runSettlement } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test((await searchParams).date ?? "") ? (await searchParams).date! : lagosDate(new Date());
  let view;
  try {
    view = await reconcileDay(date);
  } catch (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Reconciliation" />
        <Card>
          <p className="flex items-start gap-2.5 text-[15px] text-ink-2">
            <Icon name="alert" size={18} className="mt-0.5 text-warn" />
            Could not reach the bank: {errorFields(error).error}. Try again in a minute.
          </p>
        </Card>
      </div>
    );
  }
  const ok = view.gapKobo === 0 && view.rec.amountMismatch.length === 0 && view.rec.onlyInLevypass.length === 0 && view.rec.onlyAtBank.length === 0;
  const problems = [
    ...view.rec.amountMismatch.map((r) => ({ ref: r.reference, text: `ours ${formatNaira(r.levypassKobo)}, bank ${formatNaira(r.bankKobo)}`, kind: "Amount mismatch" })),
    ...view.rec.onlyInLevypass.map((r) => ({ ref: r.reference, text: formatNaira(r.amountKobo), kind: "Only in LevyPass" })),
    ...view.rec.onlyAtBank.map((r) => ({ ref: r.reference, text: formatNaira(r.amountKobo), kind: "Only at the bank" })),
  ];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reconciliation"
        lead={`Our ledger against the bank's own settlement and reconciliation for ${date}, Lagos time.`}
        actions={
          <>
            <form className="flex items-center gap-2">
              <input type="date" name="date" defaultValue={date} aria-label="Day" className={`${inputClass} min-h-11 w-auto px-4 text-[14px]`} />
              <button className={buttonClass("outline")}>Show</button>
            </form>
            <form action={runSettlement}>
              <Button type="submit">
                <Icon name="refresh" size={17} />
                Run bank settlement
              </Button>
            </form>
          </>
        }
      />

      <section className={`flex flex-wrap items-center justify-between gap-6 rounded-[var(--radius-card)] p-6 sm:p-8 ${ok ? "bg-go text-white" : "bg-stop text-white"}`} role="status">
        <div className="flex items-center gap-5">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white ${ok ? "text-go" : "text-stop"}`}>
            <Icon name={ok ? "check" : "x"} size={30} stroke={2.8} />
          </span>
          <div>
            <p className="text-[14px] text-white/80">Gap between ledger and bank</p>
            <p className="money text-[40px] leading-none sm:text-[48px]">{formatNaira(view.gapKobo)}</p>
          </div>
        </div>
        <p className="text-[17px] font-bold uppercase tracking-wide">{ok ? "Balanced. Every kobo accounted for." : "Not balanced. See the lines below."}</p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {(
          [
            ["LevyPass ledger", "ledger", view.ledger],
            ["Xtradot Bank settlement", "bank", view.bank],
          ] as const
        ).map(([title, icon, v]) => (
          <Card key={title}>
            <CardTitle aside={<Icon name={icon} size={18} className="text-ink-3" />}>{title}</CardTitle>
            <Rows
              rows={[
                ["Payments", v.count],
                ["Gross", formatNaira(v.grossKobo)],
                ["Bank fees, read from the bank", formatNaira(v.feesKobo)],
                ["Net to the government", formatNaira(v.netKobo), true],
              ]}
            />
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>Line by line, from the bank&apos;s reconciliation API</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge tone="paid">{view.rec.matched.length} matched</Badge>
          <Badge tone={view.rec.amountMismatch.length ? "unpaid" : "neutral"}>{view.rec.amountMismatch.length} amount mismatch</Badge>
          <Badge tone={view.rec.onlyInLevypass.length ? "unpaid" : "neutral"}>{view.rec.onlyInLevypass.length} only in LevyPass</Badge>
          <Badge tone={view.rec.onlyAtBank.length ? "unpaid" : "neutral"}>{view.rec.onlyAtBank.length} only at the bank</Badge>
        </div>
        {problems.length ? (
          <ul className="mt-5 divide-y divide-line border-t border-line text-[14px]">
            {problems.map((p) => (
              <li key={`${p.kind}-${p.ref}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="flex items-center gap-2">
                  <Icon name="x" size={15} stroke={2.4} className="text-stop" />
                  <span className="font-mono text-[13px]">{p.ref}</span>
                </span>
                <span className="text-ink-2">
                  {p.kind} · <span className="tnum">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Settlement batches</CardTitle>
        {view.bank.batches.length ? (
          <ul className="divide-y divide-line text-[14px]">
            {view.bank.batches.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <span className="font-mono text-[13px]">{b.settlementId ?? "Pending batch"}</span>
                <Badge tone={b.status === "settled" ? "paid" : "warn"}>{b.status}</Badge>
                <span className="text-ink-2 tnum">
                  {b.transactions.length} {b.transactions.length === 1 ? "payment" : "payments"} · net {formatNaira(b.netKobo)} to {b.settlementAccount}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-ink-3">No bank payments on this day yet.</p>
        )}
      </Card>
    </div>
  );
}
