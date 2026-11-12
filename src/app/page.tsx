import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatNaira } from "@/core/money";
import { t } from "@/messages";
import { Icon, LinkButton, Logo, buttonClass, type IconName } from "@/app/_ui/kit";
import { IlloHands, IlloScan, MarketScene } from "@/app/_ui/illustrations";
import { dashboardSummary } from "@/server/admin/summary";
import { publicStats, type PublicStats } from "@/server/public/stats";
import { MobileMenu, type MenuLink } from "@/app/_ui/mobile-menu";
import { PlayInView } from "@/app/_ui/play-in-view";
import { PaymentCarousel, type HeroPayment } from "./hero-live";
import { ReceiptSearch } from "./r/receipt-search";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { env } from "@/server/env";
import { qrSvg } from "@/server/qr";

export const dynamic = "force-dynamic";

const lagosDay = (d: Date) => d.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short" });

export default async function Home() {
  // Reads our own database only; no page load reaches the bank or a model.
  const [d, stats] = await Promise.all([dashboardSummary().catch(() => null), publicStats().catch(() => null)]);
  const [levy] = await db()
    .select({ name: s.levyTypes.name, amountKobo: s.levyTypes.amountKobo })
    .from(s.levyTypes)
    .where(and(eq(s.levyTypes.period, "daily"), eq(s.levyTypes.active, true)))
    .orderBy(asc(s.levyTypes.amountKobo))
    .limit(1)
    .catch(() => []);
  const base = env().PUBLIC_BASE_URL.replace(/\/$/, "");
  const checkQr = await qrSvg(`${base}/r`);
  // Anonymised here, on the server: the carousel is a client component, so whatever it is given ends
  // up in the page's HTML. Only the channel, time, amount and bank fee leave the server.
  const payments: HeroPayment[] = (d?.recent ?? [])
    .filter((p) => p.receipt)
    .slice(0, 6)
    .map((p, i) => ({ key: `p${i}`, channel: p.channel, at: p.at, amountKobo: p.amountKobo, feeKobo: p.feeKobo }));

  return (
    <div className="bg-paper text-ink">
      <SiteNav />
      <Hero payments={payments} levy={levy ?? null} qr={checkQr} />
      <PlayInView>
        <MarketScene className="block h-[230px] w-full sm:h-auto sm:max-h-[640px]" />
      </PlayInView>
      <HowItWorks levy={levy ?? null} host={base.replace(/^https?:\/\//, "")} />
      <UsageBand stats={stats} />
      <ReceiptCheck qr={checkQr} />
      <SiteFooter />
    </div>
  );
}

/* --------------------------------------------------------------------- nav */

const MENU: MenuLink[] = [
  { href: "/#how", label: "How it works", icon: "info" },
  { href: "/r", label: "Check a receipt", icon: "receipt" },
  { href: "/demo", label: "Demo", icon: "bolt" },
  { href: "/officer", label: "Officer", icon: "scan" },
  { href: "/admin", label: "Revenue office", icon: "bank" },
];

function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="gutter flex h-16 items-center gap-8">
        <Link href="/" aria-label="LevyPass home" className="flex min-h-11 items-center">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-[14px] font-medium text-ink-2 lg:flex">
          <a href="#how" className="py-2.5 hover:text-ink">How it works</a>
          <Link href="/r" className="py-2.5 hover:text-ink">Check a receipt</Link>
          <Link href="/demo" className="py-2.5 hover:text-ink">Demo</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/officer" className="hidden rounded-full px-3 py-2 text-[14px] font-medium text-ink-2 hover:bg-fill hover:text-ink lg:inline-flex">
            Officer
          </Link>
          <Link href="/admin" className="hidden rounded-full px-3 py-2 text-[14px] font-medium text-ink-2 hover:bg-fill hover:text-ink lg:inline-flex">
            Revenue office
          </Link>
          <LinkButton href="/login" size="sm" className="whitespace-nowrap">
            Log in
          </LinkButton>
          <span className="hidden lg:block">
            <LinkButton href="/register" variant="secondary" size="sm">
              Register
            </LinkButton>
          </span>
          <MobileMenu links={MENU} />
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------- hero */

const channelWords = ["USSD", "card", "transfer"] as const;

/**
 * The payment channel in the headline: each word fades in, holds, and leaves for the next.
 * All words share one grid cell so the line never reflows. Screen readers get the full list
 * once; with reduced motion only the first word shows.
 */
function ChannelWords() {
  return (
    <>
      <span className="sr-only">USSD, card or transfer.</span>
      <span className="lp-words text-forest" aria-hidden="true">
        {channelWords.map((w) => (
          <span key={w} className="lp-word">
            {w}.
          </span>
        ))}
      </span>
    </>
  );
}

function Hero({ payments, levy, qr }: { payments: HeroPayment[]; levy: { name: string; amountKobo: number } | null; qr: string }) {
  return (
    <section className="rails relative overflow-hidden">
      <svg className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" viewBox="0 0 1200 760" preserveAspectRatio="none" aria-hidden="true">
        <path className="lp-draw" pathLength={1} d="M640 -20 C 700 260, 980 420, 1240 380" fill="none" stroke="#a8e86b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="gutter relative grid items-center gap-12 pb-10 pt-12 md:pt-20 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14 lg:pb-12">
        <div>
          <h1 className="display text-[40px] min-[375px]:text-[48px] sm:text-[68px] lg:text-[62px] xl:text-[72px] 2xl:text-[88px]">
            <span className="animate-rise block" style={{ animationDelay: "80ms" }}>
              Traders pay levies by <ChannelWords />
            </span>
            <span className="animate-rise block text-ink-3" style={{ animationDelay: "180ms" }}>
              Officers check them in one scan.
            </span>
          </h1>
          <div style={{ animationDelay: "360ms" }} className="animate-rise mt-9 flex flex-wrap items-center gap-3">
            <LinkButton href="/login" size="lg">
              Log in
            </LinkButton>
            <LinkButton href="/register" size="lg" variant="secondary">
              Register a trader
            </LinkButton>
          </div>
          <p style={{ animationDelay: "440ms" }} className="animate-rise mt-8 flex items-start gap-2 text-[14px] text-ink-2">
            <Icon name="phone" size={18} className="mt-px text-forest" />
            <span>
              Dial <span className="whitespace-nowrap rounded-md bg-mist-2 px-1.5 py-0.5 font-mono text-[13px] font-semibold text-ink">*347*13#</span> to get started
            </span>
          </p>
        </div>
        <PaymentCard payments={payments} levy={levy} qr={qr} />
      </div>
    </section>
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

/* ------------------------------------------------------------ how it works */

function SectionHead({ id, title }: { id?: string; title: string }) {
  return (
    <h2 id={id} className="headline max-w-3xl scroll-mt-24 text-[30px] sm:text-[40px]">
      {title}
    </h2>
  );
}

function HowItWorks({ levy, host }: { levy: { name: string; amountKobo: number } | null; host: string }) {
  const amount = formatNaira(levy?.amountKobo ?? 50_000);
  // A sample number: a real one would open that trader's receipt, with their name and stall.
  const number = "LP-7K3M-9QX2T";
  const sms = t("en", "sms.receipt", { number, amount, levy: levy?.name ?? "Daily market levy", period: lagosDay(new Date()), url: `${host}/r/${number}` });
  return (
    <section className="rails gutter border-t border-line py-20 lg:py-28">
      <SectionHead id="how" title="How a trader pays" />
      <ol className="mt-14 grid gap-4 md:grid-cols-3">
        <Step n="01" tone="sand" title="Pay on any phone" body="Dial the LevyPass code, pick what to pay and approve with a bank PIN. Transfer and card work too.">
          <Lcd>{t("en", "ussd.menu")}</Lcd>
        </Step>
        <Step n="02" tone="lime" title="Receipt by SMS" body="The bank confirms the payment server to server. LevyPass marks the levy paid and sends a receipt only after that.">
          <div className="flex h-full flex-col justify-end gap-2.5 px-4 pb-4 pt-3">
            <p className="text-center text-[11px] leading-tight text-ink-3">
              <span className="font-semibold">Text Message</span>
              <br />
              Today from LevyPass
            </p>
            <SmsBubble>{sms}</SmsBubble>
          </div>
        </Step>
        <Step n="03" tone="forest" title="One scan to prove it" body="An officer scans the trader's QR and sees PAID or NOT PAID in under three seconds.">
          <div className="flex h-full flex-col items-center justify-center gap-1">
            <IlloScan className="h-[150px] w-auto" />
            <p className="rounded-full border-2 border-ink bg-lime px-3 py-0.5 text-[12px] font-bold text-ink">PAID {amount} today</p>
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

/**
 * An incoming text as a phone's Messages app draws it: 18px corners and a tail that curls out of
 * the bottom-left corner. The tail is an SVG in the bubble's own colour, so it works on any tile.
 */
function SmsBubble({ children }: { children: string }) {
  return (
    <div className="relative ml-1.5 max-w-[88%] self-start">
      {/* drawn first so the text sits on top; its right edge runs inside the bubble, which hides it */}
      <svg viewBox="0 0 22 21" aria-hidden className="absolute -left-1.5 bottom-0 h-[21px] w-[22px] text-paper">
        <path d="M6 0C6 11 4.5 17 0 20.8C6 21.6 14 21.4 22 19.5L22 0Z" fill="currentColor" />
      </svg>
      <p className="relative rounded-[18px] bg-paper px-3 py-[7px] text-[13px] leading-[1.35] text-ink">{children}</p>
    </div>
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

/** Public usage counts. Revenue, compliance and daily figures stay behind the revenue office login. */
function UsageBand({ stats }: { stats: PublicStats | null }) {
  if (!stats) return null;
  const count = (n: number) => n.toLocaleString("en-NG");
  const items: [string, string][] = [
    [count(stats.traders), stats.traders === 1 ? "trader registered" : "traders registered"],
    [count(stats.places), stats.places === 1 ? "market or motor park" : "markets and motor parks"],
    [count(stats.receipts), stats.receipts === 1 ? "receipt issued" : "receipts issued"],
    [count(stats.checks), stats.checks === 1 ? "pass checked by an officer" : "passes checked by officers"],
  ];
  return (
    <section className="bg-night text-white">
      <div className="gutter py-20 lg:py-24">
        <h2 className="headline max-w-2xl text-[30px] sm:text-[40px]">LevyPass so far</h2>
        <dl className="mt-14 grid grid-cols-1 gap-x-6 gap-y-10 border-t border-white/10 pt-10 min-[400px]:grid-cols-2 lg:grid-cols-4">
          {items.map(([value, label]) => (
            <div key={label} className="flex min-w-0 flex-col-reverse">
              <dt className="mt-3 text-[15px] font-medium text-white/85">{label}</dt>
              <dd className="money text-[30px] leading-none text-white sm:text-[38px]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- receipt check */

function ReceiptCheck({ qr }: { qr: string }) {
  return (
    <section className="rails gutter overflow-x-clip border-t border-line py-20 lg:py-28">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <PlayInView className="w-full max-w-[420px]">
          <IlloHands className="h-auto w-full" />
        </PlayInView>
        <h2 className="display mt-8 text-[40px] sm:text-[56px]">Check a levy receipt</h2>
        <ReceiptSearch variant="pill" />
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
    ["Traders", [["Log in", "/login"], ["Register", "/register"], ["Check a receipt", "/r"], ["Phone simulator", "/sim"]]],
    ["Staff", [["Officer login", "/officer/login"], ["Revenue office login", "/admin/login"]]],
    ["Project", [["Five-minute demo", "/demo"]]],
  ];
  return (
    <footer className="bg-mist">
      <div className="gutter pb-10 pt-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-ink-2">Digital levy collection for markets and motor parks, with proof in one scan.</p>
          </div>
          {cols.map(([title, links]) => (
            <div key={title}>
              <p className="text-[13px] font-semibold text-ink">{title}</p>
              <ul className="mt-1.5 flex flex-col text-[14px] text-ink-2 md:mt-3 md:gap-2.5">
                {links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="inline-flex min-h-11 items-center hover:text-ink md:min-h-0">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-line pt-6 text-[13px] text-ink-3 sm:flex-row sm:justify-between">
          <p>Team FET, Access Youth Tech Forge 2026, Track 01</p>
          <p>Built on the Xtradot Bank sandbox. Synthetic data only.</p>
        </div>
      </div>
    </footer>
  );
}
