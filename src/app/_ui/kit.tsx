import Link from "next/link";
import type { ReactNode } from "react";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${light ? "text-white" : "text-brand-800"}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={light ? "#fff" : "#027a48"} />
        <path d="M9 16.5l4.5 4.5L23 11.5" stroke={light ? "#027a48" : "#fff"} strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      LevyPass
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function Button({ children, variant = "primary", className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const styles = {
    primary: "bg-brand-700 text-white hover:bg-brand-800",
    secondary: "bg-white text-ink border border-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-brand-800 hover:bg-brand-50",
  }[variant];
  return (
    <button {...rest} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition disabled:opacity-50 ${styles} ${className}`}>
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary", className = "" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "ghost"; className?: string }) {
  const styles = { primary: "bg-brand-700 text-white hover:bg-brand-800", secondary: "bg-white text-ink border border-slate-300 hover:bg-slate-50", ghost: "text-brand-800 hover:bg-brand-50" }[variant];
  return (
    <Link href={href} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition ${styles} ${className}`}>
      {children}
    </Link>
  );
}

export function Field({ label, hint, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input {...rest} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Select({ label, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select {...rest} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-brand-600">
        {children}
      </select>
    </label>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
      <span aria-hidden="true">⚠</span>
      {children}
    </p>
  );
}

type Tone = "paid" | "unpaid" | "warn" | "neutral";
const toneStyle: Record<Tone, string> = {
  paid: "bg-brand-100 text-brand-900",
  unpaid: "bg-red-100 text-red-900",
  warn: "bg-amber-100 text-amber-900",
  neutral: "bg-slate-100 text-slate-700",
};
const toneIcon: Record<Tone, string> = { paid: "✔", unpaid: "✖", warn: "!", neutral: "•" };

/** Status always shows an icon and a word, never colour alone (PRD section 5). */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${toneStyle[tone]}`}>
      <span aria-hidden="true">{toneIcon[tone]}</span>
      {children}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-ink tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-sm text-slate-500">{sub}</p> : null}
    </Card>
  );
}

export function PageShell({ children, title, back, wide = false }: { children: ReactNode; title?: string; back?: { href: string; label: string }; wide?: boolean }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className={`mx-auto flex items-center justify-between px-4 py-3 ${wide ? "max-w-6xl" : "max-w-md"}`}>
          <Link href="/" aria-label="LevyPass home">
            <Logo />
          </Link>
          {back ? (
            <Link href={back.href} className="text-sm font-semibold text-brand-800">
              {back.label}
            </Link>
          ) : null}
        </div>
      </header>
      <main className={`mx-auto flex flex-col gap-4 px-4 py-6 ${wide ? "max-w-6xl" : "max-w-md"}`}>
        {title ? <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1> : null}
        {children}
      </main>
    </div>
  );
}
