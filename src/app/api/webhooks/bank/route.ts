import { handleBankWebhook } from "@/server/payments/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text(); // the signature covers the raw bytes, so never re-serialise
  const result = await handleBankWebhook(raw, request.headers);
  return Response.json(result.body, { status: result.status });
}
