"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// A particle sphere driven by the readiness score. High score: calm, slow ripples, teal.
// Low score: agitated, fast, jagged ripples, shading toward magenta. No score: dim and still.
const N = 3200;
const R = 1.6;

const vert = /* glsl */ `
  uniform float uTime; uniform float uAmp; uniform float uSpeed; uniform float uSize;
  attribute float aSeed; varying float vN;
  void main() {
    vec3 p = position;
    float t = uTime * uSpeed;
    float n = sin(p.x * 2.6 + t + aSeed * 6.2831) * sin(p.y * 2.9 - t * 0.8) * sin(p.z * 2.4 + t * 1.3);
    p += normalize(p) * n * uAmp;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
    vN = 0.5 + 0.5 * n;
  }
`;
const frag = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; varying float vN;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.1, d) * uOpacity * (0.55 + 0.6 * vN);
    gl_FragColor = vec4(mix(uColor, vec3(0.9, 0.95, 0.94), vN * 0.35), a);
  }
`;

const LOW = new THREE.Color("#e052ff");
const MID = new THREE.Color("#7c5cff");
const HIGH = new THREE.Color("#2ee6d6");
const DIM = new THREE.Color("#5a6e6d");

export function scoreLook(score: number | null) {
  if (score === null) return { amp: 0.03, speed: 0.4, spin: 0.05, opacity: 0.45, color: DIM };
  const s = Math.max(0, Math.min(1, score / 100));
  const color = s < 0.5 ? LOW.clone().lerp(MID, s / 0.5) : MID.clone().lerp(HIGH, (s - 0.5) / 0.5);
  return { amp: 0.36 - 0.31 * s, speed: 3 - 2.3 * s, spin: 0.2 - 0.08 * s, opacity: 0.6 + 0.35 * s, color };
}

function Sphere({ score, reduce }: { score: number | null; reduce: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { positions, seeds } = useMemo(() => {
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(golden * i) * rad * R;
      pos[i * 3 + 1] = y * R;
      pos[i * 3 + 2] = Math.sin(golden * i) * rad * R;
      seed[i] = (i * 0.618034) % 1;
    }
    return { positions: pos, seeds: seed };
  }, []);
  const look = scoreLook(score);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 }, uAmp: { value: look.amp }, uSpeed: { value: look.speed }, uSize: { value: 0.05 },
      uColor: { value: look.color.clone() }, uOpacity: { value: look.opacity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((_, dt) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    // Ease toward the target look so a new score morphs rather than snaps.
    const k = Math.min(1, dt * 2.5);
    u.uAmp.value += (look.amp - u.uAmp.value) * k;
    u.uSpeed.value += (look.speed - u.uSpeed.value) * k;
    u.uOpacity.value += (look.opacity - u.uOpacity.value) * k;
    (u.uColor.value as THREE.Color).lerp(look.color, k);
    if (!reduce) {
      u.uTime.value += dt;
      if (group.current) group.current.rotation.y += dt * look.spin;
    }
  });

  return (
    <group ref={group} rotation={[0.3, 0, 0]}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
        </bufferGeometry>
        <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

export default function ReadinessSphere({ score, active = true }: { score: number | null; active?: boolean }) {
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <Canvas frameloop={active ? "always" : "never"} camera={{ position: [0, 0, 5.4], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} aria-hidden>
      <Sphere score={score} reduce={reduce} />
    </Canvas>
  );
}
