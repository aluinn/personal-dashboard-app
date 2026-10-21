// Source 4: alert-email parser. Pure function, so it's testable and used by:
//   - POST /api/ingest/email (automated forwarding, once you've set it up)
//   - the "Paste an alert email" box in the UI (works today, no forwarding needed)
//
// IMPORTANT: written WITHOUT access to real Trackr/Bright Network emails (those are behind your
// login), so layouts are inferred from how alert emails are usually built: a heading/link per
// listing, with "Deadline: …" / "Opens: …" lines nearby. Forward me 2-3 real examples (remove
// anything personal) and I'll tune the adapters below to their exact structure.
import { parseDate } from "./dates";
import type { ImportRow } from "./types";

export type InboundEmail = { subject?: string; from?: string; text?: string; html?: string };

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));

const SKIP_LINK = /unsubscribe|preferences|privacy|terms|view[- ]in[- ]browser|mailto:|facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com\/company|tiktok|youtube|manage|settings|forward|\.(png|jpg|gif)(\?|$)/i;
const SKIP_TEXT = /^(unsubscribe|view (this )?(email )?in (your )?browser|privacy|terms|click here|here|read more|learn more|see more|apply( now)?|view|log ?in|sign ?in|manage.*|update.*preferences)$/i;

/** HTML -> text, keeping each link as ⟦text|url⟧ so we can pair titles with URLs. */
function htmlToMarked(html: string) {
  return decode(
    html
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
        const t = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return t ? ` ⟦${t}|${href}⟧ ` : " ";
      })
      .replace(/<(br|\/p|\/div|\/tr|\/li|\/h\d|\/td)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function textToMarked(text: string) {
  const out: string[] = [];
  const urlOnly = /^<?(https?:\/\/[^\s>)\]]+)>?$/;
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l) continue;
    const only = l.match(urlOnly);
    if (only && out.length && !out[out.length - 1].includes("⟦")) {
      // URL on its own line: the line above is its title.
      out[out.length - 1] = `⟦${out[out.length - 1]}|${only[1]}⟧`;
      continue;
    }
    out.push(
      l.replace(/<?(https?:\/\/[^\s>)\]]+)>?/g, (_, url) => {
        const before = l.replace(/<?https?:\/\/[^\s>)\]]+>?/g, "").replace(/[()[\]:-]+$/g, "").trim();
        return `⟦${before || "link"}|${url}⟧`;
      }),
    );
  }
  return out;
}

const DEADLINE = /(?:deadline|closes?|closing(?: date)?|apply by|applications? close[sd]?(?: on)?)\s*[:\-–]?\s*(.{4,40})/i;
const OPENS = /(?:opens?|opening(?: date)?|applications? open(?:s|ed)?(?: on)?)\s*[:\-–]?\s*(.{4,40})/i;

function splitFirmRole(title: string): { firm?: string; role?: string } {
  let m = title.match(/^(.{2,60}?)\s+(?:-|–|—|\||:)\s+(.{3,120})$/);
  if (m) return { firm: m[1].trim(), role: m[2].trim() };
  m = title.match(/^(.{3,120}?)\s+(?:at|@)\s+(.{2,60})$/i);
  if (m) return { firm: m[2].trim(), role: m[1].trim() };
  return { role: title };
}

export function parseAlertEmail(mail: InboundEmail, today = new Date()): ImportRow[] {
  const lines = mail.html ? htmlToMarked(mail.html) : textToMarked(mail.text ?? "");
  const source = /trackr/i.test(mail.from ?? "") ? "The Trackr" : /bright ?network/i.test(mail.from ?? "") ? "Bright Network" : "email";
  const rows: ImportRow[] = [];
  const seen = new Set<string>();

  lines.forEach((line, i) => {
    for (const m of line.matchAll(/⟦([^|⟧]*)\|([^⟧]*)⟧/g)) {
      const text = m[1].trim();
      const url = m[2].trim();
      if (!/^https?:/i.test(url) || SKIP_LINK.test(url) || SKIP_TEXT.test(text) || text.length < 6) continue;

      // Context = this line plus following lines up to the NEXT listing's link (never earlier lines,
      // which belong to the previous listing).
      let end = i + 1;
      while (end < lines.length && end < i + 5 && !lines[end].includes("⟦")) end++;
      const ctx = lines.slice(i, end).map((l) => l.replace(/⟦([^|⟧]*)\|[^⟧]*⟧/g, "$1"));
      const joined = ctx.join("\n");
      const dl = joined.match(DEADLINE)?.[1];
      const op = joined.match(OPENS)?.[1];
      const deadline = parseDate(dl, today);
      const opensOn = parseDate(op, today);

      const split = splitFirmRole(text);
      let firm = split.firm;
      const role = split.role;
      if (!firm) {
        // Firm is usually the short line directly above/below that isn't a date line.
        const neighbours = [lines[i - 1], lines[i + 1]].filter(Boolean).map((l) => l.replace(/⟦([^|⟧]*)\|[^⟧]*⟧/g, "$1"));
        firm = neighbours.find((l) => l.length >= 2 && l.length <= 50 && !DEADLINE.test(l) && !OPENS.test(l) && !/\d{4}/.test(l));
      }
      if (!firm || !role) continue;
      const key = `${firm}|${role}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        firm,
        role,
        link: url,
        deadline,
        opensOn,
        notes: `Imported from ${source} alert${mail.subject ? `: ${mail.subject}` : ""}`,
      });
    }
  });

  // Single-listing email with no usable links: fall back to the subject line.
  if (rows.length === 0 && mail.subject) {
    const subj = mail.subject.replace(/^(fwd?|re):\s*/i, "").replace(/^(new|now open|opening soon|closing soon)[:\s-]+/i, "");
    const { firm, role } = splitFirmRole(subj);
    const body = (mail.html ? htmlToMarked(mail.html) : (mail.text ?? "").split(/\r?\n/)).join("\n");
    if (firm && role)
      rows.push({
        firm,
        role,
        deadline: parseDate(body.match(DEADLINE)?.[1], today),
        opensOn: parseDate(body.match(OPENS)?.[1], today),
        link: body.match(/https?:\/\/[^\s<>"')\]]+/)?.[0] && !SKIP_LINK.test(body.match(/https?:\/\/[^\s<>"')\]]+/)![0]) ? body.match(/https?:\/\/[^\s<>"')\]]+/)![0] : "",
        notes: `Imported from ${source} alert: ${mail.subject}`,
      });
  }
  return rows;
}
