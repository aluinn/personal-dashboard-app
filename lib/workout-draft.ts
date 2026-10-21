// Editable form state for the workout logger (strings, so half-typed numbers never fight the user)
// plus the conversions between drafts, saved sessions, templates and the save payload.
import { MUSCLES, categoryOfType, inferMuscle, type TemplateExercise } from "./exercises";
import type { WorkoutPayload } from "@/app/workout-actions";
import { exerciseSeries, type WSession } from "./workouts";

export type DraftSet = { reps: string; weightKg: string; rpe: string };
export type DraftEx = { key: string; name: string; muscle: string; notes: string; sets: DraftSet[] };
export type Draft = {
  id?: number;
  date: string;
  type: string;
  durationMin: string;
  distanceKm: string;
  notes: string;
  exercises: DraftEx[];
};

let counter = 0;
export const newKey = () => `ex${Date.now().toString(36)}${counter++}`;
const s = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(Math.round(n * 100) / 100));
export const blankSet = (): DraftSet => ({ reps: "", weightKg: "", rpe: "" });
export const blankExercise = (): DraftEx => ({ key: newKey(), name: "", muscle: "other", notes: "", sets: [blankSet()] });

export const blankDraft = (date: string, type = "push"): Draft => ({ date, type, durationMin: "", distanceKm: "", notes: "", exercises: [] });

export function draftFromSession(x: WSession): Draft {
  return {
    id: x.id,
    date: x.date,
    type: x.type,
    durationMin: s(x.durationMin),
    distanceKm: s(x.distanceKm),
    notes: x.notes,
    exercises: x.exercises.map((e) => ({
      key: newKey(), name: e.name, muscle: e.muscle, notes: e.notes,
      sets: e.sets.map((t) => ({ reps: String(t.reps), weightKg: String(t.weightKg || ""), rpe: s(t.rpe) })),
    })),
  };
}

/** "Repeat last session": same lifts, sets and weights as a starting point, fresh date, no notes/RPE. */
export function draftRepeat(x: WSession, date: string): Draft {
  const d = draftFromSession(x);
  return { ...d, id: undefined, date, notes: "", exercises: d.exercises.map((e) => ({ ...e, notes: "", sets: e.sets.map((t) => ({ ...t, rpe: "" })) })) };
}

export function draftFromTemplate(name: string, type: string, exercises: TemplateExercise[], date: string): Draft {
  return {
    date, type, durationMin: "", distanceKm: "", notes: "",
    exercises: exercises.map((e) => ({
      key: newKey(), name: e.name, muscle: e.muscle, notes: "",
      sets: e.sets.map((t) => ({ reps: String(t.reps), weightKg: t.weightKg ? String(t.weightKg) : "", rpe: "" })),
    })),
  };
}

export function toPayload(d: Draft): WorkoutPayload {
  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    id: d.id,
    date: d.date,
    type: d.type,
    durationMin: n(d.durationMin),
    distanceKm: n(d.distanceKm),
    notes: d.notes,
    exercises: d.exercises.map((e) => ({
      name: e.name,
      muscle: e.muscle,
      notes: e.notes,
      sets: e.sets.map((t) => ({ reps: Number(t.reps) || 0, weightKg: Number(t.weightKg) || 0, rpe: n(t.rpe) })),
    })),
  };
}

export function toTemplateExercises(d: Draft): TemplateExercise[] {
  return d.exercises
    .filter((e) => e.name.trim() && e.sets.some((t) => Number(t.reps) > 0))
    .map((e) => ({
      name: e.name.trim(),
      muscle: (MUSCLES.some((m) => m.key === e.muscle) ? e.muscle : inferMuscle(e.name)) as TemplateExercise["muscle"],
      sets: e.sets.filter((t) => Number(t.reps) > 0).map((t) => ({ reps: Number(t.reps), weightKg: Number(t.weightKg) || 0 })),
    }));
}

export const draftStats = (d: Draft) => {
  let sets = 0;
  let volume = 0;
  for (const e of d.exercises)
    for (const t of e.sets) {
      const r = Number(t.reps) || 0;
      if (r > 0) {
        sets++;
        volume += r * (Number(t.weightKg) || 0);
      }
    }
  return { sets, volume };
};

/** The lifts in this draft that would be new personal records once saved (checked against history). */
export function newPRsFor(history: WSession[], d: Draft): { name: string; e1rm: number }[] {
  const p = toPayload(d);
  const fake: WSession = {
    id: d.id ?? -1,
    date: d.date,
    type: d.type,
    durationMin: null,
    distanceKm: null,
    notes: "",
    exercises: p.exercises.map((e, i) => ({ id: i, name: e.name, muscle: e.muscle ?? "other", notes: "", sets: e.sets.map((x) => ({ reps: x.reps, weightKg: x.weightKg, rpe: x.rpe ?? null })) })),
  };
  const all = [...history.filter((h) => h.id !== fake.id), fake];
  const out: { name: string; e1rm: number }[] = [];
  for (const name of new Set(fake.exercises.map((e) => e.name.trim()).filter(Boolean))) {
    const pt = exerciseSeries(all, name).find((x) => x.sessionId === fake.id);
    if (pt?.isPR) out.push({ name, e1rm: pt.e1rm });
  }
  return out;
}

export { categoryOfType };
