import { freshness, type ModuleSummary, type NoteItem } from "@/lib/notes";

// Pure graph + layout maths for the Knowledge Galaxy (3D and 2D views share it).
export type Layout = "clusters" | "timeline" | "concepts";
export const MAX_NODES = 400;

export type GNode = {
  i: number;
  id: string;
  module: string;
  mi: number;
  title: string;
  words: number;
  editedAt: number | null;
  tags: string[];
  week: number | null;
  placeholder: boolean;
  preview: string;
  url: string;
  fresh: number; // 0..1 recency (brightness)
  size: number; // sphere radius
  r: number; th0: number; w: number; tilt: number; psi: number; // orbit
  j: [number, number, number]; // stable jitter in -1..1
};
export type GLink = { a: number; b: number; cross: boolean; shared: string[] };
export type GModule = { code: string; name: string; color: string; mi: number; fresh: number; count: number; words: number; placeholder: boolean };
export type Hub = { tag: string; count: number; pos: [number, number, number] };
export type Graph = { nodes: GNode[]; links: GLink[]; modules: GModule[]; hubs: Hub[] };

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}
const rnd = (id: string, k: string) => hash(id + k);

export function nodeSize(words: number) {
  return 0.07 + 0.22 * Math.sqrt(Math.min(words, 1500) / 1500);
}

const fib = (i: number, n: number, r: number): [number, number, number] => {
  const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
  const rad = Math.sqrt(Math.max(0, 1 - y * y));
  const t = Math.PI * (3 - Math.sqrt(5)) * i;
  return [Math.cos(t) * rad * r, y * r, Math.sin(t) * rad * r];
};

export function buildGraph(notes: NoteItem[], modules: ModuleSummary[], now: number): Graph {
  // Cap the node count (newest / biggest first) so the scene stays at 60fps.
  const pick = notes.length > MAX_NODES ? [...notes].sort((a, b) => (b.editedAt ?? 0) - (a.editedAt ?? 0) || b.words - a.words).slice(0, MAX_NODES) : notes;
  const mIndex = new Map(modules.map((m, i) => [m.code, i]));
  const nodes: GNode[] = pick
    .filter((n) => mIndex.has(n.module))
    .map((n, i) => ({
      i, id: n.id, module: n.module, mi: mIndex.get(n.module)!, title: n.title, words: n.words, editedAt: n.editedAt, tags: n.tags,
      week: n.week, placeholder: n.placeholder, preview: n.preview, url: n.url, fresh: freshness(n.editedAt, now), size: nodeSize(n.words),
      r: 1.15 + rnd(n.id, "r") * 1.2 + Math.sqrt(Math.min(n.words, 1500)) / 70,
      th0: rnd(n.id, "t") * Math.PI * 2, w: (0.12 + rnd(n.id, "w") * 0.2) * (rnd(n.id, "d") > 0.5 ? 1 : -1),
      tilt: (rnd(n.id, "p") - 0.5) * 1.6, psi: (rnd(n.id, "s") - 0.5) * 1.2,
      j: [rnd(n.id, "a") * 2 - 1, rnd(n.id, "b") * 2 - 1, rnd(n.id, "c") * 2 - 1],
    }));

  const gm: GModule[] = modules.map((m, mi) => {
    const mine = nodes.filter((n) => n.mi === mi);
    return {
      code: m.code, name: m.name, color: m.color, mi, count: mine.length, words: mine.reduce((a, n) => a + n.words, 0),
      fresh: mine.length ? Math.max(...mine.map((n) => n.fresh)) : 0.12, placeholder: m.placeholder,
    };
  });

  // Concept hubs: the most-used tags, spread over a sphere.
  const tagCount = new Map<string, number>();
  nodes.forEach((n) => n.tags.forEach((t) => tagCount.set(t.toLowerCase(), (tagCount.get(t.toLowerCase()) ?? 0) + 1)));
  const top = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  const hubs: Hub[] = top.map(([tag, count], i) => ({ tag, count, pos: fib(i, top.length, 5.6) }));

  // Links between notes that share tags; cross-module pairs first, degree-capped.
  const cand: { a: number; b: number; shared: string[]; cross: boolean }[] = [];
  for (let a = 0; a < nodes.length; a++) {
    const ta = new Set(nodes[a].tags.map((t) => t.toLowerCase()));
    if (!ta.size) continue;
    for (let b = a + 1; b < nodes.length; b++) {
      const shared = nodes[b].tags.map((t) => t.toLowerCase()).filter((t) => ta.has(t));
      if (shared.length) cand.push({ a, b, shared, cross: nodes[a].mi !== nodes[b].mi });
    }
  }
  cand.sort((x, y) => y.shared.length - x.shared.length || Number(y.cross) - Number(x.cross));
  const deg = new Array(nodes.length).fill(0);
  const links: GLink[] = [];
  for (const c of cand) {
    if (links.length >= 240) break;
    if (deg[c.a] >= 4 || deg[c.b] >= 4) continue;
    deg[c.a]++;
    deg[c.b]++;
    links.push(c);
  }
  return { nodes, links, modules: gm, hubs };
}

