import { ActionForm } from "@/app/_ui/action-form";
import { Card, Field, LinkButton, PageShell } from "@/app/_ui/kit";
import { loginStart } from "../actions";

export default function LoginPage() {
  return (
    <PageShell title="Trader login">
      <Card>
        <ActionForm action={loginStart} submit="Send my code">
          <Field label="Phone number" name="phone" inputMode="tel" autoComplete="tel" required placeholder="0803 000 0000" />
        </ActionForm>
      </Card>
      <LinkButton href="/register" variant="secondary">
        New trader? Register
      </LinkButton>
    </PageShell>
  );
}
