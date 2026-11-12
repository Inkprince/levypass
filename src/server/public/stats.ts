import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

/**
 * Usage counts for the public home page. All-time counts only: no naira amounts, no daily figures,
 * no compliance rate and nothing about a single trader or officer. Revenue figures stay behind the
 * revenue office login (`dashboardSummary`).
 */
export type PublicStats = { traders: number; places: number; receipts: number; checks: number };

export async function publicStats(): Promise<PublicStats> {
  const { rows } = await db().execute<{ traders: number; places: number; receipts: number; checks: number }>(sql`
    SELECT
      (SELECT count(*)::int FROM traders WHERE status = 'active') AS traders,
      (SELECT count(*)::int FROM markets) AS places,
      (SELECT count(*)::int FROM receipts) AS receipts,
      (SELECT count(*)::int FROM scans WHERE result IN ('paid', 'not_paid')) AS checks
  `);
  const r = rows[0];
  return { traders: r?.traders ?? 0, places: r?.places ?? 0, receipts: r?.receipts ?? 0, checks: r?.checks ?? 0 };
}
