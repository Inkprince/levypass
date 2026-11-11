import "server-only";
import { and, asc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { REQUERY_FIRST_MS, REQUERY_GIVE_UP_MS, requeryDue } from "@/core/requery";
import { db, pool } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { errorFields, log } from "@/server/log";
import { settlePayment } from "@/server/payments/settle";
import { ensureWebhook } from "@/server/payments/webhook-setup";
import { triageComplaint } from "@/server/ai/triage";
import { ensureObligations } from "@/server/levy/obligations";
import { env } from "@/server/env";
import { ensureDemoData } from "./self-heal";

// In-process poller (plan: no Redis). One replica, so one loop. Every tick:
// 0. with AUTO_SEED=on, rebuild an emptied database, 1. self-heal the webhook, 2. requery payments still pending or unknown (PY-04, rule 5),
// 3. deliver queued SMS to the simulator inbox, 4. run queued jobs (AI triage).

const g = globalThis as unknown as { levypassPoller?: { timer: NodeJS.Timeout; running: boolean } };

export function startPoller(intervalMs = 8_000): void {
  if (g.levypassPoller) return;
  const state = { running: false, timer: setInterval(() => void tick(), intervalMs) };
  g.levypassPoller = state;
  setTimeout(() => void tick(), 1_500);
  log("info", "poller.started", { interval_ms: intervalMs });
}

export async function tick(): Promise<void> {
  const state = g.levypassPoller;
  if (state?.running) return;
  if (state) state.running = true;
  try {
    await healDemoData();
    await ensureWebhook().catch((e) => log("warn", "poller.webhook_heal_failed", errorFields(e)));
    await requeryPayments();
    await refreshObligations();
    await deliverSms();
    await runJobs();
  } catch (error) {
    log("error", "poller.tick_failed", errorFields(error));
  } finally {
    if (state) state.running = false;
  }
}

async function healDemoData(): Promise<void> {
  const e = env();
  if (e.AUTO_SEED !== "on") return;
  await ensureDemoData(pool(), {
    migrationsFolder: e.MIGRATIONS_DIR,
    adminPassword: e.SEED_ADMIN_PASSWORD,
    officerPin: e.SEED_OFFICER_PIN,
    publicBaseUrl: e.PUBLIC_BASE_URL,
    production: e.NODE_ENV === "production",
  });
}

/**
 * Asks the bank about payments that are not final yet and settles the ones it confirms.
 * How often each one is asked depends on its age (src/core/requery.ts). Whatever the answer, the
 * payment goes to the back of the queue, so one that keeps failing cannot hold up the rest.
 */
export async function requeryPayments(limit = 4): Promise<number> {
  const now = Date.now();
  const open = await db()
    .select({ id: s.payments.id, createdAt: s.payments.createdAt, updatedAt: s.payments.updatedAt })
    .from(s.payments)
    .where(
      and(
        inArray(s.payments.status, ["initiated", "pending", "unknown"]),
        isNull(s.payments.settledAt),
        lt(s.payments.createdAt, new Date(now - REQUERY_FIRST_MS)),
        gt(s.payments.createdAt, new Date(now - REQUERY_GIVE_UP_MS)),
        sql`${s.payments.provider} <> 'seed'`,
      ),
    )
    .orderBy(asc(s.payments.updatedAt))
    .limit(200);
  const due = open.filter((p) => requeryDue({ ageMs: now - p.createdAt.getTime(), sinceLastTryMs: now - p.updatedAt.getTime() })).slice(0, limit);
  for (const p of due) {
    try {
      const outcome = await settlePayment(p.id);
      if (outcome.kind === "settled") log("info", "poller.settled", { payment_id: p.id, via: "requery" });
    } catch (error) {
      log("warn", "poller.requery_failed", { payment_id: p.id, ...errorFields(error) });
    } finally {
      // updated_at doubles as "last asked". Best effort: a failure here must not stop the others.
      await db().update(s.payments).set({ updatedAt: sql`now()` }).where(eq(s.payments.id, p.id)).catch(() => undefined);
    }
  }
  return due.length;
}

let lastRefresh = 0;
/** Keeps every active trader's obligations current (new Lagos day), so compliance is accurate. */
async function refreshObligations(): Promise<void> {
  if (Date.now() - lastRefresh < 5 * 60_000) return;
  lastRefresh = Date.now();
  const traders = await db().select({ id: s.traders.id }).from(s.traders).where(eq(s.traders.status, "active"));
  for (const t of traders) await ensureObligations(db(), t.id);
}

async function deliverSms(): Promise<void> {
  // The simulator is the SMS gateway: delivery means the message shows in /sim.
  await db().update(s.outbox).set({ status: "sent", sentAt: sql`now()`, attempts: sql`${s.outbox.attempts} + 1` }).where(and(eq(s.outbox.kind, "sms"), eq(s.outbox.status, "pending")));
}

async function runJobs(): Promise<void> {
  const jobs = await db().select().from(s.outbox).where(and(eq(s.outbox.kind, "job"), eq(s.outbox.status, "pending"), lt(s.outbox.attempts, 3))).limit(3);
  for (const job of jobs) {
    try {
      if (job.topic === "job.triage_complaint") await triageComplaint(String((job.payload as { complaintId?: string }).complaintId));
      await db().update(s.outbox).set({ status: "sent", sentAt: sql`now()`, attempts: sql`${s.outbox.attempts} + 1` }).where(eq(s.outbox.id, job.id));
    } catch (error) {
      await db().update(s.outbox).set({ attempts: sql`${s.outbox.attempts} + 1`, lastError: String(error) }).where(eq(s.outbox.id, job.id));
    }
  }
}
