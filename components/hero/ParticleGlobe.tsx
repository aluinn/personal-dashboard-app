"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const PARTICLES = 2600; // capped for 60fps
const R = 1.6;

function fibSphere(n: number, r: number) {
  const pts = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const t = golden * i;
    pts[i * 3] = Math.cos(t) * rad * r;
    pts[i * 3 + 1] = y * r;
    pts[i * 3 + 2] = Math.sin(t) * rad * r;
  }
  return pts;
}

function toVec(lat: number, lon: number, r: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

// London plus a few financial/tech hubs
const HUBS: [number, number][] = [
  [51.5, -0.12], // London
  [40.7, -74], // New York
  [37.8, -122.4], // San Francisco
  [1.35, 103.8], // Singapore
  [35.7, 139.7], // Tokyo
];

function Globe({ reduce }: { reduce: boolean }) {
  const group = useRef<THREE.Group>(null);
  const positions = useMemo(() => fibSphere(PARTICLES, R), []);
  const arcs = useMemo(
    () =>
      HUBS.slice(1).map((h) => {
        const a = toVec(HUBS[0][0], HUBS[0][1], R);
        const b = toVec(h[0], h[1], R);
        const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.55);
        return { a, b, mid };
      }),
    [],
  );

  useFrame((_, dt) => {
    if (!reduce && group.current) group.current.rotation.y += dt * 0.12;
  });

  return (
    <group ref={group} rotation={[0.35, 0, 0]}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#e6f1f0" size={0.018} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
      </points>
      <mesh>
        <icosahedronGeometry args={[R * 0.995, 3]} />
        <meshBasicMaterial color="#2ee6d6" wireframe transparent opacity={0.07} />
      </mesh>
      {arcs.map((arc, i) => (
        <QuadraticBezierLine
          key={i}
          start={arc.a}
          end={arc.b}
          mid={arc.mid}
          color={i % 2 ? "#e052ff" : "#7c5cff"}
          lineWidth={1.6}
          transparent
          opacity={0.9}
        />
      ))}
      {HUBS.map((h, i) => (
        <mesh key={i} position={toVec(h[0], h[1], R)}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshBasicMaterial color={i === 0 ? "#2ee6d6" : "#e052ff"} />
        </mesh>
      ))}
    </group>
  );
}

export default function ParticleGlobe() {
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <Canvas
      camera={{ position: [0, 0, 5.2], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <Globe reduce={reduce} />
    </Canvas>
  );
}
