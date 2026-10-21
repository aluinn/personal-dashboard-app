import { NextResponse, type NextRequest } from "next/server";

// Optional password gate. If DASHBOARD_PASSWORD is set, every page asks for it (HTTP Basic auth:
// any username, that password). Leave it unset for local-only use. You want it set the moment the
// app is reachable from anywhere other than this computer (phone on Wi-Fi, a tunnel, a deploy).
//
// Left open on purpose: the PWA files, which browsers fetch without credentials, and the machine
// endpoints, which check their own secrets (INGEST_SECRET / CRON_SECRET) and reject everything else.
const OPEN = [/^\/manifest\.webmanifest$/, /^\/sw\.js$/, /^\/offline\.html$/, /^\/icons\//, /^\/api\/ingest\//, /^\/api\/cron\//];

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function proxy(req: NextRequest) {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw || OPEN.some((r) => r.test(req.nextUrl.pathname))) return NextResponse.next();
  const given = (req.headers.get("authorization") ?? "").match(/^Basic\s+(.+)$/i)?.[1];
  if (given) {
    const decoded = atob(given);
    if (same(decoded.slice(decoded.indexOf(":") + 1), pw)) return NextResponse.next();
  }
  return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Dashboard", charset="UTF-8"' } });
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
