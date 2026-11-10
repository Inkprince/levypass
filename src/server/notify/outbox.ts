import "server-only";
import { newId } from "@/core/ids";
import type { Db } from "@/server/db/client";
import { outbox } from "@/server/db/schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Writer = Db | Tx;

/** Notifier port, outbox adapter: the SMS is written in the caller's transaction and delivered by the poller. */
export async function queueSms(w: Writer, phone: string, topic: string, text: string, dedupeKey?: string): Promise<void> {
  await w.insert(outbox).values({ id: newId("obx"), kind: "sms", topic, recipient: phone, payload: { text }, dedupeKey }).onConflictDoNothing();
}

export async function queueJob(w: Writer, topic: string, payload: Record<string, unknown>, dedupeKey?: string): Promise<void> {
  await w.insert(outbox).values({ id: newId("obx"), kind: "job", topic, payload, dedupeKey }).onConflictDoNothing();
}
