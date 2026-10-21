// Source 2: CSV / TSV / JSON import. Works on text you export or copy yourself from
// The Trackr, Bright Network, a spreadsheet, etc. — nothing here talks to those sites.
import { parseDate } from "./dates";
import type { ImportRow } from "./types";

export function parseDelimited(text: string, delim: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const ALIASES: Record<keyof ImportRow, string[]> = {
  firm: ["firm", "company", "companyname", "employer", "organisation", "organization", "name", "bank"],
  role: ["role", "title", "jobtitle", "position", "job", "programme", "program", "opportunity", "scheme"],
  type: ["type", "sector", "industry", "category", "field"],
  programme: ["programmetype", "programtype", "scheme", "levelname", "jobtype", "level", "programme"],
  deadline: ["deadline", "closingdate", "closes", "closedate", "applicationdeadline", "applyby", "close", "closing"],
  opensOn: ["opens", "opendate", "openingdate", "opensOn", "applicationsopen", "opening", "open"],
  link: ["link", "url", "applylink", "applicationlink", "website", "applyurl"],
  notes: ["notes", "note", "comments", "comment"],
  description: ["description", "details", "summary", "about"],
  location: ["location", "city", "office", "where"],
  status: ["status", "stage", "progress"],
};

const clean = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

function mapHeaders(headers: string[]) {
  const idx: Partial<Record<keyof ImportRow, number>> = {};
  const used = new Set<number>();
  // First pass: exact alias in declared priority order, so "programme type" beats "programme" for role.
  for (const key of Object.keys(ALIASES) as (keyof ImportRow)[]) {
    for (const alias of ALIASES[key]) {
      const i = headers.findIndex((h, n) => !used.has(n) && clean(h) === clean(alias));
      if (i >= 0) {
        idx[key] = i;
        used.add(i);
        break;
      }
    }
  }
  return idx;
}

function mapStatus(s: string | undefined) {
  const v = (s ?? "").toLowerCase();
  if (!v) return undefined;
  if (/offer/.test(v)) return "offer";
  if (/reject|unsuccess|declin/.test(v)) return "rejected";
  if (/interview|assessment cent|video/.test(v)) return "interview";
  if (/test|assess|aptitude|numerical|verbal/.test(v)) return "online_test";
  if (/appli|submitted/.test(v)) return "applied";
  if (/save|interested|wishlist|shortlist/.test(v)) return "saved";
  return undefined;
}

export function parseImport(text: string, today = new Date()): { rows: ImportRow[]; errors: string[] } {
  const t = text.trim();
  const errors: string[] = [];
  if (!t) return { rows: [], errors: ["Nothing to import."] };

  let records: Record<string, string>[] = [];
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const j = JSON.parse(t);
      const arr = Array.isArray(j) ? j : Array.isArray(j.items) ? j.items : Array.isArray(j.results) ? j.results : [j];
      records = arr.filter((x: unknown) => x && typeof x === "object").map((o: Record<string, unknown>) => {
        const r: Record<string, string> = {};
        for (const [k, v] of Object.entries(o)) r[k] = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
        return r;
      });
    } catch {
      return { rows: [], errors: ["That looks like JSON but doesn't parse."] };
    }
  } else {
    const first = t.split(/\r?\n/, 1)[0];
    const delim = first.includes("\t") ? "\t" : (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
    const table = parseDelimited(t, delim);
    if (table.length < 2) return { rows: [], errors: ["Need a header row plus at least one data row."] };
    const headers = table[0];
    records = table.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  }
  if (records.length === 0) return { rows: [], errors: ["No rows found."] };

  const headers = Object.keys(records[0]);
  const idx = mapHeaders(headers);
  if (idx.firm === undefined || idx.role === undefined) {
    // Single "Company - Role" style column? Give a clear message instead of guessing wildly.
    return {
      rows: [],
      errors: [`Couldn't find company and role columns. Headers seen: ${headers.join(", ")}. Expected something like: company, role, deadline, link.`],
    };
  }
  const get = (r: Record<string, string>, k: keyof ImportRow) => (idx[k] === undefined ? "" : (r[headers[idx[k]!]] ?? "").trim());

  const rows: ImportRow[] = [];
  records.forEach((r, n) => {
    const firm = get(r, "firm");
    const role = get(r, "role");
    if (!firm || !role) {
      errors.push(`Row ${n + 2}: missing company or role, skipped.`);
      return;
    }
    const deadlineRaw = get(r, "deadline");
    const opensRaw = get(r, "opensOn");
    const deadline = parseDate(deadlineRaw, today);
    const opensOn = parseDate(opensRaw, today);
    if (deadlineRaw && !deadline && !/rolling|asap|tbc|open/i.test(deadlineRaw)) errors.push(`Row ${n + 2}: couldn't read deadline "${deadlineRaw}".`);
    const link = get(r, "link");
    rows.push({
      firm,
      role,
      type: get(r, "type").toLowerCase().includes("fin") ? "finance" : /tech|ai|software|data/i.test(get(r, "type")) ? "tech" : undefined,
      programme: idx.programme !== undefined && idx.programme !== idx.role ? get(r, "programme").toLowerCase() || undefined : undefined,
      deadline,
      opensOn,
      link: /^https?:\/\//i.test(link) ? link : "",
      notes: get(r, "notes"),
      description: get(r, "description"),
      location: get(r, "location"),
      status: mapStatus(get(r, "status")),
    });
  });
  return { rows, errors };
}
