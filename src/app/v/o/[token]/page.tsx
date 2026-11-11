import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { Card, CardTitle, Icon, PageShell, StatusPanel } from "@/app/_ui/kit";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { officerFromToken } from "@/server/levy/status";
import { allow, clientIp } from "@/server/ratelimit";
import { raiseOfficerFlag } from "@/server/ussd/menu";
import { ReportForm } from "../../report-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Officer check · LevyPass", robots: { index: false } };

/** OF-07: a trader checks the officer in front of them. A suspended ID raises a flag (FR-03). */
export default async function OfficerPublicPage({ params }: { params: Promise<{ token: string }> }) {
  if (!allow(`vo:${clientIp(await headers())}`, 60, 60_000)) return <PageShell title="Slow down" lead="Too many checks from this connection. Wait a minute and try again." />;
  const { token } = await params;
  const officer = await officerFromToken(decodeURIComponent(token));
  if (!officer) {
    return (
      <PageShell>
        <StatusPanel tone="unpaid" word="Not an officer" sub="This ID was not issued by LevyPass. Do not pay this person. Report them below." />
        <Card>
          <CardTitle>Report this collector</CardTitle>
          <ReportForm />
        </Card>
      </PageShell>
    );
  }
  const suspended = officer.status === "suspended";
  if (suspended) await raiseOfficerFlag(officer.id, null, "id_page");
  const [aut] = await db().select({ name: s.authorities.name }).from(s.authorities).where(eq(s.authorities.id, officer.authorityId));
  return (
    <PageShell>
      <StatusPanel
        tone={suspended ? "unpaid" : "paid"}
        word={suspended ? "Suspended" : "Genuine officer"}
        sub={suspended ? "Do not pay this person. The revenue office has been alerted." : "This officer is active and allowed to check levies."}
      />
      <Card>
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-mist-2 text-[18px] font-bold text-forest">
            {officer.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div className="min-w-0">
            <p className="text-[20px] font-semibold tracking-[-0.02em]">{officer.name}</p>
            <p className="text-[14px] text-ink-2">
              <span className="font-mono">{officer.staffId}</span> · {aut?.name}
            </p>
          </div>
        </div>
        <p className="mt-5 flex items-start gap-2.5 rounded-xl bg-mist px-4 py-3 text-[14px] text-ink-2">
          <Icon name="info" size={18} className="mt-px text-forest" />
          Officers never collect cash. Pay only by USSD *347*13#, transfer or card.
        </p>
      </Card>
      <Card>
        <CardTitle>Problem with this officer?</CardTitle>
        <ReportForm officerId={officer.id} />
      </Card>
    </PageShell>
  );
}
