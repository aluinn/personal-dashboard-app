import { Suspense } from "react";
import { connection } from "next/server";
import PageHeader from "@/components/ui/PageHeader";
import Panel from "@/components/ui/Panel";
import HabitGrid from "@/components/life/HabitGrid";
import { addHabit, addMusic, deleteMusic } from "@/app/life-actions";
import { loadHabits, loadMusic } from "@/lib/db/life";
import { addDays, formatDay, londonToday } from "@/lib/time";

async function Data() {
  await connection();
  const today = londonToday();
  const habits = loadHabits(addDays(today, -60));
  const music = loadMusic();
  const week = music.filter((m) => m.date > addDays(today, -7) && m.kind === "practice").reduce((a, m) => a + (m.minutes ?? 0), 0);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel label="HABITS // LAST 14 DAYS" accent="violet">
        <HabitGrid habits={habits} today={today} />
        <form action={addHabit} className="mt-4 flex gap-2 border-t border-line pt-3">
          <input name="name" required maxLength={40} placeholder="New habit" className="field" />
          <button className="btn">Add</button>
        </form>
      </Panel>

      <Panel label="MUSIC // PRACTICE & RELEASE LOG">
        <div className="micro mb-3 normal-case tracking-wide">Practice in the last 7 days: <span className="text-teal">{week} min</span></div>
        <form action={addMusic} className="grid grid-cols-2 gap-2">
          <select name="kind" className="field"><option value="practice">Practice</option><option value="release">Release</option></select>
          <input name="date" type="date" defaultValue={today} className="field" />
          <input name="title" placeholder="What (track, instrument, release name)" className="field col-span-2" />
          <input name="minutes" type="number" min={1} placeholder="Minutes (practice)" className="field" />
          <input name="notes" placeholder="Notes" className="field" />
          <button className="btn col-span-2">Log</button>
        </form>
        {music.length > 0 && (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {music.slice(0, 12).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-mono text-teal">{formatDay(m.date)}</span>{" "}
                  <span className="micro">{m.kind}{m.minutes ? ` · ${m.minutes} min` : ""}</span> {m.title}
                </span>
                <form action={deleteMusic.bind(null, m.id)}><button className="micro hover:text-magenta">Delete</button></form>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader code="10 // HABITS" title="Habits & Music" />
      <Suspense fallback={<div className="micro">Loading…</div>}><Data /></Suspense>
    </>
  );
}
