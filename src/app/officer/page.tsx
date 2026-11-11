import { eq } from "drizzle-orm";
import Link from "next/link";
import { Icon, Logo } from "@/app/_ui/kit";
import { requireSubject } from "@/server/auth/session";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { officerLogout } from "./actions";
import { Scanner } from "./scanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Officer scan · LevyPass" };

export default async function OfficerPage() {
  const officerId = await requireSubject("officer");
  const [o] = await db().select({ name: s.officers.name, staffId: s.officers.staffId }).from(s.officers).where(eq(s.officers.id, officerId));
  return (
    <div className="min-h-dvh bg-mist">
      <header className="bg-forest text-white">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <Logo light size={26} />
          <Link href="/officer/id" className="flex items-center gap-2.5 bg-white/10 py-1 pl-1 pr-3 text-left hover:bg-white/15">
            <span className="flex h-8 w-8 items-center justify-center bg-lime text-[12px] font-bold text-forest">
              {(o?.name ?? "")
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-semibold">{o?.name}</span>
              <span className="block font-mono text-[11px] text-white/65">{o?.staffId}</span>
            </span>
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-10 pt-6">
        <div>
          <h1 className="text-[40px] font-medium leading-none tracking-[-0.05em]">Scan a trader</h1>
          <p className="mt-1 text-[15px] text-ink-2">Point the camera at the trader&apos;s QR pass.</p>
        </div>
        <Scanner />
        <div className="mt-2 flex items-center justify-between text-[14px] font-semibold">
          <Link href="/officer/id" className="inline-flex items-center gap-1.5 px-3 py-2 text-forest hover:bg-fill">
            <Icon name="qr" size={17} />
            Show my officer ID
          </Link>
          <form action={officerLogout}>
            <button className="inline-flex items-center gap-1.5 px-3 py-2 text-ink-3 hover:bg-fill hover:text-ink">
              <Icon name="logout" size={17} />
              Log out
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
