"use server";

import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { setSetting } from "@/lib/db/opp";

const refresh = () => revalidatePath("/", "layout");

export async function logStimulant(kind: string, label: string, mg: number, at?: number) {
  if (kind !== "caffeine" && kind !== "nicotine") throw new Error("Bad kind");
  const amount = Number(mg);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 2000) throw new Error("Bad amount");
  const when = at && Number.isFinite(at) && at <= Date.now() + 60_000 ? Math.round(at) : Date.now();
  await q.run("INSERT INTO stimulant_logs (kind, label, amount_mg, at) VALUES (?, ?, ?, ?)", [kind, String(label).slice(0, 40), amount, when]);
  refresh();
}

export async function deleteStimulant(id: number) {
  await q.run("DELETE FROM stimulant_logs WHERE id = ?", [Number(id)]);
  refresh();
}

export async function saveStimulantSettings(f: FormData) {
  const cutoff = String(f.get("cutoff") ?? "");
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff)) await setSetting("caffeineCutoff", cutoff);
  const delay = Number(f.get("delayMin"));
  if (Number.isFinite(delay)) await setSetting("caffeineDelayMin", Math.max(0, Math.min(240, Math.round(delay))));
  const max = Number(f.get("maxMg"));
  if (Number.isFinite(max) && max > 0) await setSetting("caffeineMaxMg", Math.min(1000, Math.round(max)));
  refresh();
}
