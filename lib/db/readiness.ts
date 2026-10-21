import "server-only";
import { q } from "./index";
import { getSleepTarget, loadSleepRows } from "./health";
import { loadSessions, loadWatchWorkouts } from "./workouts";
import { computeReadiness } from "@/lib/readiness";
import { buildNights, type HrvRow } from "@/lib/sleep";
import { addDays, londonToday } from "@/lib/time";
import { dayMap, linkWatch } from "@/lib/workouts";


export async function getReadiness(today = londonToday()) {
  const [sleepRows, target, hrv, sessions, watches] = await Promise.all([
    loadSleepRows(),
    getSleepTarget(),
    q.all<HrvRow>("SELECT day, source, avg FROM hrv_daily"),
    loadSessions(),
    loadWatchWorkouts(),
  ]);
  const nights = buildNights(sleepRows);
  const { linked, unmatched } = linkWatch(sessions, watches);
  const days = dayMap(linked, unmatched);
  const now = computeReadiness(today, nights, target, hrv, days);
  const prev = computeReadiness(addDays(today, -1), nights, target, hrv, days);
  const delta = now.score !== null && prev.score !== null ? now.score - prev.score : null;
  return { ...now, delta };
}
