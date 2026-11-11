import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, Logo, Mark } from "@/app/_ui/kit";
import { requireSubject } from "@/server/auth/session";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { env } from "@/server/env";
import { adminLogout } from "../actions";
import { ReceiptSearch } from "@/app/r/receipt-search";
import { SideNav, TabNav } from "./nav";

export const dynamic = "force-dynamic";

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** Square sand chip from the Kalimo top bar. */
function Chip({ children, href, label }: { children: ReactNode; href?: string; label?: string }) {
  const cls = "flex h-10 items-center gap-2 rounded-full bg-mist-2 px-3.5 text-[14px] font-medium text-ink";
  return href ? (
    <Link href={href} aria-label={label} className={`${cls} hover:bg-fill-2`}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const adminId = await requireSubject("admin");
  // Our database only: the chrome never calls the bank.
  const [[me], [flags]] = await Promise.all([
    db().select({ name: s.admins.name }).from(s.admins).where(eq(s.admins.id, adminId)),
    db().select({ n: sql<number>`count(*)::int` }).from(s.fraudFlags).where(eq(s.fraudFlags.status, "open")),
  ]);
  const live = env().BANK_ADAPTER === "xtradot";
  const openFlags = flags?.n ?? 0;

  return (
    <div className="desk min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line px-6 pb-6 pt-8 lg:flex">
        <Link href="/admin" aria-label="Collections">
          <Logo size={30} />
        </Link>
        <div className="mt-12">
          <SideNav />
        </div>

        <Link href="/admin/failures" className="group relative mt-auto block rounded-[var(--radius-card)] bg-lime px-4 pb-4 pt-9 text-ink">
          <span className="absolute -top-6 left-4 flex h-12 w-12 items-center justify-center rounded-full border-[2.5px] border-ink bg-paper" aria-hidden="true">
            <Icon name="bolt" size={20} stroke={2.2} />
          </span>
          <span className="block text-[22px] font-medium leading-[1.02] tracking-[-0.045em]">Test the failure cases</span>
          <span className="mt-2 block text-[13px] leading-snug text-ink/75">Withhold, replay or forge a webhook and watch LevyPass credit each payment once.</span>
          <span className="mt-4 flex h-10 items-center justify-between rounded-full bg-paper px-4 text-[14px] font-medium">
            Failure drills
            <Icon name="arrowUpRight" size={14} stroke={2.4} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </Link>
        <form action={adminLogout} className="mt-5">
          <button className="inline-flex items-center gap-2 text-[14px] font-medium text-ink-2 hover:text-ink">
            <Icon name="logout" size={17} />
            Log out
          </button>
        </form>
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-mist/90 backdrop-blur-md">
          <div className="flex h-[76px] items-center gap-3 px-4 sm:px-6 lg:px-10 2xl:px-14">
            <Link href="/admin" className="lg:hidden" aria-label="Collections">
              <Mark size={30} />
            </Link>
            <ReceiptSearch variant="bar" />
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:block">
                <Chip>
                  <span className={`h-2 w-2 rounded-full ${live ? "bg-go" : "bg-warn"}`} aria-hidden="true" />
                  {live ? "Bank live" : "Bank simulated"}
                </Chip>
              </span>
              <Chip href="/admin/fraud" label={`${openFlags} open fraud flags`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${openFlags ? "bg-coral text-white" : "bg-paper text-ink-2"}`} aria-hidden="true">
                  <Icon name="flag" size={12} stroke={2.4} />
                </span>
                <span className="tnum">{openFlags}</span>
                <span className="hidden md:inline">open flags</span>
              </Chip>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest text-[13px] font-semibold text-lime" title={me?.name}>
                {initials(me?.name ?? "Revenue office")}
              </span>
            </div>
          </div>
          <div className="pb-3 lg:hidden">
            <TabNav />
          </div>
        </header>
        <main className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10 2xl:px-14">{children}</main>
      </div>
    </div>
  );
}
