import { Drills } from "./drills";

export const metadata = { title: "Failure drills · LevyPass" };

export default function FailuresPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">Failure drills</h1>
        <p className="text-slate-500">Break it on purpose, live. Each drill shows what the bank did and what LevyPass did. None of them creates a duplicate ledger entry.</p>
      </div>
      <Drills />
    </div>
  );
}
