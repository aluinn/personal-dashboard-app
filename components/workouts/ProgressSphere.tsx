"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Lifetime volume milestones in tonnes. Each one passed = one level: the sphere grows and refills.
export const MILESTONES_T = [1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

export function levelOf(totalKg: number) {
  const t = totalKg / 1000;
  let level = 0;
  while (level < MILESTONES_T.length && t >= MILESTONES_T[level]) level++;
  const prev = level === 0 ? 0 : MILESTONES_T[level - 1];
  const next = MILESTONES_T[Math.min(level, MILESTONES_T.length - 1)];
  return { level, next, prev, fraction: level >= MILESTONES_T.length ? 1 : (t - prev) / (next - prev) };
}

const N = 2200;
const UNLIT = new THREE.Color("#1d2b30");
const TEAL = new THREE.Color("#2ee6d6");
const VIOLET = new THREE.Color("#7c5cff");
const WHITE = new THREE.Color("#eafffb");

function Sphere({ level, fraction, reduce }: { level: number; fraction: number; reduce: boolean }) {
  const pts = useRef<THREE.Points>(null);
  const ring = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  const fill = useRef(reduce ? fraction : 0);
  const grow = useRef(reduce ? 1 : 0.55);
  const radius = Math.min(2.7, 1.25 + level * 0.16);

  const colorAttr = useRef<THREE.BufferAttribute>(null);
  const { positions, ys, zeros } = useMemo(() => {
    const p = new Float32Array(N * 3);
    const y = new Float32Array(N);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const yy = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - yy * yy);
      const th = golden * i;
      p[i * 3] = Math.cos(th) * r;
      p[i * 3 + 1] = yy;
      p[i * 3 + 2] = Math.sin(th) * r;
      y[i] = (yy + 1) / 2; // 0 at the south pole, 1 at the north pole
    }
    return { positions: p, ys: y, zeros: new Float32Array(N * 3) };
  }, []);

  useEffect(() => {
    if (reduce) fill.current = fraction;
  }, [fraction, reduce]);

  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    const k = reduce ? 1 : 1 - Math.exp(-dt * 1.6);
    fill.current += (fraction - fill.current) * k;
    grow.current += (1 - grow.current) * (reduce ? 1 : 1 - Math.exp(-dt * 2.2));
    const f = Math.max(0.02, fill.current);
    const attr = colorAttr.current;
    if (!attr) return;
    const colors = attr.array as Float32Array;
    for (let i = 0; i < N; i++) {
      if (ys[i] <= f) {
        const near = Math.max(0, 1 - (f - ys[i]) / 0.18); // brighter near the waterline
        tmp.copy(TEAL).lerp(VIOLET, 1 - ys[i] / Math.max(f, 0.05) > 0.6 ? 0.35 : 0).lerp(WHITE, near * 0.75);
      } else tmp.copy(UNLIT);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    attr.needsUpdate = true;
    if (group.current) group.current.scale.setScalar(radius * grow.current);
    if (ring.current) {
      const y = f * 2 - 1;
      ring.current.position.y = y;
      const s = Math.sqrt(Math.max(0.0001, 1 - y * y));
      ring.current.scale.set(s, s, s);
    }
  });

  return (
    <group ref={group}>
      <points ref={pts}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute ref={colorAttr} attach="attributes-color" args={[zeros, 3]} />
        </bufferGeometry>
        <pointsMaterial vertexColors size={0.026} sizeAttenuation transparent opacity={0.95} depthWrite={false} />
      </points>
      <mesh rotation={[Math.PI / 2, 0, 0]} ref={ring}>
        <torusGeometry args={[1, 0.006, 8, 96]} />
        <meshBasicMaterial color="#eafffb" transparent opacity={0.75} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.99, 2]} />
        <meshBasicMaterial color="#2ee6d6" wireframe transparent opacity={0.05} />
      </mesh>
    </group>
  );
}

export default function ProgressSphere({ level, fraction }: { level: number; fraction: number }) {
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <Canvas camera={{ position: [0, 0.6, 7.4], fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
      <Sphere level={level} fraction={fraction} reduce={reduce} />
      <OrbitControls enablePan={false} enableZoom={false} autoRotate={!reduce} autoRotateSpeed={0.9} />
    </Canvas>
  );
}
