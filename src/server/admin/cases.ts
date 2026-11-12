import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { queueSms } from "@/server/notify/outbox";
import { t, isLocale } from "@/messages";

// AD-04 closes a flag, complaint or review item. When a trader raised it (a complaint, or "No, I did
// not" on cash an officer recorded), the trader hears back by SMS and on their pass page.

export type CaseKind = "flag" | "complaint" | "review";
export type CaseStatus = "resolved" | "dismissed";

/** The reference a trader was given: the last six characters of a complaint ID, as the USSD reply shows it. */
export const complaintRef = (id: string) => id.slice(-6).toUpperCase();

/** Closes an open case once. Returns false when it was already closed, so a double click sends one SMS. */
export async function closeCase(adminId: string, kind: CaseKind, id: string, status: CaseStatus): Promise<boolean> {
  return db().transaction(async (tx) => {
    const table = kind === "flag" ? s.fraudFlags : kind === "complaint" ? s.complaints : s.reviewItems;
    const done = await tx
      .update(table)
      .set({ status, resolvedAt: new Date(), resolvedBy: adminId })
      .where(and(eq(table.id, id), eq(table.status, "open")))
      .returning({ id: table.id });
    if (!done.length) return false;

    let traderId: string | null = null;
    let ref = "";
    if (kind === "complaint") {
      const [c] = await tx.select({ traderId: s.complaints.reporterTraderId }).from(s.complaints).where(eq(s.complaints.id, id));
      traderId = c?.traderId ?? null;
      ref = complaintRef(id);
    } else if (kind === "flag") {
      const [f] = await tx.select({ type: s.fraudFlags.type, traderId: s.fraudFlags.traderId, receipt: s.fraudFlags.receiptNumber }).from(s.fraudFlags).where(eq(s.fraudFlags.id, id));
      // Only a cash dispute was raised by the trader; other flags are LevyPass's own checks.
      if (f?.type === "cash_disputed") {
        traderId = f.traderId;
        ref = f.receipt ?? complaintRef(id);
      }
    }
    if (traderId) {
      const [tr] = await tx.select({ phone: s.traders.phone, locale: s.traders.locale }).from(s.traders).where(eq(s.traders.id, traderId));
      if (tr) {
        const locale = isLocale(tr.locale) ? tr.locale : "en";
        const key = status === "resolved" ? "sms.report_resolved" : "sms.report_dismissed";
        await queueSms(tx, tr.phone, key, t(locale, key, { ref, ussd: "*347*13#" }), `case:${id}`);
      }
    }
    return true;
  });
}

export type TraderReport = { id: string; ref: string; what: "complaint" | "cash"; status: "open" | "resolved" | "dismissed"; at: Date };

/** The trader's own reports and where each stands, newest first. Our database only. */
export async function traderReports(traderId: string, limit = 5): Promise<TraderReport[]> {
  const complaints = await db()
    .select({ id: s.complaints.id, status: s.complaints.status, at: s.complaints.createdAt })
    .from(s.complaints)
    .where(eq(s.complaints.reporterTraderId, traderId))
    .orderBy(desc(s.complaints.createdAt))
    .limit(limit);
  const disputes = await db()
    .select({ id: s.fraudFlags.id, status: s.fraudFlags.status, at: s.fraudFlags.createdAt, receipt: s.fraudFlags.receiptNumber })
    .from(s.fraudFlags)
    .where(and(eq(s.fraudFlags.traderId, traderId), eq(s.fraudFlags.type, "cash_disputed")))
    .orderBy(desc(s.fraudFlags.createdAt))
    .limit(limit);
  return [
    ...complaints.map((c) => ({ id: c.id, ref: complaintRef(c.id), what: "complaint" as const, status: c.status, at: c.at })),
    ...disputes.map((d) => ({ id: d.id, ref: d.receipt ?? complaintRef(d.id), what: "cash" as const, status: d.status, at: d.at })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}
