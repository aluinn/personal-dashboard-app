"use server";

import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { setSetting } from "@/lib/db/opp";
import { WORKOUT_TYPES, inferMuscle, type TemplateExercise } from "@/lib/exercises";

export type WorkoutPayload = {
  id?: number;
  date: string;
  type: string;
  durationMin?: number | null;
  distanceKm?: number | null;
  notes?: string;
  exercises: { name: string; muscle?: string; notes?: string; sets: { reps: number; weightKg: number; rpe?: number | null }[] }[];
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const refresh = () => revalidatePath("/", "layout");
const num = (v: unknown, lo: number, hi: number): number | null => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : Math.min(hi, Math.max(lo, n));
};
const MUSCLE_KEYS = ["chest", "back", "shoulders", "arms", "quads", "posterior", "core", "other"];

function clean(p: WorkoutPayload) {
  if (!DATE.test(p.date)) throw new Error("Pick a date");
  const type = (WORKOUT_TYPES as readonly string[]).includes(p.type) ? p.type : "other";
  if (!Array.isArray(p.exercises) || p.exercises.length > 40) throw new Error("Too many exercises");
  const exercises = p.exercises
    .map((e) => ({
      name: String(e.name ?? "").trim().slice(0, 80),
      muscle: MUSCLE_KEYS.includes(String(e.muscle)) ? String(e.muscle) : inferMuscle(String(e.name ?? "")),
      notes: String(e.notes ?? "").slice(0, 500),
      sets: (Array.isArray(e.sets) ? e.sets : []).slice(0, 40).flatMap((s) => {
        const reps = num(s.reps, 0, 500);
        if (!reps) return []; // blank row
        return [{ reps: Math.round(reps), weightKg: num(s.weightKg, 0, 1500) ?? 0, rpe: num(s.rpe, 1, 10) }];
      }),
    }))
    .filter((e) => e.name && e.sets.length > 0);
  return {
    date: p.date,
    type,
    durationMin: num(p.durationMin, 1, 1000),
    distanceKm: num(p.distanceKm, 0, 1000),
    notes: String(p.notes ?? "").slice(0, 2000),
    exercises,
  };
}

export async function saveWorkout(payload: WorkoutPayload) {
  const w = clean(payload);
  if (w.exercises.length === 0 && !w.durationMin && !w.distanceKm) throw new Error("Add an exercise with at least one set, or a duration");
  let id = payload.id ?? 0;
  // One atomic batch. New rows are linked with SQL (last_insert_rowid / MAX(id)) because ids aren't known up front.
  type S = { sql: string; args: (string | number | null)[] };
  const stmts: S[] = [];
  if (id) {
    stmts.push({ sql: "UPDATE workout_sessions SET date=?,type=?,duration_min=?,distance_km=?,notes=? WHERE id=?", args: [w.date, w.type, w.durationMin, w.distanceKm, w.notes, id] });
    stmts.push({ sql: "DELETE FROM workout_sets WHERE exercise_id IN (SELECT id FROM workout_exercises WHERE session_id=?)", args: [id] });
    stmts.push({ sql: "DELETE FROM workout_exercises WHERE session_id=?", args: [id] });
  } else {
    stmts.push({ sql: "INSERT INTO workout_sessions (date,type,duration_min,distance_km,notes,created_at) VALUES (?,?,?,?,?,?)", args: [w.date, w.type, w.durationMin, w.distanceKm, w.notes, Date.now()] });
  }
  const sessionRef = id ? "?" : "(SELECT MAX(id) FROM workout_sessions)";
  w.exercises.forEach((e, i) => {
    stmts.push({ sql: `INSERT INTO workout_exercises (session_id,name,muscle,notes,position) VALUES (${sessionRef},?,?,?,?)`, args: [...(id ? [id] : []), e.name, e.muscle, e.notes, i] });
    e.sets.forEach((s, k) => stmts.push({ sql: "INSERT INTO workout_sets (exercise_id,position,reps,weight_kg,rpe) VALUES ((SELECT MAX(id) FROM workout_exercises),?,?,?,?)", args: [k, s.reps, s.weightKg, s.rpe] }));
  });
  const results = await q.batch(stmts);
  if (!id) id = results[0].lastInsertRowid;
  refresh();
  return id;
}

export async function deleteWorkout(id: number) {
  await q.batch([
    { sql: "DELETE FROM workout_sets WHERE exercise_id IN (SELECT id FROM workout_exercises WHERE session_id=?)", args: [id] },
    { sql: "DELETE FROM workout_exercises WHERE session_id=?", args: [id] },
    { sql: "DELETE FROM workout_sessions WHERE id=?", args: [id] },
  ]);
  refresh();
}

export async function saveTemplate(t: { name: string; type: string; exercises: TemplateExercise[] }) {
  const name = String(t.name ?? "").trim().slice(0, 60);
  if (!name) throw new Error("Give the template a name");
  const w = clean({ date: "2000-01-01", type: t.type, exercises: t.exercises.map((e) => ({ ...e, sets: e.sets })) });
  const body = JSON.stringify(w.exercises.map((e) => ({ name: e.name, muscle: e.muscle, sets: e.sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg })) })));
  await q.run("INSERT INTO workout_templates (name,type,body,created_at) VALUES (?,?,?,?)", [name, w.type, body, Date.now()]);
  refresh();
}

export async function deleteTemplate(id: number) {
  await q.run("DELETE FROM workout_templates WHERE id=?", [id]);
  refresh();
}

const METRICS = ["weight", "bodyfat", "waist", "chest", "arm", "thigh", "hips"];
export async function saveBodyMetrics(date: string, values: Record<string, number | string | null>) {
  if (!DATE.test(date)) throw new Error("Pick a date");
  const stmts: { sql: string; args: (string | number)[] }[] = [];
  for (const m of METRICS) {
    const v = num(values[m], 0, m === "bodyfat" ? 80 : 500);
    if (v !== null && v > 0) stmts.push({ sql: "INSERT INTO body_metrics (date,metric,value) VALUES (?,?,?) ON CONFLICT(date,metric) DO UPDATE SET value=excluded.value", args: [date, m, v] });
  }
  if (stmts.length === 0) throw new Error("Enter at least one measurement");
  await q.batch(stmts);
  refresh();
}

export async function deleteBodyMetric(date: string, metric: string) {
  await q.run("DELETE FROM body_metrics WHERE date=? AND metric=?", [date, metric]);
  refresh();
}

export async function saveWeeklyTarget(n: number) {
  await setSetting("workoutWeeklyTarget", Math.max(1, Math.min(14, Math.round(Number(n) || 4))));
  refresh();
}
