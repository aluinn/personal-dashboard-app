"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// "Going" / "Interested" live in this browser's localStorage (per your request: saved locally).
// They don't sync between devices, and clearing site data clears them.
export type Mark = "going" | "interested";
const KEY = "dashboard.eventMarks";
const EVT = "dashboard-event-marks";

function read() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
}

export function useEventMarks() {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const marks = useMemo<Record<string, Mark>>(() => {
    try {
      const v = raw ? JSON.parse(raw) : {};
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  }, [raw]);
  /** Set a mark; passing the mark it already has clears it. */
  const toggle = useCallback((id: string, m: Mark) => {
    let cur: Record<string, Mark> = {};
    try {
      cur = JSON.parse(read() || "{}");
    } catch {}
    if (cur[id] === m) delete cur[id];
    else cur[id] = m;
    try {
      localStorage.setItem(KEY, JSON.stringify(cur));
    } catch {}
    window.dispatchEvent(new Event(EVT));
  }, []);
  return { marks, toggle };
}
