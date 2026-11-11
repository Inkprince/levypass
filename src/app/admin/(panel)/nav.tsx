"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/app/_ui/kit";

export const adminNav: [string, string, IconName][] = [
  ["/admin", "Collections", "grid"],
  ["/admin/reconciliation", "Reconciliation", "scale"],
  ["/admin/fraud", "Fraud and complaints", "flag"],
  ["/admin/officers", "Officers", "users"],
  ["/admin/levies", "Levies", "tag"],
  ["/admin/failures", "Failure drills", "bolt"],
  ["/admin/stickers", "QR stickers", "print"],
];

const isActive = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

/** Kalimo sidebar layout: roomy rows, forest icons; the current page gets a soft highlight and a lime icon. */
export function SideNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {adminNav.map(([href, label, icon]) => {
        const on = isActive(path, href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 text-[15px] transition-colors ${on ? "bg-fill font-semibold text-ink" : "text-ink-2 hover:bg-fill hover:text-ink"}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${on ? "bg-lime text-forest" : "text-forest"}`}>
              <Icon name={icon} size={18} stroke={on ? 2.2 : 1.8} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabNav() {
  const path = usePathname();
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto px-4">
      {adminNav.map(([href, label]) => {
        const on = isActive(path, href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${on ? "bg-forest text-white" : "bg-mist-2 text-ink-2"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
