// Shared (client + server) helpers for the opportunity tracker.
export const PIPELINE = [
  { key: "saved", label: "Saved" },
  { key: "applied", label: "Applied" },
  { key: "online_test", label: "Online test" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "rejected", label: "Rejected" },
] as const;

export const ALL_STATUSES = ["feed", "dismissed", ...PIPELINE.map((p) => p.key)] as const;
export type Status = (typeof ALL_STATUSES)[number];

export const PROGRAMMES = ["spring week", "summer internship", "placement", "grad", "other"] as const;
export const TYPES = ["finance", "tech", "other"] as const;

export const STATUS_COLOR: Record<string, string> = {
  saved: "#9fb3b2",
  applied: "#2ee6d6",
  online_test: "#7c5cff",
  interview: "#e052ff",
  offer: "#7dff9b",
  rejected: "#ff6b6b",
};

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

/** Same firm + role (+ closing year) = same listing, so re-imports never duplicate. */
export function dedupeKey(firm: string, role: string, deadline?: string | null) {
  return `${norm(firm)}|${norm(role)}|${deadline ? deadline.slice(0, 4) : ""}`;
}

export function daysBetween(from: string, to: string) {
  const f = from.split("-").map(Number);
  const t = to.split("-").map(Number);
  return Math.round((Date.UTC(t[0], t[1] - 1, t[2]) - Date.UTC(f[0], f[1] - 1, f[2])) / 86400000);
}

export type Timing = {
  state: "closed" | "opens_soon" | "open";
  stateLabel: string;
  countdown: string | null;
  urgent: boolean;
  daysToClose: number | null;
};

export function timing(o: { deadline: string | null; opensOn: string | null }, today: string): Timing {
  const toOpen = o.opensOn ? daysBetween(today, o.opensOn) : 0;
  const toClose = o.deadline ? daysBetween(today, o.deadline) : null;
  if (toClose !== null && toClose < 0)
    return { state: "closed", stateLabel: "Closed", countdown: `closed ${-toClose}d ago`, urgent: false, daysToClose: toClose };
  if (toOpen > 0)
    return {
      state: "opens_soon",
      stateLabel: "Opens soon",
      countdown: `opens in ${toOpen}d`,
      urgent: false,
      daysToClose: toClose,
    };
  const countdown = toClose === null ? null : toClose === 0 ? "closes today" : `closing in ${toClose}d`;
  return { state: "open", stateLabel: "Open now", countdown, urgent: toClose !== null && toClose <= 7, daysToClose: toClose };
}

/** "Role | Firm" / "Role at Firm" / "Firm - Role" -> best guess (used for bookmarklet captures). */
export function guessFirmRole(title: string, site = ""): { firm: string; role: string } {
  const t = title.trim();
  const parts = t.split(/\s+[|–—-]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const i = site ? parts.findIndex((p) => p.toLowerCase().includes(site.toLowerCase())) : -1;
    if (i >= 0) return { firm: parts[i], role: parts.filter((_, n) => n !== i).join(" – ") };
    return { role: parts[0], firm: site || parts[parts.length - 1] };
  }
  const at = t.match(/^(.{3,120}?)\s+(?:at|@)\s+(.{2,60})$/i);
  if (at) return { role: at[1], firm: at[2] };
  return { role: t, firm: site };
}

export const CV_THRESHOLD = 50;
