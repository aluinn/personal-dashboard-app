"use client";

import { useEffect, useState } from "react";

/** Current time in ms, ticking. Null until mounted (avoids hydration mismatch). */
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}
