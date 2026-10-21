import type { Block } from "@/lib/notes-blocks";

// Unified note shape shared by the 2D page, the galaxy and the Home widget.
export type NoteItem = {
  id: string; // "n-12" (uploaded PDF, local row id) or "s-<slug>" (placeholder)
  module: string;
  title: string;
  tags: string[];
  words: number;
  editedAt: number | null; // null for placeholders
  week: number | null;
  term: string;
  year: number;
  placeholder: boolean;
  preview: string;
  url: string; // link to the original (the uploaded PDF), "" for placeholders
  hasPdf?: boolean;
  kind?: string;
};

export type ModuleSummary = {
  code: string;
  name: string;
  color: string;
  term: string;
  year: number;
  notionUrl: string;
  noteCount: number;
  words: number;
  placeholder: boolean; // showing placeholders because the module has no real pages
  weeksCovered: number;
  termWeeks: number;
  lastEdited: number | null;
  deadlines: { id: number; title: string; dueDate: string; dueTime: string; weight: number | null; term: string }[];
};

export type ReadingNote = NoteItem & { blocks: Block[] };

/** Recency 0..1 for brightness: full for today, ~0.37 after `halfLife` days, floor so stale stays visible. */
export function freshness(editedAt: number | null, now: number, halfLifeDays = 30) {
  if (editedAt === null) return 0.5; // placeholders: mid brightness
  const days = Math.max(0, (now - editedAt) / 86400000);
  return Math.max(0.12, Math.exp(-days / halfLifeDays));
}
