"use client";

import { useMemo } from "react";
import type { Graph } from "@/lib/galaxy";

// Light 2D force graph: the fallback for low-power devices, reduced WebGL support or when you pick it.
// Same data and interactions as the 3D view (hover, click, isolate, search), no animation loop.
const W = 900, H = 560;

export default function Galaxy2D({
  graph, selectedId, isolate, matchIds, onHover, onSelect, onIsolate,
}: {
  graph: Graph;
  selectedId: string | null;
  isolate: string | null;
  matchIds: Set<string> | null;
  onHover: (id: string | null, x: number, y: number) => void;
  onSelect: (id: string) => void;
  onIsolate: (code: string) => void;
}) {
  const layout = useMemo(() => {
    const { nodes, links, modules } = graph;
    const m = modules.length;
    const anchors = modules.map((_, i) => {
      const a = (i / m) * Math.PI * 2 + 0.4;
      return [W / 2 + Math.cos(a) * W * 0.28, H / 2 + Math.sin(a) * H * 0.3];
    });
    const pos = nodes.map((n) => [anchors[n.mi][0] + n.j[0] * 60, anchors[n.mi][1] + n.j[1] * 60]);
    for (let it = 0; it < 160; it++) {
      const cool = 1 - it / 160;
      const f = pos.map(() => [0, 0]);
      for (let a = 0; a < nodes.length; a++) {
        f[a][0] += (anchors[nodes[a].mi][0] - pos[a][0]) * 0.02;
        f[a][1] += (anchors[nodes[a].mi][1] - pos[a][1]) * 0.02;
        for (let b = a + 1; b < nodes.length; b++) {
          const dx = pos[a][0] - pos[b][0], dy = pos[a][1] - pos[b][1];
          const d2 = dx * dx + dy * dy + 0.01;
          if (d2 > 6000) continue;
          const k = 260 / d2;
          f[a][0] += dx * k; f[a][1] += dy * k; f[b][0] -= dx * k; f[b][1] -= dy * k;
        }
      }
      for (const l of links) {
        const dx = pos[l.b][0] - pos[l.a][0], dy = pos[l.b][1] - pos[l.a][1];
        const d = Math.hypot(dx, dy) + 0.01;
        const k = (d - 90) * 0.004;
        f[l.a][0] += dx * k; f[l.a][1] += dy * k; f[l.b][0] -= dx * k; f[l.b][1] -= dy * k;
      }
      pos.forEach((p, i) => {
        p[0] = Math.max(20, Math.min(W - 20, p[0] + Math.max(-8, Math.min(8, f[i][0])) * cool * 2));
        p[1] = Math.max(20, Math.min(H - 20, p[1] + Math.max(-8, Math.min(8, f[i][1])) * cool * 2));
      });
    }
    return { pos, anchors };
  }, [graph]);

  const dim = (mi: number, id?: string) => {
    if (isolate !== null && graph.modules[mi].code !== isolate) return 0.07;
    if (matchIds !== null && id && !matchIds.has(id)) return 0.08;
    return 1;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Notes graph, 2D view">
      {graph.links.map((l, i) => (
        <line key={i} x1={layout.pos[l.a][0]} y1={layout.pos[l.a][1]} x2={layout.pos[l.b][0]} y2={layout.pos[l.b][1]}
          stroke={graph.modules[graph.nodes[l.a].mi].color} strokeOpacity={0.35 * Math.min(dim(graph.nodes[l.a].mi, graph.nodes[l.a].id), dim(graph.nodes[l.b].mi, graph.nodes[l.b].id))} strokeWidth={l.cross ? 1.2 : 0.7} />
      ))}
      {graph.modules.map((m, i) => (
        <g key={m.code} opacity={isolate !== null && isolate !== m.code ? 0.25 : 1} style={{ cursor: "pointer" }} onClick={() => onIsolate(m.code)}>
          <circle cx={layout.anchors[i][0]} cy={layout.anchors[i][1]} r={14} fill={m.color} fillOpacity={0.25 + 0.6 * m.fresh} stroke={m.color} />
          <text x={layout.anchors[i][0]} y={layout.anchors[i][1] - 22} textAnchor="middle" fill={m.color} fontFamily="var(--font-jetbrains), monospace" fontSize="11" letterSpacing="2">{m.code}</text>
        </g>
      ))}
      {graph.nodes.map((n) => (
        <circle
          key={n.id}
          cx={layout.pos[n.i][0]} cy={layout.pos[n.i][1]} r={3 + n.size * 22}
          fill={graph.modules[n.mi].color} fillOpacity={(0.3 + 0.7 * n.fresh) * dim(n.mi, n.id)}
          stroke={n.id === selectedId ? "#fff" : "none"} strokeWidth={2} style={{ cursor: "pointer" }}
          onMouseMove={(e) => onHover(n.id, e.clientX, e.clientY)} onMouseLeave={() => onHover(null, 0, 0)}
          onClick={() => onSelect(n.id)}
          tabIndex={0} role="button" aria-label={n.title} onKeyDown={(e) => e.key === "Enter" && onSelect(n.id)}
        />
      ))}
    </svg>
  );
}
