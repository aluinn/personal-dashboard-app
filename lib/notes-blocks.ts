// What we keep of a note body: a small, serialisable block tree the reading view can render.
export type Span = { s: string; b?: boolean; i?: boolean; c?: boolean; st?: boolean; u?: boolean; href?: string };
export type Block = {
  t:
    | "p" | "h1" | "h2" | "h3" | "ul" | "ol" | "todo" | "quote" | "callout" | "code" | "hr"
    | "toggle" | "image" | "link" | "page" | "table" | "equation";
  text?: Span[];
  checked?: boolean;
  url?: string;
  caption?: string;
  lang?: string;
  icon?: string;
  rows?: Span[][][]; // table: rows -> cells -> spans
  header?: boolean;
  children?: Block[];
};

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

/** Tags typed as #AI or #regulation inside the text (and nothing else) become tags. */
export function hashTags(blocks: Block[]) {
  const found = blocks.flatMap((b) => [...textOf(b).matchAll(/(?:^|\s)#([A-Za-z][\w-]{1,24})\b/g)].map((m) => m[1]));
  return [...new Set(found)];
}
