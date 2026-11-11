import { ActionForm } from "@/app/_ui/action-form";
import { FormShell } from "@/app/_ui/form-shell";
import { ArrowLink, Card, Field } from "@/app/_ui/kit";
import { cookies } from "next/headers";
import { loginVerify } from "../../actions";

export default async function LoginVerifyPage() {
  const phone = (await cookies()).get("lp_login")?.value;
  const sim = phone ? `/sim?phone=${encodeURIComponent(phone)}` : "/sim";
  return (
    <FormShell scene="code" title="Enter your code" lead="We sent a six-digit code to your phone." back={{ href: "/login", label: "Start again" }}>
      <Card>
        <ActionForm action={loginVerify} submit="Log in">
          <Field label="Six-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="000000" className="text-center font-mono text-[24px] tracking-[0.5em]" />
        </ActionForm>
      </Card>
      <ArrowLink href={sim} target="_blank" className="self-center text-[14px]">
        Open the phone simulator
      </ArrowLink>
    </FormShell>
  );
}
