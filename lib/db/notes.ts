import "server-only";
import { connection } from "next/server";
import { q } from "./index";
import { getTermDates } from "./academic";
import { CURRENT_YEAR, termOf, termWeeks } from "@/lib/academic";
import { SEED_NOTES, SEED_KIND_LABEL, type SeedNote } from "@/data/seed-notes";
import type { ModuleSummary, NoteItem, ReadingNote } from "@/lib/notes";
import { getNotionStatus } from "@/lib/notion/sync";
import type { Block } from "@/lib/notion/types";
import { londonToday } from "@/lib/time";

type Row = { id: number; module_code: string; title: string; tags: string; words: number; edited_at: number; week: number | null; term: string; year: number; preview: string; url: string };

const seedWords = (s: SeedNote) => s.body.join(" ").split(/\s+/).filter(Boolean).length + s.title.split(/\s+/).length;
const seedPreview = (s: SeedNote) => s.body.filter((l) => !l.startsWith("- ")).join(" ").slice(0, 200);

const seedItem = (s: SeedNote, term: string, year: number): NoteItem => ({
  id: `s-${s.slug}`, module: s.module, title: s.title, tags: s.tags, words: seedWords(s), editedAt: null, week: s.week, term, year,
  placeholder: true, preview: seedPreview(s), url: "", kind: SEED_KIND_LABEL[s.kind],
});

export async function getNotesData() {
  await connection();
  const terms = await getTermDates();
  const today = londonToday();
  const currentTerm = termOf(today, terms);

  const [mods, rows, due, status] = await Promise.all([
    q.all<{ id: number; code: string; name: string; color: string; term: string; year: number; notionUrl: string }>("SELECT id, code, name, color, term, year, notion_url AS notionUrl FROM modules WHERE year = ? ORDER BY code", [CURRENT_YEAR]),
    q.all<Row>("SELECT id, module_code, title, tags, words, edited_at, week, term, year, preview, url FROM notes WHERE year = ? ORDER BY edited_at DESC", [CURRENT_YEAR]),
    q.all<{ id: number; moduleId: number; title: string; dueDate: string; dueTime: string; weight: number | null; term: string }>(
      "SELECT id, module_id AS moduleId, title, due_date AS dueDate, due_time AS dueTime, weight, term FROM assessments WHERE year = ? AND progress < 100 AND due_date >= ? ORDER BY due_date, due_time",
      [CURRENT_YEAR, today],
    ),
    getNotionStatus(),
  ]);
  const real: NoteItem[] = rows.map((r) => ({
    id: `n-${r.id}`, module: r.module_code, title: r.title, tags: JSON.parse(r.tags) as string[], words: r.words, editedAt: r.edited_at,
    week: r.week, term: r.term, year: r.year, placeholder: false, preview: r.preview, url: r.url,
  }));
  const hasReal = new Set(real.map((n) => n.module));
  // Placeholders only for modules that have no real pages yet.
  const placeholders = SEED_NOTES.filter((s) => mods.some((m) => m.code === s.module) && !hasReal.has(s.module)).map((s) => seedItem(s, currentTerm, CURRENT_YEAR));
  const notes = [...real, ...placeholders];

  const modules: ModuleSummary[] = mods.map((m) => {
    const mine = notes.filter((n) => n.module === m.code);
    const isPh = mine.length > 0 && mine.every((n) => n.placeholder);
    const lectureWeeks = new Set(mine.filter((n) => n.week !== null && n.kind !== "Reading" && n.kind !== "Essay idea").map((n) => n.week));
    const t = (m.term === "All terms" ? currentTerm : m.term) as typeof currentTerm;
    return {
      code: m.code, name: m.name, color: m.color, term: m.term, year: m.year, notionUrl: m.notionUrl,
      noteCount: mine.length, words: isPh ? 0 : mine.reduce((a, n) => a + n.words, 0), placeholder: isPh,
      weeksCovered: lectureWeeks.size, termWeeks: termWeeks(t, terms),
      lastEdited: isPh ? null : (mine.reduce((a, n) => Math.max(a, n.editedAt ?? 0), 0) || null),
      deadlines: due.filter((d) => d.moduleId === m.id).slice(0, 4).map((d) => ({ id: d.id, title: d.title, dueDate: d.dueDate, dueTime: d.dueTime, weight: d.weight, term: d.term })),
    };
  });
  return { modules, notes, status, currentTerm, today };
}

const toBlocks = (s: SeedNote): Block[] => {
  const out: Block[] = [{ t: "callout", icon: "🧪", text: [{ s: "Placeholder note. Replace it by writing the real one in Notion and syncing." }] }];
  for (const line of s.body) out.push(line.startsWith("- ") ? { t: "ul", text: [{ s: line.slice(2) }] } : { t: "p", text: [{ s: line }] });
  return out;
};

export async function getReadingNote(id: string): Promise<ReadingNote | null> {
  await connection();
  const { notes } = await getNotesData();
  const item = notes.find((n) => n.id === id);
  if (!item) return null;
  if (item.placeholder) {
    const s = SEED_NOTES.find((x) => `s-${x.slug}` === id);
    return s ? { ...item, blocks: toBlocks(s) } : null;
  }
  const r = await q.get<{ blocks: string }>("SELECT blocks FROM notes WHERE id = ?", [Number(id.slice(2))]);
  return r ? { ...item, blocks: JSON.parse(r.blocks) as Block[] } : null;
}
