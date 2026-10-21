import { TOPICS, type TopicKey } from "./types";

// Settings stores one feed per line:  Label | URL | topics (optional, comma separated)
// URL may be an https/webcal .ics link, or a bare Luma id (cal-… / discplace-…).

export type FeedConfig = { label: string; url: string; hints: TopicKey[] };
export type FeedParse = { feeds: FeedConfig[]; problems: string[] };

const LUMA_ID = /^(cal|discplace)-[A-Za-z0-9]+$/;
const ENTITY = { cal: "calendar", discplace: "discover" } as const;

export function parseFeedLines(lines: string[]): FeedParse {
  const feeds: FeedConfig[] = [];
  const problems: string[] = [];
  for (const line of lines.map((l) => l.trim()).filter(Boolean)) {
    const parts = line.split("|").map((p) => p.trim());
    const hasLabel = parts.length > 1;
    const raw = hasLabel ? parts[1] : parts[0];
    const label = hasLabel ? parts[0] : "";
    const hints = (parts[2] ?? "")
      .split(/[,\s]+/)
      .map((t) => t.toLowerCase())
      .filter((t): t is TopicKey => TOPICS.some((x) => x.key === t));

    let url = raw.replace(/^webcal:/i, "https:");
    if (LUMA_ID.test(raw)) url = `https://api.lu.ma/ics/get?entity=${ENTITY[raw.split("-")[0] as "cal" | "discplace"]}&id=${raw}`;
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      problems.push(`“${line}” isn't a link.`);
      continue;
    }
    if (u.protocol !== "https:") {
      problems.push(`“${raw}” must be an https link.`);
      continue;
    }
    if (/^(lu\.ma|luma\.com)$/i.test(u.hostname.replace(/^www\./, ""))) {
      problems.push(`“${raw}” is a Luma web page, not a feed. On that calendar's page click “Add iCal Subscription” and copy the api.lu.ma link.`);
      continue;
    }
    feeds.push({ label: label || u.hostname.replace(/^www\./, ""), url: u.toString(), hints });
  }
  return { feeds, problems };
}
