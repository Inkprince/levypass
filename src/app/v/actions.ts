"use server";

import { headers } from "next/headers";
import { newId } from "@/core/ids";
import { db } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { queueJob } from "@/server/notify/outbox";
import { allow, clientIp } from "@/server/ratelimit";

/** FR-04: a trader reports a collector, from the officer ID page. Triage runs in the background (T20). */
export async function reportCollector(_: { error?: string; done?: string }, form: FormData): Promise<{ error?: string; done?: string }> {
  if (!allow(`complaint:${clientIp(await headers())}`, 5, 600_000)) return { error: "Too many reports from this phone. Try again later." };
  const description = String(form.get("description") ?? "").trim();
  if (description.length < 10) return { error: "Tell us a little more: who, where and how much." };
  const officerId = String(form.get("officerId") ?? "") || null;
  const id = newId("cmp");
  await db().insert(s.complaints).values({ id, officerId, collectorDescription: String(form.get("collector") ?? "") || null, description: description.slice(0, 1000) });
  await queueJob(db(), "job.triage_complaint", { complaintId: id }, `triage:${id}`);
  return { done: id.slice(-6).toUpperCase() };
}
