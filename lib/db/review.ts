import "server-only";
import { db } from "./index";
import { getSleepTarget, loadSleepRows } from "./health";
import { loadHabits } from "./life";
import { loadSessions, loadWatchWorkouts } from "./workouts";
import { getStimSettings, stimLogsSince } from "./stimulants";
import { buildNights, scoresFor } from "@/lib/sleep";
import { addDays, londonDate, mondayOf } from "@/lib/time";
import { dayMap, linkWatch, recentPRs, sessionVolume } from "@/lib/workouts";

export type Period = { start: string; end: string; days: number };
export type Metrics = {
  nights: number;
  sleepH: number | null;
  sleepScore: number | null;
  sessions: number;
  trainingMin: number;
  volumeKg: number;
  prs: number;
  applications: number;
  caffeineAvg: number | null;
  caffeineOver: number;
  nicotine: number;
  habitPct: number | null;
};

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/** `weekStart` = Monday. The period runs to Sunday, or to today for the current week; the comparison period is the same number of days in the week before. */
export function periodsFor(weekStart: string, today: string): { cur: Period; prev: Period } {
  const end = addDays(weekStart, 6) > today ? today : addDays(weekStart, 6);
  const days = Math.round((Date.parse(end) - Date.parse(weekStart)) / 86400000) + 1;
  const ps = addDays(weekStart, -7);
  return { cur: { start: weekStart, end, days }, prev: { start: ps, end: addDays(ps, days - 1), days } };
}

export function getReview(weekStart: string, today: string) {
  const { cur, prev } = periodsFor(weekStart, today);
  const nights = buildNights(loadSleepRows());
  const scores = scoresFor(nights, getSleepTarget());
  const sessions = loadSessions();
  const { linked, unmatched } = linkWatch(sessions, loadWatchWorkouts());
  const days = dayMap(linked, unmatched);
  const habits = loadHabits(addDays(prev.start, -1));
  const maxMg = getStimSettings().maxMg;
  const stim = stimLogsSince(Date.parse(prev.start) - 86400000);
  const applied = db.$client.prepare("SELECT applied_at AS t FROM opportunities WHERE applied_at IS NOT NULL").all() as { t: number }[];
  const inP = (d: string, p: Period) => d >= p.start && d <= p.end;

  const metrics = (p: Period): Metrics => {
    const ns = nights.filter((n) => inP(n.date, p));
    const dayRows = [...days.values()].filter((d) => inP(d.date, p));
    const loggedSessions = linked.filter((s) => inP(s.date, p));
    const stimDays = new Map<string, number>();
    let nic = 0;
    for (const l of stim) {
      const d = londonDate(l.at);
      if (!inP(d, p)) continue;
      if (l.kind === "caffeine") stimDays.set(d, (stimDays.get(d) ?? 0) + l.mg);
      else nic++;
    }
    const slots = habits.length * p.days;
    const ticks = habits.reduce((a, h) => a + h.dates.filter((d) => inP(d, p)).length, 0);
    return {
      nights: ns.length,
      sleepH: avg(ns.map((n) => n.asleepH)),
      sleepScore: avg(ns.map((n) => scores.get(n.date)!)),
      sessions: dayRows.reduce((a, d) => a + d.sessions, 0),
      trainingMin: dayRows.reduce((a, d) => a + d.minutes, 0),
      volumeKg: loggedSessions.reduce((a, s) => a + sessionVolume(s), 0),
      prs: recentPRs(sessions, p.end, p.days).filter((x) => x.date >= p.start).length,
      applications: applied.filter((a) => inP(londonDate(a.t), p)).length,
      caffeineAvg: stimDays.size ? avg([...stimDays.values()]) : null,
      caffeineOver: [...stimDays.values()].filter((v) => v > maxMg).length,
      nicotine: nic,
      habitPct: slots ? Math.round((100 * ticks) / slots) : null,
    };
  };
  return { cur, prev, a: metrics(cur), b: metrics(prev), weekStart: mondayOf(weekStart) };
}

export const nowMsOf = () => Date.now();
