import { connection } from "next/server";
import { getTimetableData } from "@/lib/db/queries";
import { getStimSettings, wakeTimeToday } from "@/lib/db/stimulants";
import { getWeeklyTarget, loadSessions, loadWatchWorkouts } from "@/lib/db/workouts";
import { planFor } from "@/lib/workout-plan";
import { addDays, londonToday } from "@/lib/time";
import { dayMap, linkWatch } from "@/lib/workouts";
import TodayBriefClient from "./TodayBriefClient";

export default async function TodayBrief() {
  await connection();
  const { modules, sessions } = await getTimetableData();
  const today = londonToday();
  const [ws, watches, weeklyTarget, settings, wakeAt] = await Promise.all([loadSessions(), loadWatchWorkouts(), getWeeklyTarget(), getStimSettings(), wakeTimeToday()]);
  const { linked, unmatched } = linkWatch(ws, watches);
  const trained = new Set(dayMap(linked, unmatched).keys());
  const plan = planFor(ws, trained, today, addDays);
  return (
    <TodayBriefClient
      modules={modules}
      sessions={sessions}
      plan={plan}
      weeklyTarget={weeklyTarget}
      stim={{ settings, wakeAt }}
    />
  );
}
