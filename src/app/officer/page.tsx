import { eq } from "drizzle-orm";
import Link from "next/link";
import { Logo } from "@/app/_ui/kit";
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
    <div className="min-h-dvh bg-slate-50">
      <header className="flex items-center justify-between bg-brand-800 px-4 py-3 text-white">
        <Logo light />
        <div className="text-right text-sm">
          <p className="font-semibold">{o?.name}</p>
          <p className="opacity-80">{o?.staffId}</p>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-5">
        <h1 className="text-xl font-extrabold">Scan a trader</h1>
        <Scanner />
        <div className="flex justify-between text-sm font-semibold">
          <Link href="/officer/id" className="text-brand-800">
            Show my officer ID
          </Link>
          <form action={officerLogout}>
            <button className="text-slate-500">Log out</button>
          </form>
        </div>
      </main>
    </div>
  );
}
