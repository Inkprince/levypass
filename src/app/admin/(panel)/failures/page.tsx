import { PageHeader } from "@/app/_ui/kit";
import { Drills } from "./drills";

export const metadata = { title: "Failure drills · LevyPass" };

export default function FailuresPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Failure drills" lead="Break it on purpose, live. Each drill shows what the bank did and what LevyPass did. None of them creates a duplicate ledger entry." />
      <Drills />
    </div>
  );
}
