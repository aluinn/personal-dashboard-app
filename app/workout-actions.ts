"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
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
  const c = db.$client;
  let id = payload.id ?? 0;
  c.transaction(() => {
    if (id) {
      c.prepare("UPDATE workout_sessions SET date=?,type=?,duration_min=?,distance_km=?,notes=? WHERE id=?").run(w.date, w.type, w.durationMin, w.distanceKm, w.notes, id);
      c.prepare("DELETE FROM workout_exercises WHERE session_id=?").run(id); // sets cascade
    } else {
      id = Number(c.prepare("INSERT INTO workout_sessions (date,type,duration_min,distance_km,notes,created_at) VALUES (?,?,?,?,?,?)").run(w.date, w.type, w.durationMin, w.distanceKm, w.notes, Date.now()).lastInsertRowid);
    }
    const insEx = c.prepare("INSERT INTO workout_exercises (session_id,name,muscle,notes,position) VALUES (?,?,?,?,?)");
    const insSet = c.prepare("INSERT INTO workout_sets (exercise_id,position,reps,weight_kg,rpe) VALUES (?,?,?,?,?)");
    w.exercises.forEach((e, i) => {
      const exId = Number(insEx.run(id, e.name, e.muscle, e.notes, i).lastInsertRowid);
      e.sets.forEach((s, k) => insSet.run(exId, k, s.reps, s.weightKg, s.rpe));
    });
  })();
  refresh();
  return id;
}

export async function deleteWorkout(id: number) {
  db.$client.prepare("DELETE FROM workout_sessions WHERE id=?").run(id);
  refresh();
}

export async function saveTemplate(t: { name: string; type: string; exercises: TemplateExercise[] }) {
  const name = String(t.name ?? "").trim().slice(0, 60);
  if (!name) throw new Error("Give the template a name");
  const w = clean({ date: "2000-01-01", type: t.type, exercises: t.exercises.map((e) => ({ ...e, sets: e.sets })) });
  const body = JSON.stringify(w.exercises.map((e) => ({ name: e.name, muscle: e.muscle, sets: e.sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg })) })));
  db.$client.prepare("INSERT INTO workout_templates (name,type,body,created_at) VALUES (?,?,?,?)").run(name, w.type, body, Date.now());
  refresh();
}

export async function deleteTemplate(id: number) {
  db.$client.prepare("DELETE FROM workout_templates WHERE id=?").run(id);
  refresh();
}

const METRICS = ["weight", "bodyfat", "waist", "chest", "arm", "thigh", "hips"];
export async function saveBodyMetrics(date: string, values: Record<string, number | string | null>) {
  if (!DATE.test(date)) throw new Error("Pick a date");
  const up = db.$client.prepare("INSERT INTO body_metrics (date,metric,value) VALUES (?,?,?) ON CONFLICT(date,metric) DO UPDATE SET value=excluded.value");
  let n = 0;
  db.$client.transaction(() => {
    for (const m of METRICS) {
      const v = num(values[m], 0, m === "bodyfat" ? 80 : 500);
      if (v !== null && v > 0) {
        up.run(date, m, v);
        n++;
      }
    }
  })();
  if (n === 0) throw new Error("Enter at least one measurement");
  refresh();
}

export async function deleteBodyMetric(date: string, metric: string) {
  db.$client.prepare("DELETE FROM body_metrics WHERE date=? AND metric=?").run(date, metric);
  refresh();
}

export async function saveWeeklyTarget(n: number) {
  setSetting("workoutWeeklyTarget", Math.max(1, Math.min(14, Math.round(Number(n) || 4))));
  refresh();
}
