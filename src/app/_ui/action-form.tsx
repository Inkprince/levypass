"use client";

import { startTransition, useActionState, type FormEvent, type ReactNode } from "react";
import { buttonClass, ErrorNote } from "./kit";

type State = { error?: string };

function Submit({ label, pending }: { label: string; pending: boolean }) {
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
  const [state, formAction, pending] = useActionState(action, {});

  // React empties an uncontrolled form when the action it was given finishes, so a refused submit
  // (phone already registered, wrong PIN) used to wipe everything the person had typed. Sending the
  // action ourselves leaves the fields alone. Without JavaScript the form still posts to `action`.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
      {children}
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <Submit label={submit} pending={pending} />
    </form>
  );
}
