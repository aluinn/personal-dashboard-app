"use client";

import { useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import Panel from "@/components/ui/Panel";
import { addAssessment } from "@/app/actions";
import type { Module } from "@/lib/db/types";
import type { Due, Occurrence } from "@/lib/schedule";
import { DAY_NAMES, formatCountdown, weekdayOf } from "@/lib/time";
import AssessmentRow from "./AssessmentRow";

export default function ModuleCard({
  m,
  dues,
  next,
  now,
  highlight,
}: {
  m: Module;
  dues: Due[];
  next?: { occ: Occurrence; live: boolean };
  now: number;
  /** True for the module with the current/next class overall. */
  highlight?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const mine = [...dues].sort((a, b) => Number(a.progress >= 100) - Number(b.progress >= 100) || a.dueAt - b.dueAt);

  return (
    <Panel color={m.color} pulse={highlight} label={m.code} meta={m.lecturer || undefined}>
      <h3 className="text-base font-light">{m.name}</h3>
      {next && (
        <div className="micro mt-1" style={{ color: m.color }}>
          {next.live
            ? `In progress · ends in ${formatCountdown(next.occ.end - now)}`
            : `Starts in ${formatCountdown(next.occ.start - now)} · ${DAY_NAMES[weekdayOf(next.occ.date)]} ${next.occ.startTime}`}
          {next.occ.room ? ` · ${next.occ.room}` : ""}
        </div>
      )}

      <div className="mt-3">
        {m.notionUrl ? (
          <a href={m.notionUrl} target="_blank" rel="noreferrer" className="btn inline-flex items-center gap-1.5" style={{ color: m.color, borderColor: m.color }}>
            Notion notes <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <Link href="/settings" className="micro underline decoration-dotted hover:text-teal">
            + Add Notion notes link in Settings
          </Link>
        )}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="micro">Assessments &amp; deadlines</span>
          <button onClick={() => setAdding((v) => !v)} aria-label="Add assessment" className="text-muted hover:text-teal">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {mine.length === 0 && !adding && <p className="text-xs text-muted">None yet. Add one with +.</p>}
        <ul className="space-y-3">
          {mine.map((a) => (
            <AssessmentRow key={`${a.id}-${a.progress}`} a={a} color={m.color} now={now} />
          ))}
        </ul>

        {adding && (
          <form
            action={async (f) => {
              await addAssessment(f);
              setAdding(false);
            }}
            className="mt-3 grid grid-cols-2 gap-2"
          >
            <input type="hidden" name="moduleId" value={m.id} />
            <input name="title" required placeholder="e.g. Essay 1" className="field col-span-2" />
            <input name="dueDate" type="date" required className="field" />
            <input name="dueTime" type="time" defaultValue="12:00" className="field" />
            <input name="weight" type="number" min={0} max={100} placeholder="Weight %" className="field" />
            <button className="btn">Add</button>
          </form>
        )}
      </div>
    </Panel>
  );
}
