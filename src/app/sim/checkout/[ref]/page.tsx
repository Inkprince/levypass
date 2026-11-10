import { redirect } from "next/navigation";
import { getBank } from "@/server/bank";
import { Button, Card, PageShell } from "@/app/_ui/kit";

export const dynamic = "force-dynamic";

// Local stand-in for the bank's hosted checkout page (pay.xtradot.co) when BANK_ADAPTER=fake.
export default async function FakeCheckout({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  async function pay() {
    "use server";
    await getBank().simulateTransfer(ref);
    redirect(`/pay/return?reference=${encodeURIComponent(ref)}&status=successful`);
  }
  return (
    <PageShell title="Xtradot Bank checkout (sandbox)">
      <Card>
        <p className="text-sm text-slate-600">Test card 5399 8300 0000 0008, any future expiry, CVV 123, OTP 123456.</p>
        <form action={pay} className="mt-4">
          <Button className="w-full" type="submit">
            Pay now
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
