import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/app/_ui/kit";
import { requireSubject } from "@/server/auth/session";
import { env } from "@/server/env";
import { adminLogout } from "../actions";

export const dynamic = "force-dynamic";

const nav = [
  ["/admin", "Dashboard"],
  ["/admin/reconciliation", "Reconciliation"],
  ["/admin/fraud", "Fraud & complaints"],
  ["/admin/officers", "Officers"],
  ["/admin/levies", "Levies"],
  ["/admin/failures", "Failure drills"],
  ["/admin/stickers", "QR stickers"],
] as const;

export default async function PanelLayout({ children }: { children: ReactNode }) {
  await requireSubject("admin");
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="no-print sticky top-0 z-40 bg-brand-900 text-white shadow">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin">
            <Logo light />
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm font-semibold">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-lg px-3 py-1.5 hover:bg-white/10">
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="rounded-full bg-white/15 px-2 py-1">Bank: {env().BANK_ADAPTER === "xtradot" ? "Xtradot sandbox (live)" : "simulated"}</span>
            <form action={adminLogout}>
              <button className="font-semibold opacity-80 hover:opacity-100">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
