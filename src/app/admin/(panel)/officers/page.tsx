import { desc, sql } from "drizzle-orm";
import { ActionForm } from "@/app/_ui/action-form";
import { Badge, Card, CardTitle, Field, PageHeader, Select, buttonClass } from "@/app/_ui/kit";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { createOfficer, setOfficerStatus } from "../../actions";

export const dynamic = "force-dynamic";

export default async function OfficersPage() {
  const officers = await db()
    .select({ id: s.officers.id, name: s.officers.name, staffId: s.officers.staffId, status: s.officers.status, scans: sql<number>`(SELECT count(*)::int FROM scans WHERE scans.officer_id = "officers"."id" AND scans.scanned_at > now() - interval '1 day')` })
    .from(s.officers)
    .orderBy(desc(s.officers.status), s.officers.staffId);
  const markets = await db().select({ id: s.markets.id, name: s.markets.name }).from(s.markets);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Officers" lead="Suspending ends the officer's sessions at once. The next scan of their ID shows SUSPENDED and raises a fraud flag." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-x-auto p-0 sm:p-0 lg:col-span-2">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-ink-3">
                <th className="px-6 py-3 font-medium">Officer</th>
                <th className="font-medium">Staff ID</th>
                <th className="font-medium">Scans, 24 h</th>
                <th className="font-medium">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {officers.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-3.5">
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-[12px] font-bold text-lime">
                        {o.name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span className="font-semibold">{o.name}</span>
                    </span>
                  </td>
                  <td className="font-mono text-[13px] text-ink-2">{o.staffId}</td>
                  <td className="tnum">{o.scans}</td>
                  <td>
                    <Badge tone={o.status === "active" ? "paid" : "unpaid"}>{o.status}</Badge>
                  </td>
                  <td className="pr-6 text-right">
                    <form action={setOfficerStatus}>
                      <input type="hidden" name="officerId" value={o.id} />
                      <input type="hidden" name="status" value={o.status === "active" ? "suspended" : "active"} />
                      <button className={buttonClass(o.status === "active" ? "danger" : "primary", "sm")}>{o.status === "active" ? "Suspend now" : "Reinstate"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="h-fit">
          <CardTitle>Register an officer</CardTitle>
          <ActionForm action={createOfficer} submit="Create officer">
            <Field label="Full name" name="name" required />
            <Field label="Staff ID" name="staffId" required placeholder="OTT-004" className="font-mono uppercase" />
            <Field label="PIN, 4 to 8 digits" name="pin" inputMode="numeric" required className="font-mono" />
            <Select label="Market" name="marketId">
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
