'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { GlassMaterial, type GlassKind } from '../../lib/materials';
import { useQuality } from '../../lib/quality';
import { getSectionProgress, sectionRange, smooth, pointer } from '../../scroll-store';
import { useHotspotReporter } from '../../kit/ProximityType';
import { JOIN_STAGES } from './joinery';

/**
 * CaseScene — "Joinery".
 *
 * A glass side table — Resting Art's first piece — hangs in the air as its
 * own exploded kit: four legs, four aprons, a stretcher, a top, and the
 * electric-blue dowels that will hold it. Through the pinned `joinery` dwell
 * it is built the way a cabinetmaker builds it: the legs stand on their
 * marks, the aprons drop into the slots cut in the leg heads, the stretcher
 * slides in along its tenon axis, and the top turns square and seats onto
 * the dowels — a soft ring of light runs out across the plinth as it lands.
 *
 * Each member travels to a "pre-joint" pose (aligned, offset along the axis
 * of its joint) and only then moves in along that one axis, so the joint
 * reads as joinery, not a morph. Scrubbed by section progress: scrolling up
 * takes the piece apart again. Reduced motion shows the finished table.
 * Zero allocations in useFrame.
 */

/* table dimensions (world units) */
const W = 1.9; // x
const D = 1.0; // z
const H = 1.15; // floor → top surface
const LEG = 0.11;
const TOP_T = 0.07;
const APRON_H = 0.15;
const APRON_T = 0.045;
const FLOOR = -1.25;
const LX = W / 2 - 0.13;
const LZ = D / 2 - 0.11;
const LEG_H = H - TOP_T;

interface Part {
  stage: number;
  /** order within its stage, for a light stagger */
  order: number;
  size: [number, number, number];
  kind: GlassKind | 'dowel';
  final: [number, number, number];
  finalYaw: number;
  /** exploded rest pose */
  rest: [number, number, number];
  restRot: [number, number, number];
  /** pre-joint offset from final, along the joint axis */
  approach: [number, number, number];
}

const LEG_KIND: GlassKind = 'azure';
const legY = FLOOR + LEG_H / 2;
const apronY = FLOOR + LEG_H - APRON_H / 2 - 0.02;
const stretchY = FLOOR + 0.26;

const PARTS: Part[] = [
  // stage 0 — legs stand on their marks (approach from above)
  ...[
    [-LX, -LZ],
    [LX, -LZ],
    [LX, LZ],
    [-LX, LZ],
  ].map(([x, z], i): Part => ({
    stage: 0,
    order: i,
    size: [LEG, LEG_H, LEG],
    kind: LEG_KIND,
    final: [x, legY, z],
    finalYaw: 0,
    rest: [x * 1.9 + (i % 2 ? 0.3 : -0.2), legY + 0.55 + i * 0.12, z * 2.6 - 0.3],
    restRot: [0.5 - i * 0.22, i * 0.8, (i % 2 ? -1 : 1) * 0.85],
    approach: [0, 0.42, 0],
  })),
  // stage 1 — aprons drop into the slots in the leg heads
  ...[
    { f: [0, apronY, -LZ], len: W - 0.26, yaw: 0, r: [-0.35, 1.25, -1.6] },
    { f: [0, apronY, LZ], len: W - 0.26, yaw: 0, r: [0.4, 1.6, 1.3] },
    { f: [-LX, apronY, 0], len: D - 0.22, yaw: Math.PI / 2, r: [-2.1, 1.05, 0.2] },
    { f: [LX, apronY, 0], len: D - 0.22, yaw: Math.PI / 2, r: [2.15, 1.35, -0.4] },
  ].map((a, i): Part => ({
    stage: 1,
    order: i,
    size: [a.len, APRON_H, APRON_T],
    kind: 'ice',
    final: a.f as [number, number, number],
    finalYaw: a.yaw,
    rest: a.r as [number, number, number],
    restRot: [0.6 * (i % 2 ? 1 : -1), 0.4 + i * 0.5, 0.35 * (i - 1.5)],
    approach: [0, 0.5, 0],
  })),
  // stage 2 — the stretcher slides in along its tenon axis (x)
  {
    stage: 2,
    order: 0,
    size: [W - 0.26, 0.07, 0.07],
    kind: 'deep',
    final: [0, stretchY, 0],
    finalYaw: 0,
    rest: [2.2, stretchY + 0.35, 0.9],
    restRot: [0.3, -0.7, 0.45],
    approach: [1.15, 0, 0],
  },
  // stage 2 — dowels rise out of the leg heads, ready for the top
  ...[
    [-LX, -LZ],
    [LX, -LZ],
    [LX, LZ],
    [-LX, LZ],
  ].map(([x, z], i): Part => ({
    stage: 2,
    order: i + 1,
    size: [0.035, 0.12, 0.035],
    kind: 'dowel',
    final: [x, FLOOR + LEG_H + 0.02, z],
    finalYaw: 0,
    rest: [x * 0.6, FLOOR + LEG_H + 0.9 + i * 0.07, z * 0.5 + 0.2],
    restRot: [i * 0.7, 0, 1.1 - i * 0.4],
    approach: [0, 0.22, 0],
  })),
  // stage 3 — the top turns square and seats onto the dowels
  {
    stage: 3,
    order: 0,
    size: [W, TOP_T, D],
    kind: 'crystal',
    final: [0, FLOOR + H - TOP_T / 2, 0],
    finalYaw: 0,
    rest: [-0.25, FLOOR + H + 1.25, -0.5],
    restRot: [0.42, -0.62, -0.18],
    approach: [0, 0.38, 0],
  },
];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** pinned window of a 300vh dwell with a 100vh sticky stage */
const PIN_FROM = 0.25;
const PIN_TO = 0.75;

