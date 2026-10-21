import "server-only";
import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "./index";
import { dedupeKey, ALL_STATUSES, PROGRAMMES, TYPES } from "@/lib/opp";
import { inferProgramme, inferType, mergeConfig, type MatchConfig } from "@/lib/match";
import type { ImportRow } from "@/lib/sources/types";
import { DEFAULT_ADZUNA_QUERIES, adzunaConfigured } from "@/lib/sources/adzuna";
import { defaultWebQueries, tavilyConfigured } from "@/lib/sources/tavily";
import { callsToday } from "@/lib/sources/cache";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown) {
  const v = JSON.stringify(value);
  await db.insert(schema.settings).values({ key, value: v }).onConflictDoUpdate({ target: schema.settings.key, set: { value: v } }).run();
}

export async function getMatchConfig(): Promise<MatchConfig> {
  return mergeConfig(await getSetting("matchConfig", null));
}

export async function getSourceSettings() {
  const [rssFeeds, adzunaQueries, adzunaCap, webQueries, tavilyCap, lastRefresh, autoRefreshHours] = await Promise.all([
    getSetting<string[]>("rssFeeds", []),
    getSetting<string[]>("adzunaQueries", DEFAULT_ADZUNA_QUERIES),
    getSetting<number>("adzunaDailyCap", 20),
    getSetting<string[]>("webQueries", defaultWebQueries()),
    getSetting<number>("tavilyDailyCap", 20),
    getSetting<number | null>("lastPublicRefresh", null),
    getSetting<number>("autoRefreshHours", 6),
  ]);
  return { rssFeeds, adzunaQueries, adzunaCap, webQueries, tavilyCap, lastRefresh, autoRefreshHours };
}

export async function listOpportunities() {
  return db.select().from(schema.opportunities).orderBy(desc(schema.opportunities.createdAt), desc(schema.opportunities.id)).all();
}

export async function insertRows(rows: ImportRow[], opts: { status: string; source: string }) {
  let added = 0;
  let duplicates = 0;
  const now = Date.now();
  for (const r of rows) {
    const firm = r.firm.trim().slice(0, 120);
    const role = r.role.trim().slice(0, 240);
    if (!firm || !role) continue;
    const text = `${role} ${r.description ?? ""}`;
    const programme = PROGRAMMES.includes(r.programme as never) ? r.programme! : inferProgramme(text);
    const type = TYPES.includes(r.type as never) ? r.type! : inferType({ firm, role, description: r.description, programme });
    const status = r.status && ALL_STATUSES.includes(r.status as never) ? r.status : opts.status;
    const res = await db
      .insert(schema.opportunities)
      .values({
        firm, role, type, programme, status,
        deadline: r.deadline ?? null,
        opensOn: r.opensOn ?? null,
        link: r.link ?? "",
        notes: r.notes ?? "",
        description: (r.description ?? "").slice(0, 2000),
        location: r.location ?? "",
        source: opts.source,
        dedupeKey: dedupeKey(firm, role, r.deadline),
        createdAt: now,
      })
      .onConflictDoNothing()
      .run();
    if (res.rowsAffected > 0) added++;
    else duplicates++;
  }
  return { added, duplicates };
}

export async function getOpportunitiesData() {
  await connection();
  const src = await getSourceSettings();
  return {
    items: await listOpportunities(),
    config: await getMatchConfig(),
    sources: {
      adzunaConfigured: adzunaConfigured(),
      adzunaCallsToday: await callsToday("adzuna"),
      adzunaCap: src.adzunaCap,
      tavilyConfigured: tavilyConfigured(),
      tavilyCallsToday: await callsToday("tavily"),
      tavilyCap: src.tavilyCap,
      rssCount: src.rssFeeds.length,
      lastRefresh: src.lastRefresh,
      autoRefreshHours: src.autoRefreshHours,
      ingestConfigured: Boolean(process.env.INGEST_SECRET),
    },
  };
}
