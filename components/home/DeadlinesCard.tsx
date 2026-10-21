"use client";

import Panel from "@/components/ui/Panel";
import type { TimetableData } from "@/lib/db/types";
import { withDue } from "@/lib/schedule";
import { formatCountdown, formatDay } from "@/lib/time";
import { useNow } from "@/lib/useNow";

export default function DeadlinesCard({ modules, assessments }: Pick<TimetableData, "modules" | "assessments">) {
  const now = useNow(60000);
  const mods = new Map(modules.map((m) => [m.id, m]));
  const list = withDue(assessments)
    .filter((a) => a.progress < 100)
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, 3);

  return (
    <Panel label="NEXT DEADLINES" delay={0.25} className="md:col-span-3 xl:col-span-4">
      {list.length === 0 ? (
        <p className="text-sm text-muted">No open deadlines. Add assessments on the Timetable page.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((d) => {
            const m = mods.get(d.moduleId);
            const left = now === null ? null : d.dueAt - now;
            return (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm">{d.title}</div>
                  <div className="micro" style={{ color: m?.color }}>
                    {m?.code} · {formatDay(d.dueDate)}
                  </div>
                </div>
                <span className={`font-mono text-sm ${left !== null && left < 0 ? "text-magenta" : "text-teal"}`}>
                  {left === null ? "…" : left < 0 ? "overdue" : `T-${formatCountdown(left)}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
