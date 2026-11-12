import { formatNaira } from "@/core/money";
import { lagosDate } from "@/core/periods";
import { Badge, Button, Card, CardTitle, Icon, Mark, Note, PageShell } from "@/app/_ui/kit";
import { Refresh } from "@/app/_ui/refresh";
import { requireSubject } from "@/server/auth/session";
import { traderReports } from "@/server/admin/cases";
import { traderCash } from "@/server/cash/handovers";
import { recentReceipts, traderStatus } from "@/server/levy/status";
import { qrSvg, traderPassUrl } from "@/server/qr";
import { answerCash, askCash, cancelCash, payNow, traderLogout } from "../actions";

export const dynamic = "force-dynamic";

/** "10:42" today, or "11 Nov, 10:42" on another day, in Lagos time. */
function lagosWhen(d: Date): string {
  const time = d.toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });
  return lagosDate(d) === lagosDate(new Date()) ? `today at ${time}` : `${d.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short" })} at ${time}`;
}

export default async function PassPage({ searchParams }: { searchParams: Promise<{ welcome?: string; cash?: string; disputed?: string }> }) {
  const traderId = await requireSubject("trader");
  const status = await traderStatus(traderId);
  if (!status) return null;
  const { trader } = status;
  const url = await traderPassUrl(trader.id, trader.qrTokenId);
  const svg = await qrSvg(url);
  const receipts = await recentReceipts(trader.id);
  const cash = await traderCash(trader.id);
  const reports = await traderReports(trader.id);
  const { welcome, cash: cashError, disputed } = await searchParams;
  const paid = status.paidNow;
  // The trader's cash code: shown while a request to pay cash is open, whether they asked or an officer started it.
  const codeCard = cash.waiting ? (
    <div className="mt-4 rounded-2xl bg-warn-bg p-4 text-warn-fg" role="status">
      <p className="flex items-center gap-2 text-[15px] font-bold">
        <Icon name="clock" size={18} />
        {cash.waiting.officerId ? "An officer is taking your cash" : "Waiting for an officer"}
      </p>
      <p className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-ink-2">Your cash code</p>
      <p className="font-mono text-[40px] font-bold leading-none tracking-[0.3em] text-ink" aria-label={`Cash code ${cash.waiting.code.split("").join(" ")}`}>
        {cash.waiting.code}
      </p>
      <p className="mt-3 text-[14px] leading-snug text-ink">
        Hand <b className="tnum">{formatNaira(cash.waiting.amountKobo)}</b> cash to the officer standing in front of you, then tell them this code. Check their officer ID first. Never send the code to anyone. The receipt comes by SMS and shows on this page. No receipt means you have not paid.
      </p>
      <form action={cancelCash} className="mt-2">
        <button className="min-h-11 rounded-full px-1 text-[14px] font-semibold text-ink-2 underline underline-offset-4 hover:text-ink">I will not pay cash</button>
      </form>
    </div>
  ) : null;

  return (
    <PageShell>
      {/* Officers and the bank change this page from elsewhere: a cash levy, a USSD payment. Keep it current. */}
      <Refresh every={5000} />
      {disputed ? (
        <Note tone="warn" icon="flag">
          Thank you. The revenue office has your report and will look into this cash payment with the officer.
        </Note>
      ) : null}
      {cashError ? (
        <Note tone="warn" icon="alert">
          {cashError}
        </Note>
      ) : null}
      {cash.toConfirm.map((h) => (
        <section key={h.id} className="animate-rise rounded-[var(--radius-card)] border-2 border-warn bg-paper p-5" aria-label="Confirm a cash payment">
          <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-warn-fg">
            <Icon name="receipt" size={17} />
            Cash payment recorded
          </p>
          <p className="mt-2 text-[17px] font-semibold leading-snug">
            Did you hand <span className="tnum">{formatNaira(h.amountKobo)}</span> cash to {h.officerName} <span className="whitespace-nowrap font-mono text-[15px]">({h.staffId})</span> {lagosWhen(h.recordedAt)}?
          </p>
          {h.receipt ? (
            <p className="mt-1 text-[14px] text-ink-2">
              Receipt{" "}
              <a href={`/r/${h.receipt}`} className="font-mono font-semibold text-forest hover:underline">
                {h.receipt}
              </a>
            </p>
          ) : null}
          <form action={answerCash} className="mt-4 flex gap-2">
            <input type="hidden" name="handoverId" value={h.id} />
            <Button name="answer" value="yes" type="submit" className="flex-1">
              Yes, I paid
            </Button>
            <Button name="answer" value="no" type="submit" variant="outline" className="flex-1">
              No, I did not
            </Button>
          </form>
        </section>
      ))}
      {welcome ? (
        <Note tone="go" icon="check">
          Welcome to LevyPass. Your pass is ready. Show this QR code to any officer.
        </Note>
      ) : null}

      {/* The pass itself: what an officer looks at. */}
      <section className="animate-rise overflow-hidden rounded-[28px] bg-forest text-white shadow-[0_24px_60px_-30px_rgb(12_28_21/0.55)]">
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div className="min-w-0">
            <p className="text-[13px] text-white/65">{trader.market}</p>
            <p className="mt-1 truncate text-[24px] font-bold tracking-[-0.03em]">{trader.name}</p>
            <p className="text-[14px] text-white/75">
              Stall {trader.stallOrVehicle}, {trader.businessType}
            </p>
          </div>
          <Mark size={34} tone="lime" />
        </div>
        <div className="mx-4 mb-4 mt-6 rounded-[22px] bg-paper p-5 text-ink">
          <div className={`mb-4 flex items-center justify-center gap-2 rounded-full py-2 text-[14px] font-bold uppercase tracking-wide ${paid ? "bg-go-bg text-go-fg" : "bg-stop-bg text-stop-fg"}`}>
            <Icon name={paid ? "check" : "x"} size={18} />
            {paid ? "Paid today" : "Not paid today"}
          </div>
          <div className="mx-auto w-full max-w-[240px] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-3 text-center font-mono text-[12px] text-ink-3">{trader.id}</p>
        </div>
        <a href="/pass/card" className="mx-4 mb-4 flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/10 text-[14px] font-semibold hover:bg-white/15">
          <Icon name="print" size={17} />
          Print my card or stall sticker
        </a>
      </section>

      <Card>
        <CardTitle>{status.owedKobo > 0 ? "What you owe" : "All paid up"}</CardTitle>
        {status.owedKobo > 0 ? (
          <>
            <p className="money text-[40px] leading-none text-stop-fg">{formatNaira(status.owedKobo)}</p>
            <form action={payNow} className="mt-5">
              <Button className="w-full" size="lg" type="submit">
                Pay {formatNaira(status.owedKobo)} now
              </Button>
            </form>
            {codeCard ?? (
              <form action={askCash} className="mt-2">
                <Button variant="outline" size="lg" className="w-full" type="submit">
                  <Icon name="receipt" size={18} />
                  Pay cash to an officer
                </Button>
              </form>
            )}
          </>
        ) : (
          <>
            <p className="text-[15px] text-ink-2">Nothing is due right now. Thank you.</p>
            <form action={payNow} className="mt-5">
              <input type="hidden" name="amountKobo" value={status.nextKobo} />
              <input type="hidden" name="purpose" value="ahead" />
              <Button variant="secondary" size="lg" className="w-full" type="submit">
                Pay ahead {formatNaira(status.nextKobo)}
              </Button>
            </form>
            {codeCard}
          </>
        )}
        <ul className="mt-5 divide-y divide-line border-t border-line text-[15px]">
          {status.current.map((c) => (
            <li key={c.levy} className="flex items-center justify-between gap-3 py-3 last:pb-0">
              <span className="min-w-0">
                {c.levy} <span className="text-ink-3">{c.period}</span>
              </span>
              <Badge tone={c.status === "paid" ? "paid" : c.status === "part_paid" ? "warn" : "unpaid"}>{c.status.replace("_", " ")}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Recent receipts</CardTitle>
        {receipts.length ? (
          <ul className="divide-y divide-line text-[15px]">
            {receipts.map((r) => (
              <li key={r.id} className="first:pt-0 last:pb-0">
                <a href={`/r/${r.number}`} className="flex items-center justify-between gap-3 py-3 hover:text-forest">
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mist-2 text-forest">
                      <Icon name="receipt" size={17} />
                    </span>
                    <span className="leading-tight">
                      <span className="block font-mono text-[13px] font-semibold">{r.number}</span>
                      <span className="text-[13px] text-ink-3">
                        {lagosDate(r.issuedAt)}
                        {r.cashStaffId ? `, cash to ${r.cashStaffId}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="font-semibold tnum">{formatNaira(r.amountKobo)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-ink-3">No receipts yet. Your first one arrives by SMS when you pay.</p>
        )}
      </Card>

      {reports.length ? (
        <Card>
          <CardTitle>Your reports</CardTitle>
          <ul className="divide-y divide-line text-[15px]">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <span className="min-w-0 leading-tight">
                  <span className="block">{r.what === "cash" ? "Cash I did not pay" : "Report about a collector"}</span>
                  <span className="text-[13px] text-ink-3">
                    <span className="font-mono">{r.ref}</span>, {lagosDate(r.at)}
                  </span>
                </span>
                <Badge tone={r.status === "open" ? "warn" : r.status === "resolved" ? "paid" : "neutral"}>{r.status === "open" ? "being looked at" : r.status === "resolved" ? "dealt with" : "no problem found"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="flex items-start justify-center gap-2 text-center text-[14px] text-ink-2">
        <Icon name="phone" size={17} className="mt-0.5 shrink-0 text-forest" />
        <span>
          No smartphone? Dial <span className="whitespace-nowrap font-mono font-semibold text-ink">*347*13#</span> from any phone to pay.
        </span>
      </p>
      <form action={traderLogout} className="text-center">
        <button className="rounded-full px-4 py-2 text-[14px] font-semibold text-ink-3 hover:bg-fill hover:text-ink">Log out</button>
      </form>
    </PageShell>
  );
}
