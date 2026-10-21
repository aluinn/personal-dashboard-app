"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";

// three.js needs the browser, so load it client-side only.
const ParticleGlobe = dynamic(() => import("./ParticleGlobe"), {
  ssr: false,
  loading: () => <div className="micro grid h-full place-items-center">Initialising…</div>,
});

// If WebGL is unavailable, show a quiet fallback instead of crashing the page.
class GlobeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return <div className="micro grid h-full place-items-center">3D view unavailable (WebGL disabled)</div>;
    }
    return this.props.children;
  }
}

export default function HeroGlobe() {
  return (
    <GlobeBoundary>
      <ParticleGlobe />
    </GlobeBoundary>
  );
}
