import "server-only";
import { fetchCached, spendCall } from "./cache";
import { parseDate } from "./dates";
import { guessFirmRole } from "@/lib/opp";
import type { ImportRow } from "./types";

// Source 5c: open-web search via the Tavily Search API (https://docs.tavily.com).
// Official, keyed API. We only use the title / URL / snippet it returns and never fetch or
// scrape the result pages ourselves. Docs checked 2026-10: POST https://api.tavily.com/search,
// Bearer auth, "basic" search = 1 credit, free plan = 1,000 credits/month.
// Login-gated sites are excluded from searches so nothing from them is ingested:
// The Trackr, Bright Network and LinkedIn.

const EXCLUDE = ["the-trackr.com", "app.the-trackr.com", "brightnetwork.co.uk", "linkedin.com", "glassdoor.com", "glassdoor.co.uk"];
const TTL = 6 * 3600_000; // a given query is searched at most every 6h

export function defaultWebQueries(now = new Date()) {
  const y = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
  return [
    `spring week ${y} applications open UK first year students`,
    `summer internship ${y} finance UK applications open`,
    `${y} tech product management internship UK students applications open`,
    `AI policy OR technology policy internship ${y} UK students`,
    `investment banking insight week ${y} applications open`,
    `finance and tech insight events for UK university students ${y}`,
  ];
}

export const tavilyConfigured = () => Boolean(process.env.TAVILY_API_KEY);

type TavilyResult = { title: string; url: string; content: string; score?: number };

const RELEVANT = /spring\s*(week|insight)|insight\s*(week|day|programme|event)|intern|placement|fellowship|work experience|summer (analyst|programme)|early careers|open day/i;
// Listicles, guides and forum threads are noise, not listings.
const NOISE = /^(top|best)\b|\b(\d+ (best|top|ways)|guide|how to|tips|ultimate|list of|what is|vs\.?|reddit|forum|review)\b/i;

const DEADLINE = /(?:deadline|closes?|closing(?: date)?|apply by|applications? close[sd]?(?: on)?)\s*[:\-–]?\s*(.{4,40})/i;
const OPENS = /(?:opens?|opening(?: date)?|applications? open(?:s|ed)?(?: on)?)\s*[:\-–]?\s*(.{4,40})/i;

function hostFirm(url: string) {
  const h = new URL(url).hostname.replace(/^(www|careers|jobs|apply|early-?careers)\./, "").split(".")[0];
  return h ? h[0].toUpperCase() + h.slice(1) : "Unknown";
}

/** Turn search results into feed rows (pure, so it can be tested without the API). */
export function extractFromResults(results: TavilyResult[]): ImportRow[] {
  const rows: ImportRow[] = [];
  for (const r of results) {
    if (!r.url || !r.title) continue;
    if ((r.score ?? 1) < 0.3) continue;
    const title = r.title.replace(/\s+[|–—]\s+(careers?|jobs?|home|official site|apply).*$/i, "").trim();
    if (!RELEVANT.test(`${title} ${r.content}`) || !RELEVANT.test(title) && !/apply|application|deadline/i.test(r.content)) continue;
    if (NOISE.test(title)) continue;
    let host: string;
    try {
      host = new URL(r.url).hostname;
    } catch {
      continue;
    }
    if (EXCLUDE.some((d) => host === d || host.endsWith("." + d))) continue;

    const guess = guessFirmRole(title, "");
    const firm = guess.firm.replace(/\s+(early\s+)?(careers?|jobs|recruitment|students?)$/i, "").trim();
    const role = guess.role;
    rows.push({
      firm: firm && firm !== role && firm.length <= 50 ? firm : hostFirm(r.url),
      role: role || title,
      link: r.url,
      description: r.content.slice(0, 1200),
      deadline: parseDate(r.content.match(DEADLINE)?.[1]),
      opensOn: parseDate(r.content.match(OPENS)?.[1]),
    });
  }
  return rows;
}

export async function fetchWeb(queries: string[], dailyCap: number) {
  const notes: string[] = [];
  const rows: ImportRow[] = [];
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { rows, notes: ["Web search: add TAVILY_API_KEY to .env.local."] };

  for (const q of queries) {
    try {
      const { data, cached } = await fetchCached(`tavily:${q}`, TTL, async () => {
        if (!spendCall("tavily", dailyCap)) throw new Error("cap");
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
            search_depth: "basic", // 1 credit
            max_results: 10,
            time_range: "year",
            exclude_domains: EXCLUDE,
          }),
        });
        if (!res.ok) throw new Error(`API answered ${res.status}`);
        return ((await res.json()).results ?? []) as TavilyResult[];
      });
      const found = extractFromResults(data);
      rows.push(...found);
      notes.push(`Web "${q.slice(0, 40)}…": ${found.length} listing(s)${cached ? " (cached)" : ""}`);
    } catch (e) {
      notes.push((e as Error).message === "cap" ? `Web "${q.slice(0, 30)}…": skipped, daily credit cap (${dailyCap}) reached` : `Web "${q.slice(0, 30)}…": failed (${(e as Error).message})`);
    }
  }
  return { rows, notes };
}
