"use server";

import { revalidatePath } from "next/cache";
import { saveTermDates } from "@/lib/db/academic";
import { setSetting } from "@/lib/db/opp";
import { notionId } from "@/lib/notion/map";
import { syncNotes, type SyncResult } from "@/lib/notion/sync";

export async function syncNow(): Promise<SyncResult> {
  const r = await syncNotes();
  revalidatePath("/", "layout");
  return r;
}

export async function saveNotionSettings(f: FormData) {
  const raw = String(f.get("database") ?? "").trim();
  // Keep only what's needed (a URL or id of a database); never accept anything that isn't a Notion id.
  await setSetting("notionDatabase", raw && notionId(raw) ? raw : "");
  const hrs = Number(f.get("hours"));
  await setSetting("notionSyncHours", Number.isFinite(hrs) ? Math.max(0, Math.min(72, Math.round(hrs))) : 3);
  revalidatePath("/", "layout");
}

export async function saveTermDatesAction(f: FormData) {
  await saveTermDates(f);
  revalidatePath("/", "layout");
}
