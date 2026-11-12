"use client";

import { buttonClass } from "./kit";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary", "lg", "no-print w-full")}>
      {label}
    </button>
  );
}
