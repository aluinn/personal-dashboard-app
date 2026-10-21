import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { revalidatePath } from "next/cache";
import { importHealthFile } from "@/lib/health/import-file";

// Browser upload for Settings > Import. The file arrives as the raw request body (so multi-GB Apple
// exports stream to disk instead of living in memory) and progress streams back as NDJSON lines.
// Guard: only requests from this site's own pages (browsers label those `same-origin`).
export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") !== "same-origin") return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!req.body) return Response.json({ error: "Empty upload" }, { status: 400 });

  const filename = decodeURIComponent(req.headers.get("x-filename") ?? "upload").replace(/[/\\]/g, "_");
  const tmp = path.join(os.tmpdir(), `health-import-${randomUUID()}${path.extname(filename).toLowerCase()}`);
  try {
    await pipeline(Readable.fromWeb(req.body as never), fs.createWriteStream(tmp));
  } catch {
    fs.rmSync(tmp, { force: true });
    return Response.json({ error: "Upload interrupted" }, { status: 400 });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: Record<string, unknown>) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        send({ type: "progress", phase: "processing", pct: 0, message: "Upload received. Processing…" });
        const results = await importHealthFile(tmp, filename, send);
        revalidatePath("/", "layout");
        send({ type: "done", results });
      } catch (e) {
        send({ type: "error", message: (e as Error).message || "Import failed" });
      } finally {
        fs.rmSync(tmp, { force: true });
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
