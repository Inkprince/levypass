import { ActionForm } from "@/app/_ui/action-form";
import { Card, Field, PageShell } from "@/app/_ui/kit";
import { registerVerify } from "../../actions";

export default function RegisterVerifyPage() {
  return (
    <PageShell title="Enter your code" back={{ href: "/register", label: "Start again" }}>
      <p className="text-slate-600">We sent a six-digit code by SMS. In the demo it arrives in the phone simulator.</p>
      <Card>
        <ActionForm action={registerVerify} submit="Confirm and get my pass">
          <Field label="Six-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="tracking-widest" />
        </ActionForm>
      </Card>
      <a href="/sim" target="_blank" className="text-center text-sm font-semibold text-brand-800">Open the phone simulator</a>
    </PageShell>
  );
}
