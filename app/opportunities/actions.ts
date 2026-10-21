"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { getSetting, insertRows, setSetting } from "@/lib/db/opp";
import { ALL_STATUSES, PROGRAMMES, TYPES, dedupeKey } from "@/lib/opp";
import { defaultMatchConfig } from "@/lib/match";
import { parseDate } from "@/lib/sources/dates";
import { parseAlertEmail } from "@/lib/sources/email";
import { runPublicRefresh } from "@/lib/sources/refresh";
import { previewLink as previewLinkImpl, type LinkPreview } from "@/lib/sources/link-preview";
import type { ImportRow } from "@/lib/sources/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const APPLIED_STAGES = ["applied", "online_test", "interview", "offer"];
/** Remember when an application was first sent, for the weekly review. */
function stampApplied(id: number | bigint, status: string) {
  if (!APPLIED_STAGES.includes(status)) return;
  db.$client.prepare("UPDATE opportunities SET applied_at = ? WHERE id = ? AND applied_at IS NULL").run(Date.now(), Number(id));
}
const refresh = () => revalidatePath("/", "layout");
const okUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : "");

export async function saveOpportunity(f: FormData) {
  const firm = str(f, "firm");
  const role = str(f, "role");
  if (!firm || !role) throw new Error("Firm and role are required");
  const type = TYPES.includes(str(f, "type") as never) ? str(f, "type") : "other";
  const programme = PROGRAMMES.includes(str(f, "programme") as never) ? str(f, "programme") : "other";
  const status = ALL_STATUSES.includes(str(f, "status") as never) ? str(f, "status") : "saved";
  const deadline = parseDate(str(f, "deadline"));
  const opensOn = parseDate(str(f, "opensOn"));
  const values = {
    firm, role, type, programme, status, deadline, opensOn,
    link: okUrl(str(f, "link")),
    notes: str(f, "notes"),
    description: str(f, "description").slice(0, 2000),
    location: str(f, "location"),
    dedupeKey: dedupeKey(firm, role, deadline),
  };
  const id = Number(f.get("id"));
  if (id > 0) {
    db.update(schema.opportunities).set(values).where(eq(schema.opportunities.id, id)).run();
    stampApplied(id, status);
  } else {
    const r = db.insert(schema.opportunities).values({ ...values, source: str(f, "source") || "manual", createdAt: Date.now() }).onConflictDoNothing().run();
    if (r.changes === 0) throw new Error("That firm + role + year is already tracked");
    stampApplied(r.lastInsertRowid, status);
  }
  refresh();
}

export async function setStatus(id: number, status: string) {
  if (!ALL_STATUSES.includes(status as never)) throw new Error("Bad status");
  db.update(schema.opportunities).set({ status }).where(eq(schema.opportunities.id, id)).run();
  stampApplied(id, status);
  refresh();
}

export async function deleteOpportunity(id: number) {
  db.delete(schema.opportunities).where(eq(schema.opportunities.id, id)).run();
  refresh();
}

export async function previewLink(url: string): Promise<LinkPreview> {
  return previewLinkImpl(url);
}

export async function importRows(rows: ImportRow[], target: "saved" | "feed") {
  if (!Array.isArray(rows) || rows.length > 2000) throw new Error("Too many rows");
  const clean = rows.map((r) => ({ ...r, link: okUrl(r.link ?? ""), deadline: parseDate(r.deadline ?? ""), opensOn: parseDate(r.opensOn ?? "") }));
  const res = insertRows(clean, { status: target, source: "import" });
  refresh();
  return res;
}

export async function importEmailText(text: string, target: "saved" | "feed") {
  const rows = parseAlertEmail(/<\/?(a|table|div|p|br)\b/i.test(text) ? { html: text } : { text });
  const res = insertRows(rows, { status: target, source: "email" });
  refresh();
  return { ...res, found: rows.length, preview: rows.slice(0, 5).map((r) => `${r.firm}: ${r.role}`) };
}

export async function refreshPublicSources() {
  const res = await runPublicRefresh();
  refresh();
  return res;
}

export async function saveMatchConfig(f: FormData) {
  const out: Record<string, { weight: number; keywords: string[] }> = {};
  for (const g of defaultMatchConfig().groups) {
    const w = Number(f.get(`w_${g.key}`));
    out[g.key] = {
      weight: Number.isFinite(w) ? Math.max(0, Math.min(10, w)) : g.weight,
      keywords: str(f, `k_${g.key}`).split(/[\n,]/).map((x) => x.trim()).filter(Boolean).slice(0, 200),
    };
  }
  setSetting("matchConfig", out);
  refresh();
}

export async function resetMatchConfig() {
  setSetting("matchConfig", null);
  refresh();
}

export async function saveSourceSettings(f: FormData) {
  const feeds = str(f, "rssFeeds").split(/\s+/).filter((u) => /^https?:\/\//i.test(u)).slice(0, 25);
  const queries = str(f, "adzunaQueries").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 10);
  const cap = Math.max(1, Math.min(100, Math.round(Number(f.get("adzunaCap")) || 20)));
  setSetting("rssFeeds", feeds);
  setSetting("adzunaQueries", queries.length ? queries : getSetting("adzunaQueries", []));
  setSetting("adzunaDailyCap", cap);
  const wq = str(f, "webQueries").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 10);
  if (wq.length) setSetting("webQueries", wq);
  setSetting("tavilyDailyCap", Math.max(1, Math.min(100, Math.round(Number(f.get("tavilyCap")) || 20))));
  const hrs = Number(f.get("autoRefreshHours"));
  setSetting("autoRefreshHours", Number.isFinite(hrs) ? Math.max(0, Math.min(168, Math.round(hrs))) : 6);
  refresh();
}
