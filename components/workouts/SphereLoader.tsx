"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";

const ProgressSphere = dynamic(() => import("./ProgressSphere"), {
  ssr: false,
  loading: () => <div className="micro grid h-full place-items-center">Charging…</div>,
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

export default function SphereLoader(props: { level: number; fraction: number }) {
  return (
    <Boundary>
      <ProgressSphere {...props} />
    </Boundary>
  );
}
