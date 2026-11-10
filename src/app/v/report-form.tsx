"use client";

import { useActionState } from "react";
import { reportCollector } from "./actions";

export function ReportForm({ officerId }: { officerId?: string }) {
  const [state, action, pending] = useActionState(reportCollector, {});
  if (state.done) return <p className="rounded-xl bg-brand-50 p-4 font-medium text-brand-900">Thank you. Report {state.done} has reached the revenue office.</p>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="officerId" value={officerId ?? ""} />
      <textarea name="description" required rows={3} placeholder="What happened? English, Pidgin or Yoruba is fine." className="rounded-xl border border-slate-300 p-3" />
      {state.error ? <p className="text-sm font-medium text-red-700">{state.error}</p> : null}
      <button disabled={pending} className="min-h-12 rounded-xl bg-ink font-semibold text-white">
        {pending ? "Sending..." : "Report this collector"}
      </button>
    </form>
  );
}
