import { connection } from "next/server";
import { getReadiness } from "@/lib/db/readiness";

export async function GET(req: Request) {
  await connection();
  // Browser-only endpoint: used by the top bar.
  if (req.headers.get("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin") return new Response("Forbidden", { status: 403 });
  const r = getReadiness();
  return Response.json({ score: r.score, delta: r.delta });
}
