import "server-only";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { newId } from "@/core/ids";
import { formatNaira } from "@/core/money";
import { lagosDate } from "@/core/periods";
import { parseStaffIdInput, staffNumberKey, type StaffIdInput } from "@/core/staff-id";
import { getBank } from "@/server/bank";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { errorFields, log } from "@/server/log";
import { queueJob } from "@/server/notify/outbox";
import { answerHandover, askToPayCash, cashCode, traderCash } from "@/server/cash/handovers";
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
      return CON(t(L, "ussd.menu", { stall: trader.stallOrVehicle }));
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
      // The last reply is the one that counts: after an ambiguous number we ask again.
      const typed = rest.at(-1);
      if (typed === undefined) return CON(t(L, "ussd.officer_ask"));
      const input = parseStaffIdInput(typed);
      if (!input) return CON(t(L, "ussd.officer_ask"));
      const matches = await findOfficers(input, trader.marketId);
      if (matches.length > 1) return CON(t(L, "ussd.officer_ask"));
      const o = matches[0];
      if (!o) return END(t(L, "ussd.officer_unknown", { staffId: input.shown }));
      if (o.status === "suspended") {
        await raiseOfficerFlag(o.id, trader.id, "ussd");
        return END(t(L, "ussd.officer_suspended", { staffId: o.staffId, name: o.name }));
      }
      return END(t(L, "ussd.officer_active", { staffId: o.staffId, name: o.name }));
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
      const next = ({ "1": "en", "2": "pcm", "3": "yo", "4": "ig", "5": "ha" } as const)[rest[0] as "1" | "2" | "3" | "4" | "5"];
      if (!next) return END(t(L, "ussd.invalid"));
      await db().update(s.traders).set({ locale: next }).where(eq(s.traders.id, trader.id));
      return END(t(next, "ussd.language_set"));
    }
    case "7": {
      // The no-smartphone trader's way to say "I will pay cash": officers of this market now see them waiting.
      const r = await askToPayCash(trader.id);
      if (!r.ok) return END(t(L, "ussd.owe_nothing"));
      return END(t(L, "ussd.cash_asked", { amount: formatNaira(r.ask.amountKobo), code: cashCode(r.ask.id) }));
    }
    case "8": {
      // The USSD trader's answer to "did you hand this cash to this officer?" (the app asks the same).
      const [h] = (await traderCash(trader.id)).toConfirm;
      if (!h) return END(t(L, "ussd.cash_confirm_none"));
      if (rest[0] === undefined) return CON(t(L, "ussd.cash_confirm_ask", { amount: formatNaira(h.amountKobo), staffId: h.staffId, date: lagosDate(h.recordedAt) }));
      if (rest[0] !== "1" && rest[0] !== "2") return END(t(L, "ussd.invalid"));
      const r = await answerHandover(trader.id, h.id, rest[0] === "1" ? "yes" : "no");
      if (!r.ok) return END(t(L, "ussd.cash_confirm_none"));
      return END(t(L, rest[0] === "1" ? "ussd.cash_confirmed" : "ussd.cash_disputed"));
    }
    default:
      return END(t(L, "ussd.invalid"));
  }
}

/**
 * A full staff ID matches anywhere, ignoring case, spaces and dashes. A bare number matches only
 * officers of the trader's own authority, so "001" cannot land on another council's officer.
 */
async function findOfficers(input: StaffIdInput, traderMarketId: string): Promise<(typeof s.officers.$inferSelect)[]> {
  if (input.kind === "full") {
    return db()
      .select()
      .from(s.officers)
      .where(sql`regexp_replace(upper(${s.officers.staffId}), '[^A-Z0-9]', '', 'g') = ${input.key}`);
  }
  const rows = await db()
    .select({ officer: s.officers })
    .from(s.officers)
    .innerJoin(s.markets, eq(s.markets.authorityId, s.officers.authorityId))
    .where(eq(s.markets.id, traderMarketId));
  return rows.map((r) => r.officer).filter((o) => staffNumberKey(o.staffId) === input.number);
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
