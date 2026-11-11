import { redirect } from "next/navigation";
import { getBank } from "@/server/bank";
import { Button, Card, Note, PageShell, Rows } from "@/app/_ui/kit";

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
    <PageShell title="Card checkout" lead="Xtradot Bank sandbox. This page stands in for the bank's hosted checkout.">
      <Card>
        <Rows rows={[["Test card", <span key="n" className="font-mono">5399 8300 0000 0008</span>], ["Expiry", "Any future date"], ["CVV", <span key="c" className="font-mono">123</span>], ["OTP", <span key="o" className="font-mono">123456</span>]]} />
        <form action={pay} className="mt-6">
          <Button className="w-full" size="lg" type="submit">
            Pay now
          </Button>
        </form>
      </Card>
      <Note icon="lock">Reference <span className="font-mono">{ref}</span>. LevyPass marks nothing paid until it verifies this payment with the bank.</Note>
    </PageShell>
  );
}
