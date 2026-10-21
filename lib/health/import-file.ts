import "server-only";
import fs from "node:fs";
import { PassThrough, type Readable } from "node:stream";
import { parseAppleXml } from "./apple";
import { mapHealthCsv } from "./csv";
import { looksLikeHae, mapHaeJson, mapNativeJson } from "./hae";
import { applyBatch } from "./store";
import { eachZipEntry } from "./zip";

export type Emit = (o: Record<string, unknown>) => void;
const MAX_TEXT = 200 * 1024 * 1024; // CSV/JSON files are small; refuse absurd ones

async function readText(stream: Readable) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of stream) {
    size += (c as Buffer).length;
    if (size > MAX_TEXT) throw new Error("File too large for CSV/JSON import.");
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function importAppleStream(stream: Readable, totalBytes: number, emit: Emit) {
  let read = 0;
  const counter = new PassThrough();
  stream.on("data", (c: Buffer) => (read += c.length));
  stream.pipe(counter);
  let lastPct = -1;
  const timer = setInterval(() => {
    const pct = totalBytes ? Math.min(99, Math.round((read / totalBytes) * 100)) : 0;
    if (pct !== lastPct) emit({ type: "progress", phase: "processing", pct, message: `Reading Apple Health records… ${pct}%` });
    lastPct = pct;
  }, 400);
  try {
    const { batch, counts } = await parseAppleXml(counter);
    emit({ type: "progress", phase: "saving", pct: 99, message: "Saving…" });
    const saved = await applyBatch(batch, "apple");
    return { kind: "Apple Health export", counts, saved };
  } finally {
    clearInterval(timer);
  }
}

async function importTextFile(name: string, text: string) {
  if (/\.json$/i.test(name)) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`${name}: not valid JSON.`);
    }
    const hae = looksLikeHae(json);
    const batch = hae ? mapHaeJson(json) : mapNativeJson(json);
    return { kind: hae ? "Health Auto Export JSON" : "JSON", saved: await applyBatch(batch, "hae"), note: undefined as string | undefined };
  }
  const r = mapHealthCsv(text);
  if (r.error) throw new Error(`${name}: ${r.error}`);
  return {
    kind: "CSV",
    saved: await applyBatch(r.batch, "hae"),
    note: `Used columns: ${r.recognised.join("; ")}${r.ignored.length ? `. Ignored: ${r.ignored.join(", ")}` : ""}`,
  };
}

/** Dispatch on file type. Streams progress through `emit`; returns a summary. */
export async function importHealthFile(file: string, filename: string, emit: Emit) {
  const lower = filename.toLowerCase();
  const results: unknown[] = [];

  if (lower.endsWith(".zip")) {
    let sawApple = false;
    await eachZipEntry(file, async (e, open) => {
      const base = e.name.split("/").pop() ?? e.name;
      if (/^export\.xml$/i.test(base)) {
        sawApple = true;
        results.push(await importAppleStream(await open(), e.size, emit));
      } else if (/\.(csv|json)$/i.test(base) && !sawApple) {
        emit({ type: "progress", phase: "processing", message: `Reading ${base}…` });
        results.push({ file: base, ...(await importTextFile(base, await readText(await open()))) });
      }
    });
    if (results.length === 0) throw new Error("That zip has no export.xml, CSV or JSON files I can read.");
  } else if (lower.endsWith(".xml")) {
    results.push(await importAppleStream(fs.createReadStream(file), fs.statSync(file).size, emit));
  } else if (/\.(csv|tsv|txt|json)$/.test(lower)) {
    results.push({ file: filename, ...(await importTextFile(filename, fs.readFileSync(file, "utf8"))) });
  } else {
    throw new Error("Unsupported file. Use Apple Health export.zip / export.xml, or a CSV / JSON file.");
  }
  return results;
}
