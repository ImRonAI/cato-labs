'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three-stdlib';
import SceneLightRig from '../../../shared/SceneLightRig';
import ParticleField from '../../../shared/ParticleField';
import { GlassMaterial } from '../../../../lib/materials';
import { useQuality } from '../../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../../scroll-store';
import { useHotspotReporter } from '../../../../kit/ProximityType';

/* ------------------------------------------------------------------ */
/*  KnowledgeArchitectureScene — "The Memory Palace".                 */
/*                                                                    */
/*  A 3D graph of knowledge: thirty small glass nodes in five         */
/*  layered domain clusters (products / people / policies / support / */
/*  operations), wired with hairline azure edges in a single          */
/*  lineSegments draw call. The whole palace orbits slowly. A deep-   */
/*  blue query sphere fires light along the edges every ~5s —         */
/*  retrieval made visible — and distant nodes flare on arrival.      */
/*                                                                    */
/*  Scroll: hero = full palace orbit; feature = camera descends into  */
/*  a cluster; detail = the query sphere retrieves close to camera.   */
/*  Hotspot 'knowledge-query' reported on the query sphere. Reduced   */
/*  motion → static assembled palace. Zero allocations per frame.     */
/* ------------------------------------------------------------------ */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* deterministic PRNG so SSR and client agree on the layout */
function prng(seed: number) {
  let s = seed * 9973;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ------------------------- palace layout ------------------------- */

const QUERY_POS = new THREE.Vector3(0, -2.3, 2.4);

const CLUSTERS: { c: [number, number, number]; n: number; tint: string }[] = [
  { c: [-3.1, 1.05, -1.9], n: 6, tint: '#b9c9ff' }, // products
  { c: [3.0, 1.35, -2.5], n: 6, tint: '#93a9ff' }, // people
  { c: [0.1, 2.5, -4.2], n: 5, tint: '#dce4ff' }, // policies
  { c: [-2.3, -1.35, -0.9], n: 7, tint: '#e8eeff' }, // support
  { c: [2.5, -1.05, -1.3], n: 6, tint: '#b9c9ff' }, // operations
];

interface Path {
  pts: Float32Array; // waypoint xyz triplets
  lens: Float32Array; // cumulative length per waypoint
  total: number;
  target: number; // node index that flares on arrival
  start: number; // seconds offset inside the cycle
}

const {
  NODE_TOTAL,
  nodePos,
  nodeScale,
  nodePhase,
  nodeCluster,
  nodeTint,
  edgeGeometry,
  paths,
} = (() => {
  const rand = prng(31);

  /* nodes */
  const counts = CLUSTERS.map((c) => c.n);
  const NODE_TOTAL = counts.reduce((a, b) => a + b, 0);
  const nodePos = new Float32Array(NODE_TOTAL * 3);
  const nodeScale = new Float32Array(NODE_TOTAL);
  const nodePhase = new Float32Array(NODE_TOTAL);
  const nodeCluster = new Int8Array(NODE_TOTAL);
  const nodeTint: string[] = [];
  const anchors: number[] = [];

  let idx = 0;
  CLUSTERS.forEach((cl, ci) => {
    let anchor = idx;
    let anchorD = Infinity;
    for (let k = 0; k < cl.n; k++) {
      /* random point in a flattened sphere around the cluster center */
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(rand() * 2 - 1);
      const r = 0.28 + rand() * 0.6;
      const x = cl.c[0] + Math.sin(phi) * Math.cos(theta) * r;
      const y = cl.c[1] + Math.cos(phi) * r * 0.8;
      const z = cl.c[2] + Math.sin(phi) * Math.sin(theta) * r;
      nodePos[idx * 3] = x;
      nodePos[idx * 3 + 1] = y;
      nodePos[idx * 3 + 2] = z;
      nodeScale[idx] = 0.17 + rand() * 0.13;
      nodePhase[idx] = rand() * Math.PI * 2;
      nodeCluster[idx] = ci;
      nodeTint.push(cl.tint);
      const d = (x - cl.c[0]) ** 2 + (y - cl.c[1]) ** 2 + (z - cl.c[2]) ** 2;
      if (d < anchorD) {
        anchorD = d;
        anchor = idx;
      }
      idx++;
    }
    anchors.push(anchor);
  });

  const dist2 = (a: number, b: number) => {
    const dx = nodePos[a * 3] - nodePos[b * 3];
    const dy = nodePos[a * 3 + 1] - nodePos[b * 3 + 1];
    const dz = nodePos[a * 3 + 2] - nodePos[b * 3 + 2];
    return dx * dx + dy * dy + dz * dz;
  };
  const dist2Q = (a: number) => {
    const dx = nodePos[a * 3] - QUERY_POS.x;
    const dy = nodePos[a * 3 + 1] - QUERY_POS.y;
    const dz = nodePos[a * 3 + 2] - QUERY_POS.z;
    return dx * dx + dy * dy + dz * dz;
  };

  /* edges — deduped, then rasterized into one lineSegments geometry */
  const edgeSet = new Set<string>();
  const edges: Array<[number, number]> = [];
  const addEdge = (a: number, b: number) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push(a < b ? [a, b] : [b, a]);
  };

  idx = 0;
  CLUSTERS.forEach((cl, ci) => {
    const base = idx;
    for (let k = 0; k < cl.n; k++) {
      const a = base + k;
      /* wire each node to its two nearest cluster-mates */
      let b1 = -1;
      let b2 = -1;
      let d1 = Infinity;
      let d2 = Infinity;
      for (let j = 0; j < cl.n; j++) {
        if (j === k) continue;
        const b = base + j;
        const d = dist2(a, b);
        if (d < d1) {
          d2 = d1;
          b2 = b1;
          d1 = d;
          b1 = b;
        } else if (d < d2) {
          d2 = d;
          b2 = b;
        }
      }
      if (b1 >= 0) addEdge(a, b1);
      if (b2 >= 0) addEdge(a, b2);
    }
    idx += cl.n;
    void ci;
  });

  /* anchors wire to their two nearest peer anchors — the palace spine */
  anchors.forEach((a, i) => {
    const order = anchors
      .map((b, j) => ({ b, j, d: i === j ? Infinity : dist2(a, b) }))
      .sort((x, y) => x.d - y.d);
    addEdge(a, order[0].b);
    addEdge(a, order[1].b);
  });

  /* the query sphere wires to its two nearest nodes */
  let q1 = -1;
  let q2 = -1;
  let qd1 = Infinity;
  let qd2 = Infinity;
  for (let i = 0; i < NODE_TOTAL; i++) {
    const d = dist2Q(i);
    if (d < qd1) {
      qd2 = qd1;
      q2 = q1;
      qd1 = d;
      q1 = i;
    } else if (d < qd2) {
      qd2 = d;
      q2 = i;
    }
  }
  /* query endpoints are stored after the node block in the geometry */
  const pos = new Float32Array((edges.length + 2) * 6);
  edges.forEach(([a, b], e) => {
    pos[e * 6] = nodePos[a * 3];
    pos[e * 6 + 1] = nodePos[a * 3 + 1];
    pos[e * 6 + 2] = nodePos[a * 3 + 2];
    pos[e * 6 + 3] = nodePos[b * 3];
    pos[e * 6 + 4] = nodePos[b * 3 + 1];
    pos[e * 6 + 5] = nodePos[b * 3 + 2];
  });
  [q1, q2].forEach((qn, k) => {
    const e = edges.length + k;
    pos[e * 6] = QUERY_POS.x;
    pos[e * 6 + 1] = QUERY_POS.y;
    pos[e * 6 + 2] = QUERY_POS.z;
    pos[e * 6 + 3] = nodePos[qn * 3];
    pos[e * 6 + 4] = nodePos[qn * 3 + 1];
    pos[e * 6 + 5] = nodePos[qn * 3 + 2];
  });
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  /* retrieval paths — query → near node → target anchor → distant node */
  const paths: Path[] = [];
  const targetClusters = [0, 1, 2, 4]; // products / people / policies / operations
  targetClusters.forEach((ci, pi) => {
    /* farthest node of the cluster from the query — a distant answer */
    let target = -1;
    let td = -1;
    for (let i = 0; i < NODE_TOTAL; i++) {
      if (nodeCluster[i] !== ci) continue;
      const d = dist2Q(i);
      if (d > td) {
        td = d;
        target = i;
      }
    }
    const chain = [q1, anchors[ci], target].filter(
      (v, i, arr) => i === 0 || v !== arr[i - 1],
    );
    const waypoints: THREE.Vector3[] = [QUERY_POS.clone()];
    chain.forEach((n) =>
      waypoints.push(
        new THREE.Vector3(nodePos[n * 3], nodePos[n * 3 + 1], nodePos[n * 3 + 2]),
      ),
    );
    const pts = new Float32Array(waypoints.length * 3);
    const lens = new Float32Array(waypoints.length);
    let total = 0;
    waypoints.forEach((w, i) => {
      pts[i * 3] = w.x;
      pts[i * 3 + 1] = w.y;
      pts[i * 3 + 2] = w.z;
      if (i > 0) total += w.distanceTo(waypoints[i - 1]);
      lens[i] = total;
    });
    paths.push({ pts, lens, total, target, start: pi * 1.05 });
  });

  return {
    NODE_TOTAL,
    nodePos,
    nodeScale,
    nodePhase,
    nodeCluster,
    nodeTint,
    edgeGeometry,
    paths,
  };
})();

