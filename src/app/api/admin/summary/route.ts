import { dashboardSummary } from "@/server/admin/summary";
import { currentSubject } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!(await currentSubject("admin"))) return Response.json({ error: "login required" }, { status: 401 });
  return Response.json(await dashboardSummary(), { headers: { "cache-control": "no-store" } });
}
