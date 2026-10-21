"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { CURRENT_YEAR, MODULE_TERMS, termOf } from "@/lib/academic";
import { getTermDates } from "@/lib/db/academic";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(f.get(k));
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;

function refresh() {
  revalidatePath("/", "layout");
}

export async function updateModule(f: FormData) {
  const url = str(f, "notionUrl");
  if (url && !/^https:\/\//i.test(url)) throw new Error("Notion URL must start with https://");
  const color = str(f, "color");
  db.update(schema.modules)
    .set({
      name: str(f, "name") || undefined,
      notionUrl: url,
      lecturer: str(f, "lecturer"),
      ...(MODULE_TERMS.includes(str(f, "term") as never) ? { term: str(f, "term") } : {}),
      ...(COLOR.test(color) ? { color } : {}),
    })
    .where(eq(schema.modules.id, num(f, "id")))
    .run();
  refresh();
}

export async function updateSession(f: FormData) {
  db.update(schema.sessions)
    .set({ room: str(f, "room"), lecturer: str(f, "lecturer"), location: str(f, "location") })
    .where(eq(schema.sessions.id, num(f, "id")))
    .run();
  refresh();
}

export async function addEvent(f: FormData) {
  const date = str(f, "date");
  const start = str(f, "startTime");
  const end = str(f, "endTime") || start;
  const title = str(f, "title");
  if (!title || !DATE.test(date) || !TIME.test(start) || !TIME.test(end)) throw new Error("Invalid event");
  const moduleId = num(f, "moduleId");
  db.insert(schema.sessions)
    .values({
      title,
      kind: ["event", "exam", "deadline"].includes(str(f, "kind")) ? str(f, "kind") : "event",
      moduleId: moduleId > 0 ? moduleId : null,
      date,
      startTime: start,
      endTime: end,
      room: str(f, "room"),
      location: str(f, "location"),
    })
    .run();
  refresh();
}

export async function deleteSession(f: FormData) {
  db.delete(schema.sessions).where(eq(schema.sessions.id, num(f, "id"))).run();
  refresh();
}

export async function addAssessment(f: FormData) {
  const title = str(f, "title");
  const dueDate = str(f, "dueDate");
  const dueTime = str(f, "dueTime") || "23:59";
  const w = str(f, "weight");
  if (!title || !DATE.test(dueDate) || !TIME.test(dueTime)) throw new Error("Invalid assessment");
  db.insert(schema.assessments)
    .values({
      moduleId: num(f, "moduleId"),
      title,
      dueDate,
      dueTime,
      weight: w ? Math.max(0, Math.min(100, Math.round(Number(w)))) : null,
      year: CURRENT_YEAR,
      term: termOf(dueDate, getTermDates()),
    })
    .run();
  refresh();
}

export async function setProgress(id: number, progress: number) {
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  db.update(schema.assessments).set({ progress: p }).where(eq(schema.assessments.id, id)).run();
  refresh();
}

export async function deleteAssessment(f: FormData) {
  db.delete(schema.assessments).where(eq(schema.assessments.id, num(f, "id"))).run();
  refresh();
}
