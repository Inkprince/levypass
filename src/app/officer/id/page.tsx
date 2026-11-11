import { eq } from "drizzle-orm";
import { Badge, Mark, PageShell } from "@/app/_ui/kit";
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
      <section className="overflow-hidden rounded-[var(--radius-card)] bg-forest text-white">
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <p className="text-[13px] text-white/65">Levy officer</p>
            <p className="mt-1 text-[24px] font-bold tracking-[-0.03em]">{o.name}</p>
            <p className="font-mono text-[14px] text-white/75">{o.staffId}</p>
          </div>
          <Mark size={34} tone="lime" />
        </div>
        <div className="mx-4 mb-4 mt-6 flex flex-col items-center gap-4 rounded-[var(--radius-card)] bg-paper p-5 text-ink">
          <Badge tone={o.status === "active" ? "paid" : "unpaid"}>{o.status}</Badge>
          <div className="w-full max-w-[240px] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="text-center text-[14px] text-ink-2">Traders: scan this with your phone camera to check that I am a real, active officer.</p>
        </div>
      </section>
    </PageShell>
  );
}
