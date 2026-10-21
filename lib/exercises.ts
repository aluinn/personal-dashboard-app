// Exercise library used for autocomplete, muscle-group mapping (the balance radar) and starter templates.
export const MUSCLES = [
  { key: "chest", label: "Chest" },
  { key: "back", label: "Back" },
  { key: "shoulders", label: "Shoulders" },
  { key: "arms", label: "Arms" },
  { key: "quads", label: "Quads & calves" },
  { key: "posterior", label: "Hams & glutes" },
  { key: "core", label: "Core" },
] as const;
export type MuscleKey = (typeof MUSCLES)[number]["key"] | "other";

export const WORKOUT_TYPES = ["push", "pull", "legs", "upper", "lower", "full body", "run", "cycle", "sport", "other"] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];
export const STRENGTH_TYPES: string[] = ["push", "pull", "legs", "upper", "lower", "full body"];

export const LIBRARY: { name: string; muscle: MuscleKey }[] = [
  { name: "Bench Press", muscle: "chest" }, { name: "Incline Bench Press", muscle: "chest" }, { name: "Dumbbell Bench Press", muscle: "chest" },
  { name: "Incline Dumbbell Press", muscle: "chest" }, { name: "Chest Fly", muscle: "chest" }, { name: "Cable Fly", muscle: "chest" },
  { name: "Push-up", muscle: "chest" }, { name: "Dips", muscle: "chest" },
  { name: "Overhead Press", muscle: "shoulders" }, { name: "Dumbbell Shoulder Press", muscle: "shoulders" }, { name: "Lateral Raise", muscle: "shoulders" },
  { name: "Face Pull", muscle: "shoulders" }, { name: "Rear Delt Fly", muscle: "shoulders" }, { name: "Arnold Press", muscle: "shoulders" },
  { name: "Triceps Pushdown", muscle: "arms" }, { name: "Skull Crusher", muscle: "arms" }, { name: "Overhead Triceps Extension", muscle: "arms" },
  { name: "Barbell Curl", muscle: "arms" }, { name: "Dumbbell Curl", muscle: "arms" }, { name: "Hammer Curl", muscle: "arms" }, { name: "Preacher Curl", muscle: "arms" },
  { name: "Pull-up", muscle: "back" }, { name: "Chin-up", muscle: "back" }, { name: "Lat Pulldown", muscle: "back" }, { name: "Barbell Row", muscle: "back" },
  { name: "Dumbbell Row", muscle: "back" }, { name: "Seated Cable Row", muscle: "back" }, { name: "T-Bar Row", muscle: "back" }, { name: "Shrug", muscle: "back" },
  { name: "Squat", muscle: "quads" }, { name: "Front Squat", muscle: "quads" }, { name: "Leg Press", muscle: "quads" }, { name: "Lunge", muscle: "quads" },
  { name: "Bulgarian Split Squat", muscle: "quads" }, { name: "Leg Extension", muscle: "quads" }, { name: "Hack Squat", muscle: "quads" }, { name: "Calf Raise", muscle: "quads" },
  { name: "Deadlift", muscle: "posterior" }, { name: "Romanian Deadlift", muscle: "posterior" }, { name: "Hip Thrust", muscle: "posterior" },
  { name: "Leg Curl", muscle: "posterior" }, { name: "Good Morning", muscle: "posterior" }, { name: "Glute Bridge", muscle: "posterior" }, { name: "Back Extension", muscle: "posterior" },
  { name: "Plank", muscle: "core" }, { name: "Hanging Leg Raise", muscle: "core" }, { name: "Cable Crunch", muscle: "core" }, { name: "Ab Wheel", muscle: "core" }, { name: "Crunch", muscle: "core" },
];

// Ordered: first match wins, so "romanian deadlift" is caught before plain "deadlift" etc.
const RULES: [RegExp, MuscleKey][] = [
  [/romanian|rdl|hip thrust|glute|leg curl|hamstring|good morning|back extension|deadlift|pull[- ]through|nordic/i, "posterior"],
  [/triceps?|skull|pushdown|tricep|curl|bicep|hammer|preacher/i, "arms"],
  [/lateral raise|face pull|rear delt|shoulder|overhead press|ohp|military|arnold|upright row|front raise/i, "shoulders"],
  [/bench|chest|fly|flye|push[- ]?up|pec|dip/i, "chest"],
  [/pull[- ]?up|chin[- ]?up|pulldown|lat |row|shrug|pullover|back/i, "back"],
  [/squat|leg press|lunge|leg extension|quad|hack|calf|step[- ]?up|split squat/i, "quads"],
  [/plank|crunch|leg raise|ab |abs|core|sit[- ]?up|russian|wheel|woodchop/i, "core"],
];

export function inferMuscle(name: string): MuscleKey {
  const lib = LIBRARY.find((e) => e.name.toLowerCase() === name.trim().toLowerCase());
  if (lib) return lib.muscle;
  for (const [re, m] of RULES) if (re.test(name)) return m;
  return "other";
}

export type TemplateExercise = { name: string; muscle: MuscleKey; sets: { reps: number; weightKg: number }[] };

const ex = (name: string, sets = 3, reps = 8): TemplateExercise => ({ name, muscle: inferMuscle(name), sets: Array.from({ length: sets }, () => ({ reps, weightKg: 0 })) });

/** Starter templates (exercise lists only, no weights): yours are added next to these. */
export const BUILTIN_TEMPLATES: { name: string; type: WorkoutType; exercises: TemplateExercise[] }[] = [
  { name: "Push", type: "push", exercises: [ex("Bench Press", 4, 6), ex("Overhead Press", 3, 8), ex("Incline Dumbbell Press", 3, 10), ex("Lateral Raise", 3, 12), ex("Triceps Pushdown", 3, 12)] },
  { name: "Pull", type: "pull", exercises: [ex("Pull-up", 4, 6), ex("Barbell Row", 4, 8), ex("Seated Cable Row", 3, 10), ex("Face Pull", 3, 15), ex("Barbell Curl", 3, 10)] },
  { name: "Legs", type: "legs", exercises: [ex("Squat", 4, 6), ex("Romanian Deadlift", 3, 8), ex("Leg Press", 3, 10), ex("Leg Curl", 3, 12), ex("Calf Raise", 4, 12)] },
  { name: "Upper", type: "upper", exercises: [ex("Bench Press", 3, 8), ex("Barbell Row", 3, 8), ex("Overhead Press", 3, 8), ex("Lat Pulldown", 3, 10), ex("Dumbbell Curl", 2, 12), ex("Triceps Pushdown", 2, 12)] },
  { name: "Lower", type: "lower", exercises: [ex("Squat", 4, 6), ex("Deadlift", 3, 5), ex("Bulgarian Split Squat", 3, 10), ex("Leg Curl", 3, 12), ex("Calf Raise", 3, 12)] },
  { name: "Full body", type: "full body", exercises: [ex("Squat", 3, 5), ex("Bench Press", 3, 5), ex("Barbell Row", 3, 8), ex("Overhead Press", 2, 8), ex("Romanian Deadlift", 2, 8)] },
];

/** Run / cycle sessions log distance; everything else can carry lifts. */
export const categoryOfType = (t: string): "strength" | "run" | "cycle" | "other" =>
  STRENGTH_TYPES.includes(t) ? "strength" : t === "run" ? "run" : t === "cycle" ? "cycle" : "other";
