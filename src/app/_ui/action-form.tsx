"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, ErrorNote } from "./kit";

type State = { error?: string };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "mt-1 w-full")}>
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          Please wait
        </>
      ) : (
        label
      )}
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
