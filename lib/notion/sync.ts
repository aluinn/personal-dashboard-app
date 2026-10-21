import "server-only";
import { db } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/db/opp";
import { getTermDates } from "@/lib/db/academic";
import { CURRENT_YEAR, termOf, weekOfTerm } from "@/lib/academic";
import { NotionError, notion, notionConfigured } from "./client";
import { mapBlock, notionId, pageFields, previewOf, resolveModule, tableRows, wordCount } from "./map";
import type { Block } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Pulls your notes from Notion into the local `notes` table. Read-only, incremental (page bodies are
// only re-fetched when Notion says the page changed), and safe to run repeatedly.

export type SyncResult = {
  ok: boolean;
  at: number;
  pages: number;
  fetched: number;
  removed: number;
  perModule: Record<string, number>;
  unassigned: number;
  notes: string[];
  error?: string;
};

type Target = {
  id: string;
  title: string;
  url: string;
  created: number;
  edited: number;
  module: string | null;
  fields?: ReturnType<typeof pageFields>;
};

const MAX_PAGES = 250;
const g = globalThis as unknown as { __notion_sync?: Promise<SyncResult> };

export const getNotionStatus = () => ({
  tokenSet: notionConfigured(),
  database: getSetting<string>("notionDatabase", ""),
  hours: getSetting<number>("notionSyncHours", 3),
  last: getSetting<SyncResult | null>("notionLastSync", null),
});

export function syncDue() {
  const s = getNotionStatus();
  if (!s.tokenSet || s.hours <= 0) return false;
  if (!s.database && !(db.$client.prepare("SELECT COUNT(*) n FROM modules WHERE notion_url <> ''").get() as { n: number }).n) return false;
  return !s.last || Date.now() - s.last.at >= s.hours * 3600_000;
}

async function listAll(path: string, body?: unknown) {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const sep = path.includes("?") ? "&" : "?";
    const res = body
      ? await notion(path, { method: "POST", body: { ...(body as object), page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) } })
      : await notion(`${path}${sep}page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor && out.length < 1000);
  return out;
}

async function fetchBlocks(id: string, depth = 0, budget = { n: 1500 }): Promise<Block[]> {
  const raw = await listAll(`/blocks/${id}/children`);
  const out: Block[] = [];
  for (const rb of raw) {
    if (budget.n-- <= 0) break;
    const b = mapBlock(rb);
    if (!b) continue;
    if (b.t === "table") b.rows = tableRows(await listAll(`/blocks/${rb.id}/children`));
    else if (rb.has_children && rb.type !== "child_page" && depth < 2) b.children = await fetchBlocks(rb.id, depth + 1, budget);
    out.push(b);
  }
  return out;
}

const hashTags = (blocks: Block[]) => {
  const txt = (bl: Block): string => [(bl.text ?? []).map((x) => x.s).join(""), ...(bl.children ?? []).map(txt)].join(" ");
  const found = blocks.flatMap((b) => [...txt(b).matchAll(/(?:^|\s)#([A-Za-z][\w-]{1,24})\b/g)].map((m) => m[1]));
  return [...new Set(found)];
};

/** Is this id a page (with child pages) or a database? */
async function kindOf(id: string): Promise<"page" | "database"> {
  try {
    await notion(`/pages/${id}`);
    return "page";
  } catch (e) {
    if (e instanceof NotionError && (e.status === 400 || e.status === 404)) {
      await notion(`/databases/${id}`); // throws a clear "share it" error if neither
      return "database";
    }
    throw e;
  }
}

const rowToTarget = (p: any, module: string | null, mods: { code: string; name: string }[]): Target => {
  const f = pageFields(p);
  return {
    id: p.id, title: f.title, url: p.url, created: Date.parse(p.created_time), edited: Date.parse(p.last_edited_time),
    module: module ?? resolveModule(f.moduleText, mods) ?? resolveModule(f.title, mods), fields: f,
  };
};

async function run(): Promise<SyncResult> {
  const res: SyncResult = { ok: true, at: Date.now(), pages: 0, fetched: 0, removed: 0, perModule: {}, unassigned: 0, notes: [] };
  const c = db.$client;
  const mods = c.prepare("SELECT code, name, notion_url AS url FROM modules WHERE year = ?").all(CURRENT_YEAR) as { code: string; name: string; url: string }[];
  const terms = getTermDates();
  const targets = new Map<string, Target>();
  const errors: string[] = [];

  // A) one database with a Module property (or module code in the title)
  const dbId = notionId(getSetting<string>("notionDatabase", ""));
  if (dbId) {
    try {
      const rows = await listAll(`/databases/${dbId}/query`, {});
      for (const p of rows) targets.set(p.id, rowToTarget(p, null, mods));
    } catch (e) {
      errors.push(`Database: ${(e as Error).message}`);
    }
  }

  // B) one parent page (or database) per module, from the Notion URL on each module in Settings
  for (const m of mods) {
    const id = notionId(m.url);
    if (!id) continue;
    try {
      if ((await kindOf(id)) === "database") {
        for (const p of await listAll(`/databases/${id}/query`, {})) targets.set(p.id, rowToTarget(p, m.code, mods));
      } else {
        const kids = (await listAll(`/blocks/${id}/children`)).filter((b) => b.type === "child_page");
        if (kids.length === 0) {
          const p = await notion(`/pages/${id}`);
          targets.set(p.id, rowToTarget(p, m.code, mods));
        }
        for (const k of kids) {
          targets.set(k.id, {
            id: k.id, title: k.child_page.title || "Untitled", url: `https://www.notion.so/${k.id.replace(/-/g, "")}`,
            created: Date.parse(k.created_time), edited: Date.parse(k.last_edited_time), module: m.code,
          });
        }
      }
    } catch (e) {
      errors.push(`${m.code}: ${(e as Error).message}`);
    }
  }

  const list = [...targets.values()].filter((t) => {
    if (!t.module) res.unassigned++;
    return t.module;
  });
  if (list.length > MAX_PAGES) res.notes.push(`Only the first ${MAX_PAGES} of ${list.length} pages were synced.`);
  const seen = new Set<string>();
  const cached = new Map((c.prepare("SELECT external_id AS id, edited_at AS at FROM notes WHERE source = 'notion'").all() as { id: string; at: number }[]).map((r) => [r.id, r.at]));
  const getBlocks = c.prepare("SELECT blocks, words, preview FROM notes WHERE source='notion' AND external_id = ?");
  const upsert = c.prepare(`INSERT INTO notes (source, external_id, module_code, year, term, week, title, preview, tags, words, blocks, url, edited_at, synced_at)
    VALUES ('notion', @id, @module, @year, @term, @week, @title, @preview, @tags, @words, @blocks, @url, @edited, @now)
    ON CONFLICT(source, external_id) DO UPDATE SET module_code=@module, year=@year, term=@term, week=@week, title=@title, preview=@preview,
      tags=@tags, words=@words, blocks=@blocks, url=@url, edited_at=@edited, synced_at=@now`);

  for (const t of list.slice(0, MAX_PAGES)) {
    seen.add(t.id);
    try {
      let blocks: Block[] | null = null;
      let words: number, preview: string;
      if (cached.get(t.id) === t.edited) {
        const row = getBlocks.get(t.id) as { blocks: string; words: number; preview: string };
        blocks = JSON.parse(row.blocks) as Block[];
        words = row.words;
        preview = row.preview;
      } else {
        blocks = await fetchBlocks(t.id);
        words = wordCount(blocks);
        preview = previewOf(blocks);
        res.fetched++;
      }
      const f = t.fields;
      const createdDay = new Date(t.created).toISOString().slice(0, 10);
      const term = f?.term || termOf(createdDay, terms);
      const titleWeek = /week\s*(\d+)/i.exec(t.title)?.[1];
      // Week: the page's Week property, else "Week N" in the title, else the teaching week it was created in.
      const week = f?.week ?? (titleWeek ? Number(titleWeek) : weekOfTerm(createdDay, terms));
      upsert.run({
        id: t.id, module: t.module, year: f?.year ?? CURRENT_YEAR, term, week,
        title: t.title, preview, tags: JSON.stringify([...new Set([...(f?.tags ?? []), ...hashTags(blocks)])].slice(0, 12)),
        words, blocks: JSON.stringify(blocks), url: t.url, edited: t.edited, now: res.at,
      });
      res.perModule[t.module!] = (res.perModule[t.module!] ?? 0) + 1;
      res.pages++;
    } catch (e) {
      errors.push(`"${t.title}": ${(e as Error).message}`);
    }
  }

  // Pages that were deleted or un-shared disappear from the dashboard, but only after a clean run.
  if (errors.length === 0) {
    const del = c.prepare("DELETE FROM notes WHERE source='notion' AND external_id = ?");
    for (const id of cached.keys()) {
      if (seen.has(id)) continue;
      del.run(id);
      res.removed++;
    }
  }
  if (errors.length) {
    res.ok = false;
    res.error = errors.slice(0, 4).join(" | ");
  }
  if (res.unassigned) res.notes.push(`${res.unassigned} page${res.unassigned === 1 ? "" : "s"} skipped: couldn't tell which module they belong to (add a Module property, or put the module code like HPSC0014 in the title).`);
  return res;
}

/** One sync at a time; concurrent callers share the running one. */
export function syncNotes(): Promise<SyncResult> {
  if (!notionConfigured()) {
    return Promise.resolve({ ok: false, at: Date.now(), pages: 0, fetched: 0, removed: 0, perModule: {}, unassigned: 0, notes: [], error: "NOTION_TOKEN isn't set in .env.local" });
  }
  g.__notion_sync ??= run()
    .catch((e): SyncResult => ({ ok: false, at: Date.now(), pages: 0, fetched: 0, removed: 0, perModule: {}, unassigned: 0, notes: [], error: (e as Error).message }))
    .then((r) => {
      setSetting("notionLastSync", r);
      return r;
    })
    .finally(() => {
      g.__notion_sync = undefined;
    });
  return g.__notion_sync;
}
