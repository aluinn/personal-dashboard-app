import "server-only";
import { apiFetchJson } from "./safe-fetch";
import { fetchCached, spendCall } from "./cache";
import type { ImportRow } from "./types";

// Source 5a: Adzuna public job API (https://developer.adzuna.com).
// Terms checked 2026-10: free registration gives app_id/app_key; "personal job search" is an
// explicitly permitted use; any listing shown should credit Adzuna (we show an "Adzuna" link on
// every feed item); limits are "shown in your account" and may change, so the daily call cap
// below is configurable and conservative; on termination of use you must delete Adzuna data.
// No scraping of adzuna.co.uk pages anywhere. Only the keyed API.

export const DEFAULT_ADZUNA_QUERIES = [
  "spring week",
  "summer internship finance",
  "internship artificial intelligence",
  "product intern",
  "policy internship",
];
const TTL = 6 * 3600_000; // same query is never re-fetched within 6h

type AdzunaResult = {
  title: string;
  description: string;
  redirect_url: string;
  created: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
};

const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export function adzunaConfigured() {
  return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}

export async function fetchAdzuna(queries: string[], dailyCap: number) {
  const notes: string[] = [];
  const rows: ImportRow[] = [];
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return { rows, notes: ["Adzuna: add ADZUNA_APP_ID and ADZUNA_APP_KEY to .env.local."] };

  for (const q of queries) {
    try {
      const { data, cached } = await fetchCached(`adzuna:${q}`, TTL, async () => {
        if (!spendCall("adzuna", dailyCap)) throw new Error("cap");
        const url = new URL("https://api.adzuna.com/v1/api/jobs/gb/search/1");
        url.search = new URLSearchParams({
          app_id: id,
          app_key: key,
          what: q,
          results_per_page: "20",
          max_days_old: "45",
          sort_by: "date",
          "content-type": "application/json",
        }).toString();
        return (await apiFetchJson(url.toString())).results as AdzunaResult[];
      });
      if (cached) notes.push(`Adzuna "${q}": cached (<6h old)`);
      for (const r of data ?? []) {
        rows.push({
          firm: strip(r.company?.display_name ?? "Unknown"),
          role: strip(r.title),
          link: r.redirect_url,
          description: strip(r.description),
          location: r.location?.display_name ?? "",
          opensOn: r.created?.slice(0, 10) ?? null,
        });
      }
    } catch (e) {
      notes.push(
        (e as Error).message === "cap"
          ? `Adzuna "${q}": skipped, daily call cap (${dailyCap}) reached`
          : `Adzuna "${q}": failed (${(e as Error).message})`,
      );
    }
  }
  return { rows, notes };
}
