import { desc, eq, sql } from "drizzle-orm";
import { formatNaira } from "@/core/money";
import { Badge, Card } from "@/app/_ui/kit";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { closeCase } from "../../actions";

export const dynamic = "force-dynamic";

const label: Record<string, string> = {
  double_charge: "Double charge",
  unknown_receipt: "Fake receipt checked",
  reused_receipt: "Reused receipt",
  suspended_officer_scan: "Suspended officer seen",
  unknown_officer_scan: "Unknown officer seen",
};
const when = (d: Date) => d.toLocaleString("en-NG", { timeZone: "Africa/Lagos", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function Close({ kind, id }: { kind: string; id: string }) {
  return (
    <div className="flex gap-2">
      {(["resolved", "dismissed"] as const).map((st) => (
        <form key={st} action={closeCase}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={st} />
          <button className={`rounded-lg px-3 py-1 text-xs font-semibold ${st === "resolved" ? "bg-brand-700 text-white" : "border border-slate-300"}`}>{st === "resolved" ? "Resolve" : "Dismiss"}</button>
        </form>
      ))}
    </div>
  );
}

export default async function FraudPage() {
  const flags = await db()
    .select({ f: s.fraudFlags, trader: s.traders.name, officer: s.officers.name, staffId: s.officers.staffId })
    .from(s.fraudFlags)
    .leftJoin(s.traders, eq(s.traders.id, s.fraudFlags.traderId))
    .leftJoin(s.officers, eq(s.officers.id, s.fraudFlags.officerId))
    .where(eq(s.fraudFlags.status, "open"))
    .orderBy(desc(s.fraudFlags.createdAt))
    .limit(50);
  const complaints = await db().select({ c: s.complaints, officer: s.officers.name }).from(s.complaints).leftJoin(s.officers, eq(s.officers.id, s.complaints.officerId)).where(eq(s.complaints.status, "open")).orderBy(desc(s.complaints.createdAt)).limit(30);
  const review = await db().select().from(s.reviewItems).where(eq(s.reviewItems.status, "open")).orderBy(desc(s.reviewItems.createdAt)).limit(30);
  const [{ n } = { n: 0 }] = await db().select({ n: sql<number>`count(*)::int` }).from(s.fraudFlags).where(sql`${s.fraudFlags.status} <> 'open'`);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">Fraud and complaints</h1>
        <p className="text-slate-500">{n} cases closed so far. Every action here is written to the audit log.</p>
      </div>
      <section>
        <h2 className="mb-2 text-lg font-bold">Fraud flags ({flags.length})</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {flags.map(({ f, trader, officer, staffId }) => (
            <Card key={f.id} className="animate-fadein">
              <div className="flex items-start justify-between gap-2">
                <Badge tone="warn">{label[f.type] ?? f.type}</Badge>
                <span className="text-xs text-slate-500">{when(f.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm">
                {trader ? <b>{trader}</b> : null}
                {officer ? (
                  <>
                    {" "}
                    Officer <b>{officer}</b> ({staffId})
                  </>
                ) : null}
                {f.receiptNumber ? <span className="font-mono"> {f.receiptNumber}</span> : null}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {f.type === "double_charge"
                  ? `Paid again for a period already paid. Credited to ${((f.details as { creditedTo?: string[] }).creditedTo ?? []).join(", ")}.`
                  : f.type === "suspended_officer_scan"
                    ? `A suspended ID was presented (${String((f.details as { via?: string }).via ?? "")}).`
                    : f.type === "unknown_receipt"
                      ? "Someone checked a receipt number that LevyPass never issued."
                      : ""}
              </p>
              <div className="mt-3">
                <Close kind="flag" id={f.id} />
              </div>
            </Card>
          ))}
          {flags.length === 0 ? <p className="text-slate-500">No open flags.</p> : null}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold">Complaints ({complaints.length})</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {complaints.map(({ c, officer }) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {c.triageSeverity ? <Badge tone={c.triageSeverity === "high" ? "unpaid" : c.triageSeverity === "medium" ? "warn" : "neutral"}>{c.triageSeverity}</Badge> : <Badge tone="neutral">triaging...</Badge>}
                  {c.triageCategory ? <Badge tone="neutral">{c.triageCategory.replace("_", " ")}</Badge> : null}
                </div>
                <span className="text-xs text-slate-500">{when(c.createdAt)}</span>
              </div>
              {c.triageSummary ? <p className="mt-2 font-semibold">{c.triageSummary}</p> : null}
              <p className="mt-1 text-sm italic text-slate-600">&ldquo;{c.description}&rdquo;</p>
              <p className="mt-1 text-xs text-slate-500">
                {officer ? `About officer ${officer}. ` : ""}
                {c.triageSource ? `Summary by ${c.triageSource === "model" ? "Huawei MaaS" : "keyword rules (model unavailable)"}, language: ${c.triageLanguage}.` : ""}
              </p>
              <div className="mt-3">
                <Close kind="complaint" id={c.id} />
              </div>
            </Card>
          ))}
          {complaints.length === 0 ? <p className="text-slate-500">No open complaints.</p> : null}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold">Money to review ({review.length})</h2>
        <Card className="p-0">
          <table className="w-full text-sm">
            <tbody>
              {review.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 first:border-0">
                  <td className="px-5 py-3 font-semibold">{r.kind.replaceAll("_", " ")}</td>
                  <td className="font-mono text-xs">{r.providerRef}</td>
                  <td className="tabular-nums">{r.amountKobo !== null ? formatNaira(r.amountKobo) : ""}</td>
                  <td className="pr-5">
                    <Close kind="review" id={r.id} />
                  </td>
                </tr>
              ))}
              {review.length === 0 ? (
                <tr>
                  <td className="px-5 py-3 text-slate-500">Nothing to review. No money is unaccounted for.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
