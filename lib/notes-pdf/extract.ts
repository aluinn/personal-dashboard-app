import { getDocumentProxy } from "unpdf";
import type { Block } from "@/lib/notes-blocks";

// Turns a lecture-notes PDF (e.g. a Notion "Export as PDF") into the block tree the reading view renders.
// PDFs carry no structure, only positioned text, so headings/bullets/paragraphs are inferred from font
// size, bullet characters and line spacing. It works well for typed notes; scanned PDFs have no text.

type Item = { str: string; x: number; y: number; h: number; eol: boolean };
type Line = { text: string; h: number; y: number; x: number };

const BULLET = /^\s*([•◦▪▫●○■□\-–—*])\s+/;
const NUMBERED = /^\s*(\d{1,2})[.)]\s+/;

function toLines(items: Item[]): Line[] {
  // pdf.js lists items in reading order; start a new line when the baseline moves.
  const lines: Line[] = [];
  let cur: { parts: string[]; h: number; y: number; x: number } | null = null;
  for (const it of items) {
    if (!it.str && !it.eol) continue;
    if (cur && Math.abs(it.y - cur.y) > Math.max(2, it.h * 0.4)) {
      lines.push({ text: cur.parts.join("").replace(/\s+/g, " ").trim(), h: cur.h, y: cur.y, x: cur.x });
      cur = null;
    }
    if (!cur) cur = { parts: [], h: 0, y: it.y, x: it.x };
    cur.parts.push(it.str);
    cur.h = Math.max(cur.h, it.h);
  }
  if (cur) lines.push({ text: cur.parts.join("").replace(/\s+/g, " ").trim(), h: cur.h, y: cur.y, x: cur.x });
  return lines.filter((l) => l.text);
}

export async function pdfToBlocks(data: Uint8Array): Promise<{ blocks: Block[]; pages: number; chars: number }> {
  const pdf = await getDocumentProxy(data);
  const pages: Line[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    pages.push(
      toLines(
        (tc.items as { str?: string; transform?: number[]; height?: number; hasEOL?: boolean }[])
          .filter((i) => typeof i.str === "string" && i.transform)
          .map((i) => ({ str: i.str!, x: i.transform![4], y: i.transform![5], h: Math.abs(i.transform![3]) || i.height || 0, eol: !!i.hasEOL })),
      ),
    );
  }
  const all = pages.flat();
  const chars = all.reduce((a, l) => a + l.text.length, 0);
  if (chars === 0) return { blocks: [], pages: pdf.numPages, chars: 0 };

  // Body size = the most common line height, weighted by characters.
  const weight = new Map<number, number>();
  for (const l of all) {
    const k = Math.round(l.h * 2) / 2;
    weight.set(k, (weight.get(k) ?? 0) + l.text.length);
  }
  const body = [...weight.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const blocks: Block[] = [];
  let para: { text: string; lastY: number; h: number } | null = null;
  const flush = () => {
    if (para) blocks.push({ t: "p", text: [{ s: para.text }] });
    para = null;
  };
  for (const pageLines of pages) {
    if (para) flush(); // paragraphs don't continue across pages (page furniture sits in between)
    for (const l of pageLines) {
      const ratio = l.h / body;
      const bullet = BULLET.exec(l.text);
      const num = NUMBERED.exec(l.text);
      if (ratio >= 1.18 && l.text.length < 140 && !bullet) {
        flush();
        blocks.push({ t: ratio >= 1.6 ? "h1" : ratio >= 1.35 ? "h2" : "h3", text: [{ s: l.text }] });
      } else if (bullet || num) {
        flush();
        blocks.push({ t: bullet ? "ul" : "ol", text: [{ s: l.text.replace(bullet ? BULLET : NUMBERED, "") }] });
      } else if (para && Math.abs(para.lastY - l.y) < l.h * 2.1 && Math.abs(para.h - l.h) < 0.6) {
        para.text += (para.text.endsWith("-") ? "" : " ") + l.text;
        para.lastY = l.y;
      } else {
        flush();
        para = { text: l.text, lastY: l.y, h: l.h };
      }
    }
  }
  flush();
  return { blocks, pages: pdf.numPages, chars };
}
