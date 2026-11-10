import { z } from "zod";
import { ussdReply } from "@/server/ussd/menu";

export const dynamic = "force-dynamic";

const input = z.object({ sessionId: z.string().min(1), phoneNumber: z.string().min(5), text: z.string().default(""), serviceCode: z.string().optional() });

export async function POST(request: Request): Promise<Response> {
  const type = request.headers.get("content-type") ?? "";
  const raw = type.includes("json") ? await request.json() : Object.fromEntries(new URLSearchParams(await request.text()));
  const parsed = input.safeParse(raw);
  if (!parsed.success) return new Response("END Invalid request.", { status: 400, headers: { "content-type": "text/plain" } });
  return new Response(await ussdReply(parsed.data), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
