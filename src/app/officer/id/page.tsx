import { eq } from "drizzle-orm";
import { Badge, Card, PageShell } from "@/app/_ui/kit";
import { requireSubject } from "@/server/auth/session";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { officerIdUrl, qrSvg } from "@/server/qr";

export const dynamic = "force-dynamic";

/** OF-07: the officer's digital ID. Traders scan it with any phone camera. */
export default async function OfficerIdPage() {
  const officerId = await requireSubject("officer");
  const [o] = await db().select().from(s.officers).where(eq(s.officers.id, officerId));
  if (!o) return null;
  const svg = await qrSvg(await officerIdUrl(o.id, o.qrTokenId));
  return (
    <PageShell back={{ href: "/officer", label: "Back to scan" }}>
      <Card className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Levy officer</p>
        <p className="text-2xl font-extrabold">{o.name}</p>
        <p className="font-mono text-slate-600">{o.staffId}</p>
        <Badge tone={o.status === "active" ? "paid" : "unpaid"}>{o.status}</Badge>
        <div className="w-64" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-sm text-slate-500">Traders: scan this with your phone camera to check that I am a real, active officer.</p>
      </Card>
    </PageShell>
  );
}
