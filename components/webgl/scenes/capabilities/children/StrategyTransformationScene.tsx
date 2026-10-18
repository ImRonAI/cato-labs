'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, type GlassKind } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';

/**
 * StrategyTransformationScene — "The Chessboard of Evidence".
 *
 * A low pane-glass board with a faint 6×6 hairline grid. Eight glass
 * evidence pieces (cubes / cylinders / orbs, ice & azure) begin clustered
 * chaotically on the left, restless with idle jitter; as the `feature`
 * section scrolls, each glides along a staggered arc into a deliberate
 * two-rank formation on the right. One deep-blue decision piece forms up
 * last, then advances to the board's exact centre as `detail` arrives —
 * reported to ProximityType as hotspot 'strategy-core'.
 *
 * Camera: slow ±8° orbit + pointer parallax. Zero allocations in useFrame;
 * reduced motion renders the final formation as a still.
 */

type PieceShape = 'cube' | 'cyl' | 'orb';

interface PieceSpec {
  shape: PieceShape;
  kind: GlassKind;
  /** chaotic start — the evidence cluster, left side of the board */
  cluster: readonly [number, number, number];
  /** deliberate end — the decision formation, right side */
  form: readonly [number, number, number];
  rotCluster: number;
  rotForm: number;
  seed: number;
}

