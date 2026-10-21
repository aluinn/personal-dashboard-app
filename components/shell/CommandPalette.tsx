"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Briefcase, Coffee, Cigarette, Dumbbell, type LucideIcon } from "lucide-react";
import { logStimulant } from "@/app/stimulant-actions";
import { nav } from "@/lib/nav";

export default function CommandPalette({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[18vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ y: -10, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -10, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-sm border border-teal/40 bg-[#0a1115] shadow-[0_0_40px_-8px_rgba(46,230,214,0.4)]"
          >
            <PaletteBody close={() => setOpen(false)} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type Item = { id: string; label: string; hint?: string; icon: LucideIcon; run: () => void | Promise<void>; keep?: boolean };

// Mounted fresh each time the palette opens, so the query always starts empty.
function PaletteBody({ close }: { close: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [note, setNote] = useState("");
  const [, start] = useTransition();

  const go = (href: string) => {
    close();
    router.push(href);
  };
  const log = (kind: "caffeine" | "nicotine", label: string, mg: number) =>
    start(async () => {
      try {
        await logStimulant(kind, label, mg);
        setNote(`Logged ${label.toLowerCase()} ✓`);
        setTimeout(close, 700);
      } catch {
        setNote("Couldn't log that");
      }
    });

  const items: Item[] = useMemo(() => {
    const actions: Item[] = [
      { id: "a:coffee", label: "Log a coffee", hint: "95 mg caffeine, now", icon: Coffee, run: () => log("caffeine", "Coffee", 95), keep: true },
      { id: "a:velo", label: "Log a Velo", hint: "10 mg nicotine, now", icon: Cigarette, run: () => log("nicotine", "Velo", 10), keep: true },
      { id: "a:workout", label: "Log a workout", hint: "opens the logger", icon: Dumbbell, run: () => go("/health/workouts?log=1") },
      { id: "a:app", label: "Add an application", hint: "opens the form", icon: Briefcase, run: () => go("/opportunities?add=1") },
    ];
    const pages: Item[] = nav.map((n) => ({ id: n.href, label: n.label, icon: n.icon, run: () => go(n.href) }));
    const t = q.toLowerCase();
    return [...actions, ...pages].filter((i) => `${i.label} ${i.hint ?? ""}`.toLowerCase().includes(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <>
      <input
        autoFocus
        value={q}
        role="combobox"
        aria-expanded="true"
        aria-controls="palette-list"
        aria-label="Command palette"
        onChange={(e) => {
          setQ(e.target.value);
          setIdx(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setIdx((i) => Math.min(i + 1, items.length - 1));
          if (e.key === "ArrowUp") setIdx((i) => Math.max(i - 1, 0));
          if (e.key === "Enter" && items[idx]) items[idx].run();
        }}
        placeholder="Jump to a page or run a quick action…"
        className="w-full border-b border-line bg-transparent px-4 py-3 font-mono text-sm outline-none placeholder:text-muted"
      />
      <ul id="palette-list" role="listbox" className="max-h-72 overflow-auto p-1">
        {items.map((n, i) => (
          <li key={n.id} role="option" aria-selected={i === idx}>
            <button
              onMouseEnter={() => setIdx(i)}
              onClick={() => n.run()}
              className={`flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm ${i === idx ? "bg-teal/10 text-teal" : "text-text"}`}
            >
              <n.icon className="h-4 w-4" strokeWidth={1.5} />
              <span className="flex-1">{n.label}</span>
              {n.hint && <span className="micro normal-case tracking-wide">{n.hint}</span>}
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="micro px-3 py-4">No results</li>}
      </ul>
      {note && <div className="micro border-t border-line px-4 py-2 text-teal" role="status">{note}</div>}
    </>
  );
}
