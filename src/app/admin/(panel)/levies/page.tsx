import { ActionForm } from "@/app/_ui/action-form";
import { Card, Field, Select } from "@/app/_ui/kit";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { createLevy, updateLevy } from "../../actions";

export const dynamic = "force-dynamic";

export default async function LeviesPage() {
  const levies = await db().select().from(s.levyTypes).orderBy(s.levyTypes.name);
  const markets = await db().select({ id: s.markets.id, name: s.markets.name }).from(s.markets);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <h1 className="text-2xl font-extrabold">Levies</h1>
        {levies.map((l) => (
          <Card key={l.id}>
            <form action={updateLevy} className="grid gap-3 sm:grid-cols-6 sm:items-end">
              <input type="hidden" name="levyId" value={l.id} />
              <div className="sm:col-span-2">
                <p className="font-bold">{l.name}</p>
                <p className="text-sm capitalize text-slate-500">{l.period}</p>
              </div>
              <label className="flex flex-col text-sm font-semibold">
                Amount (₦)
                <input name="amountNaira" type="number" min={1} step={1} defaultValue={l.amountKobo / 100} className="mt-1 rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="flex flex-col text-sm font-semibold sm:col-span-2">
                Legal basis
                <input name="legalBasis" defaultValue={l.legalBasis} className="mt-1 rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="active" defaultChecked={l.active} /> Active
                </label>
                <button className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white">Save</button>
              </div>
            </form>
          </Card>
        ))}
        <p className="text-sm text-slate-500">A new amount applies to periods created from now on. Paid and existing periods keep the amount they were issued with.</p>
      </div>
      <Card>
        <h2 className="mb-3 text-lg font-bold">New levy</h2>
        <ActionForm action={createLevy} submit="Create levy">
          <Field label="Name" name="name" required placeholder="Motor park ticket" />
          <Field label="Amount in whole naira" name="amountNaira" type="number" min={1} step={1} required />
          <Select label="Period" name="period">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
          <Field label="Legal basis (law or bye-law)" name="legalBasis" required />
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