/* ------------------------ frame constants ------------------------ */

const CYCLE = 5; // one retrieval cycle every ~5s
const TRAVEL = 1.25; // seconds per pulse journey
const PULSE_COUNT = paths.length; // 4

/* module-level temps — zero allocations inside useFrame */
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _wq = new THREE.Vector3();
const _look = new THREE.Vector3(0, 0.35, -1.6);
const _flare = new Float32Array(NODE_TOTAL);

/** walk a waypoint polyline by arc length — no allocation */
function samplePath(path: Path, u: number, out: THREE.Vector3) {
  const target = clamp01(u) * path.total;
  const lens = path.lens;
  let i = 1;
  while (i < lens.length - 1 && lens[i] < target) i++;
  const l0 = lens[i - 1];
  const l1 = lens[i];
  const f = l1 > l0 ? (target - l0) / (l1 - l0) : 0;
  const a = (i - 1) * 3;
  const b = i * 3;
  const pts = path.pts;
  out.set(
    pts[a] + (pts[b] - pts[a]) * f,
    pts[a + 1] + (pts[b + 1] - pts[a + 1]) * f,
    pts[a + 2] + (pts[b + 2] - pts[a + 2]) * f,
  );
}

export default function KnowledgeArchitectureScene() {
  const q = useQuality();
  const report = useHotspotReporter('knowledge-query');

  const spin = useRef<THREE.Group>(null);
  const nodes = useRef<THREE.InstancedMesh>(null);
  const lineMat = useRef<THREE.LineBasicMaterial>(null);
  const pulses = useRef<THREE.InstancedMesh>(null);
  const queryRef = useRef<THREE.Mesh>(null);
  const queryMat = useRef<THREE.MeshPhysicalMaterial>(null);

  const startAt = useRef<number | null>(null);

  /* one rounded-box geometry shared by every node instance */
  const nodeGeo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 3, 0.16), []);
  useEffect(
    () => () => {
      nodeGeo.dispose();
      edgeGeometry.dispose();
    },
    [nodeGeo],
  );

  /* static instance transforms + per-cluster tints, set once */
  useEffect(() => {
    const inst = nodes.current;
    if (!inst) return;
    for (let i = 0; i < NODE_TOTAL; i++) {
      _p.set(nodePos[i * 3], nodePos[i * 3 + 1], nodePos[i * 3 + 2]);
      _s.setScalar(nodeScale[i]);
      _m.compose(_p, _q, _s);
      inst.setMatrixAt(i, _m);
      inst.setColorAt(i, _c.set(nodeTint[i]));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = t;
    const anim = q.animate;
    const introT = anim ? Math.min((t - startAt.current) / 1.6, 1) : 1;
    const intro = smooth(introT);

    /* scroll drivers — contract ids: hero / feature / detail */
    const hero = smooth(sectionRange(getSectionProgress('hero'), 0.05, 0.95));
    const feat = smooth(sectionRange(getSectionProgress('feature'), 0.06, 0.92));
    const det = smooth(sectionRange(getSectionProgress('detail'), 0.12, 0.8));

    /* the palace orbits — slowing as the query takes the stage */
    if (spin.current && anim) {
      spin.current.rotation.y += delta * 0.045 * (1 - det * 0.7);
    }

    /* ------------------------------ camera ------------------------------ */
    const drift = anim ? Math.sin(t * 0.06) * 0.45 : 0;
    let cx = drift;
    let cy = 0.55;
    let cz = 10.6 - hero * 0.7;
    cx += feat * -2.6;
    cy += feat * 0.55;
    cz += feat * -6.9; // descend into the products cluster
    cx += det * 2.9;
    cy += det * -2.15;
    cz += det * 3.1; // rise to meet the query sphere
    cz += (1 - intro) * 1.8;
    cy += (1 - intro) * 0.5;
    if (anim) {
      cx += pointer.x * 0.22;
      cy += pointer.y * 0.15;
    }

    /* gaze — the cluster on feature, tracking the query sphere on detail */
    let lx = feat * -2.9;
    let ly = 0.35 + feat * 0.75;
    let lz = -1.6 + feat * -0.3;
    if (queryRef.current) {
      queryRef.current.getWorldPosition(_wq);
      lx += (_wq.x - lx) * det;
      ly += (_wq.y - ly) * det;
      lz += (_wq.z - lz) * det;
    }

    const cam = state.camera;
    if (anim) {
      cam.position.x += (cx - cam.position.x) * 0.05;
      cam.position.y += (cy - cam.position.y) * 0.05;
      cam.position.z += (cz - cam.position.z) * 0.05;
      _look.x += (lx - _look.x) * 0.05;
      _look.y += (ly - _look.y) * 0.05;
      _look.z += (lz - _look.z) * 0.05;
    } else {
      cam.position.set(cx, cy, cz);
      _look.set(lx, ly, lz);
    }
    cam.lookAt(_look);

    /* ------------------- retrieval cycle: pulses & flares ------------------ */
    const local = anim ? t % CYCLE : -1;
    let fire = 0;
    _flare.fill(0);

    const pinst = pulses.current;
    for (let i = 0; i < PULSE_COUNT; i++) {
      const path = paths[i];
      const dt = local - path.start;
      const travelling = anim && dt >= 0 && dt <= TRAVEL;

      if (travelling) {
        const f = smooth(dt / TRAVEL);
        if (pinst) {
          samplePath(path, f, _p);
          const s = Math.max(Math.sin(f * Math.PI), 0.0001);
          _m.compose(_p, _q, _s.setScalar(s));
          pinst.setMatrixAt(i, _m);
        }
        if (f < 0.14) fire = Math.max(fire, (0.14 - f) / 0.14);
      } else if (pinst) {
        _m.compose(_p.set(0, -100, 0), _q, _s.setScalar(0.0001));
        pinst.setMatrixAt(i, _m);
      }

      /* arrival flare — decays through the rest of the cycle */
      if (anim) {
        const ad = (((local - path.start - TRAVEL) % CYCLE) + CYCLE) % CYCLE;
        _flare[path.target] = Math.max(_flare[path.target], Math.exp(-ad * 2.6));
      }
    }
    if (pinst) pinst.instanceMatrix.needsUpdate = true;

    /* node matrices — breathe, assemble, flare */
    const inst = nodes.current;
    if (inst) {
      for (let i = 0; i < NODE_TOTAL; i++) {
        const a = smooth(clamp01((introT - nodeCluster[i] * 0.1) / 0.7));
        const breath = anim ? Math.sin(t * 0.45 + nodePhase[i]) * 0.05 : 0;
        const s = Math.max(nodeScale[i] * a * (1 + breath + _flare[i] * 0.9), 0.0001);
        _p.set(nodePos[i * 3], nodePos[i * 3 + 1], nodePos[i * 3 + 2]);
        _m.compose(_p, _q, _s.setScalar(s));
        inst.setMatrixAt(i, _m);
      }
      inst.instanceMatrix.needsUpdate = true;
    }

    /* hairline edges fade in with the assembly */
    if (lineMat.current) lineMat.current.opacity = intro * 0.34;

    /* the query sphere — deep blue, spiking as each retrieval fires */
    if (queryRef.current) {
      const qa = smooth(clamp01(introT / 0.5));
      const bob = anim ? Math.sin(t * 0.6) * 0.08 : 0;
      queryRef.current.position.set(QUERY_POS.x, QUERY_POS.y + bob, QUERY_POS.z);
      queryRef.current.scale.setScalar(Math.max(qa, 0.0001) * (1 + fire * 0.18));
    }
    if (queryMat.current) {
      queryMat.current.emissiveIntensity = 0.5 + fire * 1.35 + det * 0.3;
    }

    /* hotspot for ProximityType — the query sphere itself */
    if (queryRef.current) {
      report(queryRef.current, cam, 0.42 + fire * 0.5 + det * 0.08);
    }
  });

  return (
    <group scale={q.compact ? 0.85 : 1}>
      <SceneLightRig />

      <group ref={spin}>
        {/* the palace — thirty instanced glass nodes in five clusters */}
        <instancedMesh
          ref={nodes}
          args={[undefined, undefined, NODE_TOTAL]}
          geometry={nodeGeo}
          frustumCulled={false}
        >
          <GlassMaterial kind="pane" />
        </instancedMesh>

        {/* hairline azure edges — one draw call */}
        <lineSegments geometry={edgeGeometry} frustumCulled={false}>
          <lineBasicMaterial
            ref={lineMat}
            color="#93a9ff"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </lineSegments>

        {/* retrieval pulses — instanced sparks riding the edges */}
        <instancedMesh
          ref={pulses}
          args={[undefined, undefined, PULSE_COUNT]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshBasicMaterial color={[0.85, 1.05, 2.8]} toneMapped={false} transparent />
        </instancedMesh>

        {/* the query — a deep-blue sphere asking the palace */}
        <mesh ref={queryRef} position={[QUERY_POS.x, QUERY_POS.y, QUERY_POS.z]}>
          <sphereGeometry args={[0.19, 28, 28]} />
          <GlassMaterial
            kind="deep"
            ref={queryMat}
            emissive="#2e4bff"
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>

      <ParticleField
        count={Math.floor(1300 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        parallax={q.animate ? 0.8 : 0}
        opacity={0.34}
      />
    </group>
  );
}
