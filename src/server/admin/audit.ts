import "server-only";
import { newId } from "@/core/ids";
import { db } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";

/** AD-07: every admin action is recorded with before and after. */
export async function audit(actorId: string, action: string, targetType: string, targetId: string, before: unknown, after: unknown): Promise<void> {
  await db().insert(auditLog).values({ id: newId("aud"), actorType: "admin", actorId, action, targetType, targetId, before: (before ?? null) as object, after: (after ?? null) as object });
}
