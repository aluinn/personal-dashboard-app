import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { getTermDates } from "@/lib/db/academic";
import { CURRENT_YEAR, termOf, weekOfTerm } from "@/lib/academic";
import { hashTags, previewOf, wordCount } from "@/lib/notes-blocks";
import { pdfToBlocks } from "@/lib/notes-pdf/extract";
import { londonToday } from "@/lib/time";

export const maxDuration = 30;

// Vercel rejects request bodies over ~4.5 MB before they reach us, so keep a margin under that.
const MAX_BYTES = 4 * 1024 * 1024;

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  // Browser-only endpoint (the upload form on the Notes page).
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return fail("Forbidden", 403);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Couldn't read the upload. PDFs over about 4 MB can't be uploaded to the hosted site; try a smaller export.", 413);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Choose a PDF file.");
  if (file.size > MAX_BYTES) return fail(`That PDF is ${(file.size / 1048576).toFixed(1)} MB; the limit is 4 MB. Export fewer pages, or turn off images when exporting.`, 413);
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return fail("That doesn't look like a PDF file.");

  const moduleCode = String(form.get("module") ?? "");
  const mod = await q.get<{ code: string }>("SELECT code FROM modules WHERE code = ? AND year = ?", [moduleCode, CURRENT_YEAR]);
  if (!mod) return fail("Pick which module this lecture belongs to.");

  let parsed;
  try {
    parsed = await pdfToBlocks(bytes.slice()); // pdf.js takes ownership of the buffer it is given, so hand it a copy
  } catch {
    return fail("Couldn't read that PDF. It may be encrypted or damaged.");
  }
  if (parsed.chars === 0) return fail("No text found in that PDF. It may be a scan or images only. Export from Notion as PDF (not a screenshot).");

  const terms = await getTermDates();
  const today = londonToday();
  const title =
    String(form.get("title") ?? "").trim().slice(0, 140) ||
    parsed.blocks.find((b) => b.t === "h1" || b.t === "h2" || b.t === "h3")?.text?.[0]?.s.slice(0, 140) ||
    file.name.replace(/\.pdf$/i, "").slice(0, 140) ||
    "Untitled lecture";
  const weekIn = Number(form.get("week"));
  const week = Number.isFinite(weekIn) && weekIn >= 1 && weekIn <= 12 ? Math.round(weekIn) : /week\s*(\d+)/i.test(title) ? Number(/week\s*(\d+)/i.exec(title)![1]) : weekOfTerm(today, terms);
  const tags = [...new Set([...String(form.get("tags") ?? "").split(/[,\n]/).map((t) => t.trim().replace(/^#/, "")).filter(Boolean), ...hashTags(parsed.blocks)])].slice(0, 12);

  // One atomic batch: the note and its PDF are saved together or not at all.
  const [note] = await q.batch([
    {
      sql: `INSERT INTO notes (source, external_id, module_code, year, term, week, title, preview, tags, words, blocks, url, edited_at, synced_at)
     VALUES ('pdf', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
      args: [crypto.randomUUID(), mod.code, CURRENT_YEAR, termOf(today, terms), week, title, previewOf(parsed.blocks), JSON.stringify(tags), wordCount(parsed.blocks), JSON.stringify(parsed.blocks), Date.now(), Date.now()],
    },
    { sql: "INSERT INTO note_files (note_id, name, mime, data) VALUES ((SELECT MAX(id) FROM notes), ?, 'application/pdf', ?)", args: [file.name.slice(0, 200), buf] },
  ]);
  return NextResponse.json({ ok: true, id: `n-${note.lastInsertRowid}`, title, words: wordCount(parsed.blocks), pages: parsed.pages });
}
