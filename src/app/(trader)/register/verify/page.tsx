import { ActionForm } from "@/app/_ui/action-form";
import { ArrowLink, Card, Field, PageShell } from "@/app/_ui/kit";
import { registerVerify } from "../../actions";

export default function RegisterVerifyPage() {
  return (
    <PageShell title="Enter your code" lead="We sent a six-digit code by SMS. In the demo it arrives in the phone simulator." back={{ href: "/register", label: "Start again" }}>
      <Card>
        <ActionForm action={registerVerify} submit="Confirm and get my pass">
          <Field label="Six-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="000000" className="text-center font-mono text-[24px] tracking-[0.5em]" />
        </ActionForm>
      </Card>
      <ArrowLink href="/sim" target="_blank" className="self-center text-[14px]">
        Open the phone simulator
      </ArrowLink>
    </PageShell>
  );
}
