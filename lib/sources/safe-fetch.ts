import "server-only";
import dns from "node:dns/promises";
import net from "node:net";

/**
 * Single choke point for every outbound request the dashboard makes on your behalf
 * (link preview, RSS, Adzuna). Rules:
 *
 *  - NEVER authenticate to, or get around a login/bot-challenge on, a third-party site.
 *    Domains below are login-gated; we refuse to fetch them at all.
 *      · the-trackr.com   robots.txt allows crawling, but listings are behind a login and
 *                         its terms apply, so we don't fetch. Use CSV/paste import or the bookmarklet.
 *      · brightnetwork.co.uk  serves a bot challenge ("Just a moment…") even for robots.txt.
 *                         We don't try to pass it. Use import / bookmarklet.
 *      · linkedin.com     login-gated, and its terms forbid automated access.
 *  - Respect robots.txt (fetch + parse, longest-match). If robots.txt can't be read cleanly
 *    (5xx, 401/403, HTML challenge page) we treat the site as disallowed.
 *  - Only http(s) on ports 80/443; refuse private / loopback / link-local addresses
 *    (stops the link-preview box being used to poke at your own network).
 *  - Small timeouts and a response size cap.
 */
export const USER_AGENT = "PersonalDashboard/1.0 (personal job-search tool; single user)";

const GATED = ["the-trackr.com", "brightnetwork.co.uk", "linkedin.com"];

export class FetchRefused extends Error {}

export function isGated(host: string) {
  const h = host.toLowerCase();
  return GATED.some((d) => h === d || h.endsWith("." + d));
}

function privateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return privateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

async function assertAllowedUrl(u: URL) {
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new FetchRefused("Only http(s) links are supported.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new FetchRefused("Unusual port refused.");
  if (isGated(u.hostname)) throw new FetchRefused("login-gated");
  const addrs = net.isIP(u.hostname) ? [{ address: u.hostname }] : await dns.lookup(u.hostname, { all: true });
  if (addrs.length === 0 || addrs.some((a) => privateIp(a.address))) throw new FetchRefused("Private or local address refused.");
}

async function rawFetch(url: string, { maxBytes, timeoutMs, accept }: { maxBytes: number; timeoutMs: number; accept: string }) {
  let current = new URL(url);
  for (let hop = 0; hop < 4; hop++) {
    await assertAllowedUrl(current);
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": USER_AGENT, Accept: accept },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current);
      continue;
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    return { status: res.status, contentType: res.headers.get("content-type") ?? "", text: Buffer.concat(chunks).toString("utf8"), url: current };
  }
  throw new FetchRefused("Too many redirects.");
}

// ---- robots.txt -------------------------------------------------------
function parseRobots(txt: string) {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (k === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(m[2].toLowerCase());
      lastWasAgent = true;
    } else if ((k === "allow" || k === "disallow") && cur) {
      lastWasAgent = false;
      if (m[2]) cur.rules.push({ allow: k === "allow", path: m[2] });
    } else lastWasAgent = false;
  }
  return groups;
}

function robotsAllows(txt: string, path: string) {
  const groups = parseRobots(txt);
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && USER_AGENT.toLowerCase().includes(a)));
  const use = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  let best: { allow: boolean; len: number } | null = null;
  for (const g of use)
    for (const r of g.rules) {
      const re = new RegExp("^" + r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
      if (re.test(path) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow)))
        best = { allow: r.allow, len: r.path.length };
    }
  return best ? best.allow : true;
}

const robotsCache = new Map<string, { at: number; txt: string | null }>();

async function checkRobots(u: URL) {
  const origin = u.origin;
  let hit = robotsCache.get(origin);
  if (!hit || Date.now() - hit.at > 3600_000) {
    let txt: string | null = null; // null = unreadable -> treat as disallowed
    try {
      const r = await rawFetch(`${origin}/robots.txt`, { maxBytes: 200_000, timeoutMs: 5000, accept: "text/plain" });
      if (r.status === 404 || r.status === 410) txt = "";
      else if (r.status === 200 && !/<html/i.test(r.text.slice(0, 500))) txt = r.text;
    } catch {
      txt = null;
    }
    hit = { at: Date.now(), txt };
    robotsCache.set(origin, hit);
  }
  if (hit.txt === null) throw new FetchRefused(`Couldn't read ${u.hostname}/robots.txt cleanly, so not fetching.`);
  if (!robotsAllows(hit.txt, u.pathname + u.search)) throw new FetchRefused(`${u.hostname} robots.txt disallows this page.`);
}

export async function politeFetchText(
  url: string,
  opts: { maxBytes?: number; timeoutMs?: number; accept?: string } = {},
) {
  const u = new URL(url);
  await assertAllowedUrl(u);
  await checkRobots(u);
  const r = await rawFetch(url, {
    maxBytes: opts.maxBytes ?? 1_000_000,
    timeoutMs: opts.timeoutMs ?? 7000,
    accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
  });
  if (r.status >= 400) throw new FetchRefused(`Site answered ${r.status}.`);
  return r;
}

/** For official, keyed APIs (Adzuna): SSRF-safe, no robots check (the API is the sanctioned route). */
export async function apiFetchJson(url: string) {
  const r = await rawFetch(url, { maxBytes: 3_000_000, timeoutMs: 10000, accept: "application/json" });
  if (r.status >= 400) throw new FetchRefused(`API answered ${r.status}.`);
  return JSON.parse(r.text);
}

/** For official, subscribable feeds (iCal): SSRF-safe, no robots check (the feed is the sanctioned route). */
export async function apiFetchText(url: string) {
  const r = await rawFetch(url, { maxBytes: 5_000_000, timeoutMs: 10000, accept: "text/calendar,text/plain;q=0.8" });
  if (r.status >= 400) throw new FetchRefused(`Feed answered ${r.status}.`);
  if (!/BEGIN:VCALENDAR/.test(r.text.slice(0, 2000))) throw new FetchRefused("That URL didn't return an iCal (.ics) calendar.");
  return r.text;
}
