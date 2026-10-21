import "server-only";
import { getSetting, getSourceSettings, insertRows, setSetting } from "@/lib/db/opp";
import { fetchAdzuna } from "./adzuna";
import { fetchFeeds } from "./rss";
import { fetchWeb } from "./tavily";

/** Pull every public source (Adzuna API + your RSS feeds) into the Feed. Safe to call often:
 *  per-query caches (6h / 3h) and the daily call cap in the source modules do the throttling. */
export async function runPublicRefresh() {
  const s = getSourceSettings();
  const a = await fetchAdzuna(s.adzunaQueries, s.adzunaCap);
  const r = await fetchFeeds(s.rssFeeds);
  const w = await fetchWeb(s.webQueries, s.tavilyCap);
  const adz = insertRows(a.rows, { status: "feed", source: "adzuna" });
  const rss = insertRows(r.rows, { status: "feed", source: "rss" });
  const web = insertRows(w.rows, { status: "feed", source: "web" });
  setSetting("lastPublicRefresh", Date.now());
  return {
    added: adz.added + rss.added + web.added,
    duplicates: adz.duplicates + rss.duplicates + web.duplicates,
    notes: [...a.notes, ...r.notes, ...w.notes],
  };
}

export const autoRefreshHours = () => getSetting<number>("autoRefreshHours", 6);

const VISIT_MIN_AGE_MS = 3 * 3600_000;

/** Refresh when you open the app, if auto-refresh is on and the last run is over 3h old. */
export async function refreshOnVisit() {
  const h = autoRefreshHours();
  const last = getSetting<number | null>("lastPublicRefresh", null);
  if (h <= 0 || (last !== null && Date.now() - last < VISIT_MIN_AGE_MS)) return { ran: false, added: 0 };
  const r = await runPublicRefresh();
  return { ran: true, added: r.added };
}

/** True when auto-refresh is on and the last refresh is older than the interval. */
export function refreshDue() {
  const h = autoRefreshHours();
  if (h <= 0) return false;
  const last = getSetting<number | null>("lastPublicRefresh", null);
  return last === null || Date.now() - last >= h * 3600_000;
}
