import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const modules = sqliteTable("modules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  notionUrl: text("notion_url").notNull().default(""),
  lecturer: text("lecturer").notNull().default(""),
  year: integer("year").notNull().default(2),
  term: text("term").notNull().default("All terms"),
});

// Times are London wall-clock strings ("HH:MM"), so DST never shifts a class.
// Weekly classes have `weekday` (0 = Mon … 6 = Sun) and no `date`;
// one-off events have a `date` ("YYYY-MM-DD") and no `weekday`.
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  moduleId: integer("module_id").references(() => modules.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("class"), // class | event | exam | deadline
  weekday: integer("weekday"),
  date: text("date"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  room: text("room").notNull().default(""),
  lecturer: text("lecturer").notNull().default(""),
  location: text("location").notNull().default(""),
});

export const assessments = sqliteTable("assessments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  moduleId: integer("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: text("due_date").notNull(), // "YYYY-MM-DD" (London)
  dueTime: text("due_time").notNull().default("23:59"),
  weight: integer("weight"), // % of module mark, optional
  progress: integer("progress").notNull().default(0), // 0-100, 100 = done
  year: integer("year").notNull().default(2),
  term: text("term").notNull().default(""),
});

// ---- Opportunities ----------------------------------------------------
// status: feed (unsorted inbox) | saved | applied | online_test | interview | offer | rejected | dismissed
export const opportunities = sqliteTable("opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firm: text("firm").notNull(),
  role: text("role").notNull(),
  type: text("type").notNull().default("other"), // finance | tech | other
  programme: text("programme").notNull().default("other"), // spring week | summer internship | placement | grad | other
  status: text("status").notNull().default("saved"),
  deadline: text("deadline"), // YYYY-MM-DD
  opensOn: text("opens_on"), // YYYY-MM-DD
  link: text("link").notNull().default(""),
  notes: text("notes").notNull().default(""),
  description: text("description").notNull().default(""),
  location: text("location").notNull().default(""),
  source: text("source").notNull().default("manual"),
  dedupeKey: text("dedupe_key").notNull(),
  createdAt: integer("created_at").notNull(),
  appliedAt: integer("applied_at"), // when it first reached Applied or later (UTC ms)
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Cached responses + daily call counters for public sources.
export const sourceCache = sqliteTable("source_cache", {
  key: text("key").primaryKey(),
  fetchedAt: integer("fetched_at").notNull(),
  payload: text("payload").notNull(),
});

// ---- Health data ------------------------------------------------------
// `source` ranks duplicates when several imports cover the same night/day:
// manual > apple (export.xml) > hae (Health Auto Export) > api (/api/ingest/health).
export const sleepSessions = sqliteTable("sleep_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nightDate: text("night_date").notNull(), // local date you woke up, YYYY-MM-DD
  startAt: integer("start_at"), // sleep onset, UTC ms (null for totals-only imports)
  endAt: integer("end_at"),
  tzOffsetMin: integer("tz_offset_min").notNull().default(0), // local offset when recorded
  asleepMin: real("asleep_min").notNull(),
  coreMin: real("core_min").notNull().default(0),
  deepMin: real("deep_min").notNull().default(0),
  remMin: real("rem_min").notNull().default(0),
  awakeMin: real("awake_min").notNull().default(0),
  unspecMin: real("unspec_min").notNull().default(0), // asleep, stage unknown
  inBedMin: real("in_bed_min").notNull().default(0),
  isNap: integer("is_nap").notNull().default(0),
  source: text("source").notNull(),
  dedupeKey: text("dedupe_key").notNull(), // source|night|main-or-nap|index
  createdAt: integer("created_at").notNull(),
});

export const heartRateDaily = sqliteTable(
  "heart_rate_daily",
  {
    day: text("day").notNull(),
    source: text("source").notNull(),
    avg: real("avg"),
    min: real("min"),
    max: real("max"),
    resting: real("resting"),
    samples: integer("samples"),
  },
  (t) => [primaryKey({ columns: [t.day, t.source] })],
);

export const hrvDaily = sqliteTable(
  "hrv_daily",
  {
    day: text("day").notNull(),
    source: text("source").notNull(),
    avg: real("avg"), // SDNN, ms
    min: real("min"),
    max: real("max"),
    samples: integer("samples"),
  },
  (t) => [primaryKey({ columns: [t.day, t.source] })],
);

export const stepsDaily = sqliteTable(
  "steps_daily",
  {
    day: text("day").notNull(),
    source: text("source").notNull(),
    steps: real("steps"),
    activeKcal: real("active_kcal"),
  },
  (t) => [primaryKey({ columns: [t.day, t.source] })],
);

export const workoutsImported = sqliteTable("workouts_imported", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  startAt: integer("start_at").notNull(),
  endAt: integer("end_at").notNull(),
  tzOffsetMin: integer("tz_offset_min").notNull().default(0),
  durationMin: real("duration_min"),
  distanceKm: real("distance_km"),
  activeKcal: real("active_kcal"),
  avgHr: real("avg_hr"),
  source: text("source").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
});

// ---- Workouts ---------------------------------------------------------
export const workoutSessions = sqliteTable("workout_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD (local)
  type: text("type").notNull(), // push | pull | legs | upper | lower | full body | run | cycle | sport | other
  durationMin: real("duration_min"),
  distanceKm: real("distance_km"),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

export const workoutExercises = sqliteTable("workout_exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  muscle: text("muscle").notNull().default("other"),
  notes: text("notes").notNull().default(""),
  position: integer("position").notNull().default(0),
});

export const workoutSets = sqliteTable("workout_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exerciseId: integer("exercise_id").notNull().references(() => workoutExercises.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  reps: integer("reps").notNull(),
  weightKg: real("weight_kg").notNull().default(0),
  rpe: real("rpe"),
});

export const workoutTemplates = sqliteTable("workout_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  body: text("body").notNull(), // JSON: [{name, muscle, sets:[{reps, weightKg}]}]
  createdAt: integer("created_at").notNull(),
});

export const bodyMetrics = sqliteTable(
  "body_metrics",
  {
    date: text("date").notNull(),
    metric: text("metric").notNull(), // weight | bodyfat | waist | chest | arm | thigh | hips
    value: real("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.date, t.metric] })],
);
