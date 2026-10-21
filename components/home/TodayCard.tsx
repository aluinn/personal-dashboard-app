"use client";

import Panel from "@/components/ui/Panel";
import type { TimetableData } from "@/lib/db/types";
import { expandSessions, pickNext, sessionLabel } from "@/lib/schedule";
import { DAY_NAMES, formatCountdown, londonDate, weekdayOf } from "@/lib/time";
import { useNow } from "@/lib/useNow";

export default function TodayCard({ modules, sessions }: Pick<TimetableData, "modules" | "sessions">) {
  const now = useNow(15000);
  const mods = new Map(modules.map((m) => [m.id, m]));

  if (now === null) {
    return (
      <Panel label="TODAY // TIMETABLE" className="md:col-span-3 xl:col-span-4">
        <div className="micro">Syncing…</div>
      </Panel>
    );
  }

  const today = londonDate(now);
  const occ = expandSessions(sessions, today, 14);
  const todays = occ.filter((o) => o.date === today && o.kind !== "deadline");
  const next = pickNext(occ, now);
  const nextInfo = next && sessionLabel(next.occ, mods);

  return (
    <Panel
      label="TODAY // TIMETABLE"
      meta={DAY_NAMES[weekdayOf(today)]}
      delay={0.2}
      color={nextInfo?.color}
      pulse={!!next && next.occ.date === today}
      className="md:col-span-3 xl:col-span-4"
    >
      {next && nextInfo ? (
        <div className="mb-3">
          <div className="font-mono text-2xl font-light" style={{ color: nextInfo.color }}>
            {next.live ? `Ends in ${formatCountdown(next.occ.end - now)}` : `Starts in ${formatCountdown(next.occ.start - now)}`}
          </div>
          <div className="text-sm">{next.occ.title}</div>
          <div className="micro normal-case tracking-wide">
            {next.occ.date !== today && `${DAY_NAMES[weekdayOf(next.occ.date)]} · `}
            {next.occ.startTime}–{next.occ.endTime}
            {next.occ.room ? ` · ${next.occ.room}` : ""}
          </div>
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted">Nothing scheduled in the next two weeks.</p>
      )}

      {todays.length === 0 ? (
        <p className="micro border-t border-line pt-3">No classes today</p>
      ) : (
        <ul className="space-y-2 border-t border-line pt-3">
          {todays.map((o) => {
            const { color, code } = sessionLabel(o, mods);
            const done = o.end <= now;
            return (
              <li key={o.key} className={`flex gap-3 ${done ? "opacity-40" : ""}`}>
                <span className="font-mono text-sm" style={{ color }}>
                  {o.startTime}
                </span>
                <div>
                  <div className="text-sm">{o.title.replace(/^HPSC\d+\s/, "")}</div>
                  <div className="micro normal-case tracking-wide">{code}{o.room ? ` · ${o.room}` : ""}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