/* precomputed quaternions — rest & final per part */
const _e = new THREE.Euler();
const REST_Q = PARTS.map((p) => new THREE.Quaternion().setFromEuler(_e.set(...p.restRot)));
const FINAL_Q = PARTS.map((p) => new THREE.Quaternion().setFromEuler(_e.set(0, p.finalYaw, 0)));

/* module-scope temps */
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();

export default function CaseScene() {
  const q = useQuality();
  const piece = useRef<THREE.Group>(null);
  const partRefs = useRef<(THREE.Object3D | null)[]>([]);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const topRef = useRef<THREE.Object3D | null>(null);
  const report = useHotspotReporter('case-vitrine');

  /* per-stage member counts → stagger within a stage */
  const stageCounts = useMemo(() => {
    const c = [0, 0, 0, 0];
    PARTS.forEach((p) => (c[p.stage] = Math.max(c[p.stage], p.order + 1)));
    return c;
  }, []);

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const g = piece.current;
    if (!g) return;

    const build = anim ? sectionRange(getSectionProgress('joinery'), PIN_FROM, PIN_TO) : 1;
    const read = anim
      ? smooth(clamp01((getSectionProgress('feature') + getSectionProgress('detail')) * 0.5))
      : 0.5;
    const intro = anim ? smooth(Math.min(el / 2.0, 1)) : 1;
    const compact = q.compact;

    /* placement: right of the hero copy; centre stage for the build */
    const centring = smooth(sectionRange(build, 0, 0.18));
    const tx = compact ? 0 : 1.75 - centring * 0.55;
    g.position.x += (tx - g.position.x) * 0.05;
    g.position.y = (compact ? -0.55 : 0) - (1 - intro) * 0.9;
    g.scale.setScalar(compact ? 0.62 : 1);
    /* a slow showroom turn once it stands, plus pointer */
    const yaw = -0.55 + build * 0.35 + read * 0.9 + (anim ? pointer.x * 0.22 : 0);
    g.rotation.y += (yaw - g.rotation.y) * 0.05;
    g.rotation.x += ((anim ? 0.04 - pointer.y * 0.05 : 0.04) - g.rotation.x) * 0.05;

    for (let i = 0; i < PARTS.length; i++) {
      const o = partRefs.current[i];
      if (!o) continue;
      const p = PARTS[i];
      const [s0, s1] = JOIN_STAGES[p.stage];
      const n = stageCounts[p.stage];
      const span = s1 - s0;
      const lag = n > 1 ? (span * 0.35 * p.order) / (n - 1) : 0;
      const u = clamp01((build - s0 - lag) / (span * 0.65));

      /* phase A: rest → pre-joint (aligned, offset on the joint axis) */
      const a = easeInOut(clamp01(u / 0.62));
      /* phase B: in along the joint axis, decelerating into the seat */
      const b = easeOut(clamp01((u - 0.62) / 0.38));
      const bob = anim ? Math.sin(el * 0.55 + i * 1.3) * 0.05 * (1 - a) : 0;
      const px = p.final[0] + p.approach[0];
      const py = p.final[1] + p.approach[1];
      const pz = p.final[2] + p.approach[2];
      o.position.set(
        p.rest[0] + (px - p.rest[0]) * a - p.approach[0] * b,
        p.rest[1] + (py - p.rest[1]) * a - p.approach[1] * b + bob,
        p.rest[2] + (pz - p.rest[2]) * a - p.approach[2] * b,
      );
      o.quaternion.slerpQuaternions(REST_Q[i], FINAL_Q[i], a);
      const pop = anim ? smooth(clamp01((el - 0.25 - i * 0.07) / 0.9)) : 1;
      o.scale.setScalar(Math.max(pop, 0.001));
    }

    /* the seat — a ring of light runs out across the plinth as the top lands */
    const [t0, t1] = JOIN_STAGES[3];
    const seat = clamp01((build - (t0 + (t1 - t0) * 0.6)) / ((t1 - t0) * 0.4 + 0.08));
    const ring = ringRef.current;
    if (ring && ringMat.current) {
      ring.scale.setScalar(0.6 + easeOut(seat) * 2.2);
      ringMat.current.opacity = seat > 0 && seat < 1 ? Math.sin(Math.PI * seat) * 0.5 : 0;
    }

    if (topRef.current) report(topRef.current, state.camera, (0.5 + 0.35 * build) * intro);

    /* camera: a calm three-quarter view, pushing in as it's built */
    _cam.set(
      (anim ? pointer.x * 0.3 : 0) + 0.2,
      1.15 - build * 0.35 + (anim ? pointer.y * 0.18 : 0),
      (compact ? 11.2 : 9.6) - build * 0.9 + read * 0.6 - intro * 0.3,
    );
    state.camera.position.lerp(_cam, 0.05);
    _look.set(compact ? 0 : 0.55, compact ? -0.75 : -0.35, 0);
    state.camera.lookAt(_look);
  });

  return (
    <group>
      <SceneLightRig />
      <group ref={piece}>
        {/* the plinth */}
        <mesh position={[0, FLOOR - 0.06, 0]}>
          <cylinderGeometry args={[1.85, 1.95, 0.12, 72]} />
          <GlassMaterial kind="pane" />
        </mesh>
        <mesh ref={ringRef} position={[0, FLOOR + 0.006, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.78, 0.8, 96]} />
          <meshBasicMaterial
            ref={ringMat}
            color="#2e4bff"
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        {PARTS.map((p, i) => {
          const set = (m: THREE.Object3D | null) => {
            partRefs.current[i] = m;
            if (p.stage === 3) topRef.current = m;
          };
          if (p.kind === 'dowel') {
            return (
              <mesh key={i} ref={set}>
                <cylinderGeometry args={[p.size[0] / 2, p.size[0] / 2, p.size[1], 16]} />
                <meshPhysicalMaterial
                  color="#2e4bff"
                  roughness={0.2}
                  clearcoat={1}
                  clearcoatRoughness={0.1}
                  emissive="#1226c8"
                  emissiveIntensity={0.35}
                />
              </mesh>
            );
          }
          return (
            <RoundedBox
              key={i}
              ref={set}
              args={p.size}
              radius={Math.min(0.018, Math.min(...p.size) * 0.3)}
              smoothness={3}
            >
              <GlassMaterial kind={p.kind} />
            </RoundedBox>
          );
        })}
      </group>
      <ParticleField
        count={Math.floor(1100 * q.particles)}
        drift={q.animate ? 0.08 : 0}
        opacity={0.28}
      />
    </group>
  );
}
