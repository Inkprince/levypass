import { ActionForm } from "@/app/_ui/action-form";
import { Card, Field, PageShell } from "@/app/_ui/kit";
import { officerLogin } from "../actions";

export default function OfficerLoginPage() {
  return (
    <PageShell title="Officer login">
      <Card>
        <ActionForm action={officerLogin} submit="Log in">
          <Field label="Staff ID" name="staffId" required placeholder="OTT-001" autoCapitalize="characters" />
          <Field label="PIN" name="pin" type="password" inputMode="numeric" required maxLength={8} />
        </ActionForm>
      </Card>
    </PageShell>
  );
}
