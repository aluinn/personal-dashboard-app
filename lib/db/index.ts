import { createClient, type Client, type InValue, type ResultSet } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import fs from "node:fs";
import path from "node:path";
import { termOf } from "@/lib/academic";
import * as schema from "./schema";

// The database is libSQL (SQLite-compatible), through one of two routes:
//   - TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN): a hosted Turso database. Required on Vercel, which has no
//     persistent disk. Also usable locally, so you can import big files from your Mac into the cloud DB.
//   - otherwise a local file, data/dashboard.db (what `npm run dev` uses by default).
const REMOTE = Boolean(process.env.TURSO_DATABASE_URL);
// On Vercel the only writable place is /tmp, which is wiped between instances. Without Turso configured the
// app still runs there (as a demo whose data doesn't stick) instead of crashing on a read-only disk.
const ON_VERCEL = Boolean(process.env.VERCEL);
export const EPHEMERAL = ON_VERCEL && !REMOTE;
const LOCAL_PATH = ON_VERCEL ? "/tmp/dashboard.db" : path.join(process.cwd(), "data", "dashboard.db");

const BOOTSTRAP = `
CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  notion_url TEXT NOT NULL DEFAULT '',
  lecturer TEXT NOT NULL DEFAULT '',
  year INTEGER NOT NULL DEFAULT 2,
  term TEXT NOT NULL DEFAULT 'All terms'
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'class',
  weekday INTEGER,
  date TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room TEXT NOT NULL DEFAULT '',
  lecturer TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TEXT NOT NULL,
  due_time TEXT NOT NULL DEFAULT '23:59',
  weight INTEGER,
  progress INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT 2,
  term TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm TEXT NOT NULL,
  role TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  programme TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'saved',
  deadline TEXT,
  opens_on TEXT,
  link TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  dedupe_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_opp_dedupe ON opportunities(dedupe_key);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS source_cache (
  key TEXT PRIMARY KEY,
  fetched_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sleep_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  night_date TEXT NOT NULL,
  start_at INTEGER,
  end_at INTEGER,
  tz_offset_min INTEGER NOT NULL DEFAULT 0,
  asleep_min REAL NOT NULL,
  core_min REAL NOT NULL DEFAULT 0,
  deep_min REAL NOT NULL DEFAULT 0,
  rem_min REAL NOT NULL DEFAULT 0,
  awake_min REAL NOT NULL DEFAULT 0,
  unspec_min REAL NOT NULL DEFAULT 0,
  in_bed_min REAL NOT NULL DEFAULT 0,
  is_nap INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sleep_dedupe ON sleep_sessions(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_sleep_night ON sleep_sessions(night_date);
CREATE TABLE IF NOT EXISTS heart_rate_daily (
  day TEXT NOT NULL, source TEXT NOT NULL,
  avg REAL, min REAL, max REAL, resting REAL, samples INTEGER,
  PRIMARY KEY (day, source)
);
CREATE TABLE IF NOT EXISTS hrv_daily (
  day TEXT NOT NULL, source TEXT NOT NULL,
  avg REAL, min REAL, max REAL, samples INTEGER,
  PRIMARY KEY (day, source)
);
CREATE TABLE IF NOT EXISTS steps_daily (
  day TEXT NOT NULL, source TEXT NOT NULL,
  steps REAL, active_kcal REAL,
  PRIMARY KEY (day, source)
);
CREATE TABLE IF NOT EXISTS workouts_imported (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  tz_offset_min INTEGER NOT NULL DEFAULT 0,
  duration_min REAL,
  distance_km REAL,
  active_kcal REAL,
  avg_hr REAL,
  source TEXT NOT NULL,
  dedupe_key TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_dedupe ON workouts_imported(dedupe_key);
CREATE TABLE IF NOT EXISTS workout_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  duration_min REAL,
  distance_km REAL,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wsession_date ON workout_sessions(date);
CREATE TABLE IF NOT EXISTS workout_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  muscle TEXT NOT NULL DEFAULT 'other',
  notes TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_wex_session ON workout_exercises(session_id);
CREATE TABLE IF NOT EXISTS workout_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL,
  weight_kg REAL NOT NULL DEFAULT 0,
  rpe REAL
);
CREATE INDEX IF NOT EXISTS idx_wset_ex ON workout_sets(exercise_id);
CREATE TABLE IF NOT EXISTS workout_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS body_metrics (
  date TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  PRIMARY KEY (date, metric)
);

CREATE TABLE IF NOT EXISTS stimulant_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,            -- caffeine | nicotine
  label TEXT NOT NULL DEFAULT '',
  amount_mg REAL NOT NULL,
  at INTEGER NOT NULL            -- UTC ms
);
CREATE INDEX IF NOT EXISTS stimulant_logs_at ON stimulant_logs(at);

CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS habit_logs (
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  PRIMARY KEY (habit_id, date)
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',  -- grad scheme | masters | other
  status TEXT NOT NULL DEFAULT 'todo',     -- todo | doing | submitted | done
  target_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,            -- notion
  external_id TEXT NOT NULL,
  module_code TEXT NOT NULL,
  year INTEGER NOT NULL DEFAULT 2,
  term TEXT NOT NULL DEFAULT '',
  week INTEGER,
  title TEXT NOT NULL,
  preview TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  words INTEGER NOT NULL DEFAULT 0,
  blocks TEXT NOT NULL DEFAULT '[]',
  url TEXT NOT NULL DEFAULT '',
  edited_at INTEGER NOT NULL,
  synced_at INTEGER NOT NULL,
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS notes_module ON notes(module_code);

CREATE TABLE IF NOT EXISTS done_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,            -- London day, YYYY-MM-DD
  text TEXT NOT NULL,
  at INTEGER NOT NULL            -- UTC ms
);
CREATE INDEX IF NOT EXISTS done_items_date ON done_items(date);

CREATE TABLE IF NOT EXISTS note_files (
  note_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'application/pdf',
  data BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS music_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,            -- practice | release
  minutes INTEGER,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
`;

