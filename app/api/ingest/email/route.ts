import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { insertRows } from "@/lib/db/opp";
import { parseAlertEmail } from "@/lib/sources/email";

// Source 4: automated email-forward ingestion.
// Whatever receives your forwarded alert emails (Cloudflare Email Worker, Zapier/Make, a Gmail
// Apps Script, Postmark/Mailgun inbound...) POSTs JSON here:
//   Authorization: Bearer <INGEST_SECRET>
//   { "subject": "...", "from": "...", "text": "...", "html": "..." }   (Postmark-style
//   Subject/From/TextBody/HtmlBody keys are accepted too)
// Parsed listings land in the Feed inbox for triage. Needs a URL the sender can reach, so it works
// once the dashboard is deployed or exposed via a tunnel; until then use the paste box in the UI.
export async function POST(req: Request) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return NextResponse.json({ error: "INGEST_SECRET is not set" }, { status: 503 });

  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.text();
  if (raw.length > 1_500_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const pick = (...k: string[]) => k.map((x) => body[x]).find((v) => typeof v === "string") as string | undefined;
  const rows = parseAlertEmail({
    subject: pick("subject", "Subject"),
    from: pick("from", "From"),
    text: pick("text", "TextBody"),
    html: pick("html", "HtmlBody"),
  });
  const res = await insertRows(rows, { status: "feed", source: "email" });
  return NextResponse.json({ parsed: rows.length, ...res });
}
