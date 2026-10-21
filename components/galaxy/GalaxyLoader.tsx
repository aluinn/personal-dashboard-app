"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import Galaxy2D from "./Galaxy2D";
import type { GalaxyProps } from "./Galaxy3D";

// three.js is only downloaded when this mounts. It waits for idle time and for the card to be on
// screen, and the scene stops rendering when scrolled away. Falls back to 2D when:
//   - you choose 2D, or the device looks low-power (<=2 CPU cores, <=2 GB RAM, or Data Saver on), or
//   - WebGL is unavailable or the scene crashes.
const Galaxy3D = dynamic(() => import("./Galaxy3D"), { ssr: false, loading: () => <div className="micro grid h-full place-items-center">Charting the galaxy…</div> });

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function lowPower() {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (n.hardwareConcurrency ?? 8) <= 2 || (n.deviceMemory ?? 8) <= 2 || Boolean(n.connection?.saveData);
}
function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export type Mode = "auto" | "3d" | "2d";

export default function GalaxyLoader(props: Omit<GalaxyProps, "reduce" | "active"> & { mode?: Mode }) {
  const { mode = "auto", ...rest } = props;
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [env, setEnv] = useState<{ reduce: boolean; low: boolean; gl: boolean } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setEnv({ reduce: matchMedia("(prefers-reduced-motion: reduce)").matches, low: lowPower(), gl: hasWebGL() }), 0);
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (n: number) => void };
    const go = () => setReady(true);
    const idle = w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 1500 }) : window.setTimeout(go, 600);
    return () => {
      clearTimeout(t);
      if (w.requestIdleCallback) w.cancelIdleCallback?.(idle);
      else clearTimeout(idle);
    };
  }, []);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const two = (
    <Galaxy2D graph={rest.graph} selectedId={rest.selectedId} isolate={rest.isolate} matchIds={rest.matchIds} onHover={rest.onHover} onSelect={rest.onSelect} onIsolate={rest.onIsolate} />
  );
  const use2d = env && (mode === "2d" || (mode === "auto" && (env.low || !env.gl)) || (mode === "3d" && !env.gl));

  return (
    <div ref={box} className="h-full w-full">
      {!env || !ready ? (
        <div className="micro grid h-full place-items-center">Charting the galaxy…</div>
      ) : use2d ? (
        two
      ) : (
        <Boundary fallback={two}>
          <Galaxy3D {...rest} reduce={env.reduce} active={visible} />
        </Boundary>
      )}
    </div>
  );
}
