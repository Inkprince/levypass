import { PageHeader } from "@/app/_ui/kit";
import { Drills } from "./drills";

export const metadata = { title: "Failure drills · LevyPass" };

export default function FailuresPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Failure drills" />
      <Drills />
    </div>
  );
}
