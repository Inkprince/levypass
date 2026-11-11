"use client";

import { useActionState } from "react";
import { buttonClass, Note } from "@/app/_ui/kit";
import { reportCollector } from "./actions";

export function ReportForm({ officerId }: { officerId?: string }) {
  const [state, action, pending] = useActionState(reportCollector, {});
  if (state.done) return <Note tone="go" icon="check">Thank you. Report {state.done} has reached the revenue office.</Note>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="officerId" value={officerId ?? ""} />
      <textarea
        name="description"
        required
        rows={3}
        aria-label="What happened"
        placeholder="Describe what happened in English, Pidgin or Yoruba."
        className="w-full resize-none rounded-xl border border-line-2 bg-paper p-4 text-base outline-none placeholder:text-ink-3/70 focus:border-forest focus:ring-4 focus:ring-forest/10"
      />
      {state.error ? <p className="text-sm font-medium text-stop-fg">{state.error}</p> : null}
      <button disabled={pending} className={buttonClass("primary", "lg", "w-full")}>
        {pending ? "Sending" : "Report this collector"}
      </button>
    </form>
  );
}
