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

export function getSetting<T>(key: string, fallback: T): T {
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown) {
  const v = JSON.stringify(value);
  db.insert(schema.settings).values({ key, value: v }).onConflictDoUpdate({ target: schema.settings.key, set: { value: v } }).run();
}

export function getMatchConfig(): MatchConfig {
  return mergeConfig(getSetting("matchConfig", null));
}

export function getSourceSettings() {
  return {
    rssFeeds: getSetting<string[]>("rssFeeds", []),
    adzunaQueries: getSetting<string[]>("adzunaQueries", DEFAULT_ADZUNA_QUERIES),
    adzunaCap: getSetting<number>("adzunaDailyCap", 20),
    webQueries: getSetting<string[]>("webQueries", defaultWebQueries()),
    tavilyCap: getSetting<number>("tavilyDailyCap", 20),
    lastRefresh: getSetting<number | null>("lastPublicRefresh", null),
    autoRefreshHours: getSetting<number>("autoRefreshHours", 6),
  };
}

export function listOpportunities() {
  return db.select().from(schema.opportunities).orderBy(desc(schema.opportunities.createdAt), desc(schema.opportunities.id)).all();
}

export function insertRows(rows: ImportRow[], opts: { status: string; source: string }) {
  let added = 0;
  let duplicates = 0;
  const now = Date.now();
  db.transaction(() => {
    for (const r of rows) {
      const firm = r.firm.trim().slice(0, 120);
      const role = r.role.trim().slice(0, 240);
      if (!firm || !role) continue;
      const text = `${role} ${r.description ?? ""}`;
      const programme = PROGRAMMES.includes(r.programme as never) ? r.programme! : inferProgramme(text);
      const type = TYPES.includes(r.type as never) ? r.type! : inferType({ firm, role, description: r.description, programme });
      const status = r.status && ALL_STATUSES.includes(r.status as never) ? r.status : opts.status;
      const res = db
        .insert(schema.opportunities)
        .values({
          firm,
          role,
          type,
          programme,
          status,
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
      if (res.changes > 0) added++;
      else duplicates++;
    }
  });
  return { added, duplicates };
}

export async function getOpportunitiesData() {
  await connection();
  const src = getSourceSettings();
  return {
    items: listOpportunities(),
    config: getMatchConfig(),
    sources: {
      adzunaConfigured: adzunaConfigured(),
      adzunaCallsToday: callsToday("adzuna"),
      adzunaCap: src.adzunaCap,
      tavilyConfigured: tavilyConfigured(),
      tavilyCallsToday: callsToday("tavily"),
      tavilyCap: src.tavilyCap,
      rssCount: src.rssFeeds.length,
      lastRefresh: src.lastRefresh,
      autoRefreshHours: src.autoRefreshHours,
      ingestConfigured: Boolean(process.env.INGEST_SECRET),
    },
  };
}
