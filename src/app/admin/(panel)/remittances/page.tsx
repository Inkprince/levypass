import { asc, eq, sql } from "drizzle-orm";
import { Badge, Card, CardTitle, Icon, PageHeader, Stat, buttonClass, inputClass } from "@/app/_ui/kit";
import { floatLabel } from "@/core/floats";
import { formatNaira } from "@/core/money";
import { lagosDate, periodFor } from "@/core/periods";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { officerFloat } from "@/server/floats/floats";
import { decideFloatAction } from "../../actions";

export const dynamic = "force-dynamic";

const when = (d: Date) => d.toLocaleString("en-NG", { timeZone: "Africa/Lagos", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function RemittancesPage() {
  const today = periodFor("daily", new Date()).start;
  const officers = await db().select({ id: s.officers.id, name: s.officers.name, staffId: s.officers.staffId, status: s.officers.status }).from(s.officers).orderBy(asc(s.officers.staffId));
  const floats = await Promise.all(officers.map(async (o) => ({ o, f: await officerFloat(o.id) })));
  const requests = await db()
    .select({ f: s.floats, name: s.officers.name, staffId: s.officers.staffId })
    .from(s.floats)
    .innerJoin(s.officers, eq(s.officers.id, s.floats.officerId))
    .where(eq(s.floats.status, "requested"))
    .orderBy(asc(s.floats.requestedAt));
  const [cash] = (
    await db().execute<{ kobo: string; n: number; total: string }>(sql`
      SELECT coalesce(sum(amount_kobo) FILTER (WHERE kind = 'cash_collection'), 0) AS kobo,
             count(*) FILTER (WHERE kind = 'cash_collection')::int AS n,
             coalesce(sum(amount_kobo) FILTER (WHERE kind IN ('cash_collection', 'inflow')), 0) AS total
      FROM ledger_entries WHERE created_at >= ${today}`)
  ).rows;
  const held = floats.reduce((x, { f }) => x + Math.max(0, f.balanceKobo), 0);
  const cashKobo = Number(cash?.kobo ?? 0);
  const totalKobo = Number(cash?.total ?? 0);
  const withFloat = floats.filter(({ f }) => f.history.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Advance remittances"
        lead="Officers remit to the government account in advance, before they take any cash. Each cash levy is paid from that advance, so no officer ever owes the government. Approve a new remittance only when the last one is accounted for."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Stat label="Advance held by officers" value={formatNaira(held)} sub="Already in the government account, not yet used for levies" />
        </Card>
        <Card>
          <Stat label="Cash levies today" value={formatNaira(cashKobo)} sub={`${cash?.n ?? 0} ${cash?.n === 1 ? "receipt" : "receipts"}, ${totalKobo ? Math.round((cashKobo / totalKobo) * 100) : 0}% of today's collections`} />
        </Card>
        <Card>
          <Stat label="Requests waiting" value={String(requests.length)} sub="Approve, then the officer pays it in" />
        </Card>
      </div>

      <Card>
        <CardTitle>Remittance requests</CardTitle>
        {requests.length === 0 ? <p className="text-[14px] text-ink-3">No requests waiting.</p> : null}
        <ul className="divide-y divide-line">
          {requests.map(({ f, name, staffId }) => {
            const now = floats.find((x) => x.o.id === f.officerId)?.f;
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-4 py-4">
                <div className="min-w-[200px] flex-1">
                  <p className="font-semibold">
                    {name} <span className="font-mono text-[13px] text-ink-3">{staffId}</span>
                  </p>
                  <p className="text-[14px] text-ink-2">
                    <span className="font-mono">{floatLabel(staffId, f.seq)}</span> for <b className="tnum">{formatNaira(f.amountKobo)}</b>, asked {when(f.requestedAt)}
                  </p>
                  <p className="text-[13px] text-ink-3">
                    Advance left now {formatNaira(now?.balanceKobo ?? 0)}, {now?.statements.length ?? 0} remittances before
                  </p>
                </div>
                <form action={decideFloatAction}>
                  <input type="hidden" name="floatId" value={f.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <button className={buttonClass("primary", "sm")}>
                    <Icon name="check" size={16} />
                    Approve
                  </button>
                </form>
                <form action={decideFloatAction} className="flex gap-2">
                  <input type="hidden" name="floatId" value={f.id} />
                  <input type="hidden" name="decision" value="declined" />
                  <input name="reason" placeholder="Reason (optional)" aria-label="Reason for declining" className={`${inputClass} h-9 w-44 text-[14px]`} />
                  <button className={buttonClass("outline", "sm")}>Decline</button>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[640px] text-[14px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-ink-3">
              <th className="px-6 py-3 font-medium">Officer</th>
              <th className="font-medium">Advance left</th>
              <th className="font-medium">Remittances</th>
              <th className="font-medium">Cash levies</th>
              <th className="font-medium">Request</th>
            </tr>
          </thead>
          <tbody>
            {floats.map(({ o, f }) => {
              const lines = f.statements.flatMap((st) => st.lines);
              return (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-3.5">
                    <span className="font-semibold">{o.name}</span> <span className="font-mono text-[13px] text-ink-3">{o.staffId}</span>
                  </td>
                  <td className="tnum font-semibold">{formatNaira(f.balanceKobo)}</td>
                  <td className="tnum">{f.statements.length}</td>
                  <td className="tnum">
                    {new Set(lines.map((l) => l.paymentId)).size}, {formatNaira(lines.reduce((x, l) => x + l.amountKobo, 0))}
                  </td>
                  <td>{f.open ? <Badge tone="warn">{f.open.status === "requested" ? "waiting for you" : "approved, not paid in"}</Badge> : <span className="text-ink-3">none</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {withFloat.length ? <h2 className="text-[20px] font-semibold">Each remittance, accounted for</h2> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {withFloat.flatMap(({ o, f }) =>
          f.statements.map((st) => (
            <Card key={st.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono font-semibold">{st.label}</p>
                  <p className="text-[13px] text-ink-3">
                    {o.name}, remitted {lagosDate(st.loadedAt)}
                  </p>
                </div>
                <Badge tone={st.usedUp ? "neutral" : "paid"}>{st.usedUp ? "used up" : "in use"}</Badge>
              </div>
              <p className="mt-3 text-[14px] text-ink-2">
                Remitted <b className="tnum text-ink">{formatNaira(st.amountKobo)}</b> = cash levies <b className="tnum text-ink">{formatNaira(st.usedKobo)}</b> + left <b className="tnum text-ink">{formatNaira(st.remainingKobo)}</b>
              </p>
              {st.lines.length ? (
                <ul className="mt-3 divide-y divide-line border-t border-line text-[13px]">
                  {st.lines.slice(0, 8).map((l) => (
                    <li key={`${l.paymentId}-${l.amountKobo}`} className="flex justify-between gap-2 py-1.5">
                      <span className="truncate">
                        {l.traderName}, {l.stall} <a href={`/r/${l.receipt}`} className="font-mono text-forest hover:underline">{l.receipt}</a>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {l.answer === "disputed" ? <Badge tone="unpaid">trader denies</Badge> : l.answer === "confirmed" ? <Badge tone="paid">trader confirmed</Badge> : <Badge tone="neutral">not confirmed</Badge>}
                        <b className="tnum">{formatNaira(l.amountKobo)}</b>
                      </span>
                    </li>
                  ))}
                  {st.lines.length > 8 ? <li className="py-1.5 text-ink-3">and {st.lines.length - 8} more</li> : null}
                </ul>
              ) : null}
            </Card>
          )),
        )}
      </div>
    </div>
  );
}
