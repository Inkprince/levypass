import { redirect } from "next/navigation";
import { Card, Note, PageShell } from "@/app/_ui/kit";
import { IlloReceipt } from "@/app/_ui/illustrations";
import { ReceiptSearch } from "./receipt-search";

export const metadata = { title: "Check a receipt" };

const target = (raw: unknown) => `/r/${encodeURIComponent(String(raw ?? "").trim() || "-")}`;

/** RC-03: anyone can check a receipt number. Also accepts ?number= from the home page form. */
export default async function ReceiptCheck({ searchParams }: { searchParams: Promise<{ number?: string }> }) {
  const { number } = await searchParams;
  if (number !== undefined) redirect(target(number));
  return (
    <PageShell art={<IlloReceipt />} title="Check that a receipt is genuine" back={{ href: "/", label: "Home" }}>
      <Card>
        <ReceiptSearch variant="card" />
      </Card>
      <Note icon="flag">LevyPass reports any receipt number it never issued to the revenue office.</Note>
    </PageShell>
  );
}
