import { ActionForm } from "@/app/_ui/action-form";
import { Card, CardTitle, Field, PageHeader, Select, buttonClass, inputClass } from "@/app/_ui/kit";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { createLevy, updateLevy } from "../../actions";

export const dynamic = "force-dynamic";

const small = `${inputClass} min-h-11 text-[15px]`;

export default async function LeviesPage() {
  const levies = await db().select().from(s.levyTypes).orderBy(s.levyTypes.name);
  const markets = await db().select({ id: s.markets.id, name: s.markets.name }).from(s.markets);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Levies" lead="A new amount applies only to new periods. Existing periods keep their original amount." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          {levies.map((l) => (
            <Card key={l.id}>
              <form action={updateLevy} className="flex flex-col gap-4">
                <input type="hidden" name="levyId" value={l.id} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[17px] font-semibold tracking-[-0.02em]">{l.name}</p>
                    <p className="text-[13px] capitalize text-ink-3">{l.period}</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-[13px] font-medium">
                    <input type="checkbox" name="active" defaultChecked={l.active} className="h-4 w-4 accent-[#0f3d2e]" /> Active
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                    Amount, ₦
                    <input name="amountNaira" type="number" min={1} step={1} defaultValue={l.amountKobo / 100} className={`${small} tnum`} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                    Legal basis
                    <input name="legalBasis" defaultValue={l.legalBasis} className={small} />
                  </label>
                  <button className={buttonClass("primary", "md")}>Save</button>
                </div>
              </form>
            </Card>
          ))}
        </div>
        <Card className="h-fit">
          <CardTitle>New levy</CardTitle>
          <ActionForm action={createLevy} submit="Create levy">
            <Field label="Name" name="name" required placeholder="Motor park ticket" />
            <Field label="Amount in whole naira" name="amountNaira" type="number" min={1} step={1} required />
            <Select label="Period" name="period">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
            <Field label="Legal basis, law or bye-law" name="legalBasis" required />
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
