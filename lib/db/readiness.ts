import "server-only";
import { db } from "./index";
import { getSleepTarget, loadSleepRows } from "./health";
import { loadSessions, loadWatchWorkouts } from "./workouts";
import { computeReadiness } from "@/lib/readiness";
import { buildNights, type HrvRow } from "@/lib/sleep";
import { addDays, londonToday } from "@/lib/time";
import { dayMap, linkWatch } from "@/lib/workouts";


export function getReadiness(today = londonToday()) {
  const nights = buildNights(loadSleepRows());
  const target = getSleepTarget();
  const hrv: HrvRow[] = db.$client.prepare("SELECT day, source, avg FROM hrv_daily").all() as HrvRow[];
  const { linked, unmatched } = linkWatch(loadSessions(), loadWatchWorkouts());
  const days = dayMap(linked, unmatched);
  const now = computeReadiness(today, nights, target, hrv, days);
  const prev = computeReadiness(addDays(today, -1), nights, target, hrv, days);
  const delta = now.score !== null && prev.score !== null ? now.score - prev.score : null;
  return { ...now, delta };
}
