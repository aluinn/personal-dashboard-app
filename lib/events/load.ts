import "server-only";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/lib/db";
import { getSetting } from "@/lib/db/opp";
import { getTimetableData } from "@/lib/db/queries";
import { fetchCached } from "@/lib/sources/cache";
import { apiFetchText } from "@/lib/sources/safe-fetch";
import { expandSessions } from "@/lib/schedule";
import { londonToday } from "@/lib/time";
import { toEvent } from "./classify";
import { parseFeedLines, type FeedConfig } from "./feeds";
import { parseIcs, type RawEvent } from "./ics";
import type { Block, FeedStatus, TechEvent } from "./types";

// Luma publishes an iCal feed for each public calendar ("Add iCal Subscription" on the calendar
// page; https://help.luma.com/p/ical-syncing) and for city/discover pages. We only read those
// feeds, which exist for exactly this kind of subscription: no scraping, no login, no API key.
// Each feed is fetched at most once an hour (cached in source_cache); if a fetch fails we keep
// showing the last good copy and say so. Feed links come from Settings -> Tech events.

export const EVENT_FEED_TTL = 3600_000;
const HORIZON_DAYS = 150;

export const getEventFeedLines = () => getSetting<string[]>("eventFeeds", []);

async function loadFeed(f: FeedConfig): Promise<{ raw: RawEvent[]; status: FeedStatus }> {
  const key = `events:ics:${f.url}`;
  const base = { label: f.label, url: f.url };
  try {
    const { data } = await fetchCached<RawEvent[]>(key, EVENT_FEED_TTL, async () => {
      const text = await apiFetchText(f.url);
      return parseIcs(text)
        .filter((e) => !e.cancelled)
        .map((e) => ({ ...e, description: e.description.slice(0, 900) }));
    });
    const row = db.select().from(schema.sourceCache).where(eq(schema.sourceCache.key, key)).get();
    return { raw: data, status: { ...base, ok: true, count: data.length, fetchedAt: row?.fetchedAt } };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Couldn't fetch this feed.";
    const row = db.select().from(schema.sourceCache).where(eq(schema.sourceCache.key, key)).get();
    if (row) {
      const raw = JSON.parse(row.payload) as RawEvent[];
      return { raw, status: { ...base, ok: false, stale: true, count: raw.length, error, fetchedAt: row.fetchedAt } };
    }
    return { raw: [], status: { ...base, ok: false, count: 0, error } };
  }
}

/** `pastDays` also keeps events that ended up to that many days ago (for the weekly review). */
export async function loadEvents(pastDays = 0): Promise<{
  events: TechEvent[];
  feeds: FeedStatus[];
  problems: string[];
  blocks: Block[];
  configured: boolean;
}> {
  await connection();
  const { feeds: configs, problems } = parseFeedLines(getEventFeedLines());
  const loaded = await Promise.all(configs.map(loadFeed));

  const now = Date.now();
  const horizon = now + HORIZON_DAYS * 86400_000;
  const byId = new Map<string, TechEvent>();
  loaded.forEach(({ raw }, i) => {
    for (const r of raw) {
      if (r.end < now - pastDays * 86400_000 || r.start > horizon) continue;
      const ev = toEvent(r, configs[i].label, configs[i].hints);
      const prev = byId.get(ev.id);
      if (!prev) byId.set(ev.id, ev);
      else if (!prev.source.split(" · ").includes(ev.source)) {
        prev.source += ` · ${ev.source}`;
        prev.topics = [...new Set([...prev.topics, ...ev.topics])];
      }
    }
  });
  const events = [...byId.values()].sort((a, b) => a.start - b.start).slice(0, 500);

  const { modules, sessions } = await getTimetableData();
  const code = new Map(modules.map((m) => [m.id, m.code]));
  const blocks: Block[] = expandSessions(sessions, londonToday(), HORIZON_DAYS)
    .filter((o) => o.kind !== "deadline")
    .map((o) => ({ start: o.start, end: o.end, title: o.title, code: (o.moduleId && code.get(o.moduleId)) || "EVENT" }));

  return { events, feeds: loaded.map((l) => l.status), problems, blocks, configured: configs.length > 0 || problems.length > 0 };
}
