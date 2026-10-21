import "server-only";
import { q } from "./index";
import { getSetting } from "./opp";
import { PROJECTS, type Habit, type ProjectLinks } from "@/lib/life";

export async function loadHabits(sinceDate: string): Promise<Habit[]> {
  const [habits, logs] = await Promise.all([
    q.all<{ id: number; name: string }>("SELECT id, name FROM habits WHERE archived = 0 ORDER BY position, id"),
    q.all<{ habit_id: number; date: string }>("SELECT habit_id, date FROM habit_logs WHERE date >= ?", [sinceDate]),
  ]);
  return habits.map((h) => ({ ...h, dates: logs.filter((l) => l.habit_id === h.id).map((l) => l.date) }));
}

export type DoneItem = { id: number; text: string; at: number };
export const loadDone = (date: string) => q.all<DoneItem>("SELECT id, text, at FROM done_items WHERE date = ? ORDER BY at DESC, id DESC", [date]);
/** Things you've logged recently, most frequent first, for one-tap re-adding. */
export const recentDoneTexts = (sinceDate: string) =>
  q.all<{ text: string; n: number }>("SELECT text, COUNT(*) n FROM done_items WHERE date >= ? GROUP BY text ORDER BY n DESC, MAX(at) DESC LIMIT 6", [sinceDate]);

export type Goal = { id: number; title: string; category: string; status: string; targetDate: string | null; notes: string };
export const loadGoals = () =>
  q.all<Goal>("SELECT id, title, category, status, target_date AS targetDate, notes FROM goals ORDER BY (target_date IS NULL), target_date, id");

export type MusicEntry = { id: number; date: string; kind: string; minutes: number | null; title: string; notes: string };
export const loadMusic = (limit = 60) =>
  q.all<MusicEntry>("SELECT id, date, kind, minutes, title, notes FROM music_log ORDER BY date DESC, id DESC LIMIT ?", [limit]);

export async function getProjectLinks(): Promise<ProjectLinks> {
  const saved = await getSetting<ProjectLinks>("projectLinks", {});
  return Object.fromEntries(PROJECTS.map((p) => [p.key, saved[p.key] ?? []]));
}
