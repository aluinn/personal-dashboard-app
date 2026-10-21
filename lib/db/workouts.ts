import "server-only";
import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { db, schema } from "./index";
import { getSetting } from "./opp";
import type { TemplateExercise } from "@/lib/exercises";
import { watchDate, type WatchWorkout, type WSession } from "@/lib/workouts";

export type Template = { id: number; name: string; type: string; exercises: TemplateExercise[] };
export type BodyRow = { date: string; metric: string; value: number };

export const getWeeklyTarget = () => getSetting<number>("workoutWeeklyTarget", 4);

export async function loadSessions(): Promise<WSession[]> {
  const [sessions, exercises, sets] = await Promise.all([
    db.select().from(schema.workoutSessions).orderBy(asc(schema.workoutSessions.date), asc(schema.workoutSessions.id)).all(),
    db.select().from(schema.workoutExercises).orderBy(asc(schema.workoutExercises.position), asc(schema.workoutExercises.id)).all(),
    db.select().from(schema.workoutSets).orderBy(asc(schema.workoutSets.position), asc(schema.workoutSets.id)).all(),
  ]);
  const setsBy = new Map<number, typeof sets>();
  for (const s of sets) setsBy.set(s.exerciseId, [...(setsBy.get(s.exerciseId) ?? []), s]);
  const exBy = new Map<number, typeof exercises>();
  for (const e of exercises) exBy.set(e.sessionId, [...(exBy.get(e.sessionId) ?? []), e]);
  return sessions.map((s) => ({
    id: s.id, date: s.date, type: s.type, durationMin: s.durationMin, distanceKm: s.distanceKm, notes: s.notes,
    exercises: (exBy.get(s.id) ?? []).map((e) => ({
      id: e.id, name: e.name, muscle: e.muscle, notes: e.notes,
      sets: (setsBy.get(e.id) ?? []).map((x) => ({ reps: x.reps, weightKg: x.weightKg, rpe: x.rpe })),
    })),
  }));
}

export async function loadWatchWorkouts(): Promise<WatchWorkout[]> {
  return (await db.select().from(schema.workoutsImported).orderBy(asc(schema.workoutsImported.startAt)).all()).map((w) => ({
    id: w.id, type: w.type, date: watchDate(w.startAt, w.tzOffsetMin), startAt: w.startAt,
    durationMin: w.durationMin, distanceKm: w.distanceKm, activeKcal: w.activeKcal, avgHr: w.avgHr,
  }));
}

export async function loadTemplates(): Promise<Template[]> {
  return (await db.select().from(schema.workoutTemplates).orderBy(asc(schema.workoutTemplates.name)).all()).map((t) => {
    let exercises: TemplateExercise[] = [];
    try {
      exercises = JSON.parse(t.body);
    } catch {
      /* corrupt template body: show it empty rather than crash */
    }
    return { id: t.id, name: t.name, type: t.type, exercises };
  });
}

export async function getWorkoutsPageData() {
  await connection();
  const [sessions, watches, templates, body, target] = await Promise.all([
    loadSessions(),
    loadWatchWorkouts(),
    loadTemplates(),
    db.select().from(schema.bodyMetrics).orderBy(asc(schema.bodyMetrics.date)).all() as Promise<BodyRow[]>,
    getWeeklyTarget(),
  ]);
  return { sessions, watches, templates, body, target };
}