/* deterministic PRNG — stable scatter across renders */
function rand(seedStart: number) {
  let s = seedStart * 9973;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const BOARD_TOP = 0.05;
const REST_Y: Record<PieceShape, number> = { cube: 0.27, cyl: 0.31, orb: 0.32 };

/* cell-centred formation slots — two ranks of evidence on the right */
const FORMATION: readonly (readonly [number, number])[] = [
  [0.5, -1.5],
  [1.5, -1.5],
  [0.5, -0.5],
  [1.5, -0.5],
  [0.5, 0.5],
  [1.5, 0.5],
  [0.5, 1.5],
  [1.5, 1.5],
];

const SHAPES: readonly PieceShape[] = [
  'cube',
  'cyl',
  'orb',
  'cube',
  'orb',
  'cyl',
  'cube',
  'orb',
];
const KINDS: readonly GlassKind[] = [
  'azure',
  'ice',
  'ice',
  'azure',
  'ice',
  'azure',
  'azure',
  'ice',
];

function buildPieces(): PieceSpec[] {
  const r = rand(11);
  return FORMATION.map(([fx, fz], i) => {
    const shape = SHAPES[i];
    return {
      shape,
      kind: KINDS[i],
      cluster: [-2.55 + r() * 1.6, REST_Y[shape] + r() * 0.4, -1.85 + r() * 3.7],
      form: [fx, REST_Y[shape], fz],
      rotCluster: r() * Math.PI * 2,
      rotForm: Math.round(r() * 3) * (Math.PI / 2),
      seed: r(),
    };
  });
}

const CORE_REST_Y = 0.34;

/* module-scope temps — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();

function Piece({
  spec,
  refCb,
}: {
  spec: PieceSpec;
  refCb: (m: THREE.Mesh | null) => void;
}) {
  const pos: [number, number, number] = [
    spec.cluster[0],
    spec.cluster[1],
    spec.cluster[2],
  ];
  if (spec.shape === 'cube') {
    return (
      <RoundedBox
        ref={refCb}
        args={[0.44, 0.44, 0.44]}
        radius={0.08}
        smoothness={4}
        position={pos}
        rotation={[0, spec.rotCluster, 0]}
      >
        <GlassMaterial kind={spec.kind} />
      </RoundedBox>
    );
  }
  return (
    <mesh ref={refCb} position={pos} rotation={[0, spec.rotCluster, 0]}>
      {spec.shape === 'cyl' ? (
        <cylinderGeometry args={[0.17, 0.21, 0.52, 28]} />
      ) : (
        <sphereGeometry args={[0.27, 32, 24]} />
      )}
      <GlassMaterial kind={spec.kind} />
    </mesh>
  );
}

export default function StrategyTransformationScene() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const pieceRefs = useRef<(THREE.Mesh | null)[]>([]);
  const coreRef = useRef<THREE.Mesh>(null);
  const report = useHotspotReporter('strategy-core');

  const pieces = useMemo(buildPieces, []);
  const core = useMemo<PieceSpec>(() => {
    const r = rand(29);
    return {
      shape: 'cube',
      kind: 'deep',
      cluster: [-1.15 + r() * 0.5, CORE_REST_Y + 0.25, 1.05],
      form: [2.5, CORE_REST_Y, 0],
      rotCluster: r() * Math.PI * 2,
      rotForm: Math.PI / 4,
      seed: r(),
    };
  }, []);

  /* faint 6×6 hairline grid etched just above the glass slab */
  const grid = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i <= 6; i++) {
      const c = -3 + i;
      pts.push(c, BOARD_TOP + 0.012, -3, c, BOARD_TOP + 0.012, 3);
      pts.push(-3, BOARD_TOP + 0.012, c, 3, BOARD_TOP + 0.012, c);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(pts), 3),
    );
    return geometry;
  }, []);
  useEffect(() => () => grid.dispose(), [grid]);

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const feature = anim ? getSectionProgress('feature') : 1;
    const detail = anim ? getSectionProgress('detail') : 1;
    const intro = anim ? smooth(Math.min(el / 1.7, 1)) : 1;

    const g = group.current;
    if (g) g.position.y = -1.15 * (1 - intro);

    /* evidence pieces: cluster → formation on staggered arcs */
    for (let i = 0; i < pieces.length; i++) {
      const m = pieceRefs.current[i];
      if (!m) continue;
      const s = pieces[i];
      const t = smooth(sectionRange(feature, 0.04 + i * 0.062, 0.54 + i * 0.062));
      const x = s.cluster[0] + (s.form[0] - s.cluster[0]) * t;
      const y =
        s.cluster[1] +
        (s.form[1] - s.cluster[1]) * t +
        Math.sin(t * Math.PI) * 0.85 +
        (anim ? Math.sin(el * 1.25 + s.seed * 9.4) * 0.05 * (1 - t) : 0);
      const z = s.cluster[2] + (s.form[2] - s.cluster[2]) * t;
      m.position.set(x, y, z);
      m.rotation.y = s.rotCluster + (s.rotForm - s.rotCluster) * t;
      const pop = anim
        ? smooth(Math.min(Math.max((el - 0.15 - i * 0.07) / 0.7, 0), 1))
        : 1;
      m.scale.setScalar(Math.max(pop, 0.001));
    }

    /* the decision piece: forms last, then advances to the centre at detail */
    const c = coreRef.current;
    if (c) {
      const tc = smooth(sectionRange(feature, 0.5, 0.95));
      const td = smooth(sectionRange(detail, 0.12, 0.72));
      let x = core.cluster[0] + (core.form[0] - core.cluster[0]) * tc;
      let y =
        core.cluster[1] +
        (core.form[1] - core.cluster[1]) * tc +
        Math.sin(tc * Math.PI) * 0.85 +
        (anim ? Math.sin(el * 1.25 + core.seed * 9.4) * 0.05 * (1 - tc) : 0);
      let z = core.cluster[2] + (core.form[2] - core.cluster[2]) * tc;
      x += (0 - x) * td;
      z += (0 - z) * td;
      y += (CORE_REST_Y - y) * td + Math.sin(td * Math.PI) * 0.3;
      c.position.set(x, y, z);
      c.rotation.y =
        core.rotCluster +
        (core.rotForm - core.rotCluster) * tc +
        td * Math.PI * 0.5;
      const pop = anim ? smooth(Math.min(Math.max((el - 0.7) / 0.8, 0), 1)) : 1;
      const breathe = anim ? 1 + Math.sin(el * 1.6) * 0.02 * td : 1;
      c.scale.setScalar(Math.max(pop, 0.001) * breathe);
      report(c, state.camera, 0.55 + 0.4 * td);
    }

    /* camera — slow ±8° orbit + pointer parallax, eased */
    const orbit = anim ? (Math.sin(el * 0.06) * 8 * Math.PI) / 180 : 0.45;
    const radius = 9.4 - intro * 0.6;
    _camTarget.set(
      Math.sin(orbit) * radius + (anim ? pointer.x * 0.45 : 0),
      5.35 + (anim ? pointer.y * 0.3 : 0),
      Math.cos(orbit) * radius,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    state.camera.lookAt(0, 0.15, 0);
  });

  return (
    <group ref={group}>
      <SceneLightRig />

      {/* the board — one low slab of frosted pane glass */}
      <RoundedBox args={[6.4, 0.1, 6.4]} radius={0.04} smoothness={4}>
        <GlassMaterial kind="pane" />
      </RoundedBox>
      <lineSegments geometry={grid}>
        <lineBasicMaterial color="#93a9ff" transparent opacity={0.32} />
      </lineSegments>

      {/* evidence pieces */}
      {pieces.map((s, i) => (
        <Piece
          key={i}
          spec={s}
          refCb={(m) => {
            pieceRefs.current[i] = m;
          }}
        />
      ))}

      {/* the decision piece — singular deep-blue accent */}
      <RoundedBox
        ref={coreRef}
        args={[0.58, 0.58, 0.58]}
        radius={0.12}
        smoothness={4}
        position={[core.cluster[0], core.cluster[1], core.cluster[2]]}
        rotation={[0, core.rotCluster, 0]}
      >
        <GlassMaterial kind="deep" />
      </RoundedBox>

      <ParticleField
        count={Math.floor(1400 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.32}
      />
    </group>
  );
}
