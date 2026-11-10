import "server-only";
import { and, eq } from "drizzle-orm";
import { newId } from "@/core/ids";
import { dueObligations, type LevyAssignment } from "@/core/obligations";
import type { Db } from "@/server/db/client";
import { levyTypes, obligations, traderLevies } from "@/server/db/schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function levyAssignments(w: Db | Tx, traderId: string): Promise<(LevyAssignment & { name: string })[]> {
  const rows = await w
    .select({ levyTypeId: levyTypes.id, name: levyTypes.name, period: levyTypes.period, amountKobo: levyTypes.amountKobo, startDate: traderLevies.startDate, exemption: traderLevies.exemption })
    .from(traderLevies)
    .innerJoin(levyTypes, eq(levyTypes.id, traderLevies.levyTypeId))
    .where(and(eq(traderLevies.traderId, traderId), eq(levyTypes.active, true)));
  return rows;
}

/** Creates any obligations owed up to `now` that do not exist yet. Idempotent (unique index). */
export async function ensureObligations(w: Db | Tx, traderId: string, now = new Date()): Promise<void> {
  const rows = (await levyAssignments(w, traderId)).flatMap((a) => dueObligations(a, now));
  if (!rows.length) return;
  await w
    .insert(obligations)
    .values(rows.map((o) => ({ id: newId("obl"), traderId, ...o })))
    .onConflictDoNothing();
}
