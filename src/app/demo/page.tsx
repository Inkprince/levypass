import Link from "next/link";
import { Icon, type IconName, PageShell } from "@/app/_ui/kit";

export const metadata = { title: "Demo script · LevyPass" };

const steps: [string, string, string, string][] = [
  ["Register Mama Bisi on her phone.", "The OTP lands in the phone simulator.", "/register", "Register"],
  ["She pays today's levy by USSD.", "*347*13#, option 1. The receipt SMS arrives in seconds.", "/sim", "Simulator"],
  ["Officer Musa scans her QR: PAID.", "Then an unpaid trader: NOT PAID, with a pay-now code.", "/officer", "Scanner"],
  ["A judge scans Musa's officer ID.", "The admin suspends him; the next scan says SUSPENDED and a flag appears.", "/admin/officers", "Officers"],
  ["Type a made-up receipt number.", "NOT GENUINE, and the revenue office is flagged.", "/r", "Receipt check"],
  ["Charge Mama Bisi again for today.", "Flagged as a double charge and credited to tomorrow.", "/admin/failures", "Drills"],
  ["Break it.", "Withhold a webhook, replay one, forge a signature.", "/admin/failures", "Drills"],
  ["The dashboard has moved.", "Reconciliation shows a gap of ₦0.00.", "/admin/reconciliation", "Reconciliation"],
];

const roles: [string, string, string, IconName][] = [
  ["Trader", "Register and see the pass", "/register", "user"],
  ["Phone simulator", "SMS inbox and USSD", "/sim", "phone"],
  ["Officer", "Scan a trader's QR", "/officer", "scan"],
  ["Revenue office", "Live collections", "/admin", "grid"],
];

export default function DemoPage() {
  return (
    <PageShell title="Five-minute demo" lead="Open each role in its own tab, then follow the script top to bottom." wide back={{ href: "/", label: "Home" }}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {roles.map(([label, sub, href, icon]) => (
          <Link key={href} href={href} target="_blank" className="group flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-paper p-5 transition-colors hover:border-forest">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-lime">
              <Icon name={icon} size={20} />
            </span>
            <span>
              <span className="flex items-center gap-1 text-[16px] font-semibold tracking-[-0.01em]">
                {label}
                <Icon name="arrowRight" size={16} stroke={2} className="text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-forest" />
              </span>
              <span className="text-[13px] text-ink-2">{sub}</span>
            </span>
          </Link>
        ))}
      </div>

      <ol className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
        {steps.map(([title, body, href, cta], i) => (
          <li key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0 sm:px-6">
            <span className="w-6 shrink-0 font-mono text-[13px] font-semibold text-ink-3">{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{title}</span>
              <span className="text-[14px] text-ink-2">{body}</span>
            </span>
            <Link href={href} target="_blank" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-fill px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-fill-2">
              <span className="hidden sm:inline">{cta}</span>
              <Icon name="arrowRight" size={15} stroke={2} />
            </Link>
          </li>
        ))}
      </ol>
      <p className="flex items-center gap-2 text-[13px] text-ink-3">
        <Icon name="lock" size={15} />
        Demo logins: officer OTT-001 and admin revenue@levypass.test. PINs and passwords are in the team&apos;s logins file.
      </p>
    </PageShell>
  );
}
