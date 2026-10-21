import type { RawEvent } from "./ics";
import type { Price, TechEvent, TopicKey } from "./types";

// Turns a raw calendar entry into a dashboard event. Everything here is a heuristic over
// the feed's text: Luma's iCal feeds are thin (title, location, a short description), so
// topic and price are best-effort and the UI says so.

export const LONDON = { lat: 51.5074, lng: -0.1278 };

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Fallback when a feed gives no GEO: match a city name in the address.
const CITIES: [string, number, number][] = [
  ["london", 51.5074, -0.1278], ["cambridge", 52.2053, 0.1218], ["oxford", 51.752, -1.2577],
  ["reading", 51.4543, -0.9781], ["brighton", 50.8225, -0.1372], ["bristol", 51.4545, -2.5879],
  ["birmingham", 52.4862, -1.8904], ["manchester", 53.4808, -2.2426], ["leeds", 53.8008, -1.5491],
  ["sheffield", 53.3811, -1.4701], ["liverpool", 53.4084, -2.9916], ["newcastle", 54.9783, -1.6178],
  ["nottingham", 52.9548, -1.1581], ["cardiff", 51.4816, -3.1791], ["edinburgh", 55.9533, -3.1883],
  ["glasgow", 55.8642, -4.2518], ["belfast", 54.5973, -5.9301], ["dublin", 53.3498, -6.2603],
  ["paris", 48.8566, 2.3522], ["amsterdam", 52.3676, 4.9041], ["berlin", 52.52, 13.405],
  ["lisbon", 38.7223, -9.1393], ["madrid", 40.4168, -3.7038], ["barcelona", 41.3874, 2.1686],
  ["zurich", 47.3769, 8.5417], ["new york", 40.7128, -74.006], ["san francisco", 37.7749, -122.4194],
  ["singapore", 1.3521, 103.8198], ["dubai", 25.2048, 55.2708],
];

export function kmFromLondon(geo: [number, number] | null, address: string): number | null {
  if (geo) return Math.round(haversineKm(LONDON, { lat: geo[0], lng: geo[1] }));
  const a = address.toLowerCase();
  const hit = CITIES.find(([n]) => a.includes(n));
  return hit ? Math.round(haversineKm(LONDON, { lat: hit[1], lng: hit[2] })) : null;
}

const TOPIC_RE: Record<Exclude<TopicKey, "ai">, RegExp> = {
  crypto: /crypto|blockchain|web3|solana|ethereum|bitcoin|\bdefi\b|\bdao\b|on-?chain|\bnfts?\b|stablecoin/i,
  startups: /start-?ups?|founders?|venture|\bVC\b|pitch|accelerator|incubator|pre-?seed|\bseed\b|y combinator|\bYC\b|entrepreneur|demo day|scale-?up/,
  hackathons: /hackathon|hack ?day|\bhackers?\b|buildathon|build day|\bjam\b|\bhack\b/i,
  fintech: /fintech|finance|financial|banking|payments?|trading|investing|investment|quant\b|capital markets|insurtech|regtech|wealth|\bfx\b/i,
};
// "AI", "ML" etc. are matched case-sensitively so "said" or "maintain" never count.
const AI_INSENSITIVE = /artificial intelligence|machine learning|\bllms?\b|\bgpt|generative|deep learning|agentic|openai|anthropic|\bclaude\b|\bgemini\b|neural/i;

export function topicsFor(text: string): TopicKey[] {
  const out: TopicKey[] = [];
  if (/\bAI\b|\bML\b|\bLLMs?\b|\bGPT/.test(text) || AI_INSENSITIVE.test(text)) out.push("ai");
  (["crypto", "startups", "hackathons", "fintech"] as const).forEach((k) => {
    if (TOPIC_RE[k].test(text)) out.push(k);
  });
  return out;
}

export function priceFor(text: string): Price {
  if (/[£$€]\s?\d|\b\d+(\.\d\d)?\s?(gbp|usd|eur)\b|\bbuy tickets?\b|\bticket price\b/i.test(text)) return "paid";
  if (/\bfree\b(?!\s+(?:from|of)\b)/i.test(text.replace(/feel free/gi, ""))) return "free";
  return "unknown";
}

const VIDEO_HOST = /(^|\.)(zoom\.us|meet\.google\.com|teams\.microsoft\.com|whereby\.com|youtube\.com|youtu\.be|twitch\.tv|discord\.(gg|com)|luma\.com|lu\.ma|webex\.com|crowdcast\.io|streamyard\.com)$/i;
const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());
const URL_IN = /https?:\/\/[^\s)>"']+/;

export function toEvent(raw: RawEvent, source: string, hints: TopicKey[] = []): TechEvent {
  const desc = raw.description;
  // Luma descriptions: "Get up-to-date information at: <url>\n\nAddress:\n<lines>\n\nHosted by <names>"
  const lumaUrl = desc.match(/https?:\/\/(?:lu\.ma|luma\.com)\/[^\s)>"']+/i)?.[0] ?? "";
  const addrBlock = desc.match(/Address:\s*\n([\s\S]*?)(?:\n\s*\n|$)/i)?.[1]?.replace(/\n+/g, ", ").trim() ?? "";
  const addr = /check event page|^$/i.test(addrBlock) ? "" : addrBlock;
  const hostedBy = desc.match(/Hosted by\s+([^\n]+)/i)?.[1]?.trim() ?? "";

  const locIsUrl = isUrl(raw.location);
  let venue = locIsUrl ? addr : raw.location || addr;
  let online = !venue || /\b(online|virtual|zoom|webinar|livestream|google meet|teams)\b/i.test(venue);
  // A bare link as the location: a video/Luma link means online; any other site is usually a
  // physical event hosted elsewhere (Meetup, Eventbrite, a conference site) with no address given.
  if (locIsUrl && !addr) {
    const host = new URL(raw.location.trim()).hostname.replace(/^www\./, "");
    if (!VIDEO_HOST.test(host)) {
      online = false;
      venue = "Location on the event page";
    }
  }
  const hasAddress = Boolean(venue) && !online && venue !== "Location on the event page";

  const url = raw.url || lumaUrl || (locIsUrl ? raw.location : "") || desc.match(URL_IN)?.[0] || "";
  const text = `${raw.title}\n${desc}`;
  const topics = [...new Set([...hints, ...topicsFor(text)])];

  return {
    id: raw.uid || `${raw.title}|${raw.start}`,
    title: raw.title,
    start: raw.start,
    end: raw.end,
    allDay: raw.allDay,
    venue: online && !venue ? "" : venue,
    online,
    host: raw.organizer && !/^luma$/i.test(raw.organizer) ? raw.organizer : hostedBy,
    source,
    url,
    topics,
    price: priceFor(text),
    km: hasAddress ? kmFromLondon(raw.geo, venue) : null,
    description: desc.replace(/Get up-to-date information at:[^\n]*\n*/i, "").slice(0, 700),
  };
}