// Your weekly schedule (Europe/London). weekday: 0 = Mon … 6 = Sun
const SEED_MODULES = [
  { code: "HPSC0124", name: "Science in Government", color: "#2ee6d6", weekday: 1, start: "09:00", end: "11:00" },
  { code: "HPSC0022", name: "Science and Religion", color: "#7c5cff", weekday: 2, start: "11:00", end: "13:00" },
  { code: "HPSC0014", name: "Philosophy of Science 2", color: "#e052ff", weekday: 3, start: "09:00", end: "11:00" },
  { code: "HPSC0037", name: "Thinking about Technology", color: "#ffb347", weekday: 4, start: "09:00", end: "11:00" },
];

// Columns added after a table first shipped (CREATE IF NOT EXISTS can't add them).
async function migrate(c: Client) {
  const cols = async (table: string) => (await c.execute(`PRAGMA table_info(${table})`)).rows.map((r) => String(r.name));
  const opp = await cols("opportunities");
  if (!opp.includes("applied_at")) await c.execute("ALTER TABLE opportunities ADD COLUMN applied_at INTEGER");
  const mod = await cols("modules");
  if (!mod.includes("year")) await c.execute("ALTER TABLE modules ADD COLUMN year INTEGER NOT NULL DEFAULT 2");
  if (!mod.includes("term")) await c.execute("ALTER TABLE modules ADD COLUMN term TEXT NOT NULL DEFAULT 'All terms'");
  const ass = await cols("assessments");
  if (!ass.includes("year")) await c.execute("ALTER TABLE assessments ADD COLUMN year INTEGER NOT NULL DEFAULT 2");
  if (!ass.includes("term")) await c.execute("ALTER TABLE assessments ADD COLUMN term TEXT NOT NULL DEFAULT ''");
  // Tag existing deadlines with their term.
  const untagged = (await c.execute("SELECT id, due_date AS d FROM assessments WHERE term = ''")).rows;
  for (const a of untagged) await c.execute({ sql: "UPDATE assessments SET term = ? WHERE id = ?", args: [termOf(String(a.d)), Number(a.id)] });
}

