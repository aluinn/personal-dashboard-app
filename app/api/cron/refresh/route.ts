import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runPublicRefresh } from "@/lib/sources/refresh";

// For hosted deployments (e.g. Vercel Cron, which sends `Authorization: Bearer $CRON_SECRET`).
// Locally the in-process scheduler already handles this.
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runPublicRefresh());
}
export const GET = handle;
export const POST = handle;
