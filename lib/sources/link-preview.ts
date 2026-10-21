import "server-only";
import { parseDate } from "./dates";
import { FetchRefused, isGated, politeFetchText } from "./safe-fetch";

// Source 1b: "paste a link" quick-add. Fetches ONE page you pasted (like a chat app's link preview)
// and reads its title/description/JSON-LD JobPosting. Login-gated sites are never fetched.

export type LinkPreview = {
  ok: boolean;
  notice?: string;
  firm?: string;
  role?: string;
  description?: string;
  deadline?: string | null;
  location?: string;
  link: string;
};

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/\s+/g, " ").trim();

function meta(html: string, name: string) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, "i");
  const m = html.match(re1) ?? html.match(re2);
  return m ? decode(m[1]) : "";
}

type JobPostingLd = {
  title?: string;
  description?: string;
  validThrough?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { address?: { addressLocality?: string; addressCountry?: string } };
};

function jobPosting(html: string) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]);
      const nodes: unknown[] = Array.isArray(j) ? j : j["@graph"] ? j["@graph"] : [j];
      const jp = nodes.find((n) => (n as { "@type"?: string })?.["@type"] === "JobPosting") as JobPostingLd | undefined;
      if (jp) return jp;
    } catch {
      /* ignore bad JSON-LD */
    }
  }
  return null;
}

export async function previewLink(raw: string): Promise<LinkPreview> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, notice: "That doesn't look like a link.", link: raw };
  }
  const link = u.toString();
  if (isGated(u.hostname))
    return {
      ok: false,
      link,
      notice: `${u.hostname} is login-gated, so I haven't fetched it. Fill the details in below, or use the bookmarklet while you're on the page.`,
    };
  try {
    const r = await politeFetchText(link);
    const html = r.text;
    const jp = jobPosting(html);
    const title = decode(meta(html, "og:title") || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""));
    const description = meta(html, "og:description") || meta(html, "description");
    const site = meta(html, "og:site_name");

    if (jp) {
      const loc = jp.jobLocation?.address;
      const body = String(jp.description ?? description);
      return {
        ok: true,
        link,
        role: decode(String(jp.title ?? title)),
        firm: decode(String(jp.hiringOrganization?.name ?? site ?? u.hostname)),
        description: decode(body.replace(/<[^>]+>/g, " ")).slice(0, 1500),
        deadline: parseDate(jp.validThrough ?? null),
        location: loc ? [loc.addressLocality, loc.addressCountry].filter(Boolean).join(", ") : "",
      };
    }
    // "Role | Firm" style titles
    const parts = title.split(/\s+[|–—-]\s+/).map((p) => p.trim()).filter(Boolean);
    let role = title;
    let firm = site || u.hostname.replace(/^www\./, "");
    if (parts.length >= 2) {
      const siteMatch = site ? parts.findIndex((p) => p.toLowerCase().includes(site.toLowerCase())) : -1;
      if (siteMatch >= 0) {
        firm = parts[siteMatch];
        role = parts.filter((_, i) => i !== siteMatch).join(" – ");
      } else {
        role = parts[0];
        firm = site || parts[parts.length - 1];
      }
    }
    return { ok: true, link, role, firm, description: description.slice(0, 1500) };
  } catch (e) {
    const msg = e instanceof FetchRefused ? e.message : "Couldn't fetch that page.";
    return { ok: false, link, notice: `${msg} You can still fill the details in by hand.` };
  }
}
