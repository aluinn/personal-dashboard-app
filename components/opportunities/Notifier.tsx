"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";
import { daysBetween } from "@/lib/opp";

type Item = { id: number; firm: string; role: string; status: string; opensOn: string | null; deadline: string | null; score: number };

const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
};

const FEED_SCORE_MIN = 70; // only ping for feed items that are a strong CV match

function notify(title: string, body: string) {
  try {
    new Notification(title, { body, tag: title });
  } catch {
    /* notifications unavailable */
  }
}

async function check() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const res = await fetch("/api/opportunities/alerts", { cache: "no-store" });
  if (!res.ok) return;
  const { today, items } = (await res.json()) as { today: string; items: Item[] };

  // 1) Newly open items. First run just records what's already open, so enabling alerts doesn't spam.
  const firstRun = localStorage.getItem("opp:seen-open") === null;
  const seen = new Set<number>(read("opp:seen-open", []));
  const open = items.filter(
    (o) => (!o.opensOn || o.opensOn <= today) && (!o.deadline || o.deadline >= today) && (o.status === "saved" || o.score >= FEED_SCORE_MIN),
  );
  const fresh = open.filter((o) => !seen.has(o.id));
  if (!firstRun && fresh.length > 0) {
    if (fresh.length <= 3) fresh.forEach((o) => notify(`Now open: ${o.firm}`, o.role));
    else notify(`${fresh.length} opportunities are now open`, fresh.slice(0, 3).map((o) => o.firm).join(", ") + "…");
  }
  write("opp:seen-open", [...new Set([...seen, ...open.map((o) => o.id)])]);

  // 2) Deadlines within 7 days for things you've saved but not yet applied to: once per 7/3/1/0-day bucket.
  const done = new Set<string>(read("opp:deadline-notified", []));
  for (const o of items) {
    if (o.status !== "saved" || !o.deadline) continue;
    const d = daysBetween(today, o.deadline);
    if (d < 0 || d > 7) continue;
    const bucket = d === 0 ? 0 : d === 1 ? 1 : d <= 3 ? 3 : 7;
    const key = `${o.id}:${bucket}`;
    if (done.has(key)) continue;
    done.add(key);
    notify(`${d === 0 ? "Closes today" : `Closes in ${d} day${d > 1 ? "s" : ""}`}: ${o.firm}`, o.role);
  }
  write("opp:deadline-notified", [...done].slice(-300));
}

/**
 * Mounted once in the app shell. On every full load of the dashboard it first asks the server to
 * refresh public sources (the server skips this if the last run was under 3h ago), then runs the
 * alert check, and repeats the check every 10 minutes while the tab is open.
 */
export default function Notifier() {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const run = () => void check().catch(() => {});
    (async () => {
      // Only show the toast if the refresh is actually slow (i.e. it's really searching).
      const slow = setTimeout(() => alive && setToast("Searching for new opportunities…"), 800);
      try {
        const res = await fetch("/api/opportunities/refresh", { method: "POST" });
        const j = (await res.json()) as { ran?: boolean; added?: number };
        if (alive && j.ran) {
          setToast(j.added ? `+${j.added} new opportunities` : "No new opportunities");
          if (j.added) router.refresh();
          setTimeout(() => alive && setToast(null), 4000);
        } else if (alive) setToast(null);
      } catch {
        if (alive) setToast(null);
      } finally {
        clearTimeout(slow);
      }
      if (alive) setTimeout(run, 1500);
    })();
    const id = setInterval(run, 10 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [router]);

  if (!toast) return null;
  return (
    <div className="micro fixed bottom-4 right-4 z-40 rounded-sm border border-teal/40 bg-[#0a1115] px-3 py-2 text-teal shadow-[0_0_20px_-6px_rgba(46,230,214,0.5)]">
      {toast}
    </div>
  );
}

export function AlertsButton() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported" | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission), 0);
    return () => clearTimeout(t);
  }, []);
  if (perm === null) return null;
  if (perm === "unsupported") return null;
  if (perm === "granted")
    return (
      <span className="micro inline-flex items-center gap-1.5 text-teal" title="Alerts only fire while a dashboard tab is open">
        <Bell className="h-3.5 w-3.5" /> Alerts on
      </span>
    );
  if (perm === "denied")
    return (
      <span className="micro inline-flex items-center gap-1.5" title="Allow notifications for localhost in your browser's site settings">
        <BellOff className="h-3.5 w-3.5" /> Alerts blocked
      </span>
    );
  return (
    <button className="btn inline-flex items-center gap-1.5" onClick={async () => setPerm(await Notification.requestPermission())}>
      <Bell className="h-3 w-3" /> Enable alerts
    </button>
  );
}
