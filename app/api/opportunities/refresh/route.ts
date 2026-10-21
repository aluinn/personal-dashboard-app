import { NextResponse } from "next/server";
import { refreshOnVisit } from "@/lib/sources/refresh";

// Called by the app itself when you open it. Browsers always label same-site fetches, so
// requests from other sites are refused. Real throttling lives in refreshOnVisit (3h minimum
// age) plus the per-query caches and daily caps.
export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") !== "same-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await refreshOnVisit(), { headers: { "Cache-Control": "no-store" } });
}
