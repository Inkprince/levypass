import Link from "next/link";
import { Icon, Logo } from "@/app/_ui/kit";
import { Phone } from "./phone";

export const metadata = { title: "Phone simulator" };

export default function SimPage() {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-paper">
        <div className="gutter flex h-14 items-center justify-between">
          <Link href="/" aria-label="LevyPass home" className="flex min-h-11 items-center">
            <Logo size={26} />
          </Link>
          <Link href="/demo" className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-ink-2 hover:bg-fill hover:text-ink">
            <Icon name="arrowLeft" size={16} />
            Demo
          </Link>
        </div>
      </header>
      <main className="gutter py-8 lg:py-12">
        <Phone />
      </main>
    </div>
  );
}
