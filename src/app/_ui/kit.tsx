import Link from "next/link";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ brand */

/** The pass mark: a ticket with notched sides and a check. */
export function Mark({ size = 28, tone = "forest" }: { size?: number; tone?: "forest" | "lime" }) {
  const body = tone === "forest" ? "#0f3d2e" : "#a8e86b";
  const tick = tone === "forest" ? "#a8e86b" : "#0f3d2e";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <mask id={`lp-notch-${tone}`}>
        <rect width="32" height="32" fill="#fff" />
        <circle cx="0" cy="16" r="3.4" fill="#000" />
        <circle cx="32" cy="16" r="3.4" fill="#000" />
      </mask>
      <rect width="32" height="32" rx="9" fill={body} mask={`url(#lp-notch-${tone})`} />
      <path d="M10 16.4l4 4 8-8.6" stroke={tick} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ light = false, size = 28 }: { light?: boolean; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[17px] font-bold tracking-[-0.03em] ${light ? "text-white" : "text-ink"}`}>
      <Mark size={size} tone={light ? "lime" : "forest"} />
      LevyPass
    </span>
  );
}

/** Payment channel as people say it: USSD, Card, Transfer. */
export function channelLabel(channel: string) {
  return ({ ussd: "USSD", card: "Card", transfer: "Transfer", virtual_account: "Virtual account", bank_transfer: "Transfer" } as Record<string, string>)[channel] ?? channel.replaceAll("_", " ");
}

/* ------------------------------------------------------------------ icons */

const paths = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6.5 6.5l11 11M17.5 6.5l-11 11",
  alert: "M12 7.5v6M12 17h.01",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  arrowUpRight: "M7 17L17 7M8 7h9v9",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  chevronRight: "M9.5 6l6 6-6 6",
  phone: "M8 3h8a1.5 1.5 0 011.5 1.5v15A1.5 1.5 0 0116 21H8a1.5 1.5 0 01-1.5-1.5v-15A1.5 1.5 0 018 3zM11 17.5h2",
  scan: "M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16M4 12h16",
  bank: "M3.5 9.5L12 4.5l8.5 5M5.5 10v7M10 10v7M14 10v7M18.5 10v7M3.5 19.5h17",
  receipt: "M6 3.5h12v17l-2.5-1.5-2 1.5-1.5-1.5-1.5 1.5-2-1.5L6 20.5zM9 8h6M9 11.5h6M9 15h3.5",
  shield: "M12 3.5l7 2.5v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2.2 2.2L15.5 10",
  ledger: "M5 4.5h11.5A2.5 2.5 0 0119 7v12.5H7.5A2.5 2.5 0 015 17zM5 17a2.5 2.5 0 012.5-2.5H19M9 8.5h6",
  flag: "M5.5 20.5v-16M5.5 5h11l-2 4 2 4h-11",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5c1-3.5 4-5.5 7.5-5.5s6.5 2 7.5 5.5",
  users: "M9 11.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 19.5c.8-3 3.3-5 6.5-5s5.7 2 6.5 5M16 4.8a3.5 3.5 0 010 6.4M17.5 14.7c2 .6 3.4 2.3 4 4.8",
  grid: "M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z",
  scale: "M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 005 0zM19 8l-2.5 6a3 3 0 005 0z",
  bolt: "M13 3L5 13.5h6L10 21l8-10.5h-6z",
  tag: "M3.5 12.6V4.5A1 1 0 014.5 3.5h8.1a1 1 0 01.7.3l7.2 7.2a1 1 0 010 1.4l-8.1 8.1a1 1 0 01-1.4 0L3.8 13.3a1 1 0 01-.3-.7zM8 8h.01",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2v2M18 18h2v2h-2",
  logout: "M14.5 8V5.5A1.5 1.5 0 0013 4H5.5A1.5 1.5 0 004 5.5v13A1.5 1.5 0 005.5 20H13a1.5 1.5 0 001.5-1.5V16M10 12h10M17 9l3 3-3 3",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.5V12l3 2",
  lock: "M6.5 10.5h11A1.5 1.5 0 0119 12v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 19v-7a1.5 1.5 0 011.5-1.5zM8.5 10.5V7.5a3.5 3.5 0 017 0v3",
  message: "M4.5 5.5h15A1.5 1.5 0 0121 7v9a1.5 1.5 0 01-1.5 1.5H9l-4.5 3.5v-3.5A1.5 1.5 0 013 16V7a1.5 1.5 0 011.5-1.5z",
  refresh: "M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 4.5v4h-4",
  print: "M7 9V3.5h10V9M7 17.5H5A1.5 1.5 0 013.5 16v-5.5A1.5 1.5 0 015 9h14a1.5 1.5 0 011.5 1.5V16a1.5 1.5 0 01-1.5 1.5h-2M7 14h10v6.5H7z",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.5h.01",
  card: "M3.5 6.5h17A1.5 1.5 0 0122 8v9a1.5 1.5 0 01-1.5 1.5h-17A1.5 1.5 0 012 17V8a1.5 1.5 0 011.5-1.5zM2 10.5h20M6 15h4",
  transfer: "M4 8.5h14M14.5 5l3.5 3.5-3.5 3.5M20 15.5H6M9.5 12L6 15.5 9.5 19",
  hash: "M9 3.5L7 20.5M17 3.5l-2 17M4 8.5h16.5M3.5 15.5H20",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, stroke = 1.8, className = "" }: { name: IconName; size?: number; stroke?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={paths[name]} />
      {name === "alert" ? <path d="M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /> : null}
    </svg>
  );
}

/* ---------------------------------------------------------------- actions */

type Variant = "primary" | "accent" | "secondary" | "outline" | "danger" | "ghost" | "inverse";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-forest text-white hover:bg-forest-2",
  accent: "bg-lime text-ink hover:bg-lime-2",
  secondary: "bg-fill text-ink hover:bg-fill-2",
  outline: "border border-line-2 bg-paper text-ink hover:border-ink-3",
  danger: "bg-stop text-white hover:bg-stop-fg",
  ghost: "text-forest hover:bg-fill",
  inverse: "bg-white/12 text-white hover:bg-white/20",
};
const sizeClass: Record<Size, string> = {
  sm: "min-h-9 px-3.5 text-[13px]",
  md: "min-h-11 px-5 text-[15px]",
  lg: "min-h-13 px-6 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className = "") {
  return `inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-btn)] font-semibold tracking-[-0.01em] transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 ${variantClass[variant]} ${sizeClass[size]} ${className}`;
}

export function Button({ children, variant = "primary", size = "md", className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button {...rest} className={buttonClass(variant, size, className)}>
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary", size = "md", className = "", target }: { href: string; children: ReactNode; variant?: Variant; size?: Size; className?: string; target?: string }) {
  return (
    <Link href={href} target={target} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

/** A text link with a trailing arrow, used for secondary navigation. */
export function ArrowLink({ href, children, className = "", target }: { href: string; children: ReactNode; className?: string; target?: string }) {
  return (
    <Link href={href} target={target} className={`group inline-flex items-center gap-1 font-semibold text-forest ${className}`}>
      {children}
      <Icon name="chevronRight" size={16} stroke={2.2} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/* ----------------------------------------------------------------- inputs */

export const inputClass =
  "min-h-12 w-full rounded-[var(--radius-input)] border border-line-2 bg-paper px-4 text-base text-ink outline-none transition placeholder:text-ink-3/70 focus:border-forest focus:ring-4 focus:ring-forest/10";

export function Field({ label, hint, className = "", ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input {...rest} className={`${inputClass} ${className}`} />
      {hint ? <span className="text-[13px] text-ink-3">{hint}</span> : null}
    </label>
  );
}

export function Select({ label, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="relative">
        <select {...rest} className={`${inputClass} appearance-none pr-10`}>
          {children}
        </select>
        <Icon name="chevronRight" size={16} stroke={2.2} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-ink-3" />
      </span>
    </label>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2.5 rounded-[var(--radius-input)] bg-stop-bg px-4 py-3 text-sm font-medium text-stop-fg">
      <Icon name="alert" size={18} className="mt-px" />
      <span>{children}</span>
    </p>
  );
}

export function Note({ children, tone = "neutral", icon = "info" }: { children: ReactNode; tone?: "neutral" | "go" | "warn"; icon?: IconName }) {
  const style = { neutral: "bg-mist-2 text-ink-2", go: "bg-go-bg text-go-fg", warn: "bg-warn-bg text-warn-fg" }[tone];
  return (
    <p className={`flex items-start gap-2.5 rounded-[var(--radius-input)] px-4 py-3 text-sm font-medium ${style}`}>
      <Icon name={icon} size={18} className="mt-px" />
      <span>{children}</span>
    </p>
  );
}

/* ----------------------------------------------------------------- status */

export type Tone = "paid" | "unpaid" | "warn" | "neutral";
const toneStyle: Record<Tone, string> = {
  paid: "bg-go-bg text-go-fg",
  unpaid: "bg-stop-bg text-stop-fg",
  warn: "bg-warn-bg text-warn-fg",
  neutral: "bg-mist-2 text-ink-2",
};
const toneIcon: Record<Tone, IconName> = { paid: "check", unpaid: "x", warn: "alert", neutral: "info" };

/** Status always shows an icon and a word, never colour alone (PRD section 5). */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[var(--radius-chip)] py-0.5 pl-1.5 pr-2.5 text-[12px] font-semibold ${toneStyle[tone]}`}>
      <Icon name={toneIcon[tone]} size={14} stroke={2.4} />
      <span className="inline-block first-letter:uppercase">{children}</span>
    </span>
  );
}

