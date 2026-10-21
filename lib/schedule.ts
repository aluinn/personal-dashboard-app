import type { Assessment, Module, Session } from "@/lib/db/types";
import { addDays, wallToInstant, weekdayOf } from "@/lib/time";

export type Occurrence = {
  key: string;
  sessionId: number;
  moduleId: number | null;
  kind: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  start: number; // UTC ms
  end: number;
  room: string;
  lecturer: string;
  location: string;
};

/** Expand weekly + one-off sessions into concrete occurrences over `days` days. */
export function expandSessions(sessions: Session[], fromDate: string, days: number): Occurrence[] {
  const out: Occurrence[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    const wd = weekdayOf(date);
    for (const s of sessions) {
      const hit = s.date ? s.date === date : s.weekday === wd;
      if (!hit) continue;
      out.push({
        key: `${s.id}-${date}`,
        sessionId: s.id,
        moduleId: s.moduleId,
        kind: s.kind,
        title: s.title,
        date,
        startTime: s.startTime,
        endTime: s.endTime,
        start: wallToInstant(date, s.startTime),
        end: wallToInstant(date, s.endTime),
        room: s.room,
        lecturer: s.lecturer,
        location: s.location,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** The class/event happening now, or the next one to start. */
export function pickNext(occ: Occurrence[], now: number) {
  const upcoming = occ.filter((o) => o.kind !== "deadline" && o.end > now).sort((a, b) => a.start - b.start);
  const o = upcoming[0];
  if (!o) return null;
  return { occ: o, live: o.start <= now };
}

export function sessionLabel(o: Occurrence, mods: Map<number, Module>) {
  const m = o.moduleId ? mods.get(o.moduleId) : undefined;
  return { code: m?.code ?? "EVENT", color: m?.color ?? "#9fb3b2", module: m };
}

export type Due = Assessment & { dueAt: number };
export function withDue(a: Assessment[]): Due[] {
  return a.map((x) => ({ ...x, dueAt: wallToInstant(x.dueDate, x.dueTime) }));
}

export const KIND_LABEL: Record<string, string> = {
  class: "CLASS",
  event: "EVENT",
  exam: "EXAM",
  deadline: "DEADLINE",
};