// ---- layouts ----------------------------------------------------------------------------------
type V3 = [number, number, number];
export const corePos = (mi: number, m: number, layout: Layout): V3 => {
  if (layout === "timeline") {
    const a = (mi / m) * Math.PI * 2;
    return [Math.cos(a) * 3.4, -6.4, Math.sin(a) * 3.4];
  }
  const a = (mi / m) * Math.PI * 2 + 0.4;
  const R = layout === "concepts" ? 8.6 : 6.4;
  return [Math.cos(a) * R, layout === "concepts" ? 0 : mi % 2 ? 1.5 : -1.5, Math.sin(a) * R];
};

export function nodePos(g: Graph, n: GNode, layout: Layout, t: number, calm: boolean, out: V3) {
  const m = g.modules.length;
  const wob = calm ? 0 : t;
  if (layout === "clusters") {
    const c = corePos(n.mi, m, layout);
    const th = n.th0 + n.w * wob;
    const x = n.r * Math.cos(th), z = n.r * Math.sin(th);
    const y1 = -z * Math.sin(n.tilt), z1 = z * Math.cos(n.tilt);
    out[0] = c[0] + x * Math.cos(n.psi) - y1 * Math.sin(n.psi);
    out[1] = c[1] + x * Math.sin(n.psi) + y1 * Math.cos(n.psi);
    out[2] = c[2] + z1;
    return;
  }
  if (layout === "timeline") {
    const week = n.week ?? 11;
    const ang = week * 0.62 + (n.mi / m) * Math.PI * 2;
    const R = 3.4 + n.j[0] * 0.9;
    out[0] = Math.cos(ang) * R + n.j[2] * 0.3 + Math.sin(wob * 0.4 + n.th0) * 0.08;
    out[1] = (week - 6) * 0.85 + n.j[1] * 0.45;
    out[2] = Math.sin(ang) * R + n.j[2] * 0.3 + Math.cos(wob * 0.4 + n.th0) * 0.08;
    return;
  }
  // concepts: centroid of this note's tag hubs; untagged notes rest near their module
  const hs = n.tags.map((t) => g.hubs.find((h) => h.tag === t.toLowerCase())).filter(Boolean) as Hub[];
  let base: V3;
  if (hs.length) base = [hs.reduce((a, h) => a + h.pos[0], 0) / hs.length, hs.reduce((a, h) => a + h.pos[1], 0) / hs.length, hs.reduce((a, h) => a + h.pos[2], 0) / hs.length];
  else base = corePos(n.mi, m, layout);
  out[0] = base[0] + n.j[0] * 0.9 + Math.sin(wob * 0.5 + n.th0) * 0.1;
  out[1] = base[1] + n.j[1] * 0.9;
  out[2] = base[2] + n.j[2] * 0.9 + Math.cos(wob * 0.5 + n.th0) * 0.1;
}

export function matches(n: { title: string; tags: string[]; module: string; preview: string }, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return `${n.title} ${n.tags.join(" ")} ${n.module} ${n.preview}`.toLowerCase().includes(s);
}
