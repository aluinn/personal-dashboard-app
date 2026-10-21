import "server-only";
import { fetchCached } from "./cache";
import { politeFetchText } from "./safe-fetch";
import type { ImportRow } from "./types";

// Source 5b: company careers RSS/Atom feeds YOU add in Settings (I don't hard-code any, since
// I can't verify which firms publish one). Each fetch goes through politeFetchText:
// robots.txt honoured, private IPs refused, 1MB cap, cached 3h per feed.

const TTL = 3 * 3600_000;
const RELEVANT = /intern|spring|insight|placement|graduate|analyst programme|apprentice|fellowship|trainee/i;

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
};

export function parseFeed(xml: string, feedHost: string): ImportRow[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  const rows: ImportRow[] = [];
  for (const b of blocks) {
    const title = tag(b, "title");
    if (!title || !RELEVANT.test(title)) continue;
    const link = b.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ?? tag(b, "link");
    const firm = tag(b, "author") || tag(b, "dc:creator") || feedHost.replace(/^(www|careers|jobs)\./, "");
    rows.push({
      firm,
      role: title,
      link: /^https?:/i.test(link) ? link : "",
      description: (tag(b, "description") || tag(b, "summary") || tag(b, "content")).slice(0, 1200),
      opensOn: null,
    });
  }
  return rows;
}

export async function fetchFeeds(urls: string[]) {
  const rows: ImportRow[] = [];
  const notes: string[] = [];
  for (const url of urls) {
    try {
      const { data } = await fetchCached(`rss:${url}`, TTL, async () => {
        const r = await politeFetchText(url, { accept: "application/rss+xml,application/atom+xml,application/xml,text/xml" });
        return parseFeed(r.text, new URL(url).hostname);
      });
      rows.push(...data);
      notes.push(`${new URL(url).hostname}: ${data.length} relevant item(s)`);
    } catch (e) {
      notes.push(`${url}: ${(e as Error).message}`);
    }
  }
  return { rows, notes };
}
