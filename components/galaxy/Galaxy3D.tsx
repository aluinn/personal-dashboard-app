"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { corePos, nodePos, type GNode, type Graph, type Layout } from "@/lib/galaxy";

// Instanced meshes (one draw call each) for nodes, halos and hit-targets; line segments for links;
// a points cloud for pulses and dust. Node count is capped upstream (MAX_NODES).
export type GalaxyProps = {
  graph: Graph;
  layout: Layout;
  selectedId: string | null;
  isolate: string | null;
  matchIds: Set<string> | null; // null = no search active
  interactive: boolean;
  reduce: boolean;
  compact?: boolean;
  onHover: (id: string | null, x: number, y: number) => void;
  onSelect: (id: string) => void;
  onIsolate: (code: string) => void;
  onHit: () => void; // a node/core was clicked (so a double-click on empty space can be told apart)
  resetSignal: number;
  active?: boolean; // false = stop rendering (scrolled out of view)
};
type SceneProps = GalaxyProps & { overlay: RefObject<HTMLDivElement | null> };

const ONE_C = new THREE.Color(1, 1, 1);
const HOME_CAM = new THREE.Vector3(0, 5.5, 17);
const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3(1, 1, 1);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function Scene(p: SceneProps) {
  const { graph, layout, reduce } = p;
  const { nodes, links, modules, hubs } = graph;
  const N = nodes.length;
  const L = links.length;
  const nodeMesh = useRef<THREE.InstancedMesh>(null);
  const haloMesh = useRef<THREE.InstancedMesh>(null);
  const hitMesh = useRef<THREE.InstancedMesh>(null);
  const lineGeo = useRef<THREE.BufferGeometry>(null);
  const pulseGeo = useRef<THREE.BufferGeometry>(null);
  const dust = useRef<THREE.Points>(null);
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const coreRefs = useRef<(THREE.Group | null)[]>([]);
  const hubMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const labelEls = useRef<HTMLDivElement[]>([]);
  const hubEls = useRef<HTMLDivElement[]>([]);
  const { camera } = useThree();

  // animated per-node state
  const st = useRef({
    cur: new Float32Array(N * 3),
    alpha: new Float32Array(N).fill(0),
    scale: new Float32Array(N).fill(1),
    init: false,
    t: 0,
    idle: 0,
    fly: null as null | { t0: number; fromPos: THREE.Vector3; fromTgt: THREE.Vector3; dur: number; node: number; reset: boolean },
    coreCur: new Float32Array(modules.length * 3),
    hover: -1,
  });
  const colors = useMemo(() => nodes.map((n) => new THREE.Color(modules[n.mi].color)), [nodes, modules]);
  const modColors = useMemo(() => modules.map((m) => new THREE.Color(m.color)), [modules]);
  const hitCol = useRef(new THREE.Color());

  // Fixed per-link / per-pulse data
  const linkPos0 = useMemo(() => new Float32Array(L * 6), [L]);
  const linkCol0 = useMemo(() => new Float32Array(L * 6), [L]);
  const pulsePos0 = useMemo(() => new Float32Array(L * 3), [L]);
  const pulseCol0 = useMemo(() => new Float32Array(L * 3), [L]);
  const phases = useMemo(() => links.map((_, i) => ({ ph: (i * 0.6180339) % 1, sp: 0.18 + ((i * 7) % 5) * 0.04 })), [links]);
  const dustPos = useMemo(() => {
    const a = new Float32Array(1400 * 3);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; // fixed seed: same starfield every time
    for (let i = 0; i < 1400; i++) {
      const r = 14 + rand() * 22, th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
      a[i * 3] = r * Math.sin(ph) * Math.cos(th);
      a[i * 3 + 1] = r * Math.cos(ph) * 0.7;
      a[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    return a;
  }, []);
  // Dot-matrix shell points for each core
  const shell = useMemo(() => {
    const n = 260;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), t = Math.PI * (3 - Math.sqrt(5)) * i;
      a.set([Math.cos(t) * rad, y, Math.sin(t) * rad], i * 3);
    }
    return a;
  }, []);

  useEffect(() => {
    // Raycasts use instance matrices, but three tests a cached bounding sphere first. Positions move
    // every frame, so give it a sphere that always contains the scene.
    for (const m of [nodeMesh.current, hitMesh.current]) if (m) m.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
  }, [N]);

  // Camera fly requests
  const flyTo = (node: number | null, reset: boolean) => {
    const c = controls.current;
    if (!c) return;
    st.current.fly = { t0: st.current.t, fromPos: camera.position.clone(), fromTgt: c.target.clone(), dur: 1.3, node: node ?? -1, reset };
  };
  const lastSel = useRef<string | null>(null);
  useEffect(() => {
    if (p.selectedId && p.selectedId !== lastSel.current) {
      const i = nodes.findIndex((n) => n.id === p.selectedId);
      if (i >= 0) flyTo(i, false);
    }
    lastSel.current = p.selectedId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.selectedId]);
  const lastReset = useRef(p.resetSignal);
  useEffect(() => {
    if (p.resetSignal !== lastReset.current) {
      lastReset.current = p.resetSignal;
      flyTo(null, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.resetSignal]);

  // Create the label elements once per data set; useFrame moves them.
  useEffect(() => {
    const root = p.overlay.current;
    if (!root) return;
    const made: HTMLDivElement[] = [];
    const mk = (html: string, cls: string, style = "") => {
      const el = document.createElement("div");
      el.className = cls;
      el.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;display:none;${style}`;
      el.innerHTML = html;
      root.appendChild(el);
      made.push(el);
      return el;
    };
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    labelEls.current = modules.map((m) =>
      mk(
        `<div style="font-size:${p.compact ? 9 : 11}px;letter-spacing:.2em">${esc(m.code)}</div>${p.compact ? "" : `<div style="font-size:9px;letter-spacing:.08em;color:#9fb3b2">${esc(m.name.toUpperCase())}</div>`}`,
        "font-mono text-center",
        `color:${m.color};text-shadow:0 0 8px ${m.color}`,
      ),
    );
    hubEls.current = hubs.map((h) => mk(`#${esc(h.tag.toUpperCase())}`, "font-mono", "font-size:9px;letter-spacing:.16em;color:rgba(230,241,240,.85)"));
    return () => made.forEach((el) => el.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, hubs, p.compact]);

  const pos = useRef<[number, number, number]>([0, 0, 0]);

  useFrame((state, dtRaw) => {
    const s = st.current;
    const dt = Math.min(dtRaw, 0.05);
    if (!reduce) s.t += dt;
    const t = s.t;
    const k = Math.min(1, dt * 3.2);
    const nm = nodeMesh.current, hm = haloMesh.current, ht = hitMesh.current;
    if (!nm || !hm || !ht) return;

    // cores
    modules.forEach((m, mi) => {
      const c = corePos(mi, modules.length, layout);
      const i3 = mi * 3;
      if (!s.init) s.coreCur.set(c, i3);
      for (let a = 0; a < 3; a++) s.coreCur[i3 + a] += (c[a] - s.coreCur[i3 + a]) * k;
      coreRefs.current[mi]?.position.set(s.coreCur[i3], s.coreCur[i3 + 1], s.coreCur[i3 + 2]);
      void m;
    });

    // nodes
    for (let i = 0; i < N; i++) {
      const n = nodes[i];
      nodePos(graph, n, layout, t, reduce, pos.current);
      const i3 = i * 3;
      if (!s.init) s.cur.set(pos.current, i3);
      for (let a = 0; a < 3; a++) s.cur[i3 + a] += (pos.current[a] - s.cur[i3 + a]) * k;

      const isoHidden = p.isolate !== null && modules[n.mi].code !== p.isolate;
      const searchMiss = p.matchIds !== null && !p.matchIds.has(n.id);
      let target = 0.25 + 0.75 * n.fresh;
      if (isoHidden) target = 0.05;
      else if (searchMiss) target = 0.06;
      else if (p.matchIds !== null) target = 1;
      if (n.id === p.selectedId) target = 1;
      s.alpha[i] += (target - s.alpha[i]) * k;

      let sc = n.id === p.selectedId ? 1.7 : i === s.hover ? 1.5 : p.matchIds && !searchMiss ? 1.35 : 1;
      if (!reduce && p.matchIds && !searchMiss) sc *= 1 + 0.15 * Math.sin(t * 4 + i);
      s.scale[i] += (sc - s.scale[i]) * k;
      const r = n.size * s.scale[i];

      tmpV.set(s.cur[i3], s.cur[i3 + 1], s.cur[i3 + 2]);
      tmpM.compose(tmpV, tmpQ, tmpS.setScalar(r));
      nm.setMatrixAt(i, tmpM);
      tmpM.compose(tmpV, tmpQ, tmpS.setScalar(r * 2.3));
      hm.setMatrixAt(i, tmpM);
      tmpM.compose(tmpV, tmpQ, tmpS.setScalar(Math.max(0.2, n.size * 1.8)));
      ht.setMatrixAt(i, tmpM);
      const a = s.alpha[i];
      nm.setColorAt(i, hitCol.current.copy(colors[i]).lerp(ONE_C, 0.25).multiplyScalar(0.25 + a * 1.1));
      hm.setColorAt(i, hitCol.current.copy(colors[i]).multiplyScalar(a * 0.13));
    }
    nm.count = hm.count = ht.count = N;
    nm.instanceMatrix.needsUpdate = hm.instanceMatrix.needsUpdate = ht.instanceMatrix.needsUpdate = true;
    if (nm.instanceColor) nm.instanceColor.needsUpdate = true;
    if (hm.instanceColor) hm.instanceColor.needsUpdate = true;

    // links + pulses (write straight into the geometry buffers)
    const lg = lineGeo.current, pg = pulseGeo.current;
    const linkPos = lg?.attributes.position.array as Float32Array | undefined;
    const linkCol = lg?.attributes.color.array as Float32Array | undefined;
    const pulsePos = pg?.attributes.position.array as Float32Array | undefined;
    const pulseCol = pg?.attributes.color.array as Float32Array | undefined;
    const showLinks = !(p.isolate !== null);
    for (let l = 0; linkPos && linkCol && pulsePos && pulseCol && l < L; l++) {
      const { a, b, cross } = links[l];
      const ia = a * 3, ib = b * 3;
      const o = l * 6;
      linkPos[o] = s.cur[ia]; linkPos[o + 1] = s.cur[ia + 1]; linkPos[o + 2] = s.cur[ia + 2];
      linkPos[o + 3] = s.cur[ib]; linkPos[o + 4] = s.cur[ib + 1]; linkPos[o + 5] = s.cur[ib + 2];
      const vis = Math.min(s.alpha[a], s.alpha[b]) * (showLinks ? 1 : 0.2) * (cross ? 0.55 : 0.3);
      const ca = colors[a], cb = colors[b];
      linkCol[o] = ca.r * vis; linkCol[o + 1] = ca.g * vis; linkCol[o + 2] = ca.b * vis;
      linkCol[o + 3] = cb.r * vis; linkCol[o + 4] = cb.g * vis; linkCol[o + 5] = cb.b * vis;
      // pulse travelling a -> b
      const ph = reduce ? 0.5 : (phases[l].ph + t * phases[l].sp) % 1;
      pulsePos[l * 3] = s.cur[ia] + (s.cur[ib] - s.cur[ia]) * ph;
      pulsePos[l * 3 + 1] = s.cur[ia + 1] + (s.cur[ib + 1] - s.cur[ia + 1]) * ph;
      pulsePos[l * 3 + 2] = s.cur[ia + 2] + (s.cur[ib + 2] - s.cur[ia + 2]) * ph;
      const pv = reduce ? 0 : Math.min(1, vis * 3.2) * Math.sin(ph * Math.PI);
      pulseCol[l * 3] = pv; pulseCol[l * 3 + 1] = pv; pulseCol[l * 3 + 2] = pv;
    }
    if (lineGeo.current) {
      lineGeo.current.attributes.position.needsUpdate = true;
      lineGeo.current.attributes.color.needsUpdate = true;
    }
    if (pulseGeo.current) {
      pulseGeo.current.attributes.position.needsUpdate = true;
      pulseGeo.current.attributes.color.needsUpdate = true;
    }

    // labels are plain DOM nodes in an overlay (no extra React roots), positioned by projecting 3D points
    const sz = state.size;
    const place = (el: HTMLDivElement | undefined, x: number, y: number, z: number, show: boolean, opacity: number) => {
      if (!el) return;
      tmpV.set(x, y, z).project(camera);
      const vis = show && tmpV.z < 1 && Math.abs(tmpV.x) < 1.15 && Math.abs(tmpV.y) < 1.15;
      el.style.display = vis ? "block" : "none";
      if (vis) {
        el.style.transform = `translate(-50%,-50%) translate(${((tmpV.x * 0.5 + 0.5) * sz.width).toFixed(1)}px,${((-tmpV.y * 0.5 + 0.5) * sz.height).toFixed(1)}px)`;
        el.style.opacity = String(opacity);
      }
    };
    modules.forEach((m, mi) => {
      const i3 = mi * 3;
      const r = 0.42 + Math.min(0.5, Math.log10(1 + m.words) * 0.08);
      const hide = p.isolate !== null && p.isolate !== m.code;
      place(labelEls.current[mi], s.coreCur[i3], s.coreCur[i3 + 1] + r * 2.4 + 0.5, s.coreCur[i3 + 2], !hide, 0.4 + 0.6 * (0.25 + 0.75 * m.fresh));
    });
    hubs.forEach((h, i) => {
      const mesh = hubMeshes.current[i];
      if (mesh) mesh.visible = layout === "concepts";
      place(hubEls.current[i], h.pos[0], h.pos[1] + 0.34, h.pos[2], layout === "concepts", 0.85);
    });

    if (dust.current && !reduce) dust.current.rotation.y += dt * 0.012;

    // camera: fly, follow selected node, idle rotation
    const c = controls.current;
    if (c) {
      c.enabled = p.interactive;
      const f = s.fly;
      if (f) {
        const u = Math.min(1, (s.t - f.t0) / f.dur) || 1;
        const e = reduce ? 1 : ease(Math.min(1, (s.t - f.t0) / f.dur));
        let toTgt: THREE.Vector3, toPos: THREE.Vector3;
        if (f.reset || f.node < 0) {
          toTgt = new THREE.Vector3(0, layout === "timeline" ? -2.2 : 0, 0);
          toPos = layout === "timeline" ? new THREE.Vector3(0, 3, 22) : HOME_CAM.clone();
        } else {
          const i3 = f.node * 3;
          toTgt = new THREE.Vector3(s.cur[i3], s.cur[i3 + 1], s.cur[i3 + 2]);
          const dir = camera.position.clone().sub(toTgt).normalize();
          toPos = toTgt.clone().add(dir.multiplyScalar(4.2));
        }
        camera.position.lerpVectors(f.fromPos, toPos, e);
        c.target.lerpVectors(f.fromTgt, toTgt, e);
        if (u >= 1 && (s.t - f.t0) / f.dur >= 1) s.fly = null;
        s.idle = 0;
      } else if (p.selectedId) {
        // keep the chosen node centred as it orbits, moving the camera with it
        const i = nodes.findIndex((n) => n.id === p.selectedId);
        if (i >= 0) {
          const i3 = i * 3;
          tmpV.set(s.cur[i3], s.cur[i3 + 1], s.cur[i3 + 2]).sub(c.target);
          c.target.add(tmpV);
          camera.position.add(tmpV);
        }
      }
      c.autoRotate = !reduce && !p.selectedId && !s.fly; // gentle idle rotation; OrbitControls pauses it while you drag
      c.autoRotateSpeed = p.interactive ? 0.35 : 0.6;
      c.update();
    }
    s.init = true;
  });

  const pointer = (e: ThreeEvent<PointerEvent>) => {
    if (!p.interactive) return;
    e.stopPropagation();
    const id = e.instanceId ?? -1;
    st.current.hover = id;
    p.onHover(id >= 0 ? nodes[id].id : null, e.clientX, e.clientY);
  };

  return (
    <>
      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={2.5} maxDistance={34} enablePan={false} />

      <points ref={dust}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustPos, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#9fb3b2" size={0.045} sizeAttenuation transparent opacity={0.45} depthWrite={false} />
      </points>

      {/* module cores: dot-matrix shell, glowing centre, mono label */}
      {modules.map((m, mi) => {
        const glow = 0.25 + 0.75 * m.fresh;
        const r = 0.42 + Math.min(0.5, Math.log10(1 + m.words) * 0.08);
        return (
          <group key={m.code} ref={(g) => { coreRefs.current[mi] = g; }}>
            <mesh
              onClick={(e) => { if (!p.interactive) return; e.stopPropagation(); p.onHit(); p.onIsolate(m.code); }}
              onPointerOver={() => p.interactive && (document.body.style.cursor = "pointer")}
              onPointerOut={() => (document.body.style.cursor = "")}
            >
              <sphereGeometry args={[r, 24, 24]} />
              <meshBasicMaterial color={modColors[mi].clone().multiplyScalar(0.3 + glow)} toneMapped={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[r * 2.6, 20, 20]} />
              <meshBasicMaterial color={modColors[mi]} transparent opacity={0.1 * glow + 0.02} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </mesh>
            <points scale={r * 2.1}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[shell, 3]} />
              </bufferGeometry>
              <pointsMaterial color={m.color} size={0.03} sizeAttenuation transparent opacity={0.35 + 0.5 * glow} depthWrite={false} />
            </points>
          </group>
        );
      })}

      {/* concept hubs (Concept map layout) */}
      {hubs.map((h, i) => (
        <mesh key={h.tag} ref={(m) => { hubMeshes.current[i] = m; }} position={h.pos} visible={false}>
          <octahedronGeometry args={[0.12, 0]} />
          <meshBasicMaterial color="#e6f1f0" wireframe toneMapped={false} />
        </mesh>
      ))}

      {/* links + pulses */}
      <lineSegments frustumCulled={false}>
        <bufferGeometry ref={lineGeo}>
          <bufferAttribute attach="attributes-position" args={[linkPos0, 3]} />
          <bufferAttribute attach="attributes-color" args={[linkCol0, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </lineSegments>
      <points frustumCulled={false}>
        <bufferGeometry ref={pulseGeo}>
          <bufferAttribute attach="attributes-position" args={[pulsePos0, 3]} />
          <bufferAttribute attach="attributes-color" args={[pulseCol0, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.09} sizeAttenuation vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>

      {/* nodes */}
      <instancedMesh ref={haloMesh} args={[undefined, undefined, Math.max(1, N)]} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={nodeMesh} args={[undefined, undefined, Math.max(1, N)]} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={hitMesh}
        args={[undefined, undefined, Math.max(1, N)]}
        frustumCulled={false}
        onPointerMove={pointer}
        onPointerOut={() => {
          st.current.hover = -1;
          p.onHover(null, 0, 0);
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (!p.interactive || e.instanceId === undefined) return;
          e.stopPropagation();
          p.onHit();
          p.onSelect(nodes[e.instanceId].id);
        }}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </>
  );
}


export default function Galaxy3D(props: GalaxyProps) {
  const overlay = useRef<HTMLDivElement>(null);
  return (
    <div className="relative h-full w-full">
      <Canvas
        frameloop={props.active === false ? "never" : "always"}
        camera={{ position: HOME_CAM.toArray(), fov: props.compact ? 55 : 48, near: 0.1, far: 120 }}
        dpr={[1, props.compact ? 1.25 : 1.5]}
        gl={{ antialias: !props.compact, alpha: true, powerPreference: "high-performance" }}
        aria-hidden
      >
        <Scene {...props} overlay={overlay} />
      </Canvas>
      <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden />
    </div>
  );
}

export type { GNode };