const tagDot: Record<Tone, string> = { paid: "bg-go", unpaid: "bg-stop", warn: "bg-warn", neutral: "bg-ink-3" };

/** Kalimo-style tag: a white chip with a coloured dot and a word. */
export function Tag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap bg-paper px-2 py-1 text-[12px] font-medium text-ink">
      <span className={`h-1.5 w-1.5 rounded-full ${tagDot[tone]}`} aria-hidden="true" />
      <span className="inline-block first-letter:uppercase">{children}</span>
    </span>
  );
}

const panelStyle: Record<Tone, { bg: string; dot: string; icon: IconName }> = {
  paid: { bg: "bg-go text-white", dot: "bg-white text-go", icon: "check" },
  unpaid: { bg: "bg-stop text-white", dot: "bg-white text-stop", icon: "x" },
  warn: { bg: "bg-night text-white", dot: "bg-warn text-night", icon: "alert" },
  neutral: { bg: "bg-forest text-white", dot: "bg-lime text-forest", icon: "info" },
};

/** The one big answer on a verification screen: icon, word, then context. */
export function StatusPanel({ tone, word, sub, children, className = "" }: { tone: Tone; word: string; sub?: ReactNode; children?: ReactNode; className?: string }) {
  const s = panelStyle[tone];
  return (
    <section className={`animate-fadein flex flex-col items-center gap-3 rounded-[var(--radius-card)] px-6 py-9 text-center ${s.bg} ${className}`} role="status">
      <span className={`animate-pop flex h-[72px] w-[72px] items-center justify-center rounded-full ${s.dot}`}>
        <Icon name={s.icon} size={tone === "warn" ? 36 : 40} stroke={2.8} />
      </span>
      <p className="display text-[40px] uppercase leading-none sm:text-5xl">{word}</p>
      {sub ? <div className="max-w-sm text-[15px] text-white/85">{sub}</div> : null}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------- containers */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[var(--radius-card)] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[18px] font-medium tracking-[-0.03em] text-ink">{children}</h2>
      {aside}
    </div>
  );
}

