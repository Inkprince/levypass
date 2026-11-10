import { ActionForm } from "@/app/_ui/action-form";
import { Card, Field, PageShell } from "@/app/_ui/kit";
import { adminLogin } from "../actions";

export default function AdminLogin() {
  return (
    <PageShell title="Revenue office login">
      <Card>
        <ActionForm action={adminLogin} submit="Log in">
          <Field label="Email" name="email" type="email" autoComplete="username" required placeholder="revenue@levypass.test" />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        </ActionForm>
      </Card>
    </PageShell>
  );
}
