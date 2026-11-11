import { ActionForm } from "@/app/_ui/action-form";
import { Card, Field, Icon, PageShell, Select } from "@/app/_ui/kit";
import { IlloStall } from "@/app/_ui/illustrations";
import { markets } from "@/server/traders/register";
import { registerStart } from "../actions";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const list = await markets();
  return (
    <PageShell art={<IlloStall />} title="Get your LevyPass" back={{ href: "/login", label: "Log in" }}>
      <Card>
        <ActionForm action={registerStart} submit="Send my code">
          <Field label="Full name" name="name" autoComplete="name" required placeholder="Bisi Adewale" />
          <Field label="Phone number" name="phone" inputMode="tel" autoComplete="tel" required placeholder="0803 000 0000" />
          <Select label="Market or park" name="marketId" required defaultValue={list[0]?.id}>
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stall or vehicle" name="stallOrVehicle" required placeholder="E-07" />
            <Field label="Business" name="businessType" required placeholder="Fabrics" />
          </div>
          <Select label="Language for SMS" name="locale" defaultValue="en">
            <option value="en">English</option>
            <option value="pcm">Pidgin</option>
            <option value="yo">Yoruba</option>
          </Select>
        </ActionForm>
      </Card>
      <ol className="grid grid-cols-3 gap-2 text-center text-[12px] text-ink-2">
        {(
          [
            ["user", "Your details"],
            ["message", "Code by SMS"],
            ["qr", "Your QR pass"],
          ] as const
        ).map(([icon, label], i) => (
          <li key={label} className="flex flex-col items-center gap-1.5">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${i === 0 ? "bg-forest text-lime" : "bg-mist-2 text-ink-3"}`}>
              <Icon name={icon} size={17} />
            </span>
            {label}
          </li>
        ))}
      </ol>
    </PageShell>
  );
}
