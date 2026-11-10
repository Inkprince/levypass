import "server-only";
import { getBank } from "@/server/bank";
import { fakeWebhookRegistered } from "@/server/bank/fake";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { getSetting, setSetting } from "@/server/settings";

const secretKey = () => `bank.${env().BANK_ADAPTER}.webhook_secret`;
const idKey = () => `bank.${env().BANK_ADAPTER}.webhook_id`;

export async function webhookSecret(): Promise<string | undefined> {
  return getSetting(secretKey());
}

/**
 * Self-heal (plan: sandbox state is volatile). Registers our webhook when we hold no secret, or
 * when `force` is set (after a sandbox reset). The secret is shown once, so it goes straight to the DB.
 */
export async function ensureWebhook(force = false): Promise<void> {
  const bank = getBank();
  const have = await getSetting(secretKey());
  const fakeLost = bank.provider === "fake" && !fakeWebhookRegistered();
  if (have && !force && !fakeLost) return;
  const oldId = await getSetting(idKey());
  if (oldId && force) await bank.deleteWebhook(oldId).catch(() => undefined);
  const hook = await bank.registerWebhook(env().WEBHOOK_URL);
  await setSetting(secretKey(), hook.secret);
  await setSetting(idKey(), hook.id);
  log("info", "webhook.registered", { provider: bank.provider, webhook_id: hook.id, url: env().WEBHOOK_URL });
}
