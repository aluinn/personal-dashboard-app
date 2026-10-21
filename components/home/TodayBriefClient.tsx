"use client";

import Link from "next/link";
import Panel from "@/components/ui/Panel";
import type { TimetableData } from "@/lib/db/types";
import { expandSessions, pickNext, sessionLabel } from "@/lib/schedule";
import { caffeineWindow, type StimSettings } from "@/lib/stimulants";
import { DAY_NAMES, formatCountdown, londonDate, weekdayOf } from "@/lib/time";
import type { Plan } from "@/lib/workout-plan";
import { useNow } from "@/lib/useNow";

const Row = ({ label, children, href }: { label: string; children: React.ReactNode; href?: string }) => (
  <div className="flex gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0 last:pb-0">
    <div className="micro w-16 shrink-0 pt-0.5">{label}</div>
    <div className="min-w-0 flex-1 text-sm">{children}</div>
    {href && <Link href={href} className="micro self-start hover:text-teal">Open →</Link>}
  </div>
);

export default function TodayBriefClient({
  modules,
  sessions,
  plan,
  weeklyTarget,
  stim,
}: Pick<TimetableData, "modules" | "sessions"> & {
  plan: Plan;
  weeklyTarget: number;
  stim: { settings: StimSettings; wakeAt: number | null };
}) {
  const now = useNow(15000);
  if (now === null) return <Panel label="TODAY // BRIEF" className="md:col-span-6 xl:col-span-4"><div className="micro">Syncing…</div></Panel>;

  const today = londonDate(now);
  const mods = new Map(modules.map((m) => [m.id, m]));
  const next = pickNext(expandSessions(sessions, today, 14), now);
  const info = next && sessionLabel(next.occ, mods);
  const win = caffeineWindow(now, today, stim.wakeAt, stim.settings);
  const tone = win.state === "closed" ? "text-magenta" : win.state === "open" ? "text-teal" : "text-text";

  return (
    <Panel label="TODAY // BRIEF" meta={DAY_NAMES[weekdayOf(today)]} delay={0.1} className="md:col-span-6 xl:col-span-4">
      <Row label="Class" href="/timetable">
        {next && info ? (
          <>
            <span className="font-mono" style={{ color: info.color }}>
              {next.live ? `ends in ${formatCountdown(next.occ.end - now)}` : `in ${formatCountdown(next.occ.start - now)}`}
            </span>{" "}
            {next.occ.title.replace(/^HPSC\d+\s/, "")}
            <div className="micro normal-case tracking-wide">
              {next.occ.date !== today && `${DAY_NAMES[weekdayOf(next.occ.date)]} · `}
              {next.occ.startTime}–{next.occ.endTime}{next.occ.room ? ` · ${next.occ.room}` : ""}
            </div>
          </>
        ) : (
          <span className="text-muted">Nothing in the next two weeks</span>
        )}
      </Row>
      <Row label="Workout" href="/health/workouts">
        <span className={plan.state === "done" ? "text-teal" : ""}>{plan.text}</span>
        <div className="micro normal-case tracking-wide">Weekly target {weeklyTarget}</div>
      </Row>
      <Row label="Caffeine" href="/stimulants">
        <span className={tone}>{win.text}</span>
        {!stim.wakeAt && win.state !== "closed" && <div className="micro normal-case tracking-wide">No wake time from sleep data today, so no start delay</div>}
      </Row>
    </Panel>
  );
}
