"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, CalendarPlus, Copy } from "lucide-react";
import Panel from "@/components/ui/Panel";
import type { TimetableData } from "@/lib/db/types";
import { expandSessions, pickNext, withDue } from "@/lib/schedule";
import { addDays, formatDay, londonDate, mondayOf } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import Agenda from "./Agenda";
import ModuleCard from "./ModuleCard";
import WeekGrid from "./WeekGrid";

export default function TimetableView({ modules, sessions, assessments }: TimetableData) {
  const now = useNow(15000);
  const [view, setView] = useState<"week" | "agenda">("week");
  const [offset, setOffset] = useState(0);
  const [copied, setCopied] = useState(false);

  const mods = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);
  const dues = useMemo(() => withDue(assessments), [assessments]);

  if (now === null) return <div className="micro">Syncing clock…</div>;

  const today = londonDate(now);
  const weekStart = addDays(mondayOf(today), offset * 7);
  const weekOcc = expandSessions(sessions, weekStart, 7);
  const lookahead = expandSessions(sessions, today, 21);
  const next = pickNext(lookahead, now);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(`${location.origin}/api/timetable.ics`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {(["week", "agenda"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`btn ${view === v ? "bg-teal/15" : "!border-line !text-muted"}`}
            >
              {v}
            </button>
          ))}
          {view === "week" && (
            <div className="ml-1 flex items-center gap-2 md:ml-3">
              <button aria-label="Previous week" onClick={() => setOffset((o) => o - 1)} className="text-muted hover:text-teal">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="micro min-w-[150px] text-center text-text">
                {formatDay(weekStart, { day: "numeric", month: "short" })} – {formatDay(addDays(weekStart, 6), { day: "numeric", month: "short" })}
              </span>
              <button aria-label="Next week" onClick={() => setOffset((o) => o + 1)} className="text-muted hover:text-teal">
                <ChevronRight className="h-4 w-4" />
              </button>
              {offset !== 0 && (
                <button onClick={() => setOffset(0)} className="micro text-teal hover:underline">
                  This week
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/timetable.ics?download=1" className="btn inline-flex items-center gap-1.5">
            <Download className="h-3 w-3" /> .ics
          </a>
          <button onClick={() => (location.href = `webcal://${location.host}/api/timetable.ics`)} className="btn inline-flex items-center gap-1.5">
            <CalendarPlus className="h-3 w-3" /> Subscribe
          </button>
          <button onClick={copyUrl} className="btn inline-flex items-center gap-1.5">
            <Copy className="h-3 w-3" /> {copied ? "Copied" : "Copy URL"}
          </button>
        </div>
      </div>

      <Panel label={view === "week" ? "WEEK VIEW // EUROPE/LONDON" : "AGENDA // NEXT 3 WEEKS"}>
        {view === "week" ? (
          <WeekGrid weekStart={weekStart} occ={weekOcc} mods={mods} now={now} liveKey={next?.live ? next.occ.key : undefined} />
        ) : (
          <Agenda occ={lookahead} dues={dues} mods={mods} now={now} nextKey={next?.occ.key} />
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((m) => {
          const upcoming = lookahead.find((o) => o.moduleId === m.id && o.kind !== "deadline" && o.end > now);
          const isNextOverall = next && upcoming && next.occ.key === upcoming.key;
          return (
            <ModuleCard
              key={m.id}
              m={m}
              dues={dues.filter((d) => d.moduleId === m.id)}
              next={upcoming ? { occ: upcoming, live: upcoming.start <= now } : undefined}
              now={now}
              highlight={!!isNextOverall}
            />
          );
        })}
      </div>
    </div>
  );
}
