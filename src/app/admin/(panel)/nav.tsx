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

export function SideNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {adminNav.map(([href, label, icon]) => {
        const on = isActive(path, href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors ${on ? "bg-fill text-ink" : "text-ink-2 hover:bg-fill hover:text-ink"}`}>
            <Icon name={icon} size={18} className={on ? "text-forest" : "text-ink-3"} />
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
          <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${on ? "bg-forest text-white" : "bg-fill text-ink-2"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
