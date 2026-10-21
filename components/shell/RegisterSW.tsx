"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds only (in dev it would just get in the way). */
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
