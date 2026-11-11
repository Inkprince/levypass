"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { parseReceiptNumber } from "@/core/receipts";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { allow, clientIp } from "@/server/ratelimit";

/**
 * Answers "does this receipt exist?" for the search animation, so its check or cross is the
 * real answer. The result page still does the full check and raises the fraud flag (FR-02).
 */
export async function lookupReceipt(typed: string): Promise<{ found: boolean | null; href: string }> {
  const clean = String(typed ?? "").trim().slice(0, 40);
  const href = `/r/${encodeURIComponent(clean || "-")}`;
  if (!allow(`rq:${clientIp(await headers())}`, 30, 60_000)) return { found: null, href };
  const number = parseReceiptNumber(clean);
  if (!number) return { found: false, href };
  const [r] = await db().select({ n: s.receipts.number }).from(s.receipts).where(eq(s.receipts.number, number)).limit(1);
  return { found: Boolean(r), href };
}
