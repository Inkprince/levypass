import "server-only";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { newId } from "@/core/ids";
import { formatNaira } from "@/core/money";
import { lagosDate } from "@/core/periods";
import { getBank } from "@/server/bank";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { errorFields, log } from "@/server/log";
import { queueJob } from "@/server/notify/outbox";
import { amountOwed, startPayment } from "@/server/payments/start";
import { normalisePhone } from "@/server/phone";
import { env } from "@/server/env";
import { t, isLocale, type Locale } from "@/messages";

// POST /api/ussd in the Africa's Talking shape: sessionId, phoneNumber, text ("1*2*...").
// The reply starts with CON (session continues) or END (session closes).

const CON = (x: string) => `CON ${x}`;
const END = (x: string) => `END ${x}`;

export async function ussdReply(input: { phoneNumber: string; text: string }): Promise<string> {
  const phone = normalisePhone(input.phoneNumber) ?? input.phoneNumber;
  const [trader] = await db().select().from(s.traders).where(eq(s.traders.phone, phone));
  if (!trader) return END(t("en", "ussd.not_registered", { url: env().PUBLIC_BASE_URL }));
  const L: Locale = isLocale(trader.locale) ? trader.locale : "en";
  const steps = input.text === "" ? [] : input.text.split("*");
  const [choice, ...rest] = steps;

  switch (choice) {
    case undefined:
      return CON(t(L, "ussd.menu"));
    case "1": {
      const owed = await amountOwed(trader.id);
      const amount = owed.totalKobo > 0 ? owed.totalKobo : owed.nextKobo;
      const what = owed.totalKobo > 0 ? t(L, "ussd.pay_what_owed") : t(L, "ussd.pay_what_ahead", { levy: owed.nextLevy });
      if (rest[0] === undefined) return CON(t(L, "ussd.pay_choose", { amount: formatNaira(amount), what }));
      if (rest[0] !== "1") return END(t(L, "ussd.cancelled"));
      try {
        const p = await startPayment({ traderId: trader.id, channel: "ussd", amountKobo: amount, purpose: owed.totalKobo > 0 ? "owed" : "ahead" });
        // Sandbox: the bank's USSD approval is simulated (PY-03). Real life: the bank prompts for the PIN.
        if (p.status === "pending") await getBank().simulateUssd(p.reference);
        return END(t(L, "ussd.pay_started", { amount: formatNaira(amount) }));
      } catch (error) {
        log("warn", "ussd.pay_failed", errorFields(error));
        return END(t(L, "ussd.pay_failed"));
      }
    }
    case "2": {
      const owed = await amountOwed(trader.id);
      if (owed.totalKobo === 0) return END(t(L, "ussd.owe_nothing"));
      const lines = owed.lines.slice(0, 4).map((l) => `${l.levy} ${lagosDate(l.periodStart)}: ${formatNaira(l.owedKobo)}`).join("\n");
      return END(t(L, "ussd.owe", { amount: formatNaira(owed.totalKobo), lines }));
    }
    case "3": {
      const [r] = await db().select().from(s.receipts).where(eq(s.receipts.traderId, trader.id)).orderBy(desc(s.receipts.issuedAt)).limit(1);
      return END(r ? t(L, "ussd.last_receipt", { number: r.number, amount: formatNaira(r.amountKobo), date: lagosDate(r.issuedAt) }) : t(L, "ussd.no_receipt"));
    }
    case "4": {
      if (rest[0] === undefined) return CON(t(L, "ussd.officer_ask"));
      const staffId = rest.join("*").trim().toUpperCase();
      const [o] = await db().select().from(s.officers).where(eq(s.officers.staffId, staffId));
      if (!o) return END(t(L, "ussd.officer_unknown", { staffId }));
      if (o.status === "suspended") {
        await raiseOfficerFlag(o.id, trader.id, "ussd");
        return END(t(L, "ussd.officer_suspended", { staffId, name: o.name }));
      }
      return END(t(L, "ussd.officer_active", { staffId, name: o.name }));
    }
    case "5": {
      if (rest[0] === undefined) return CON(t(L, "ussd.report_ask"));
      const id = newId("cmp");
      await db().insert(s.complaints).values({ id, reporterTraderId: trader.id, description: rest.join("*").slice(0, 1000) });
      await queueJob(db(), "job.triage_complaint", { complaintId: id }, `triage:${id}`);
      return END(t(L, "ussd.report_done", { id: id.slice(-6).toUpperCase() }));
    }
    case "6": {
      if (rest[0] === undefined) return CON(t(L, "ussd.language"));
      const next = ({ "1": "en", "2": "pcm", "3": "yo" } as const)[rest[0] as "1" | "2" | "3"];
      if (!next) return END(t(L, "ussd.invalid"));
      await db().update(s.traders).set({ locale: next }).where(eq(s.traders.id, trader.id));
      return END(t(next, "ussd.language_set"));
    }
    default:
      return END(t(L, "ussd.invalid"));
  }
}

/** FR-03: a suspended officer still presenting their ID. One open flag per officer per hour. */
export async function raiseOfficerFlag(officerId: string, traderId: string | null, via: string): Promise<void> {
  const recent = await db()
    .select({ id: s.fraudFlags.id })
    .from(s.fraudFlags)
    .where(and(eq(s.fraudFlags.officerId, officerId), eq(s.fraudFlags.type, "suspended_officer_scan"), gt(s.fraudFlags.createdAt, sql`now() - interval '1 hour'`)));
  if (recent.length) return;
  await db().insert(s.fraudFlags).values({ id: newId("flg"), type: "suspended_officer_scan", officerId, traderId, details: { via } });
}
