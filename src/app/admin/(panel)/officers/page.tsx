import { desc, sql } from "drizzle-orm";
import { ActionForm } from "@/app/_ui/action-form";
import { Badge, Card, Field, Select } from "@/app/_ui/kit";
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
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h1 className="mb-4 text-2xl font-extrabold">Officers</h1>
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Officer</th>
                <th className="font-medium">Staff ID</th>
                <th className="font-medium">Scans (24h)</th>
                <th className="font-medium">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {officers.map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-semibold">{o.name}</td>
                  <td className="font-mono">{o.staffId}</td>
                  <td className="tabular-nums">{o.scans}</td>
                  <td>
                    <Badge tone={o.status === "active" ? "paid" : "unpaid"}>{o.status}</Badge>
                  </td>
                  <td className="pr-5 text-right">
                    <form action={setOfficerStatus}>
                      <input type="hidden" name="officerId" value={o.id} />
                      <input type="hidden" name="status" value={o.status === "active" ? "suspended" : "active"} />
                      <button className={`rounded-lg px-3 py-1.5 font-semibold ${o.status === "active" ? "bg-red-600 text-white" : "bg-brand-700 text-white"}`}>
                        {o.status === "active" ? "Suspend now" : "Reinstate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-3 text-sm text-slate-500">Suspending ends the officer&apos;s sessions immediately. Their ID page shows SUSPENDED on the next scan and raises a fraud flag.</p>
      </div>
      <Card>
        <h2 className="mb-3 text-lg font-bold">Register an officer</h2>
        <ActionForm action={createOfficer} submit="Create officer">
          <Field label="Full name" name="name" required />
          <Field label="Staff ID" name="staffId" required placeholder="OTT-004" />
          <Field label="PIN (4 to 8 digits)" name="pin" inputMode="numeric" required />
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
  );
}
