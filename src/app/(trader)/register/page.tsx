import { ActionForm } from "@/app/_ui/action-form";
import { Card, Field, PageShell, Select } from "@/app/_ui/kit";
import { markets } from "@/server/traders/register";
import { registerStart } from "../actions";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const list = await markets();
  return (
    <PageShell title="Register as a trader" back={{ href: "/login", label: "Log in" }}>
      <p className="text-slate-600">It takes one minute. We send a code to your phone to confirm it is yours.</p>
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
          <Field label="Stall or vehicle number" name="stallOrVehicle" required placeholder="E-07" />
          <Field label="Type of business" name="businessType" required placeholder="Fabrics" />
          <Select label="Language for SMS" name="locale" defaultValue="en">
            <option value="en">English</option>
            <option value="pcm">Pidgin</option>
            <option value="yo">Yoruba</option>
          </Select>
        </ActionForm>
      </Card>
    </PageShell>
  );
}
