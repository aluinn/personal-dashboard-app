export const TOPICS = [
  { key: "ai", label: "AI" },
  { key: "crypto", label: "Crypto" },
  { key: "startups", label: "Startups" },
  { key: "hackathons", label: "Hackathons" },
  { key: "fintech", label: "Finance / fintech" },
] as const;
export type TopicKey = (typeof TOPICS)[number]["key"];

export type Price = "free" | "paid" | "unknown";

export type TechEvent = {
  id: string;
  title: string;
  start: number; // UTC ms
  end: number;
  allDay: boolean;
  venue: string;
  online: boolean;
  host: string;
  source: string; // feed label(s)
  url: string; // RSVP / event page
  topics: TopicKey[];
  price: Price;
  km: number | null; // distance from London centre
  description: string;
};

export type FeedStatus = {
  label: string;
  url: string;
  ok: boolean;
  count: number;
  error?: string;
  stale?: boolean;
  fetchedAt?: number;
};

export type Block = { start: number; end: number; title: string; code: string };
