import { redirect } from "next/navigation";
import { Card, Field, Icon, Note, PageShell, buttonClass } from "@/app/_ui/kit";
import { IlloReceipt } from "@/app/_ui/illustrations";

export const metadata = { title: "Check a receipt · LevyPass" };

const target = (raw: unknown) => `/r/${encodeURIComponent(String(raw ?? "").trim() || "-")}`;

async function go(form: FormData) {
  "use server";
  redirect(target(form.get("number")));
}

/** RC-03: anyone can check a receipt number. Also accepts ?number= from the home page form. */
export default async function ReceiptCheck({ searchParams }: { searchParams: Promise<{ number?: string }> }) {
  const { number } = await searchParams;
  if (number !== undefined) redirect(target(number));
  return (
    <PageShell art={<IlloReceipt />} title="Is this receipt genuine?" back={{ href: "/", label: "Home" }}>
      <Card>
        <form action={go} className="flex flex-col gap-4">
          <Field label="Receipt number" name="number" required placeholder="LP-7K3M-9QX2T" autoCapitalize="characters" autoComplete="off" className="font-mono uppercase tracking-wide" />
          <button type="submit" className={buttonClass("primary", "lg", "w-full")}>
            <Icon name="shield" size={18} />
            Check receipt
          </button>
        </form>
      </Card>
      <Note icon="flag">A number LevyPass never issued is reported to the revenue office, so fake receipts stop working.</Note>
    </PageShell>
  );
}
