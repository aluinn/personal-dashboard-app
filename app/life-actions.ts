"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { setSetting } from "@/lib/db/opp";
import { GOAL_CATEGORIES, GOAL_STATUSES, PROJECTS } from "@/lib/life";
import { londonToday } from "@/lib/time";

const refresh = () => revalidatePath("/", "layout");
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

// ---- habits
export async function toggleHabit(id: number, date: string) {
  if (!isDate(date) || date > londonToday()) throw new Error("Bad date");
  const c = db.$client;
  const del = c.prepare("DELETE FROM habit_logs WHERE habit_id = ? AND date = ?").run(Number(id), date);
  if (del.changes === 0) c.prepare("INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)").run(Number(id), date);
  refresh();
}
export async function addHabit(f: FormData) {
  const name = s(f, "name").slice(0, 40);
  if (!name) return;
  const pos = (db.$client.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM habits").get() as { p: number }).p;
  db.$client.prepare("INSERT INTO habits (name, position) VALUES (?, ?)").run(name, pos);
  refresh();
}
export async function archiveHabit(id: number) {
  db.$client.prepare("UPDATE habits SET archived = 1 WHERE id = ?").run(Number(id));
  refresh();
}

// ---- goals
export async function saveGoal(f: FormData) {
  const title = s(f, "title").slice(0, 120);
  if (!title) return;
  const category = (GOAL_CATEGORIES as readonly string[]).includes(s(f, "category")) ? s(f, "category") : "other";
  const target = isDate(s(f, "targetDate")) ? s(f, "targetDate") : null;
  db.$client.prepare("INSERT INTO goals (title, category, target_date, notes, created_at) VALUES (?, ?, ?, ?, ?)").run(title, category, target, s(f, "notes").slice(0, 500), Date.now());
  refresh();
}
export async function setGoalStatus(id: number, status: string) {
  if (!GOAL_STATUSES.some((x) => x.key === status)) throw new Error("Bad status");
  db.$client.prepare("UPDATE goals SET status = ? WHERE id = ?").run(status, Number(id));
  refresh();
}
export async function deleteGoal(id: number) {
  db.$client.prepare("DELETE FROM goals WHERE id = ?").run(Number(id));
  refresh();
}

// ---- music log
export async function addMusic(f: FormData) {
  const kind = s(f, "kind") === "release" ? "release" : "practice";
  const date = isDate(s(f, "date")) ? s(f, "date") : londonToday();
  const minutes = Math.round(Number(f.get("minutes")));
  db.$client
    .prepare("INSERT INTO music_log (date, kind, minutes, title, notes) VALUES (?, ?, ?, ?, ?)")
    .run(date, kind, Number.isFinite(minutes) && minutes > 0 ? Math.min(minutes, 1440) : null, s(f, "title").slice(0, 100), s(f, "notes").slice(0, 300));
  refresh();
}
export async function deleteMusic(id: number) {
  db.$client.prepare("DELETE FROM music_log WHERE id = ?").run(Number(id));
  refresh();
}

// ---- project links: "Label | https://…" per line
export async function saveProjectLinks(f: FormData) {
  const out: Record<string, { label: string; url: string }[]> = {};
  for (const p of PROJECTS) {
    out[p.key] = s(f, `links_${p.key}`)
      .split("\n")
      .map((l) => l.split("|").map((x) => x.trim()))
      .map(([a, b]) => (b ? { label: a, url: b } : { label: a?.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] ?? "", url: a ?? "" }))
      .filter((l) => /^https?:\/\//i.test(l.url))
      .slice(0, 8);
  }
  setSetting("projectLinks", out);
  refresh();
}
