import type { Block, TechEvent } from "./types";

/** Timetable blocks that overlap the event's time. All-day events never clash. */
export function clashesFor(e: Pick<TechEvent, "start" | "end" | "allDay">, blocks: Block[]) {
  if (e.allDay) return [];
  return blocks.filter((b) => e.start < b.end && e.end > b.start);
}
