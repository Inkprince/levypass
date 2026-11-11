import { ActionForm } from "@/app/_ui/action-form";
import { FormShell } from "@/app/_ui/form-shell";
import { Card, Field } from "@/app/_ui/kit";
import { officerLogin } from "../actions";

export default function OfficerLoginPage() {
  return (
    <FormShell scene="officer" title="Officer sign in" back={{ href: "/", label: "Home" }}>
      <Card>
        <ActionForm action={officerLogin} submit="Sign in">
          <Field label="Staff ID" name="staffId" required placeholder="OTT-001" autoCapitalize="characters" className="font-mono uppercase" />
          <Field label="PIN" name="pin" type="password" inputMode="numeric" required maxLength={8} className="font-mono tracking-[0.3em]" />
        </ActionForm>
      </Card>
    </FormShell>
  );
}
