import { PageHeader } from "@/app/_ui/kit";
import { drillOptions } from "@/server/admin/failures";
import { Drills } from "./drills";

export const dynamic = "force-dynamic";
export const metadata = { title: "Failure drills" };

export default async function FailuresPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Failure drills" />
      <Drills options={await drillOptions()} />
    </div>
  );
}
