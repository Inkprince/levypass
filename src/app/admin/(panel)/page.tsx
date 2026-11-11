import { dashboardSummary } from "@/server/admin/summary";
import { LiveDashboard } from "./live-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function AdminHome() {
  return <LiveDashboard initial={await dashboardSummary()} />;
}
