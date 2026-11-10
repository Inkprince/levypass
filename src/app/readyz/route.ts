import { pingDatabase } from "@/server/db/client";
import { errorFields, log } from "@/server/log";

export const dynamic = "force-dynamic";

/** Readiness: the app can reach its database. Kept separate from /healthz so liveness stays cheap. */
export async function GET(): Promise<Response> {
  const headers = { "cache-control": "no-store" };
  try {
    await pingDatabase();
    return Response.json({ status: "ok", database: "ok" }, { headers });
  } catch (error) {
    log("error", "readyz.database_unreachable", errorFields(error));
    return Response.json({ status: "error", database: "unreachable" }, { status: 503, headers });
  }
}
