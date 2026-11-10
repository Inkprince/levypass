import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { Card, PageShell } from "@/app/_ui/kit";
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
  if (!allow(`vo:${clientIp(await headers())}`, 60, 60_000)) return <PageShell title="Slow down">Too many checks. Wait a minute and try again.</PageShell>;
  const { token } = await params;
  const officer = await officerFromToken(decodeURIComponent(token));
  if (!officer) {
    return (
      <PageShell>
        <Card className="flex flex-col items-center gap-2 bg-red-600 text-center text-white">
          <span className="text-5xl" aria-hidden="true">✖</span>
          <p className="text-3xl font-black">NOT A LEVYPASS OFFICER</p>
          <p className="opacity-90">Do not pay this person. Report them below.</p>
        </Card>
        <Card>
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
      <Card className={`flex flex-col items-center gap-2 text-center text-white ${suspended ? "bg-red-600" : "bg-brand-700"}`}>
        <span className="animate-pop flex h-20 w-20 items-center justify-center rounded-full bg-white text-5xl" style={{ color: suspended ? "#dc2626" : "#027a48" }} aria-hidden="true">
          {suspended ? "✖" : "✔"}
        </span>
        <p className="text-4xl font-black">{suspended ? "SUSPENDED" : "GENUINE OFFICER"}</p>
        <p className="opacity-90">{suspended ? "Do not pay this person. The revenue office has been alerted." : "This officer is active and allowed to check levies."}</p>
      </Card>
      <Card>
        <p className="text-xl font-bold">{officer.name}</p>
        <p className="font-mono text-slate-600">{officer.staffId}</p>
        <p className="text-slate-600">{aut?.name}</p>
        <p className="mt-2 text-sm text-slate-500">Officers never collect cash. Pay only by USSD *347*13#, transfer or card.</p>
      </Card>
      <Card>
        <p className="mb-2 font-semibold">Problem with this officer?</p>
        <ReportForm officerId={officer.id} />
      </Card>
    </PageShell>
  );
}
