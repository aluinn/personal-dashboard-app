import type { Block, Span } from "./types";

// Pure mapping from Notion API JSON (version 2022-06-28 shapes) to what we store. No I/O.
/* eslint-disable @typescript-eslint/no-explicit-any */

export function spans(rich: any[] | undefined): Span[] {
  return (rich ?? []).map((r) => {
    const a = r.annotations ?? {};
    const o: Span = { s: r.plain_text ?? "" };
    if (a.bold) o.b = true;
    if (a.italic) o.i = true;
    if (a.code) o.c = true;
    if (a.strikethrough) o.st = true;
    if (a.underline) o.u = true;
    const href = r.href ?? r.text?.link?.url;
    if (href && /^https?:\/\//i.test(href)) o.href = href;
    return o;
  });
}
export const plain = (rich: any[] | undefined) => (rich ?? []).map((r) => r.plain_text ?? "").join("");

/** One API block -> our Block (children attached by the caller). Unknown types return null. */
export function mapBlock(b: any): Block | null {
  const d = b[b.type];
  switch (b.type) {
    case "paragraph": return { t: "p", text: spans(d.rich_text) };
    case "heading_1": return { t: "h1", text: spans(d.rich_text) };
    case "heading_2": return { t: "h2", text: spans(d.rich_text) };
    case "heading_3": return { t: "h3", text: spans(d.rich_text) };
    case "bulleted_list_item": return { t: "ul", text: spans(d.rich_text) };
    case "numbered_list_item": return { t: "ol", text: spans(d.rich_text) };
    case "to_do": return { t: "todo", text: spans(d.rich_text), checked: !!d.checked };
    case "quote": return { t: "quote", text: spans(d.rich_text) };
    case "callout": return { t: "callout", text: spans(d.rich_text), icon: d.icon?.emoji };
    case "toggle": return { t: "toggle", text: spans(d.rich_text) };
    case "code": return { t: "code", text: [{ s: plain(d.rich_text) }], lang: d.language };
    case "divider": return { t: "hr" };
    case "equation": return { t: "equation", text: [{ s: d.expression ?? "" }] };
    case "image": {
      // Notion-hosted files use signed URLs that expire after about an hour, so these may break on old syncs.
      const url = d.type === "external" ? d.external?.url : d.file?.url;
      return url ? { t: "image", url, caption: plain(d.caption) } : null;
    }
    case "bookmark":
    case "link_preview":
    case "embed": return d.url ? { t: "link", url: d.url, caption: plain(d.caption) || d.url } : null;
    case "child_page": return { t: "page", text: [{ s: d.title ?? "Untitled" }] };
    case "table": return { t: "table", header: !!d.has_column_header, rows: [] };
    default: return null;
  }
}

export function tableRows(rowBlocks: any[]): Span[][][] {
  return rowBlocks.filter((r) => r.type === "table_row").map((r) => (r.table_row.cells as any[][]).map((c) => spans(c)));
}

const textOf = (bl: Block): string =>
  [(bl.text ?? []).map((x) => x.s).join(""), ...(bl.rows ?? []).flat(2).map((x) => x.s), ...(bl.children ?? []).map(textOf)].join(" ");

export function wordCount(blocks: Block[]) {
  return blocks.reduce((n, b) => (b.t === "code" || b.t === "image" ? n : n + (textOf(b).match(/\S+/g)?.length ?? 0)), 0);
}
export function previewOf(blocks: Block[], max = 220) {
  const t = blocks
    .filter((b) => ["p", "ul", "ol", "quote", "callout", "todo"].includes(b.t))
    .map((b) => (b.text ?? []).map((x) => x.s).join(""))
    .filter(Boolean)
    .join(" · ");
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

// ---- page properties -------------------------------------------------------------------------
export type PageFields = {
  title: string;
  moduleText: string; // raw text of the Module property, "" if none
  tags: string[];
  week: number | null;
  term: string; // "Term 1" etc, "" if none
  year: number | null;
};

const propText = (p: any): string => {
  if (!p) return "";
  switch (p.type) {
    case "select": return p.select?.name ?? "";
    case "multi_select": return (p.multi_select ?? []).map((x: any) => x.name).join(", ");
    case "rich_text": return plain(p.rich_text);
    case "title": return plain(p.title);
    case "number": return p.number === null || p.number === undefined ? "" : String(p.number);
    case "status": return p.status?.name ?? "";
    case "formula": return p.formula?.string ?? (p.formula?.number != null ? String(p.formula.number) : "");
    case "rollup": return (p.rollup?.array ?? []).map(propText).filter(Boolean).join(", ");
    default: return "";
  }
};

export function pageFields(page: any): PageFields {
  const props: Record<string, any> = page.properties ?? {};
  const find = (re: RegExp) => Object.entries(props).find(([k]) => re.test(k.trim()))?.[1];
  const titleProp = Object.values(props).find((p: any) => p.type === "title");
  const week = propText(find(/^week$/i)).match(/\d+/)?.[0];
  const term = propText(find(/^term$/i)).match(/[123]/)?.[0];
  const year = propText(find(/^(academic )?year$/i)).match(/\d/)?.[0];
  const tagsRaw = find(/^(tags?|concepts?|topics?)$/i);
  const tags = tagsRaw
    ? propText(tagsRaw).split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  return {
    title: plain((titleProp as any)?.title) || "Untitled",
    moduleText: propText(find(/^module$/i)),
    tags: [...new Set(tags)].slice(0, 12),
    week: week ? Number(week) : null,
    term: term ? `Term ${term}` : "",
    year: year ? Number(year) : null,
  };
}

/** Match free text ("HPSC0014", "HPSC0014: Philosophy of Science 2", "Science and Religion") to a module code. */
export function resolveModule(text: string, mods: { code: string; name: string }[]): string | null {
  const t = text.trim();
  if (!t) return null;
  const code = t.match(/HPSC\d{4}/i)?.[0].toUpperCase();
  if (code && mods.some((m) => m.code === code)) return code;
  const lower = t.toLowerCase();
  return mods.find((m) => m.code.toLowerCase() === lower || lower.includes(m.name.toLowerCase()) || m.name.toLowerCase() === lower)?.code ?? null;
}

/** A 32-hex Notion id from a pasted URL or id (with or without dashes). */
export function notionId(input: string): string | null {
  const m = input.replace(/-/g, "").match(/[0-9a-f]{32}/i);
  return m ? m[0].toLowerCase() : null;
}
