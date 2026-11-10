import { ActionForm } from "@/app/_ui/action-form";
import { Card, Field, PageShell } from "@/app/_ui/kit";
import { loginVerify } from "../../actions";

export default function LoginVerifyPage() {
  return (
    <PageShell title="Enter your code" back={{ href: "/login", label: "Start again" }}>
      <Card>
        <ActionForm action={loginVerify} submit="Log in">
          <Field label="Six-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
        </ActionForm>
      </Card>
      <a href="/sim" target="_blank" className="text-center text-sm font-semibold text-brand-800">Open the phone simulator</a>
    </PageShell>
  );
}
