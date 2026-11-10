export const dynamic = "force-dynamic";

/** Liveness only: no database or bank call, so it stays cheap under the platform probe. */
export function GET(): Response {
  return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}
