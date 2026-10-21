"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NotificationsCentre from "./NotificationsCentre";

export default function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const [now, setNow] = useState<Date | null>(null);
  const [score, setScore] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/readiness", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => live && j && setScore(j.score))
        .catch(() => {});
    load();
    const id = setInterval(load, 10 * 60_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const date = now
    ?.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
  const time = now?.toLocaleTimeString("en-GB");

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-3 border-b border-line bg-[#05080a]/80 px-3 backdrop-blur-md md:px-6">
      <div className="micro flex items-center gap-3 md:gap-4">
        <span className="text-teal">●<span className="hidden sm:inline"> SYS ONLINE</span></span>
        <span suppressHydrationWarning className="hidden md:inline">{date ?? "--"}</span>
        <span suppressHydrationWarning className="text-text">{time ?? "--:--:--"}</span>
      </div>
      <div className="flex items-center gap-3 md:gap-5">
        <button
          onClick={onOpenPalette}
          className="micro rounded-sm border border-line px-2 py-1 transition-colors hover:border-teal/50 hover:text-teal"
        >
          Search<span className="ml-2 hidden text-teal/70 md:inline">⌘K</span>
        </button>
        <NotificationsCentre />
        <Link href="/" className="micro flex items-center gap-2">
          <span className="hidden sm:inline">Readiness</span>
          <span className="font-mono text-sm text-teal glow-text">{score === undefined ? "…" : (score ?? "--")}</span>
        </Link>
      </div>
    </header>
  );
}
