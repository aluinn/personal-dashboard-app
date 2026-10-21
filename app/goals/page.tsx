import { Suspense } from "react";
import { connection } from "next/server";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import { deleteGoal, saveGoal, setGoalStatus } from "@/app/life-actions";
import { loadGoals } from "@/lib/db/life";
import { GOAL_CATEGORIES, GOAL_STATUSES } from "@/lib/life";

async function Data() {
  await connection();
  const goals = await loadGoals();
  return (
    <div className="space-y-4">
      <Panel label="ADD A GOAL // E.G. A GRAD SCHEME OR MASTER'S APPLICATION" accent="violet">
        <form action={saveGoal} className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_2fr_auto]">
          <input name="title" required maxLength={120} placeholder="Title" className="field" />
          <select name="category" className="field">{GOAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <input name="targetDate" type="date" className="field" aria-label="Target date" />
          <input name="notes" placeholder="Notes" className="field" />
          <button className="btn">Add</button>
        </form>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {GOAL_STATUSES.map((col) => (
          <Panel key={col.key} label={`${col.label.toUpperCase()} // ${goals.filter((g) => g.status === col.key).length}`}>
            <ul className="space-y-3">
              {goals.filter((g) => g.status === col.key).map((g) => (
                <li key={g.id} className="rounded-sm border border-line p-2.5">
                  <div className="text-sm">{g.title}</div>
                  <div className="micro normal-case tracking-wide">{g.category}{g.targetDate ? ` · by ${g.targetDate}` : ""}</div>
                  {g.notes && <div className="mt-1 text-xs text-muted">{g.notes}</div>}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {GOAL_STATUSES.filter((s) => s.key !== g.status).map((s) => (
                        <form key={s.key} action={setGoalStatus.bind(null, g.id, s.key)}>
                          <button className="micro rounded-sm border border-line px-1.5 py-0.5 !text-[9px] hover:border-teal/50 hover:text-teal">→ {s.label}</button>
                        </form>
                      ))}
                    </div>
                    <form action={deleteGoal.bind(null, g.id)}><button className="micro hover:text-magenta" aria-label={`Delete ${g.title}`}>×</button></form>
                  </div>
                </li>
              ))}
              {goals.filter((g) => g.status === col.key).length === 0 && <li className="micro">Empty</li>}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader code="11 // GOALS" title="Goals Board" />
      <Suspense fallback={<div className="micro">Loading…</div>}><Data /></Suspense>
    </>
  );
}
