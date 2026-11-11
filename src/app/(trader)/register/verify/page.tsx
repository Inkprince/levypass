import { ActionForm } from "@/app/_ui/action-form";
import { FormShell } from "@/app/_ui/form-shell";
import { ArrowLink, Card, Field } from "@/app/_ui/kit";
import { cookies } from "next/headers";
import { openRegistration } from "@/server/traders/register";
import { registerVerify } from "../../actions";

export default async function RegisterVerifyPage() {
  // The code went to the number being registered: open the simulator on that SIM, not on the newest trader's.
  const reg = openRegistration((await cookies()).get("lp_reg")?.value);
  const sim = reg ? `/sim?phone=${encodeURIComponent(reg.phone)}` : "/sim";
  return (
    <FormShell scene="code" title="Enter your code" lead="We sent a six-digit code by SMS. In the demo it arrives in the phone simulator." back={{ href: "/register", label: "Start again" }}>
      <Card>
        <ActionForm action={registerVerify} submit="Confirm and get my pass">
          <Field label="Six-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="000000" className="text-center font-mono text-[24px] tracking-[0.5em]" />
        </ActionForm>
      </Card>
      <ArrowLink href={sim} target="_blank" className="self-center text-[14px]">
        Open the phone simulator
      </ArrowLink>
    </FormShell>
  );
}
