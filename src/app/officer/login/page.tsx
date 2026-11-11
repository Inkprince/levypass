import { ActionForm } from "@/app/_ui/action-form";
import { Card, Field, PageShell } from "@/app/_ui/kit";
import { IlloBadge } from "@/app/_ui/illustrations";
import { officerLogin } from "../actions";

export default function OfficerLoginPage() {
  return (
    <PageShell art={<IlloBadge />} title="Officer sign in" lead="Use the staff ID and PIN issued by the revenue office." back={{ href: "/", label: "Home" }}>
      <Card>
        <ActionForm action={officerLogin} submit="Sign in">
          <Field label="Staff ID" name="staffId" required placeholder="OTT-001" autoCapitalize="characters" className="font-mono uppercase" />
          <Field label="PIN" name="pin" type="password" inputMode="numeric" required maxLength={8} className="font-mono tracking-[0.3em]" />
        </ActionForm>
      </Card>
    </PageShell>
  );
}
