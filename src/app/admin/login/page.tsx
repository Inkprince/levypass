import { ActionForm } from "@/app/_ui/action-form";
import { Card, Field, PageShell } from "@/app/_ui/kit";
import { IlloGovernment } from "@/app/_ui/illustrations";
import { adminLogin } from "../actions";

export default function AdminLogin() {
  return (
    <PageShell art={<IlloGovernment />} title="Revenue office" lead="Sign in to see collections, reconciliation and the fraud queue." back={{ href: "/", label: "Home" }}>
      <Card>
        <ActionForm action={adminLogin} submit="Sign in">
          <Field label="Email" name="email" type="email" autoComplete="username" required placeholder="revenue@levypass.test" />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        </ActionForm>
      </Card>
    </PageShell>
  );
}
