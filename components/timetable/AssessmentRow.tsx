"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteAssessment, setProgress } from "@/app/actions";
import type { Due } from "@/lib/schedule";
import { formatCountdown, formatDay } from "@/lib/time";

export default function AssessmentRow({ a, color, now }: { a: Due; color: string; now: number }) {
  const [value, setValue] = useState(a.progress);
  const [, start] = useTransition();
  const commit = () => start(() => setProgress(a.id, value));
  const left = a.dueAt - now;
  const overdue = left < 0 && value < 100;

  return (
    <li className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-sm ${value >= 100 ? "text-muted line-through" : ""}`}>{a.title}</div>
          <div className="micro normal-case tracking-wide">
            {formatDay(a.dueDate)} {a.dueTime}
            {a.weight ? ` · ${a.weight}%` : ""}
            {value < 100 && (
              <span className={overdue ? "text-magenta" : ""}> · {overdue ? "overdue" : `in ${formatCountdown(left)}`}</span>
            )}
          </div>
        </div>
        <form action={deleteAssessment}>
          <input type="hidden" name="id" value={a.id} />
          <button aria-label="Delete assessment" className="text-muted transition-colors hover:text-magenta">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative h-1 flex-1 rounded-full bg-white/5">
          <div className="h-full rounded-full transition-[width]" style={{ width: `${value}%`, background: color }} />
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value}
            aria-label={`Progress on ${a.title}`}
            onChange={(e) => setValue(+e.target.value)}
            onPointerUp={commit}
            onKeyUp={commit}
            className="absolute inset-x-0 -top-2 h-5 w-full cursor-pointer opacity-0"
          />
        </div>
        <span className="w-9 text-right font-mono text-[11px]" style={{ color }}>
          {value}%
        </span>
      </div>
    </li>
  );
}
