"use client";

import Delta from "./Delta";
import { useEventMarks } from "@/lib/events/marks";

type Ev = { id: string; title: string; start: number; end: number };

/** "Attended" = events you marked Going that have ended. Marks live in this browser, so this is read client-side. */
export default function EventsAttended({ events, now, curStart, curEnd, prevStart, prevEnd }: { events: Ev[]; now: number; curStart: number; curEnd: number; prevStart: number; prevEnd: number }) {
  const { marks } = useEventMarks();
  const going = events.filter((e) => marks[e.id] === "going" && e.end <= now);
  const cur = going.filter((e) => e.start >= curStart && e.start < curEnd);
  const prev = going.filter((e) => e.start >= prevStart && e.start < prevEnd);
  return (
    <div>
      <div className="font-mono text-3xl font-light text-teal glow-text">{cur.length}</div>
      <Delta cur={cur.length} prev={prev.length} />
      <ul className="mt-2 space-y-1 text-xs text-muted">
        {cur.map((e) => <li key={e.id} className="truncate">{e.title}</li>)}
      </ul>
      <p className="micro mt-2 normal-case tracking-wide !text-[10px]">Counts events you marked Going. Events only appear if they’re still in your feeds.</p>
    </div>
  );
}
