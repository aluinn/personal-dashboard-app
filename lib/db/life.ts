import "server-only";
import { db } from "./index";
import { getSetting } from "./opp";
import { PROJECTS, type Habit, type ProjectLinks } from "@/lib/life";

const DEFAULT_HABITS = ["Reading", "Music practice", "Outreach emails"];

export function loadHabits(sinceDate: string): Habit[] {
  const c = db.$client;
  if ((c.prepare("SELECT COUNT(*) n FROM habits").get() as { n: number }).n === 0) {
    const ins = c.prepare("INSERT INTO habits (name, position) VALUES (?, ?)");
    DEFAULT_HABITS.forEach((n, i) => ins.run(n, i));
  }
  const habits = c.prepare("SELECT id, name FROM habits WHERE archived = 0 ORDER BY position, id").all() as { id: number; name: string }[];
  const logs = c.prepare("SELECT habit_id, date FROM habit_logs WHERE date >= ?").all(sinceDate) as { habit_id: number; date: string }[];
  return habits.map((h) => ({ ...h, dates: logs.filter((l) => l.habit_id === h.id).map((l) => l.date) }));
}

export type Goal = { id: number; title: string; category: string; status: string; targetDate: string | null; notes: string };
export const loadGoals = (): Goal[] =>
  db.$client
    .prepare("SELECT id, title, category, status, target_date AS targetDate, notes FROM goals ORDER BY (target_date IS NULL), target_date, id")
    .all() as Goal[];

export type MusicEntry = { id: number; date: string; kind: string; minutes: number | null; title: string; notes: string };
export const loadMusic = (limit = 60): MusicEntry[] =>
  db.$client.prepare("SELECT id, date, kind, minutes, title, notes FROM music_log ORDER BY date DESC, id DESC LIMIT ?").all(limit) as MusicEntry[];

export function getProjectLinks(): ProjectLinks {
  const saved = getSetting<ProjectLinks>("projectLinks", {});
  return Object.fromEntries(PROJECTS.map((p) => [p.key, saved[p.key] ?? []]));
}