async function init(c: Client) {
  if (!REMOTE) {
    // Rollback-journal mode, deliberately not WAL: a second process (a script, a DB browser) closing its
    // connection could delete the WAL file this server still has open, losing writes. Single-user app.
    await c.execute("PRAGMA journal_mode = DELETE");
    await c.execute("PRAGMA busy_timeout = 5000");
    await c.execute("PRAGMA foreign_keys = ON");
  }
  await c.executeMultiple(BOOTSTRAP);
  await migrate(c);
  if (Number((await c.execute("SELECT COUNT(*) AS n FROM habits")).rows[0].n) === 0) {
    for (const [i, name] of ["Reading", "Music practice", "Outreach emails"].entries()) {
      await c.execute({ sql: "INSERT INTO habits (name, position) VALUES (?, ?)", args: [name, i] });
    }
  }
  const count = Number((await c.execute("SELECT COUNT(*) AS n FROM modules")).rows[0].n);
  if (count === 0) {
    for (const m of SEED_MODULES) {
      const r = await c.execute({ sql: "INSERT INTO modules (code, name, color) VALUES (?, ?, ?)", args: [m.code, m.name, m.color] });
      await c.execute({
        sql: "INSERT INTO sessions (module_id, title, kind, weekday, start_time, end_time) VALUES (?, ?, 'class', ?, ?, ?)",
        args: [Number(r.lastInsertRowid), `${m.code} ${m.name}`, m.weekday, m.start, m.end],
      });
    }
  }
}

type G = { __libsql?: Client; __dbReady?: Promise<void>; __dbKey?: string };
const g = globalThis as unknown as G;
if (!REMOTE) fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
const raw: Client = (g.__libsql ??= createClient(REMOTE ? { url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN } : { url: `file:${LOCAL_PATH}` }));

// Tables are created / migrated lazily, once per process, on the first query (so building the app never
// touches a database). If the table definitions change while `npm run dev` is running, it runs again.
const KEY = String(BOOTSTRAP.length) + ":" + BOOTSTRAP.slice(-200);
function ensure(): Promise<void> {
  if (!g.__dbReady || g.__dbKey !== KEY) {
    g.__dbKey = KEY;
    g.__dbReady = init(raw).catch((e) => {
      g.__dbReady = undefined;
      throw e;
    });
  }
  return g.__dbReady;
}

const GATED = new Set(["execute", "batch", "transaction", "executeMultiple"]);
export const client: Client = new Proxy(raw, {
  get(target, prop, recv) {
    const v = Reflect.get(target, prop, recv);
    if (typeof v === "function" && GATED.has(String(prop))) {
      return async (...args: unknown[]) => {
        await ensure();
        return (v as (...a: unknown[]) => unknown).apply(target, args);
      };
    }
    return typeof v === "function" ? v.bind(target) : v;
  },
});

export const db = drizzle(client, { schema });
export { schema };

// ---- raw SQL helpers (plain-object rows, safe to pass to client components) --------------------------
type Args = InValue[] | Record<string, InValue>;
const plain = <T>(rs: ResultSet): T[] => rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]])) as T);

export const q = {
  async all<T = Record<string, unknown>>(sql: string, args: Args = []): Promise<T[]> {
    return plain<T>(await client.execute({ sql, args }));
  },
  async get<T = Record<string, unknown>>(sql: string, args: Args = []): Promise<T | undefined> {
    return plain<T>(await client.execute({ sql, args }))[0];
  },
  async run(sql: string, args: Args = []) {
    const r = await client.execute({ sql, args });
    return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid === undefined ? 0 : Number(r.lastInsertRowid) };
  },
  /** Several statements applied atomically (all or nothing). */
  async batch(stmts: { sql: string; args?: Args }[]) {
    if (stmts.length === 0) return [];
    const rs = await client.batch(stmts.map((s) => ({ sql: s.sql, args: s.args ?? [] })), "write");
    return rs.map((r) => ({ changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid === undefined ? 0 : Number(r.lastInsertRowid) }));
  },
};
