import Link from "next/link";
import { PageShell } from "@/app/_ui/kit";

export const metadata = { title: "Demo script · LevyPass" };

const steps: [string, string, string][] = [
  ["1", "Register Mama Bisi on her phone. The OTP lands in the phone simulator.", "/register"],
  ["2", "She pays today's levy by USSD (*347*13#, option 1). The receipt SMS arrives in seconds.", "/sim"],
  ["3", "Officer Musa scans her QR: PAID. He scans an unpaid trader: NOT PAID, with a pay-now code.", "/officer"],
  ["4", "A judge scans Musa's officer ID. The admin suspends him; the next scan says SUSPENDED and a flag appears.", "/admin/officers"],
  ["5", "Type a made-up receipt number: NOT GENUINE, flagged.", "/r"],
  ["6", "Charge Mama Bisi again for today: flagged as a double charge and credited to tomorrow.", "/admin/failures"],
  ["7", "Break it: withhold a webhook, replay one, forge a signature.", "/admin/failures"],
  ["8", "Dashboard has moved; reconciliation shows a gap of ₦0.00.", "/admin/reconciliation"],
];

export default function DemoPage() {
  return (
    <PageShell title="Five-minute demo" wide back={{ href: "/", label: "Home" }}>
      <div className="grid gap-3 md:grid-cols-4">
        {(
          [
            ["Trader", "/register"],
            ["Phone simulator", "/sim"],
            ["Officer", "/officer"],
            ["Revenue office", "/admin"],
          ] as const
        ).map(([label, href]) => (
          <Link key={href} href={href} target="_blank" className="rounded-2xl bg-brand-700 p-5 text-center text-lg font-bold text-white shadow hover:bg-brand-800">
            {label}
          </Link>
        ))}
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map(([n, text, href]) => (
          <li key={n} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-900">{n}</span>
            <span className="flex-1">{text}</span>
            <Link href={href} target="_blank" className="text-sm font-semibold text-brand-800">
              Open
            </Link>
          </li>
        ))}
      </ol>
      <p className="text-sm text-slate-500">Demo logins: officer OTT-001 and admin revenue@levypass.test. PINs and passwords are in the team&apos;s logins file.</p>
    </PageShell>
  );
}
