"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ErrorNote } from "./kit";

type State = { error?: string };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-700 px-5 py-3 text-base font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60">
      {pending ? "Please wait..." : label}
    </button>
  );
}

export function ActionForm({ action, submit, children }: { action: (s: State, f: FormData) => Promise<State>; submit: string; children: ReactNode }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {children}
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <Submit label={submit} />
    </form>
  );
}
