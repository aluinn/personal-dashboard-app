import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { looksLikeHae, mapHaeJson, mapNativeJson } from "@/lib/health/hae";
import { applyBatch } from "@/lib/health/store";

// Automatic sync endpoint for Health Auto Export's "REST API" automation or an iOS Shortcut.
//   POST /api/ingest/health          Authorization: Bearer <INGEST_SECRET>
// Body: Health Auto Export JSON ({data:{metrics:[…],workouts:[…]}}) OR the simple native shape
// ({sleep:[…],heartRate:[…],hrv:[…],steps:[…],workouts:[…]}), documented on Settings.
// Idempotent: re-sending a day updates it, never duplicates it.
export async function POST(req: Request) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return NextResponse.json({ error: "INGEST_SECRET is not set" }, { status: 503 });
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.text();
  if (raw.length > 50_000_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const hae = looksLikeHae(json);
  const saved = applyBatch(hae ? mapHaeJson(json) : mapNativeJson(json), hae ? "hae" : "api");
  revalidatePath("/", "layout");
  return NextResponse.json({ format: hae ? "health-auto-export" : "native", saved });
}
