import { ActionForm } from "@/app/_ui/action-form";
import { Card, Field, LinkButton, PageShell } from "@/app/_ui/kit";
import { IlloFeaturePhone } from "@/app/_ui/illustrations";
import { loginStart } from "../actions";

export default function LoginPage() {
  return (
    <PageShell art={<IlloFeaturePhone />} title="Welcome back" back={{ href: "/", label: "Home" }}>
      <Card>
        <ActionForm action={loginStart} submit="Send my code">
          <Field label="Phone number" name="phone" inputMode="tel" autoComplete="tel" required placeholder="0803 000 0000" />
        </ActionForm>
      </Card>
      <div className="flex items-center gap-3 text-[13px] text-ink-3">
        <span className="h-px flex-1 bg-line" />
        First time here
        <span className="h-px flex-1 bg-line" />
      </div>
      <LinkButton href="/register" variant="outline" size="lg">
        Register as a trader
      </LinkButton>
    </PageShell>
  );
}
