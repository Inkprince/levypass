// Starts the in-process poller once per server (not during `next build`, not in tests).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.POLLER === "off") return;
  const { startPoller } = await import("./server/jobs/poller");
  startPoller();
}
