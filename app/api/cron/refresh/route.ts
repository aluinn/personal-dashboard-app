import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runPublicRefresh } from "@/lib/sources/refresh";
import { notionConfigured } from "@/lib/notion/client";
import { syncNotes } from "@/lib/notion/sync";

// For hosted deployments (e.g. Vercel Cron, which sends `Authorization: Bearer $CRON_SECRET`).
// Locally the in-process scheduler already handles this. Also syncs Notion notes.
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // One daily cron does both jobs (Vercel Hobby crons run at most once a day).
  const opportunities = await runPublicRefresh();
  const notes = notionConfigured() ? await syncNotes() : null;
  return NextResponse.json({ ...opportunities, notes });
}
export const GET = handle;
export const POST = handle;
