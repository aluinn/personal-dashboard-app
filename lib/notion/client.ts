import "server-only";

// Thin wrapper over the official Notion REST API. The token lives in NOTION_TOKEN (.env.local) and
// is only ever sent to api.notion.com. Read-only: we never call a write endpoint.
// Pinned to API version 2022-06-28 (databases are queried with /databases/{id}/query). Notion has
// since added newer versions; this one is still served and says nothing about being retired.
const BASE = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

export class NotionError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

export const notionConfigured = () => Boolean(process.env.NOTION_TOKEN);

let lastCall = 0;
async function throttle() {
  // Notion allows about 3 requests/second on average.
  const wait = lastCall + 350 - Date.now();
  lastCall = Math.max(Date.now(), lastCall) + (wait > 0 ? wait : 0);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function notion(path: string, init?: { method?: string; body?: unknown }): Promise<any> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new NotionError("NOTION_TOKEN isn't set in .env.local");
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle();
    const res = await fetch(BASE + path, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, (Number(res.headers.get("retry-after")) || 2) * 1000));
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.message ?? `Notion answered ${res.status}`;
      if (res.status === 401) throw new NotionError("Notion rejected the token (401). Check NOTION_TOKEN.", 401);
      if (res.status === 404) throw new NotionError("Notion can't see that page. Share it with your integration (••• menu → Connections).", 404);
      throw new NotionError(msg, res.status);
    }
    return json;
  }
  throw new NotionError("Notion is rate-limiting requests; try again in a minute.", 429);
}
