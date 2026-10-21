"use client";

import type { Module } from "@/lib/db/types";
import { KIND_LABEL, sessionLabel, type Due, type Occurrence } from "@/lib/schedule";
import { formatCountdown, formatDay, londonDate } from "@/lib/time";

type Row = {
  key: string;
  at: number;
  date: string;
  time: string;
  title: string;
  color: string;
  tag: string;
  meta: string;
  live: boolean;
  next: boolean;
};

export default function Agenda({
  occ,
  dues,
  mods,
  now,
  nextKey,
}: {
  occ: Occurrence[];
  dues: Due[];
  mods: Map<number, Module>;
  now: number;
  nextKey?: string;
}) {
  const rows: Row[] = [
    ...occ
      .filter((o) => o.end > now)
      .map((o) => {
        const { code, color } = sessionLabel(o, mods);
        return {
          key: o.key,
          at: o.start,
          date: o.date,
          time: `${o.startTime}–${o.endTime}`,
          title: o.title,
          color,
          tag: `${code} · ${KIND_LABEL[o.kind] ?? o.kind.toUpperCase()}`,
          meta: [o.room, o.location, o.lecturer].filter(Boolean).join(" · "),
          live: o.start <= now,
          next: o.key === nextKey,
        };
      }),
    ...dues
      .filter((a) => a.progress < 100 && a.dueAt > now)
      .map((a) => {
        const m = mods.get(a.moduleId);
        return {
          key: `due-${a.id}`,
          at: a.dueAt,
          date: a.dueDate,
          time: a.dueTime,
          title: `Due: ${a.title}`,
          color: m?.color ?? "#9fb3b2",
          tag: `${m?.code ?? ""} · DUE`,
          meta: a.weight ? `${a.weight}% of module` : "",
          live: false,
          next: false,
        };
      }),
  ].sort((a, b) => a.at - b.at);

  const grouped = new Map<string, Row[]>();
  for (const r of rows) grouped.set(r.date, [...(grouped.get(r.date) ?? []), r]);
  const today = londonDate(now);

  if (rows.length === 0) return <p className="text-sm text-muted">Nothing scheduled in the next three weeks.</p>;

  return (
    <div className="space-y-5">
      {[...grouped.entries()].map(([date, list]) => (
        <div key={date}>
          <div className={`micro mb-2 ${date === today ? "text-teal" : ""}`}>
            {date === today ? "Today · " : ""}
            {formatDay(date, { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <ul className="space-y-2">
            {list.map((r) => (
              <li
                key={r.key}
                style={{ "--c": r.color, borderLeft: `2px solid ${r.color}` } as React.CSSProperties}
                className={`flex items-center justify-between gap-4 bg-white/[0.02] px-3 py-2 ${r.live || r.next ? "pulse-accent" : ""}`}
              >
                <div>
                  <div className="text-sm">{r.title}</div>
                  <div className="micro normal-case tracking-wide">
                    <span style={{ color: r.color }}>{r.tag}</span>
                    {r.meta && ` · ${r.meta}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{r.time}</div>
                  {(r.live || r.next) && (
                    <div className="micro" style={{ color: r.color }}>
                      {r.live ? "In progress" : `Starts in ${formatCountdown(r.at - now)}`}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
