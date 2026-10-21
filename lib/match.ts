import { matchGroups, studyYear, type KeywordGroup } from "./profile";

export type MatchConfig = { groups: KeywordGroup[] };

export const defaultMatchConfig = (): MatchConfig => ({
  groups: matchGroups.map((g) => ({ ...g, keywords: [...g.keywords] })),
});

/** Merge saved overrides (weight + keywords per group key) onto the defaults. */
export function mergeConfig(saved: unknown): MatchConfig {
  const cfg = defaultMatchConfig();
  if (!saved || typeof saved !== "object") return cfg;
  const o = saved as Record<string, { weight?: number; keywords?: string[] }>;
  for (const g of cfg.groups) {
    const s = o[g.key];
    if (!s) continue;
    if (typeof s.weight === "number") g.weight = Math.max(0, Math.min(10, s.weight));
    if (Array.isArray(s.keywords)) g.keywords = s.keywords.map(String).filter(Boolean);
  }
  return cfg;
}

export type MatchListing = {
  firm: string;
  role: string;
  programme?: string;
  type?: string;
  description?: string;
};

export type GroupResult = { key: string; label: string; weight: number; hits: string[]; points: number };
export type MatchResult = {
  score: number;
  groups: GroupResult[]; // only groups with hits, strongest first
  adjustments: { text: string; delta: number }[];
  why: string;
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cache = new Map<string, RegExp>();

function keywordRegex(kw: string) {
  let r = cache.get(kw);
  if (!r) {
    const shortCaps = kw === kw.toUpperCase() && /[A-Z]/.test(kw) && kw.length <= 4;
    const body = esc(kw).replace(/\s+/g, "\\s+");
    r = shortCaps
      ? new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`)
      : new RegExp(`(?<![A-Za-z0-9])${body}(?:s|es)?(?![A-Za-z0-9])`, "i");
    cache.set(kw, r);
  }
  return r;
}

/**
 * Score a listing 0-100.
 *  - A keyword found in the role/programme counts double (title is a stronger signal).
 *  - Each group gives p = weight/10 * (1 - 0.55^points); groups combine as a noisy-OR,
 *    so several different strengths raise the score without ever exceeding 100.
 *  - Level-fit adjustments reflect where you are in your degree.
 */
export function scoreListing(l: MatchListing, config: MatchConfig, now = new Date()): MatchResult {
  const title = `${l.role} ${l.programme ?? ""}`;
  const body = `${l.firm} ${l.description ?? ""}`;
  const groups: GroupResult[] = [];
  let miss = 1;

  for (const g of config.groups) {
    const hits: string[] = [];
    let points = 0;
    for (const kw of g.keywords) {
      const re = keywordRegex(kw);
      if (re.test(title)) {
        hits.push(kw);
        points += 2;
      } else if (re.test(body)) {
        hits.push(kw);
        points += 1;
      }
    }
    if (hits.length === 0) continue;
    const p = Math.min(1, g.weight / 10) * (1 - Math.pow(0.55, points));
    miss *= 1 - 0.9 * p;
    groups.push({ key: g.key, label: g.label, weight: g.weight, hits, points: Math.round(p * 100) });
  }
  groups.sort((a, b) => b.points - a.points);

  const adjustments: { text: string; delta: number }[] = [];
  const year = studyYear(now);
  const all = `${title} ${l.description ?? ""}`;
  if (l.programme === "spring week") adjustments.push({ text: "Spring week: open to 1st/2nd years", delta: 8 });
  if (l.programme === "summer internship" && year <= 2)
    adjustments.push({ text: "Summer internship: right stage (penultimate/earlier year)", delta: 8 });
  if (l.programme === "placement") adjustments.push({ text: "Placement year option", delta: 4 });
  if (l.programme === "grad" && year < 3) adjustments.push({ text: "Graduate scheme: not eligible until final year", delta: -25 });
  if (/final[- ]year/i.test(all) && year < 3) adjustments.push({ text: "Targets final-year students", delta: -12 });
  if (/penultimate/i.test(all) && year === 2) adjustments.push({ text: "Targets penultimate-year students", delta: 5 });

  const base = 100 * (1 - miss);
  const score = Math.max(0, Math.min(100, Math.round(base + adjustments.reduce((a, x) => a + x.delta, 0))));

  const top = groups.flatMap((g) => g.hits).slice(0, 4);
  const why = top.length ? `Matches: ${top.join(", ")}` : "No CV keywords matched";
  return { score, groups, adjustments, why };
}

export const TRACKS = [
  { key: "spring", label: "Spring weeks" },
  { key: "summer", label: "Summer internships" },
  { key: "techai", label: "Tech product / AI" },
  { key: "policy", label: "Policy / AI governance" },
  { key: "startup", label: "Startup / VC" },
] as const;
export type TrackKey = (typeof TRACKS)[number]["key"];

export function tracksFor(l: MatchListing & { programme?: string }, m: MatchResult): TrackKey[] {
  const text = `${l.firm} ${l.role} ${l.description ?? ""}`;
  const out: TrackKey[] = [];
  if (l.programme === "spring week") out.push("spring");
  if (l.programme === "summer internship") out.push("summer");
  const tech = m.groups.find((g) => g.key === "techAI");
  if (l.type === "tech" || (tech && /product|\bAI\b|machine learning|data|software|engineer|analyst/i.test(l.role))) out.push("techai");
  if (m.groups.some((g) => g.key === "policy")) out.push("policy");
  if (/start-?up|venture|\bVC\b|founder|seed|scale-?up|early[- ]stage/i.test(text)) out.push("startup");
  return out;
}

export function inferProgramme(text: string): string {
  if (/spring\s*(week|insight|programme|internship)|insight\s*(week|programme|day)/i.test(text)) return "spring week";
  if (/summer\s*(intern|analyst|associate|programme)|\binterns?(hips?)?\b/i.test(text)) return "summer internship";
  if (/placement|industrial year|year in industry/i.test(text)) return "placement";
  if (/graduate|grad\s*(scheme|programme)|full[- ]time/i.test(text)) return "grad";
  return "other";
}

export function inferType(l: MatchListing): string {
  const r = scoreListing({ ...l, programme: undefined }, defaultMatchConfig());
  const f = r.groups.find((g) => g.key === "finance")?.points ?? 0;
  const t = r.groups.find((g) => g.key === "techAI")?.points ?? 0;
  if (f === 0 && t === 0) return "other";
  return f >= t ? "finance" : "tech";
}
