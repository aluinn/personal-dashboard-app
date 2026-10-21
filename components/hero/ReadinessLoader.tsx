"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";

// three.js is only downloaded when this scene mounts (never on the server, never on other pages).
const ReadinessSphere = dynamic(() => import("./ReadinessSphere"), {
  ssr: false,
  loading: () => <div className="micro grid h-full place-items-center">Initialising…</div>,
});

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <div className="micro grid h-full place-items-center">3D view unavailable (WebGL disabled)</div> : this.props.children;
  }
}

/**
 * Mounts the 3D scene only once the page has settled (idle) and the card is on screen, and stops
 * rendering when it scrolls out of view or the tab is hidden, so it never competes with first paint.
 */
export default function ReadinessLoader({ score }: { score: number | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const go = () => setReady(true);
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (n: number) => void };
    const idle = w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 1500 }) : window.setTimeout(go, 600);
    return () => (w.requestIdleCallback ? w.cancelIdleCallback?.(idle) : clearTimeout(idle));
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} className="h-full w-full">
      {ready ? (
        <Boundary>
          <ReadinessSphere score={score} active={visible} />
        </Boundary>
      ) : (
        <div className="micro grid h-full place-items-center">Initialising…</div>
      )}
    </div>
  );
}
