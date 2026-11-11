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

/** Heroicons v2.2.0, 24px outline (MIT, Tailwind Labs). Path data copied from heroicons/24/outline. */
const paths = {
  check: ["m4.5 12.75 6 6 9-13.5"], // check
  x: ["M6 18 18 6M6 6l12 12"], // x-mark
  alert: ["M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"], // exclamation-triangle
  arrowRight: ["M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"], // arrow-right
  arrowLeft: ["M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"], // arrow-left
  arrowUpRight: ["m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"], // arrow-up-right
  search: ["m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"], // magnifying-glass
  chevronRight: ["m8.25 4.5 7.5 7.5-7.5 7.5"], // chevron-right
  phone: ["M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"], // device-phone-mobile
  scan: ["M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"], // viewfinder-circle
  bank: ["M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z"], // building-library
  receipt: ["M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"], // document-text
  shield: ["M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"], // shield-check
  ledger: ["M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"], // book-open
  flag: ["M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"], // flag
  user: ["M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"], // user
  users: ["M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"], // users
  grid: ["M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"], // squares-2x2
  scale: ["M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971Z"], // scale
  bolt: ["m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"], // bolt
  tag: ["M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z", "M6 6h.008v.008H6V6Z"], // tag
  qr: ["M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z", "M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z"], // qr-code
  logout: ["M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"], // arrow-right-start-on-rectangle
  clock: ["M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"], // clock
  lock: ["M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"], // lock-closed
  message: ["M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"], // chat-bubble-bottom-center-text
  refresh: ["M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"], // arrow-path
  print: ["M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"], // printer
  info: ["m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"], // information-circle
  card: ["M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"], // credit-card
  transfer: ["M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"], // arrows-right-left
  hash: ["M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5"], // hashtag
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, stroke = 1.5, className = "" }: { name: IconName; size?: number; stroke?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
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
    <Link href={href} target={target} className={`group inline-flex min-h-11 items-center gap-1 font-semibold text-forest ${className}`}>
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
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-paper px-2.5 py-1 text-[12px] font-medium text-ink">
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
          <Link href="/" aria-label="LevyPass home" className="flex min-h-11 items-center">
            <Logo size={26} />
          </Link>
          {back ? (
            <Link href={back.href} className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-btn)] px-3 text-sm font-semibold text-ink-2 hover:bg-fill hover:text-ink">
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
