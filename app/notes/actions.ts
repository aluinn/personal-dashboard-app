"use server";

import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { saveTermDates } from "@/lib/db/academic";

export async function saveTermDatesAction(f: FormData) {
  await saveTermDates(f);
  revalidatePath("/", "layout");
}

const idOf = (id: string) => (/^n-\d+$/.test(id) ? Number(id.slice(2)) : null);

export async function deleteNote(id: string) {
  const n = idOf(id);
  if (n === null) throw new Error("Placeholders can't be deleted; they disappear once you upload real notes for the module.");
  await q.batch([{ sql: "DELETE FROM note_files WHERE note_id = ?", args: [n] }, { sql: "DELETE FROM notes WHERE id = ?", args: [n] }]);
  revalidatePath("/", "layout");
}

/** Edit the details of an uploaded note (the text itself comes from the PDF; re-upload to change it). */
export async function updateNote(f: FormData) {
  const n = idOf(String(f.get("id") ?? ""));
  if (n === null) throw new Error("Bad note");
  const title = String(f.get("title") ?? "").trim().slice(0, 140);
  const week = Number(f.get("week"));
  const tags = String(f.get("tags") ?? "").split(/[,\n]/).map((t) => t.trim().replace(/^#/, "")).filter(Boolean).slice(0, 12);
  if (!title) throw new Error("Give the note a title");
  await q.run("UPDATE notes SET title = ?, week = ?, tags = ?, edited_at = ? WHERE id = ?", [title, Number.isFinite(week) && week >= 1 && week <= 12 ? Math.round(week) : null, JSON.stringify(tags), Date.now(), n]);
  revalidatePath("/", "layout");
}
