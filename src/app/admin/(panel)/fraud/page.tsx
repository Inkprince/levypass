import { desc, eq, sql } from "drizzle-orm";
import { formatNaira } from "@/core/money";
import { Badge, Card, Icon, type IconName, PageHeader, buttonClass } from "@/app/_ui/kit";
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
const flagIcon: Record<string, IconName> = {
  double_charge: "refresh",
  unknown_receipt: "receipt",
  reused_receipt: "receipt",
  suspended_officer_scan: "user",
  unknown_officer_scan: "user",
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
          <button className={buttonClass(st === "resolved" ? "primary" : "outline", "sm")}>{st === "resolved" ? "Resolve" : "Dismiss"}</button>
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
    <div className="flex flex-col gap-8">
      <PageHeader title="Fraud and complaints" lead={`${n} cases closed so far. Every action here is written to the audit log.`} />

      <section>
        <SectionTitle count={flags.length}>Fraud flags</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {flags.map(({ f, trader, officer, staffId }) => (
            <Card key={f.id} className="animate-fadein flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warn-bg text-warn-fg">
                    <Icon name={flagIcon[f.type] ?? "flag"} size={17} />
                  </span>
                  <span className="font-semibold">{label[f.type] ?? f.type}</span>
                </span>
                <span className="text-[12px] text-ink-3 tnum">{when(f.createdAt)}</span>
              </div>
              <p className="text-[14px] text-ink">
                {trader ? <b className="font-semibold">{trader}</b> : null}
                {officer ? (
                  <>
                    {" "}
                    Officer <b className="font-semibold">{officer}</b> <span className="font-mono text-ink-2">{staffId}</span>
                  </>
                ) : null}
                {f.receiptNumber ? <span className="font-mono"> {f.receiptNumber}</span> : null}
              </p>
              <p className="text-[13px] text-ink-2">
                {f.type === "double_charge"
                  ? `Paid again for a period already paid. Credited to ${((f.details as { creditedTo?: string[] }).creditedTo ?? []).join(", ")}.`
                  : f.type === "suspended_officer_scan"
                    ? `A suspended ID was presented (${String((f.details as { via?: string }).via ?? "")}).`
                    : f.type === "unknown_receipt"
                      ? "Someone checked a receipt number that LevyPass never issued."
                      : ""}
              </p>
              <div className="mt-auto border-t border-ink/15 pt-3">
                <Close kind="flag" id={f.id} />
              </div>
            </Card>
          ))}
          {flags.length === 0 ? <Empty>No open flags.</Empty> : null}
        </div>
      </section>

      <section>
        <SectionTitle count={complaints.length}>Complaints</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {complaints.map(({ c, officer }) => (
            <Card key={c.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {c.triageSeverity ? <Badge tone={c.triageSeverity === "high" ? "unpaid" : c.triageSeverity === "medium" ? "warn" : "neutral"}>{c.triageSeverity}</Badge> : <Badge tone="neutral">triaging</Badge>}
                  {c.triageCategory ? <Badge tone="neutral">{c.triageCategory.replace("_", " ")}</Badge> : null}
                </div>
                <span className="text-[12px] text-ink-3 tnum">{when(c.createdAt)}</span>
              </div>
              {c.triageSummary ? <p className="font-semibold leading-snug">{c.triageSummary}</p> : null}
              <blockquote className="border-l-2 border-line-2 pl-3 text-[14px] italic text-ink-2">{c.description}</blockquote>
              <p className="text-[12px] text-ink-3">
                {officer ? `About officer ${officer}. ` : ""}
                {c.triageSource ? `Summary by ${c.triageSource === "model" ? "Huawei MaaS" : "keyword rules (model unavailable)"}, language: ${c.triageLanguage}.` : ""}
              </p>
              <div className="mt-auto border-t border-ink/15 pt-3">
                <Close kind="complaint" id={c.id} />
              </div>
            </Card>
          ))}
          {complaints.length === 0 ? <Empty>No open complaints.</Empty> : null}
        </div>
      </section>

      <section>
        <SectionTitle count={review.length}>Money to review</SectionTitle>
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[520px] text-[14px]">
            <tbody>
              {review.map((r) => (
                <tr key={r.id} className="border-t border-line first:border-0">
                  <td className="px-6 py-3.5 font-semibold capitalize">{r.kind.replaceAll("_", " ")}</td>
                  <td className="font-mono text-[12px] text-ink-2">{r.providerRef}</td>
                  <td className="font-semibold tnum">{r.amountKobo !== null ? formatNaira(r.amountKobo) : ""}</td>
                  <td className="pr-6">
                    <Close kind="review" id={r.id} />
                  </td>
                </tr>
              ))}
              {review.length === 0 ? (
                <tr>
                  <td className="flex items-center gap-2 px-6 py-5 text-ink-2">
                    <Icon name="check" size={17} stroke={2.4} className="text-go" />
                    Nothing to review. No money is unaccounted for.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}

function SectionTitle({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <h2 className="mb-5 flex items-center gap-3 border-t border-line pt-8 text-[28px] font-medium tracking-[-0.045em]">
      {children}
      <span className="rounded-full bg-mist-2 px-2.5 py-0.5 text-[13px] font-semibold text-ink-2 tnum">{count}</span>
    </h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-2 px-6 py-5 text-[14px] text-ink-2">
      <Icon name="check" size={17} stroke={2.4} className="text-go" />
      {children}
    </p>
  );
}
