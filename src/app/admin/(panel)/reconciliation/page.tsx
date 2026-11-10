import { formatNaira } from "@/core/money";
import { lagosDate } from "@/core/periods";
import { Badge, Button, Card } from "@/app/_ui/kit";
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
    return <Card>Could not reach the bank: {errorFields(error).error}. Try again in a minute.</Card>;
  }
  const ok = view.gapKobo === 0 && view.rec.amountMismatch.length === 0 && view.rec.onlyInLevypass.length === 0 && view.rec.onlyAtBank.length === 0;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Reconciliation</h1>
          <p className="text-slate-500">Our ledger against the bank&apos;s own settlement and reconciliation for {date} (Lagos time).</p>
        </div>
        <div className="flex gap-2">
          <form className="flex gap-2">
            <input type="date" name="date" defaultValue={date} className="rounded-lg border border-slate-300 px-3" />
            <button className="rounded-lg border border-slate-300 px-3 font-semibold">Show</button>
          </form>
          <form action={runSettlement}>
            <Button type="submit">Run bank settlement now</Button>
          </form>
        </div>
      </div>

      <Card className={`flex flex-wrap items-center justify-between gap-4 ${ok ? "bg-brand-700 text-white" : "bg-red-600 text-white"}`}>
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl" style={{ color: ok ? "#027a48" : "#dc2626" }} aria-hidden="true">
            {ok ? "✔" : "✖"}
          </span>
          <div>
            <p className="text-sm opacity-90">Gap between ledger and bank</p>
            <p className="text-4xl font-black tabular-nums">{formatNaira(view.gapKobo)}</p>
          </div>
        </div>
        <p className="text-lg font-bold">{ok ? "BALANCED: every kobo accounted for" : "NOT BALANCED: see the lines below"}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["LevyPass ledger", view.ledger],
            ["Xtradot Bank settlement", view.bank],
          ] as const
        ).map(([title, v]) => (
          <Card key={title}>
            <p className="font-bold">{title}</p>
            <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-500">Payments</dt>
              <dd className="text-right tabular-nums">{v.count}</dd>
              <dt className="text-slate-500">Gross</dt>
              <dd className="text-right tabular-nums">{formatNaira(v.grossKobo)}</dd>
              <dt className="text-slate-500">Bank fees (read from the bank)</dt>
              <dd className="text-right tabular-nums">{formatNaira(v.feesKobo)}</dd>
              <dt className="font-semibold">Net to the government</dt>
              <dd className="text-right font-bold tabular-nums">{formatNaira(v.netKobo)}</dd>
            </dl>
          </Card>
        ))}
      </div>

      <Card>
        <p className="font-bold">Line by line (the bank&apos;s reconciliation API)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="paid">{view.rec.matched.length} matched</Badge>
          <Badge tone={view.rec.amountMismatch.length ? "unpaid" : "neutral"}>{view.rec.amountMismatch.length} amount mismatch</Badge>
          <Badge tone={view.rec.onlyInLevypass.length ? "unpaid" : "neutral"}>{view.rec.onlyInLevypass.length} only in LevyPass</Badge>
          <Badge tone={view.rec.onlyAtBank.length ? "unpaid" : "neutral"}>{view.rec.onlyAtBank.length} only at the bank</Badge>
        </div>
        <ul className="mt-3 font-mono text-xs">
          {view.rec.amountMismatch.map((r) => (
            <li key={r.reference}>
              ✖ {r.reference}: ours {formatNaira(r.levypassKobo)}, bank {formatNaira(r.bankKobo)}
            </li>
          ))}
          {view.rec.onlyInLevypass.map((r) => (
            <li key={r.reference}>✖ {r.reference}: in our ledger, not at the bank ({formatNaira(r.amountKobo)})</li>
          ))}
          {view.rec.onlyAtBank.map((r) => (
            <li key={r.reference}>✖ {r.reference}: at the bank, not in our ledger ({formatNaira(r.amountKobo)})</li>
          ))}
        </ul>
      </Card>

      <Card>
        <p className="font-bold">Settlement batches</p>
        {view.bank.batches.map((b, i) => (
          <p key={i} className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-mono">{b.settlementId ?? "pending batch"}</span>
            <Badge tone={b.status === "settled" ? "paid" : "warn"}>{b.status}</Badge>
            <span className="tabular-nums">
              {b.transactions.length} payments · net {formatNaira(b.netKobo)} to account {b.settlementAccount}
            </span>
          </p>
        ))}
        {view.bank.batches.length === 0 ? <p className="mt-2 text-sm text-slate-500">No bank payments on this day yet.</p> : null}
      </Card>
    </div>
  );
}
