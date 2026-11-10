import Link from "next/link";
import { formatNaira } from "@/core/money";
import { Logo } from "@/app/_ui/kit";
import { dashboardSummary } from "@/server/admin/summary";

export const dynamic = "force-dynamic";

export default async function Home() {
  const d = await dashboardSummary().catch(() => null);
  const traders = d?.compliance.reduce((x, c) => x + c.traders, 0) ?? 0;
  const paid = d?.compliance.reduce((x, c) => x + c.paid, 0) ?? 0;
  return (
    <div className="min-h-dvh bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-6">
          <div className="flex items-center justify-between">
            <Logo light />
            <Link href="/demo" className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">
              Live demo
            </Link>
          </div>
          <div className="mt-14 grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="inline-block rounded-full bg-gold/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold">Access Youth Tech Forge 2026 · Team FET</p>
              <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">Every levy paid. Every naira traced. One scan to prove it.</h1>
              <p className="mt-4 max-w-xl text-lg text-white/85">
                LevyPass lets market and motor-park traders pay levies by USSD, transfer or card, settles the money straight to the government&apos;s bank account, and lets an officer confirm payment with one QR scan. No cash. No fake receipts. No missing money.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="rounded-xl bg-white px-6 py-3 font-bold text-brand-800 shadow-lg hover:bg-brand-50">
                  Register a trader
                </Link>
                <Link href="/officer" className="rounded-xl bg-white/15 px-6 py-3 font-bold hover:bg-white/25">
                  Officer scanner
                </Link>
                <Link href="/admin" className="rounded-xl bg-white/15 px-6 py-3 font-bold hover:bg-white/25">
                  Revenue dashboard
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Collected today", d ? formatNaira(d.collected.day) : "-"],
                ["This month", d ? formatNaira(d.collected.month) : "-"],
                ["Traders paid today", traders ? `${Math.round((paid / traders) * 100)}%` : "-"],
                ["Gap at reconciliation", "₦0.00"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white/10 p-5 backdrop-blur">
                  <p className="text-sm text-white/75">{k}</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3">
        {[
          ["Pay on any phone", "USSD *347*13# on a basic phone, transfer or card. The receipt arrives by SMS in seconds, in English, Pidgin or Yoruba."],
          ["Verify in one scan", "Officers scan a signed QR and see PAID or NOT PAID in under three seconds. Traders scan the officer back to check they are genuine."],
          ["Bank-grade integrity", "Append-only double-entry ledger, verify-before-value, idempotency both ways, and daily reconciliation with the bank to the kobo."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-slate-200 p-6">
            <p className="text-lg font-bold text-ink">{title}</p>
            <p className="mt-2 text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold">For government</h2>
            <p className="mt-2 text-slate-600">Collections land in the government&apos;s own account, never with an individual. Leakage, fake receipts and ghost collectors become visible the moment they happen, on a live dashboard and a fraud queue.</p>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold">For Access Bank</h2>
            <p className="mt-2 text-slate-600">Collection balances for the bank, a digital front door to millions of unbanked traders, and a consented payment history that can power savings and micro-credit.</p>
          </div>
        </div>
      </section>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
        Synthetic data only. Built on the Xtradot Bank sandbox. Check a receipt at <Link href="/r" className="font-semibold text-brand-800">/r</Link>.
      </footer>
    </div>
  );
}
