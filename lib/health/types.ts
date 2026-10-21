// One normalised shape every importer (Apple XML, Health Auto Export JSON/CSV, the ingest
// endpoint) produces. lib/health/store.ts is the only thing that writes it to the database.

export type SleepNight = {
  nightDate: string; // local wake-up date
  startAt: number | null;
  endAt: number | null;
  tzOffsetMin: number;
  asleepMin: number;
  coreMin: number;
  deepMin: number;
  remMin: number;
  awakeMin: number;
  unspecMin: number;
  inBedMin: number;
  isNap: boolean;
  /** Distinguishes several sessions on one night (main 0, main 1, nap 0 …). */
  index: number;
};

export type HrDay = { day: string; avg?: number | null; min?: number | null; max?: number | null; resting?: number | null; samples?: number | null };
export type HrvDay = { day: string; avg?: number | null; min?: number | null; max?: number | null; samples?: number | null };
export type StepsDay = { day: string; steps?: number | null; activeKcal?: number | null };
export type WorkoutRow = {
  type: string;
  startAt: number;
  endAt: number;
  tzOffsetMin: number;
  durationMin?: number | null;
  distanceKm?: number | null;
  activeKcal?: number | null;
  avgHr?: number | null;
};

export type HealthBatch = {
  sleep: SleepNight[];
  hr: HrDay[];
  hrv: HrvDay[];
  steps: StepsDay[];
  workouts: WorkoutRow[];
};

export const emptyBatch = (): HealthBatch => ({ sleep: [], hr: [], hrv: [], steps: [], workouts: [] });

export type Source = "manual" | "apple" | "hae" | "api";
