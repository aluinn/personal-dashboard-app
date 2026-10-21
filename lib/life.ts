// Pure helpers for habits / goals.
export const GOAL_STATUSES = [
  { key: "todo", label: "To do" },
  { key: "doing", label: "In progress" },
  { key: "submitted", label: "Submitted" },
  { key: "done", label: "Done" },
] as const;
export const GOAL_CATEGORIES = ["grad scheme", "masters", "other"] as const;

export type Habit = { id: number; name: string; dates: string[] };

/** Consecutive days ending today; a not-yet-ticked today doesn't break the run. */
export function habitStreak(dates: string[], today: string, addDays: (d: string, n: number) => string) {
  const set = new Set(dates);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export const PROJECTS = [
  { key: "nexus", name: "NEXUS", note: "Digital-asset portfolio, news and journal platform" },
  { key: "kori", name: "Kori Club", note: "Drop-based clothing brand on Shopify" },
  { key: "trim", name: "Trim", note: "2nd place, SpaceX/Grok Bot Commerce London Hackathon" },
] as const;
export type ProjectLinks = Record<string, { label: string; url: string }[]>;
