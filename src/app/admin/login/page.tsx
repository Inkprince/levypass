import { ActionForm } from "@/app/_ui/action-form";
import { FormShell } from "@/app/_ui/form-shell";
import { Card, Field } from "@/app/_ui/kit";
import { adminLogin } from "../actions";

export default function AdminLogin() {
  return (
    <FormShell scene="admin" title="Revenue office" back={{ href: "/", label: "Home" }}>
      <Card>
        <ActionForm action={adminLogin} submit="Sign in">
          <Field label="Email" name="email" type="email" autoComplete="username" required placeholder="revenue@levypass.test" />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        </ActionForm>
      </Card>
    </FormShell>
  );
}
