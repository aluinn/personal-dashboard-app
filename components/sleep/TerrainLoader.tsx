"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import type { TerrainHover } from "./SleepTerrain";

const SleepTerrain = dynamic(() => import("./SleepTerrain"), {
  ssr: false,
  loading: () => <div className="micro grid h-full place-items-center">Building terrain…</div>,
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

export default function TerrainLoader(props: { grid: number[][]; has: boolean[]; target: number; hover: TerrainHover; onHover: (h: TerrainHover) => void }) {
  return (
    <Boundary>
      <SleepTerrain {...props} />
    </Boundary>
  );
}
