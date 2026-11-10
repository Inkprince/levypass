import { Logo } from "@/app/_ui/kit";
import { Phone } from "./phone";

export const metadata = { title: "Phone simulator · LevyPass" };

export default function SimPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 bg-slate-950 px-4 py-8">
      <div className="text-center">
        <Logo light />
        <p className="mt-1 text-sm text-slate-400">Feature-phone simulator: SMS inbox and USSD, for any trader number.</p>
      </div>
      <Phone />
    </main>
  );
}
