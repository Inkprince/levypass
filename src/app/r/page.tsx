import { redirect } from "next/navigation";
import { Button, Card, Field, PageShell } from "@/app/_ui/kit";

export const metadata = { title: "Check a receipt · LevyPass" };

async function go(form: FormData) {
  "use server";
  redirect(`/r/${encodeURIComponent(String(form.get("number") ?? "").trim() || "-")}`);
}

/** RC-03: anyone can check a receipt number. */
export default function ReceiptCheck() {
  return (
    <PageShell title="Is this receipt genuine?">
      <Card>
        <form action={go} className="flex flex-col gap-4">
          <Field label="Receipt number" name="number" required placeholder="LP-7K3M-9QX2T" autoCapitalize="characters" />
          <Button type="submit">Check receipt</Button>
        </form>
      </Card>
    </PageShell>
  );
}
