import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, Logo } from "@/app/_ui/kit";
import { requireSubject } from "@/server/auth/session";
import { env } from "@/server/env";
import { adminLogout } from "../actions";
import { SideNav, TabNav } from "./nav";

export const dynamic = "force-dynamic";

function BankMode() {
  const live = env().BANK_ADAPTER === "xtradot";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-2.5 py-1 text-[12px] font-medium text-ink-2">
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-go" : "bg-warn"}`} aria-hidden="true" />
      {live ? "Xtradot sandbox, live" : "Bank simulated"}
    </span>
  );
}

export default async function PanelLayout({ children }: { children: ReactNode }) {
  await requireSubject("admin");
  return (
    <div className="min-h-dvh bg-mist lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper px-4 py-5 lg:flex">
        <Link href="/admin" className="px-2">
          <Logo />
        </Link>
        <p className="mt-6 px-3 text-[12px] font-medium text-ink-3">Revenue office</p>
        <div className="mt-2">
          <SideNav />
        </div>
        <div className="mt-auto flex flex-col gap-3 border-t border-line px-2 pt-4">
          <BankMode />
          <form action={adminLogout}>
            <button className="inline-flex items-center gap-2 text-[14px] font-medium text-ink-2 hover:text-ink">
              <Icon name="logout" size={17} />
              Log out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/admin">
              <Logo size={26} />
            </Link>
            <div className="flex items-center gap-2">
              <BankMode />
              <form action={adminLogout}>
                <button aria-label="Log out" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-fill">
                  <Icon name="logout" size={18} />
                </button>
              </form>
            </div>
          </div>
          <div className="pb-3">
            <TabNav />
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10 2xl:px-14">{children}</main>
      </div>
    </div>
  );
}
