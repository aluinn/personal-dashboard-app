// What we keep of a Notion page body: a small, serialisable block tree the reading view can render.
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
