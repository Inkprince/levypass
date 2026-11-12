import { eq } from "drizzle-orm";
import { ActionForm } from "@/app/_ui/action-form";
import { Badge, Button, Card, Icon, Note, PageShell, Select, StatusPanel } from "@/app/_ui/kit";
import { floatAmountsKobo } from "@/core/floats";
import { formatNaira } from "@/core/money";
import { lagosDate } from "@/core/periods";
import { requireSubject } from "@/server/auth/session";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { officerFloat } from "@/server/floats/floats";
import { approveDepositAction, requestFloatAction, startDepositAction } from "../actions";
import { Refresh } from "@/app/_ui/refresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "Advance remittance" };

type Checkout = { ussdCode?: string; transferAccount?: { accountNumber: string; accountName: string; bankName: string }; expiresAt?: string };

const time = (d: Date) => d.toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });

export default async function OfficerAdvancePage() {
  const officerId = await requireSubject("officer");
  const f = await officerFloat(officerId);
  const open = f.open;
  const lastDeclined = !open && f.history[0]?.status === "declined" ? f.history[0] : null;

  let deposit: { id: string; amountKobo: number; status: string; checkout: Checkout } | null = null;
  if (open?.status === "approved" && open.paymentId) {
    const [p] = await db().select().from(s.payments).where(eq(s.payments.id, open.paymentId));
    const checkout = ((p?.providerData as { checkout?: Checkout } | undefined)?.checkout ?? {}) as Checkout;
    const live = p && (p.status === "pending" || p.status === "initiated" || p.status === "unknown") && (!checkout.expiresAt || new Date(checkout.expiresAt) > new Date());
    if (live) deposit = { id: p.id, amountKobo: p.amountKobo, status: p.status, checkout };
  }

  return (
    <PageShell back={{ href: "/officer", label: "Back to scan" }} title="Advance remittance" lead="For traders with no bank. You remit to the government first, then take cash only up to what you remitted. Each cash levy is paid from your advance.">
      {open ? <Refresh /> : null}
      <Card>
        <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Advance</p>
        <p className="money mt-1 text-[44px] leading-none">{formatNaira(f.balanceKobo)}</p>
        <p className="mt-2 text-[13px] text-ink-3">Left to use, already in the government account</p>
        {f.overspentKobo > 0 ? <p className="mt-2 font-semibold text-stop">Over by {formatNaira(f.overspentKobo)}. The revenue office has been told.</p> : null}
      </Card>

      {open?.status === "requested" ? (
        <Note tone="warn" icon="clock">
          <b>{open.label}</b> for {formatNaira(open.amountKobo)} is waiting for the revenue office to approve it.
        </Note>
      ) : null}

      {open?.status === "approved" && !deposit ? (
        <Card>
          <p className="flex items-center gap-2 font-semibold">
            <Icon name="check" size={18} className="text-go" />
            {open.label} approved by the revenue office
          </p>
          <p className="mt-1 text-[14px] text-ink-2">Pay {formatNaira(open.amountKobo)} into the government account. Your advance starts when the bank confirms it.</p>
          <form action={startDepositAction} className="mt-4">
            <input type="hidden" name="floatId" value={open.id} />
            <Button className="w-full" size="lg">
              Pay in {formatNaira(open.amountKobo)}
            </Button>
          </form>
        </Card>
      ) : null}

      {deposit ? (
        <Card>
          <div className="flex items-center gap-3 rounded-2xl bg-warn-bg px-4 py-3 text-warn-fg" role="status">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-warn-fg/30 border-t-warn-fg" aria-hidden="true" />
            <span className="text-[15px] font-semibold">Waiting for the bank to confirm {formatNaira(deposit.amountKobo)}</span>
          </div>
          {deposit.checkout.ussdCode ? (
            <>
              <p className="mt-4 text-[14px] text-ink-2">Dial on your phone and approve with your bank PIN:</p>
              <p className="mt-1 rounded-xl bg-mist px-4 py-3 text-center font-mono text-[26px] font-bold tracking-wide">{deposit.checkout.ussdCode}</p>
            </>
          ) : null}
          {deposit.checkout.transferAccount ? (
            <p className="mt-3 text-[14px] text-ink-2">
              Or transfer to <b className="font-mono text-ink">{deposit.checkout.transferAccount.accountNumber}</b>, {deposit.checkout.transferAccount.accountName}, {deposit.checkout.transferAccount.bankName}. At the revenue office, the cashier can pay it in for you.
            </p>
          ) : null}
          <form action={approveDepositAction} className="mt-4">
            <input type="hidden" name="paymentId" value={deposit.id} />
            <Button variant="outline" className="w-full" type="submit">
              Sandbox: approve this USSD payment
            </Button>
          </form>
        </Card>
      ) : null}

      {!open ? (
        <Card>
          <p className="font-semibold">{f.balanceKobo > 0 ? "Request another advance remittance" : "Request an advance remittance"}</p>
          {lastDeclined ? (
            <p className="mt-1 text-[14px] text-stop">
              {lastDeclined.label} was declined{lastDeclined.declineReason ? `: ${lastDeclined.declineReason}` : "."}
            </p>
          ) : null}
          <div className="mt-3">
            <ActionForm action={requestFloatAction} submit="Send request">
              <Select label="Amount" name="amountKobo" defaultValue={String(floatAmountsKobo[1])}>
                {floatAmountsKobo.map((k) => (
                  <option key={k} value={k}>
                    {formatNaira(k)}
                  </option>
                ))}
              </Select>
            </ActionForm>
          </div>
        </Card>
      ) : null}

      {f.statements.length ? <h2 className="mt-2 text-[18px] font-semibold">Each remittance, accounted for</h2> : null}
      {f.statements.map((st) => (
        <Card key={st.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[14px] font-semibold">{st.label}</p>
              <p className="text-[13px] text-ink-3">
                Remitted {lagosDate(st.loadedAt)} {time(st.loadedAt)}
              </p>
            </div>
            <Badge tone={st.usedUp ? "neutral" : "paid"}>{st.usedUp ? "used up" : "in use"}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
            <p>
              <span className="block text-ink-3">Remitted</span>
              <b className="tnum">{formatNaira(st.amountKobo)}</b>
            </p>
            <p>
              <span className="block text-ink-3">Cash taken</span>
              <b className="tnum">{formatNaira(st.usedKobo)}</b>
            </p>
            <p>
              <span className="block text-ink-3">Left</span>
              <b className="tnum">{formatNaira(st.remainingKobo)}</b>
            </p>
          </div>
          {st.lines.length ? (
            <ul className="mt-3 divide-y divide-line border-t border-line text-[14px]">
              {st.lines.map((l) => (
                <li key={`${l.paymentId}-${l.amountKobo}`} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {l.traderName}, stall {l.stall}
                    </span>
                    <span className="block font-mono text-[12px] text-ink-3">
                      {l.receipt} · {time(l.at)}
                    </span>
                  </span>
                  <b className="tnum shrink-0">{formatNaira(l.amountKobo)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-ink-3">No cash taken against this remittance yet.</p>
          )}
        </Card>
      ))}
      {f.statements.length === 0 && !open ? <StatusPanel tone="neutral" word="No advance yet" sub="Without an advance you cannot take cash. Traders can still pay by USSD, transfer or card." /> : null}
    </PageShell>
  );
}
