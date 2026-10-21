"use client";

import { useOptimistic, useTransition } from "react";
import { archiveHabit, toggleHabit } from "@/app/life-actions";
import { habitStreak, type Habit } from "@/lib/life";
import { addDays, formatDay } from "@/lib/time";

type Tap = { id: number; date: string };

/** `compact` shows only today's tick per habit (Home card); otherwise a 14-day grid. */
export default function HabitGrid({ habits, today, compact = false }: { habits: Habit[]; today: string; compact?: boolean }) {
  const [, start] = useTransition();
  const [view, tap] = useOptimistic(habits, (cur, t: Tap) =>
    cur.map((h) => (h.id !== t.id ? h : { ...h, dates: h.dates.includes(t.date) ? h.dates.filter((d) => d !== t.date) : [...h.dates, t.date] })),
  );
  const days = Array.from({ length: compact ? 1 : 14 }, (_, i) => addDays(today, i - (compact ? 0 : 13)));
  const flip = (id: number, date: string) =>
    start(async () => {
      tap({ id, date });
      await toggleHabit(id, date);
    });

  return (
    <ul className="space-y-2.5">
      {view.map((h) => {
        const streak = habitStreak(h.dates, today, addDays);
        return (
          <li key={h.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{h.name}</div>
              <div className="micro normal-case tracking-wide">{streak > 0 ? `${streak}-day streak` : "no streak"}</div>
            </div>
            <div className="flex gap-1">
              {days.map((d) => {
                const on = h.dates.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => flip(h.id, d)}
                    aria-pressed={on}
                    aria-label={compact ? `${on ? "Done" : "Tick"} ${h.name} today` : `${h.name}, ${formatDay(d)}: ${on ? "done" : "not done"}`}
                    title={formatDay(d)}
                    className={`h-7 rounded-[3px] border transition-colors ${compact ? "w-16 text-[10px]" : "w-5"} ${
                      on ? "border-teal bg-teal/70 text-[#05080a] shadow-[0_0_8px_-1px_rgba(46,230,214,0.7)]" : d === today ? "border-teal/50 text-muted" : "border-line text-muted"
                    }`}
                  >
                    {compact && <span className="micro !text-[9px] !text-inherit">{on ? "Done ✓" : "Tick"}</span>}
                  </button>
                );
              })}
            </div>
            {!compact && (
              <button className="micro hover:text-magenta" onClick={() => start(() => archiveHabit(h.id))} aria-label={`Remove ${h.name}`}>×</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