/** Label and value rows divided by hairlines. */
export function Rows({ rows, className = "" }: { rows: [ReactNode, ReactNode, boolean?][]; className?: string }) {
  return (
    <dl className={`divide-y divide-line text-[15px] ${className}`}>
      {rows.map(([k, v, strong], i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className={strong ? "font-semibold text-ink" : "text-ink-2"}>{k}</dt>
          <dd className={`text-right tnum ${strong ? "font-bold text-ink" : "font-medium text-ink"}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      <p className="money text-[28px] leading-none text-ink">{value}</p>
      {sub ? <p className="text-[13px] text-ink-3">{sub}</p> : null}
    </div>
  );
}

/** Page header for app screens: title, an optional muted lead, and actions. */
export function PageHeader({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[34px] font-medium leading-[1.02] tracking-[-0.05em] text-ink sm:text-[44px]">{title}</h1>
        {lead ? <p className="mt-3 max-w-2xl text-[15px] text-ink-2">{lead}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Shell for the phone-first screens: traders, officers and public checks. */
export function PageShell({ children, title, lead, back, art, wide = false }: { children?: ReactNode; title?: string; lead?: ReactNode; back?: { href: string; label: string }; art?: ReactNode; wide?: boolean }) {
  const width = wide ? "max-w-none gutter" : "max-w-md px-4";
  return (
    <div className="min-h-dvh bg-mist">
      <header className="sticky top-0 z-30 border-b border-line bg-mist/85 backdrop-blur-md">
        <div className={`mx-auto flex h-14 items-center justify-between ${width}`}>
          <Link href="/" aria-label="LevyPass home">
            <Logo size={26} />
          </Link>
          {back ? (
            <Link href={back.href} className="inline-flex items-center gap-1 rounded-[var(--radius-btn)] px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-fill hover:text-ink">
              <Icon name="arrowLeft" size={16} stroke={2} />
              {back.label}
            </Link>
          ) : null}
        </div>
      </header>
      <main className={`mx-auto flex flex-col gap-4 pb-12 pt-6 ${width}`}>
        {art ? <div className="-mb-2 flex justify-start [&_svg]:h-[104px] [&_svg]:w-auto">{art}</div> : null}
        {title ? (
          <div className="mb-1">
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink">{title}</h1>
            {lead ? <p className="mt-1.5 text-[15px] text-ink-2">{lead}</p> : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
