"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, Icon, buttonClass } from "@/app/_ui/kit";
import { SearchReveal, useSearchReveal } from "@/app/_ui/search-reveal";
import { lookupReceipt } from "./actions";

/**
 * The receipt number search, on the home page (pill) and on /r (card). Without JavaScript it is
 * a plain GET to /r, which redirects to the result.
 */
export function ReceiptSearch({ variant }: { variant: "pill" | "card" | "bar" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const { phase, run } = useSearchReveal();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const typed = value.trim();
    if (!typed) return;
    e.preventDefault();
    void run(
      () => lookupReceipt(typed),
      (r) => r.found,
      (r) => router.push(r?.href ?? `/r/${encodeURIComponent(typed)}`),
    );
  };

  const overlay = <SearchReveal phase={phase} searching="Checking the receipt" found="Receipt found" missing="No such receipt" />;
  const busy = phase !== "idle";

  if (variant === "bar") {
    return (
      <form action="/r" method="get" onSubmit={onSubmit} className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 focus-within:ring-2 focus-within:ring-forest/30" role="search">
        <Icon name="search" size={19} className="shrink-0 text-ink-2" />
        <input name="number" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Look up a receipt number" placeholder="Look up a receipt, e.g. LP-7K3M-9QX2T" autoCapitalize="characters" autoComplete="off" className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-ink-2" />
        {overlay}
      </form>
    );
  }
  if (variant === "card") {
    return (
      <form action="/r" method="get" onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Receipt number" name="number" value={value} onChange={(e) => setValue(e.target.value)} required placeholder="LP-7K3M-9QX2T" autoCapitalize="characters" autoComplete="off" className="font-mono uppercase tracking-wide" />
        <button type="submit" disabled={busy} className={buttonClass("primary", "lg", "w-full")}>
          <Icon name="search" size={18} />
          Check receipt
        </button>
        {overlay}
      </form>
    );
  }
  return (
    <form action="/r" method="get" onSubmit={onSubmit} className="mt-8 flex w-full max-w-lg items-center gap-2 rounded-full border border-line-2 bg-paper p-1.5 pl-5 focus-within:border-forest focus-within:ring-4 focus-within:ring-forest/10">
      <Icon name="receipt" size={20} className="text-ink-3" />
      <input name="number" value={value} onChange={(e) => setValue(e.target.value)} required aria-label="Receipt number" placeholder="Receipt number, e.g. LP-7K3M-9QX2T" autoCapitalize="characters" autoComplete="off" className="min-w-0 flex-1 bg-transparent py-2 font-medium outline-none placeholder:font-normal placeholder:text-ink-3" />
      <button disabled={busy} className={buttonClass("primary", "md")}>
        Check
      </button>
      {overlay}
    </form>
  );
}
