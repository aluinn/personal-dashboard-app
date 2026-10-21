import Link from "next/link";
import { connection } from "next/server";
import Panel from "@/components/ui/Panel";
import { loadGoals } from "@/lib/db/life";
import { GOAL_STATUSES } from "@/lib/life";

export default async function GoalsCard() {
  await connection();
  const goals = await loadGoals();
  const open = goals.filter((g) => g.status !== "done");
  return (
    <Panel label="GOALS" meta={<Link href="/goals" className="hover:text-teal">Board →</Link>} delay={0.55} className="md:col-span-6 xl:col-span-4">
      {goals.length === 0 ? (
        <p className="text-sm text-muted">No goals yet. <Link href="/goals" className="text-teal underline decoration-dotted">Add your grad scheme and master’s targets</Link>.</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-4 gap-2 text-center">
            {GOAL_STATUSES.map((s) => (
              <div key={s.key}>
                <div className="font-mono text-xl text-teal">{goals.filter((g) => g.status === s.key).length}</div>
                <div className="micro !text-[9px]">{s.label}</div>
              </div>
            ))}
          </div>
          <ul className="space-y-1.5 border-t border-line pt-3 text-sm">
            {open.slice(0, 3).map((g) => (
              <li key={g.id} className="flex justify-between gap-2">
                <span className="truncate">{g.title}</span>
                <span className="micro shrink-0">{g.targetDate ?? g.category}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
