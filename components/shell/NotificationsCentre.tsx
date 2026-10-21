"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useEventMarks } from "@/lib/events/marks";
import type { Notif } from "@/lib/notifications";

type Ev = { id: string; title: string; start: number; venue: string; online: boolean };
const SEEN = "dashboard.notifiedPush";
const DISMISSED = "dashboard.notifDismissed";

const readSet = (k: string) => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(k) ?? "[]"));
  } catch {
    return new Set<string>();
  }
};
const writeSet = (k: string, s: Set<string>) => {
  try {
    localStorage.setItem(k, JSON.stringify([...s].slice(-300)));
  } catch {
    /* storage unavailable */
  }
};

const TONE = { alert: "border-magenta/60 text-magenta", warn: "border-[#c4811a]/60 text-[#e0a040]", info: "border-line text-teal" } as const;

export default function NotificationsCentre() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ items: Notif[]; events: Ev[] } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [perm, setPerm] = useState<string>("default");
  const { marks } = useEventMarks();
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {
      /* offline: keep what we have */
    }
  }, []);

  useEffect(() => {
    const t0 = setTimeout(() => {
      setDismissed(readSet(DISMISSED));
      setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
      load();
    }, 0);
    const id = setInterval(load, 60_000);
    return () => {
      clearTimeout(t0);
      clearInterval(id);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const eventItems: Notif[] = (data?.events ?? [])
    .filter((e) => marks[e.id] === "going")
    .map((e) => ({
      id: `ev:${e.id}`, kind: "event", severity: "info", push: true,
      title: `${e.title}`,
      detail: `${new Date(e.start).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit" })} · ${e.online ? "Online" : e.venue.split(",")[0]}`,
      href: "/events",
    }));
  const items = [...(data?.items ?? []), ...eventItems].filter((n) => !dismissed.has(n.id));

  // Browser notification, once per item id, only for the kinds marked push.
  useEffect(() => {
    if (perm !== "granted") return;
    const seen = readSet(SEEN);
    const fresh = items.filter((n) => n.push && !seen.has(n.id));
    if (!fresh.length) return;
    for (const n of fresh) {
      try {
        new Notification(n.title, { body: n.detail, tag: n.id });
      } catch {
        /* unavailable */
      }
      seen.add(n.id);
    }
    writeSet(SEEN, seen);
  }, [items, perm]);

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    writeSet(DISMISSED, next);
  };
  const urgent = items.filter((n) => n.severity !== "info").length;

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${items.length ? `, ${items.length} unread` : ""}`}
        aria-expanded={open}
        className="relative rounded-sm border border-line p-1.5 transition-colors hover:border-teal/50 hover:text-teal"
      >
        <Bell className="h-3.5 w-3.5" strokeWidth={1.5} />
        {items.length > 0 && (
          <span className={`absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 font-mono text-[9px] text-[#05080a] ${urgent ? "bg-magenta" : "bg-teal"}`}>{items.length}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            role="dialog"
            aria-label="Notifications"
            className="fixed inset-x-3 top-14 z-50 max-h-[70vh] overflow-auto rounded-sm border border-teal/40 bg-[#0a1115] p-2 shadow-[0_0_40px_-8px_rgba(46,230,214,0.4)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
          >
            {items.length === 0 ? (
              <p className="micro px-2 py-4">All clear.</p>
            ) : (
              <ul className="space-y-1.5">
                {items.map((n) => (
                  <li key={n.id} className={`flex items-start gap-2 rounded-sm border-l-2 bg-white/[0.03] p-2 ${TONE[n.severity]}`}>
                    <Link href={n.href} onClick={() => setOpen(false)} className="min-w-0 flex-1">
                      <div className="text-sm text-text">{n.title}</div>
                      <div className="micro normal-case tracking-wide">{n.detail}</div>
                    </Link>
                    <button onClick={() => dismiss(n.id)} className="micro hover:text-text" aria-label={`Dismiss: ${n.title}`}>×</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 border-t border-line px-2 pt-2">
              {perm === "default" && (
                <button
                  className="btn"
                  onClick={async () => setPerm(await Notification.requestPermission())}
                >
                  Enable desktop alerts
                </button>
              )}
              {perm === "granted" && <p className="micro normal-case tracking-wide !text-[10px]">Alerts are on. They fire while the dashboard is open in a tab or installed app, not when it’s closed.</p>}
              {perm === "denied" && <p className="micro normal-case tracking-wide !text-[10px]">Alerts are blocked in your browser settings.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
