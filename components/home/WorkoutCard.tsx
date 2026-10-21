import Link from "next/link";
import { connection } from "next/server";
import Panel from "@/components/ui/Panel";
import { getWeeklyTarget, loadSessions, loadWatchWorkouts } from "@/lib/db/workouts";
import { londonToday } from "@/lib/time";
import { dayMap, linkWatch, sessionVolume, tonnes, weekStreak, weeklyCounts } from "@/lib/workouts";

const ago = (from: string, to: string) => {
  const n = Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  return n <= 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`;
};

export default async function WorkoutCard() {
  await connection();
  const [sessions, watches, target] = await Promise.all([loadSessions(), loadWatchWorkouts(), getWeeklyTarget()]);
  const { linked, unmatched } = linkWatch(sessions, watches);
  const today = londonToday();
  const counts = weeklyCounts(dayMap(linked, unmatched), today, 52);
  const week = counts[counts.length - 1]?.count ?? 0;
  const streak = weekStreak(counts, target);
  const last = [...linked].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0];
  const wrap = "md:col-span-3 xl:col-span-4";

  return (
    <Panel label="WORKOUTS" meta={<Link href="/health/workouts" className="hover:text-teal">Open →</Link>} delay={0.3} className={wrap}>
      <div className="flex items-end justify-between">
        <div>
          <div className="micro">This week</div>
          <div className="font-mono text-4xl font-light text-teal glow-text">{week}<span className="text-xl text-muted">/{target}</span></div>
        </div>
        <div className="text-right">
          <div className="micro">Week streak</div>
          <div className="font-mono text-2xl font-light">{streak.current}</div>
        </div>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
        <div className="flow-gradient h-full" style={{ width: `${Math.min(100, (week / Math.max(1, target)) * 100)}%` }} />
      </div>
      <div className="mt-3 text-xs text-muted">
        {last ? (
          <>
            Last: <span className="capitalize text-text">{last.type}</span> · {ago(last.date, today)}
            {sessionVolume(last) > 0 ? ` · ${tonnes(sessionVolume(last))}` : ""}
          </>
        ) : (
          <>No workouts logged yet. <Link href="/health/workouts" className="text-teal underline decoration-dotted">Log your first</Link>.</>
        )}
      </div>
    </Panel>
  );
}
