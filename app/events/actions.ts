"use server";

import { revalidatePath } from "next/cache";
import { setSetting } from "@/lib/db/opp";

export async function saveEventFeeds(f: FormData) {
  const lines = String(f.get("eventFeeds") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 15);
  setSetting("eventFeeds", lines);
  revalidatePath("/", "layout");
}
