import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatNaira } from "@/core/money";
import { t } from "@/messages";
import { ArrowLink, Icon, LinkButton, Logo, buttonClass, type IconName } from "@/app/_ui/kit";
import { IlloCoins, IlloFeaturePhone, IlloGovernment, IlloHands, IlloReceipt, IlloScan, MarketScene } from "@/app/_ui/illustrations";
import { dashboardSummary, type Summary } from "@/server/admin/summary";
import { CountUp, PaymentCarousel, type HeroPayment } from "./hero-live";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { env } from "@/server/env";
import { qrSvg } from "@/server/qr";

export const dynamic = "force-dynamic";

const lagosDay = (d: Date) => d.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short" });

export default async function Home() {
  // Reads our own database only; no page load reaches the bank or a model.
  const d = await dashboardSummary().catch(() => null);
  const [levy] = await db()
    .select({ name: s.levyTypes.name, amountKobo: s.levyTypes.amountKobo })
    .from(s.levyTypes)
    .where(and(eq(s.levyTypes.period, "daily"), eq(s.levyTypes.active, true)))
    .orderBy(asc(s.levyTypes.amountKobo))
    .limit(1)
    .catch(() => []);
  const base = env().PUBLIC_BASE_URL.replace(/\/$/, "");
  const checkQr = await qrSvg(`${base}/r`);
  const payments: HeroPayment[] = (d?.recent ?? []).filter((p) => p.receipt).slice(0, 6);
  const latest = payments[0] ?? null;

  return (
    <div className="bg-cream text-ink">
      <SiteNav />
      <Hero d={d} payments={payments} levy={levy ?? null} qr={checkQr} />
      <MarketScene className="block h-[230px] w-full sm:h-auto sm:max-h-[640px]" />
      <TrustRow />
      <HowItWorks d={d} levy={levy ?? null} latestReceipt={latest?.receipt ?? null} host={base.replace(/^https?:\/\//, "")} />
      <LiveBand d={d} />
      <Integrity />
      <Audiences />
      <ReceiptCheck qr={checkQr} />
      <SiteFooter />
    </div>
  );
}

/* --------------------------------------------------------------------- nav */

function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/85 backdrop-blur-md">
      <div className="gutter flex h-16 items-center gap-8">
        <Link href="/" aria-label="LevyPass home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-[14px] font-medium text-ink-2 md:flex">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#integrity" className="hover:text-ink">Integrity</a>
          <Link href="/r" className="hover:text-ink">Check a receipt</Link>
          <Link href="/demo" className="hover:text-ink">Demo</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/officer" className="hidden rounded-full px-3 py-2 text-[14px] font-medium text-ink-2 hover:bg-fill hover:text-ink lg:inline-flex">
            Officer
          </Link>
          <Link href="/admin" className="hidden rounded-full px-3 py-2 text-[14px] font-medium text-ink-2 hover:bg-fill hover:text-ink lg:inline-flex">
            Revenue office
          </Link>
          <LinkButton href="/demo" variant="secondary" size="sm" className="md:hidden">
            Demo
          </LinkButton>
          <LinkButton href="/register" size="sm">
            Register a trader
          </LinkButton>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero({ d, payments, levy, qr }: { d: Summary | null; payments: HeroPayment[]; levy: { name: string; amountKobo: number } | null; qr: string }) {
  return (
    <section className="rails relative overflow-hidden">
      <svg className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" viewBox="0 0 1200 760" preserveAspectRatio="none" aria-hidden="true">
        <path className="lp-draw" pathLength={1} d="M640 -20 C 700 260, 980 420, 1240 380" fill="none" stroke="#a8e86b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="gutter relative grid items-center gap-12 pb-10 pt-12 md:pt-20 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14 lg:pb-12">
        <div>
          {d && (d.collected.day > 0 || d.collected.month > 0) ? (
            <p className="animate-rise mb-7 inline-flex items-center gap-2.5 rounded-full border border-line bg-paper/70 py-1.5 pl-3 pr-4 text-[13px] text-ink-2">
              <LiveDot />
              <span>
                {d.collected.day > 0 ? "Collected today" : "Collected this month"}
                <span className="hidden sm:inline"> through LevyPass</span>
              </span>
              <CountUp kobo={d.collected.day > 0 ? d.collected.day : d.collected.month} className="font-bold text-ink tnum" />
            </p>
          ) : null}
          <h1 className="display text-[48px] sm:text-[68px] lg:text-[62px] xl:text-[72px] 2xl:text-[88px]">
            <span className="animate-rise block" style={{ animationDelay: "80ms" }}>
              Every levy paid.
            </span>
            <span className="animate-rise block text-ink-3" style={{ animationDelay: "180ms" }}>
              Every naira traced.
            </span>
          </h1>
          <p style={{ animationDelay: "280ms" }} className="animate-rise mt-7 max-w-[34rem] text-[18px] leading-relaxed text-ink-2">
            Market and motor-park traders pay by USSD, transfer or card. The money settles straight to the government&apos;s account, and an officer confirms it with one QR scan.
          </p>
          <div style={{ animationDelay: "360ms" }} className="animate-rise mt-9 flex flex-wrap items-center gap-3">
            <LinkButton href="/register" size="lg">
              Register a trader
            </LinkButton>
            <LinkButton href="/demo" size="lg" variant="secondary">
              See the five-minute demo
              <Icon name="arrowRight" size={18} stroke={2} />
            </LinkButton>
          </div>
          <p style={{ animationDelay: "440ms" }} className="animate-rise mt-8 flex items-start gap-2 text-[14px] text-ink-2">
            <Icon name="phone" size={18} className="mt-px text-forest" />
            <span>
              No smartphone needed. Dial <span className="whitespace-nowrap rounded-md bg-mist-2 px-1.5 py-0.5 font-mono text-[13px] font-semibold text-ink">*347*13#</span> on any phone.
            </span>
          </p>
        </div>
        <PaymentCard payments={payments} levy={levy} qr={qr} />
      </div>
    </section>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-go opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-go" />
    </span>
  );
}

/** Wise-style breakdown of real payments, with a tilted pass card behind it (Kalimo's stacked cards). */
function PaymentCard({ payments, levy, qr }: { payments: HeroPayment[]; levy: { name: string; amountKobo: number } | null; qr: string }) {
  return (
    <div className="animate-rise relative mx-auto w-full max-w-[440px] lg:mr-0" style={{ animationDelay: "160ms" }}>
      <div className="lp-float absolute -left-14 top-28 hidden w-[200px] -rotate-[12deg] rounded-[22px] border-[2.5px] border-ink bg-lime p-4 sm:block" aria-hidden="true">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-ink">LevyPass</span>
          <span className="rounded-full border-2 border-ink bg-paper px-1.5 text-[10px] font-bold">A-01</span>
        </div>
        <div className="mt-3 rounded-xl border-2 border-ink bg-paper p-1.5 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="mt-2 text-[11px] font-bold text-ink">Paid today</p>
      </div>
      {payments.length ? (
        <PaymentCarousel payments={payments} />
      ) : (
        <div className="relative overflow-hidden rounded-[28px] border border-line bg-paper shadow-[0_24px_60px_-28px_rgb(12_28_21/0.35)]">
          <div className="bg-forest px-6 pb-7 pt-6 text-white">
            <p className="text-[13px] font-medium text-white/70">Today&apos;s levy</p>
            <p className="money mt-4 text-[52px] leading-none">{formatNaira(levy?.amountKobo ?? 0)}</p>
            <p className="mt-2 text-[14px] text-white/75">{levy?.name ?? "Market levy"}</p>
          </div>
          <div className="flex flex-col gap-1 px-6 pb-6 pt-5">
            <BreakdownRow icon="bank" label="Settles to" value="Government account" />
            <BreakdownRow icon="receipt" label="Receipt" value="By SMS, in seconds" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href="/r" className={buttonClass("accent", "md", "w-full")}>
                Check receipt
              </Link>
              <Link href="/register" className={buttonClass("secondary", "md", "w-full")}>
                Get a pass
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownRow({ icon, label, value }: { icon: IconName; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-2">
        <Icon name={icon} size={17} />
      </span>
      <span className="flex-1 text-[14px] text-ink-2">{label}</span>
      <span className="text-right text-[14px] font-semibold">{value}</span>
    </div>
  );
}

/* --------------------------------------------------------------- trust row */

function TrustRow() {
  const items: [(p: { className?: string }) => ReactNode, string, string][] = [
    [IlloGovernment, "Money goes to the government's account", "Every payment settles to the authority's own collection account. No officer ever handles cash."],
    [IlloReceipt, "Receipts anyone can check", "Each receipt carries a number you can check online. A made-up number is flagged to the revenue office the moment it is tried."],
    [IlloFeaturePhone, "Works on any phone", "USSD on a basic handset, bank transfer or card. The receipt arrives by SMS within seconds."],
  ];
  return (
    <section className="rails border-t border-line">
      <div className="grid gap-px bg-line sm:grid-cols-3">
        {items.map(([Art, title, body]) => (
          <div key={title} className="bg-cream px-[var(--gutter)] py-9">
            <Art className="-ml-2 h-[88px] w-auto" />
            <p className="mt-4 text-[16px] font-semibold tracking-[-0.01em]">{title}</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ how it works */

function SectionHead({ id, title, soft, className = "" }: { id?: string; title: string; soft: string; className?: string }) {
  return (
    <h2 id={id} className={`headline max-w-3xl scroll-mt-24 text-[30px] sm:text-[40px] ${className}`}>
      {title} <span className="soft">{soft}</span>
    </h2>
  );
}

function HowItWorks({ d, levy, latestReceipt, host }: { d: Summary | null; levy: { name: string; amountKobo: number } | null; latestReceipt: string | null; host: string }) {
  const amount = formatNaira(levy?.amountKobo ?? 50_000);
  const number = latestReceipt ?? "LP-7K3M-9QX2T";
  const sms = t("en", "sms.receipt", { number, amount, levy: levy?.name ?? "Daily market levy", period: lagosDay(new Date()), url: `${host}/r/${number}` });
  const paidRate = d ? d.compliance.reduce((x, c) => x + c.paid, 0) : 0;
  return (
    <section className="rails gutter border-t border-line py-20 lg:py-28">
      <SectionHead id="how" title="Three steps from stall to proof." soft="The trader pays, the bank confirms, the officer scans. Nobody handles cash." />
      <ol className="mt-14 grid gap-4 md:grid-cols-3">
        <Step n="01" tone="sand" title="Pay on any phone" body="Dial the LevyPass code, pick what to pay and approve with a bank PIN. Transfer and card work too.">
          <Lcd>{t("en", "ussd.menu")}</Lcd>
        </Step>
        <Step n="02" tone="lime" title="Receipt by SMS" body="The bank confirms the payment server to server. Only then is the levy marked paid and a receipt sent.">
          <div className="flex h-full flex-col justify-end gap-2 p-4">
            <p className="text-center text-[11px] font-medium text-ink-3">LevyPass · now</p>
            <p className="max-w-[92%] rounded-2xl rounded-bl-md bg-paper px-3.5 py-2.5 text-[13px] leading-snug text-ink shadow-[0_1px_0_rgb(12_28_21/0.06)]">{sms}</p>
          </div>
        </Step>
        <Step n="03" tone="forest" title="One scan to prove it" body={`An officer scans the trader's QR and sees PAID or NOT PAID in under three seconds.${paidRate ? ` ${paidRate} traders have paid today.` : ""}`}>
          <div className="flex h-full flex-col items-center justify-center gap-1">
            <IlloScan className="h-[150px] w-auto" />
            <p className="rounded-full border-2 border-ink bg-lime px-3 py-0.5 text-[12px] font-bold text-ink">PAID · {amount} · today</p>
          </div>
        </Step>
      </ol>
    </section>
  );
}

const stepTone = {
  sand: { tile: "bg-mist-2", art: "bg-cream", num: "text-ink-3", body: "text-ink-2" },
  lime: { tile: "bg-lime", art: "bg-lime-soft", num: "text-ink/60", body: "text-ink/75" },
  forest: { tile: "bg-forest text-white", art: "bg-forest-2", num: "text-white/55", body: "text-white/75" },
};

function Step({ n, tone, title, body, children }: { n: string; tone: keyof typeof stepTone; title: string; body: string; children: ReactNode }) {
  const t = stepTone[tone];
  return (
    <li className={`flex flex-col rounded-[24px] p-2 ${t.tile}`}>
      <div className={`h-[220px] overflow-hidden rounded-[18px] ${t.art}`}>{children}</div>
      <div className="px-4 pb-5 pt-5">
        <p className={`font-mono text-[12px] font-semibold ${t.num}`}>{n}</p>
        <p className="mt-1.5 text-[18px] font-semibold tracking-[-0.02em]">{title}</p>
        <p className={`mt-1.5 text-[15px] leading-relaxed ${t.body}`}>{body}</p>
      </div>
    </li>
  );
}

function Lcd({ children }: { children: string }) {
  return (
    <div className="flex h-full items-center justify-center p-5">
      <pre className="w-full max-w-[220px] whitespace-pre-wrap rounded-xl bg-[#c5d4b4] px-4 py-3.5 font-mono text-[12.5px] leading-[1.55] text-[#1d2a16] shadow-[inset_0_2px_6px_rgb(0_0_0/0.12)]">{children}</pre>
    </div>
  );
}

/* --------------------------------------------------------------- live band */

function LiveBand({ d }: { d: Summary | null }) {
  if (!d) return null;
  const traders = d.compliance.reduce((x, c) => x + c.traders, 0);
  const paid = d.compliance.reduce((x, c) => x + c.paid, 0);
  const stats: [string, string, string][] = [
    [formatNaira(d.collected.month), "collected this month", "from the append-only ledger"],
    [formatNaira(d.collected.week), "collected this week", `${d.paymentsDay} ${d.paymentsDay === 1 ? "payment" : "payments"} so far today`],
    [traders ? `${Math.round((paid / traders) * 100)}%` : "0%", "of traders paid today", `${paid} of ${traders} in the market`],
    [String(d.open.scansToday), "officer scans today", "each one logged with time and place"],
  ];
  const max = Math.max(...d.days.map((x) => x.kobo), 1);
  return (
    <section className="bg-night text-white">
      <div className="gutter py-20 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="headline max-w-2xl text-[30px] sm:text-[40px]">
            Live from the ledger. <span className="text-white/50">Every figure here is recomputed from ledger entries when the page loads.</span>
          </h2>
          <ArrowLink href="/admin" className="text-lime">
            Open the revenue dashboard
          </ArrowLink>
        </div>
        <dl className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 border-t border-white/10 pt-10 lg:grid-cols-4">
          {stats.map(([value, label, sub]) => (
            <div key={label}>
              <dd className="money text-[30px] leading-none text-white sm:text-[38px]">{value}</dd>
              <dt className="mt-3 text-[15px] font-medium text-white/85">{label}</dt>
              <p className="mt-0.5 text-[13px] text-white/50">{sub}</p>
            </div>
          ))}
        </dl>
        <figure className="mt-14">
          <figcaption className="mb-3 text-[13px] text-white/55">Collections, last 14 days</figcaption>
          <div className="flex h-24 items-end gap-[2px]" role="img" aria-label="Daily collections for the last 14 days">
            {d.days.map((x, i) => (
              <div key={x.date} className="group relative flex h-full flex-1 items-end">
                <div className={`w-full rounded-t-[4px] ${i === d.days.length - 1 ? "bg-lime" : "bg-lime/25 group-hover:bg-lime/45"}`} style={{ height: `${Math.max(3, (x.kobo / max) * 100)}%` }} />
                <span className={`pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-ink opacity-0 transition group-hover:opacity-100 ${i < d.days.length / 2 ? "left-0" : "right-0"}`}>
                  {x.date.slice(5)} · {formatNaira(x.kobo)}
                </span>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <tbody>
              {d.days.map((x) => (
                <tr key={x.date}>
                  <td>{x.date}</td>
                  <td>{formatNaira(x.kobo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- integrity */

function Integrity() {
  const rules: [IconName, string, string][] = [
    ["ledger", "Append-only ledger", "Entries are never updated or deleted; a database trigger refuses it. Every total is recomputed from them."],
    ["shield", "Verify before value", "A webhook is only a hint. A levy is marked paid after LevyPass asks the bank, server to server, and it confirms."],
    ["refresh", "Idempotent both ways", "Every call that moves money carries a key saved before it is sent. A replayed webhook changes nothing."],
    ["lock", "Signed webhooks", "HMAC-SHA256 over the raw body, compared in constant time. Anything older than five minutes is refused."],
    ["flag", "Fraud flags in real time", "Double charges, made-up receipts and suspended officers raise a flag in the revenue office as they happen."],
    ["scale", "Reconciled to the kobo", "Each day the ledger is matched line by line with the bank's own settlement. Any gap is listed with its reference."],
  ];
  return (
    <section className="rails gutter py-20 lg:py-28">
      <SectionHead id="integrity" title="Built like a bank ledger." soft="The rules a payments engineer would check are enforced in code and in the database." />
      <div className="mt-14 grid gap-px overflow-hidden rounded-[24px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {rules.map(([icon, title, body]) => (
          <div key={title} className="bg-paper p-7">
            <Icon name={icon} size={22} className="text-forest" />
            <p className="mt-5 text-[16px] font-semibold tracking-[-0.01em]">{title}</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{body}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[14px] text-ink-3">
        Try to break it yourself: the revenue office has a{" "}
        <Link href="/admin/failures" className="font-semibold text-forest underline decoration-line-2 underline-offset-4 hover:decoration-forest">
          failure drill panel
        </Link>{" "}
        that withholds, replays and forges webhooks live.
      </p>
    </section>
  );
}

/* --------------------------------------------------------------- audiences */

function Audiences() {
  return (
    <section className="rails gutter border-t border-line py-20 lg:py-28">
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="relative flex flex-col overflow-hidden rounded-[28px] bg-mist-2 p-8 sm:p-10">
          <IlloGovernment className="absolute right-4 top-6 hidden h-[110px] w-auto sm:block" />
          <p className="text-[13px] font-semibold text-forest">For the revenue office</p>
          <h3 className="headline mt-3 text-[28px] sm:max-w-[75%] sm:text-[34px]">
            Collections you can see. <span className="soft">Leakage you can stop.</span>
          </h3>
          <ul className="mt-8 flex flex-col gap-3.5 text-[15px] text-ink-2">
            {["Money lands in the government's own account, never with a person.", "A live dashboard of every market, levy and officer, recomputed from the ledger.", "Fake receipts and ghost collectors surface as flags the moment they appear."].map((x) => (
              <li key={x} className="flex gap-3">
                <Icon name="check" size={18} stroke={2.4} className="mt-0.5 text-go" />
                {x}
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-10">
            <LinkButton href="/admin" variant="outline">
              Revenue office sign in
            </LinkButton>
          </div>
        </article>
        <article className="relative flex flex-col overflow-hidden rounded-[28px] bg-forest p-8 text-white sm:p-10">
          <IlloCoins className="absolute right-4 top-6 hidden h-[110px] w-auto sm:block" />
          <p className="text-[13px] font-semibold text-lime">For Access Bank</p>
          <h3 className="headline mt-3 text-[28px] sm:max-w-[75%] sm:text-[34px]">
            A front door to the market. <span className="text-white/55">Millions of traders, one daily habit.</span>
          </h3>
          <ul className="mt-8 flex flex-col gap-3.5 text-[15px] text-white/80">
            {["Collection balances held at the bank, settled every day.", "A digital first step for traders who have never had an account.", "A consented payment history that can support savings and micro-credit."].map((x) => (
              <li key={x} className="flex gap-3">
                <Icon name="check" size={18} stroke={2.4} className="mt-0.5 text-lime" />
                {x}
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-10">
            <LinkButton href="/demo" variant="accent">
              Walk through the demo
            </LinkButton>
          </div>
        </article>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- receipt check */

function ReceiptCheck({ qr }: { qr: string }) {
  return (
    <section className="rails gutter border-t border-line py-20 lg:py-28">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <IlloHands className="h-auto w-full max-w-[420px]" />
        <h2 className="display mt-8 text-[40px] sm:text-[56px]">Holding a levy receipt?</h2>
        <p className="mt-4 text-[17px] text-ink-2">Type its number to see if it is genuine. Anyone can check, no account needed.</p>
        <form action="/r" method="get" className="mt-8 flex w-full max-w-lg items-center gap-2 rounded-full border border-line-2 bg-paper p-1.5 pl-5 focus-within:border-forest focus-within:ring-4 focus-within:ring-forest/10">
          <Icon name="receipt" size={20} className="text-ink-3" />
          <input name="number" required aria-label="Receipt number" placeholder="Receipt number, e.g. LP-7K3M-9QX2T" autoCapitalize="characters" className="min-w-0 flex-1 bg-transparent py-2 font-medium outline-none placeholder:font-normal placeholder:text-ink-3" />
          <button className={buttonClass("primary", "md")}>Check</button>
        </form>
        <div className="mt-10 flex items-center gap-4 rounded-2xl border border-line p-3 pr-5 text-left">
          <div className="w-[76px] shrink-0 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-[14px] text-ink-2">
            <span className="block font-semibold text-ink">Or scan with your phone camera</span>
            It opens the receipt check page.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ footer */

function SiteFooter() {
  const cols: [string, [string, string][]][] = [
    ["Traders", [["Register", "/register"], ["Log in", "/login"], ["Check a receipt", "/r"], ["Phone simulator", "/sim"]]],
    ["Officers", [["Scanner", "/officer"], ["Officer login", "/officer/login"]]],
    ["Revenue office", [["Dashboard", "/admin"], ["Reconciliation", "/admin/reconciliation"], ["Fraud and complaints", "/admin/fraud"], ["Failure drills", "/admin/failures"]]],
    ["Project", [["Five-minute demo", "/demo"]]],
  ];
  return (
    <footer className="bg-mist">
      <div className="gutter pb-10 pt-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-ink-2">Digital levy collection for markets and motor parks, with proof in one scan.</p>
          </div>
          {cols.map(([title, links]) => (
            <div key={title}>
              <p className="text-[13px] font-semibold text-ink">{title}</p>
              <ul className="mt-3 flex flex-col gap-2.5 text-[14px] text-ink-2">
                {links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="hover:text-ink">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-line pt-6 text-[13px] text-ink-3 sm:flex-row sm:justify-between">
          <p>Team FET · Access Youth Tech Forge 2026, Track 01</p>
          <p>Built on the Xtradot Bank sandbox. Synthetic data only.</p>
        </div>
      </div>
    </footer>
  );
}
