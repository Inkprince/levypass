import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { fallbackTriage, type Triage } from "@/core/triage-fallback";
import { db } from "@/server/db/client";
import { complaints } from "@/server/db/schema";
import { env } from "@/server/env";
import { errorFields, log } from "@/server/log";
import { acquireSlot } from "@/server/outbound";

// T20: Huawei MaaS turns a complaint in English, Pidgin or Yoruba into an English summary,
// category and severity. Thinking off, a timeout, and a deterministic fallback (AGENTS.md).

const answer = z.object({ summary: z.string().min(5).max(300), category: z.string().min(2).max(40), severity: z.enum(["low", "medium", "high"]) });

const system =
  "You triage complaints from Nigerian market traders about levy collectors. The text may be English, Nigerian Pidgin, Yoruba, Igbo or Hausa. " +
  'Reply with JSON only: {"summary": one plain English sentence, "category": one of fake_collector, overcharge, no_receipt, harassment, other, "severity": low|medium|high}.';

async function askModel(text: string): Promise<Omit<Triage, "language">> {
  const e = env();
  if (!e.MAAS_BASE_URL || !e.GATEWAY_KEY) throw new Error("model not configured");
  await acquireSlot();
  const res = await fetch(`${e.MAAS_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: e.GATEWAY_KEY, authorization: "Bearer unused" },
    body: JSON.stringify({
      model: e.MAAS_MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: text.slice(0, 1500) }],
      temperature: 0,
      max_tokens: 200,
      chat_template_kwargs: { thinking: false },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  log("info", "maas.call", { status: res.status, request_id: res.headers.get("x-request-id") });
  if (!res.ok) throw new Error(`model returned ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "";
  const match = /\{[\s\S]*\}/.exec(content);
  return answer.parse(JSON.parse(match?.[0] ?? "{}"));
}

export async function triageComplaint(complaintId: string): Promise<void> {
  const [c] = await db().select().from(complaints).where(eq(complaints.id, complaintId));
  if (!c || c.triageSource) return; // cached on the complaint
  const fallback = fallbackTriage(c.description);
  let result: Triage = fallback;
  let source: "model" | "fallback" = "fallback";
  try {
    result = { ...(await askModel(c.description)), language: fallback.language };
    source = "model";
  } catch (error) {
    log("warn", "triage.fallback", { complaint_id: complaintId, ...errorFields(error) });
  }
  await db()
    .update(complaints)
    .set({ triageSummary: result.summary, triageCategory: result.category, triageSeverity: result.severity, triageLanguage: result.language, triageSource: source })
    .where(eq(complaints.id, complaintId));
}
