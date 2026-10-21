import { categoryOf, type WSession } from "@/lib/workouts";

const NEXT: Record<string, string> = { push: "pull", pull: "legs", legs: "push", upper: "lower", lower: "upper", "full body": "full body" };

export type Plan = { state: "done" | "planned" | "rest"; text: string };

/**
 * A suggestion, not a schedule: continues your push/pull/legs (or upper/lower) rotation from your
 * last strength session, and suggests rest after three training days in a row.
 */
export function planFor(sessions: WSession[], trainedDates: Set<string>, today: string, addDays: (d: string, n: number) => string): Plan {
  const todays = sessions.filter((s) => s.date === today);
  if (todays.length) return { state: "done", text: `Done today: ${todays.map((s) => s.type).join(", ")}` };
  if ([1, 2, 3].every((i) => trainedDates.has(addDays(today, -i)))) return { state: "rest", text: "Rest day suggested (3 training days in a row)" };
  const lastStrength = [...sessions].filter((s) => categoryOf(s.type) === "strength").sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0];
  const next = (lastStrength && NEXT[lastStrength.type]) || "push";
  return { state: "planned", text: `Suggested: ${next}${lastStrength ? ` (after ${lastStrength.type})` : ""}` };
}
