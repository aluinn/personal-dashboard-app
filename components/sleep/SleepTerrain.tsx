"use client";

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type TerrainHover = { col: number; row: number; x: number; y: number } | null;

const WIDTH = 12;
const DEPTH_STEP = 0.3;
const H_SCALE = 0.5; // world units per hour of sleep

const LOW = new THREE.Color("#5b4bd6"); // short nights: deep violet
const MID = new THREE.Color("#2ee6d6"); // around target: teal
const HIGH = new THREE.Color("#eafffb"); // above target: near-white
const NONE = new THREE.Color("#26343a");
const WHITE = new THREE.Color("#ffffff");

const smooth = (t: number) => t * t * (3 - 2 * t);

function Terrain({
  grid,
  has,
  target,
  reduce,
  hover,
  onHover,
}: {
  grid: number[][]; // rows x days, hours
  has: boolean[];
  target: number;
  reduce: boolean;
  hover: TerrainHover;
  onHover: (h: TerrainHover) => void;
}) {
  const rows = grid.length;
  const days = grid[0]?.length ?? 0;
  // Smooth between nights so 30 nights read as hills instead of 30 lonely dots (the day under
  // the pointer is what the tooltip reports).
  const sub = Math.max(1, Math.round(120 / Math.max(days, 1)));
  const cols = days <= 1 ? 1 : (days - 1) * sub + 1;
  const count = rows * cols;
  const dayOf = (f: number) => Math.min(days - 1, Math.round(f / sub));

  const dots = useRef<THREE.InstancedMesh>(null);
  const hits = useRef<THREE.InstancedMesh>(null);
  const cur = useRef<Float32Array>(new Float32Array(count));
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const hoverDay = hover?.col ?? -1;

  const fine = useMemo(() => {
    const f = new Float32Array(count);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const d = c / sub;
        const i0 = Math.min(days - 1, Math.floor(d));
        const i1 = Math.min(days - 1, i0 + 1);
        const t = smooth(d - i0);
        f[r * cols + c] = grid[r][i0] * (1 - t) + grid[r][i1] * t;
      }
    return f;
  }, [grid, rows, cols, days, sub, count]);
  const target3 = useMemo(() => fine.map((h) => h * H_SCALE), [fine]);

  useEffect(() => {
    const m = dots.current;
    if (!m) return;
    const col = new THREE.Color();
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const h = fine[r * cols + c];
        const d = dayOf(c);
        if (h <= 0.05) col.copy(NONE);
        else if (r === 0 && !has[d]) col.copy(NONE);
        else if (h < target) col.copy(LOW).lerp(MID, Math.max(0, (h - 4) / Math.max(0.5, target - 4)));
        else col.copy(MID).lerp(HIGH, Math.min(1, (h - target) / 2));
        if (d === hoverDay) col.lerp(WHITE, 0.6);
        m.setColorAt(r * cols + c, col);
      }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fine, has, rows, cols, target, hoverDay]);

  useEffect(() => {
    cur.current = reduce ? target3.slice() : new Float32Array(count); // grow up from flat on each change
  }, [target3, reduce, count]);

  const hitScale = Math.max(0.09, (WIDTH / Math.max(cols, 2)) * 0.7);
  useFrame((_, dt) => {
    const m = dots.current;
    const h = hits.current;
    if (!m || !h) return;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 4.5);
    const a = cur.current;
    for (let i = 0; i < count; i++) {
      const d = target3[i] - a[i];
      a[i] = Math.abs(d) > 0.0008 ? a[i] + d * k : target3[i];
    }
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = (cols === 1 ? 0 : c / (cols - 1) - 0.5) * WIDTH;
        const z = ((rows - 1) / 2 - r) * DEPTH_STEP;
        const s = dayOf(c) === hoverDay ? 0.075 : r === 0 ? 0.05 : 0.04;
        dummy.position.set(x, a[i], z);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        dummy.scale.setScalar(hitScale);
        dummy.updateMatrix();
        h.setMatrixAt(i, dummy.matrix);
      }
    m.instanceMatrix.needsUpdate = true;
    h.instanceMatrix.needsUpdate = true;
  });

  const front = ((rows - 1) / 2) * DEPTH_STEP;
  const ty = target * H_SCALE;
  return (
    <>
      <instancedMesh ref={dots} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* invisible, larger spheres so hovering is forgiving */}
      <instancedMesh
        ref={hits}
        args={[undefined, undefined, count]}
        frustumCulled={false}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          if (e.instanceId === undefined) return;
          const rect = (e.nativeEvent.target as HTMLElement).getBoundingClientRect();
          onHover({ col: dayOf(e.instanceId % cols), row: Math.floor(e.instanceId / cols), x: e.nativeEvent.clientX - rect.left, y: e.nativeEvent.clientY - rect.top });
        }}
        onPointerOut={() => onHover(null)}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <Line points={[[-WIDTH / 2 - 0.3, ty, front + 0.25], [WIDTH / 2 + 0.3, ty, front + 0.25]]} color="#5b7cff" lineWidth={1} transparent opacity={0.85} />
      <gridHelper args={[WIDTH + 2, 30, "#16262a", "#0f1b1e"]} position={[0, -0.02, 0]} />
      <OrbitControls
        enablePan={false}
        minDistance={5}
        maxDistance={18}
        minPolarAngle={0.2}
        maxPolarAngle={1.45}
        target={[0, 1.2, 0]}
        autoRotate={!reduce && !hover}
        autoRotateSpeed={0.4}
      />
    </>
  );
}

export default function SleepTerrain(props: {
  grid: number[][];
  has: boolean[];
  target: number;
  hover: TerrainHover;
  onHover: (h: TerrainHover) => void;
}) {
  const [reduce] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  return (
    <Canvas camera={{ position: [1.5, 6.4, 9.6], fov: 40 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
      <Terrain {...props} reduce={reduce} />
    </Canvas>
  );
}
