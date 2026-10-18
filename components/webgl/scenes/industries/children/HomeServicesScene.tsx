'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
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
 * HomeServicesScene — "The Interlocking Gears".
 *
 * A train of three glass gears (azure → deep → ice) turns slowly in the
 * luminous void. Before `feature`, each hunts at its own slightly-off rate —
 * teeth slipping past one another. As `feature` progresses the train
 * phase-locks into exact mesh ratios, and a fourth small gear glides in on
 * an arc and seats into the train: the business running on rails. The deep
 * master gear is reported to ProximityType as hotspot
 * 'ind-home-deep-gear'.
 *
 * Camera: slow ±6° drift + pointer parallax. Zero allocations in useFrame;
 * reduced motion renders the locked, four-gear train as a still.
 */

interface GearSpec {
  teeth: number;
  pitchR: number;
  thickness: number;
  kind: GlassKind;
  /** meshed seat position (inner-group space) */
  pos: readonly [number, number, number];
  /** signed angular ratio relative to the deep master gear */
  ratio: number;
  /** mesh phase so teeth interleave once locked */
  phase: number;
  /** independent drift rate before phase-lock (rad/s) */
  slip: number;
}

/** trapezoid-tooth cog, extruded with a small bevel; module-matched teeth */
function buildGearGeometry(
  teeth: number,
  pitchR: number,
  toothDepth: number,
  thickness: number,
): THREE.ExtrudeGeometry {
  const rootR = pitchR - toothDepth / 2;
  const tipR = pitchR + toothDepth / 2;
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  let started = false;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const seg: ReadonlyArray<readonly [number, number]> = [
      [a, rootR],
      [a + step * 0.3, rootR],
      [a + step * 0.38, tipR],
      [a + step * 0.62, tipR],
      [a + step * 0.7, rootR],
    ];
    for (const [ang, r] of seg) {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (!started) {
        shape.moveTo(x, y);
        started = true;
      } else {
        shape.lineTo(x, y);
      }
    }
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, Math.max(rootR * 0.3, 0.12), 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.center();
  return geo;
}

/* the standing train: A (azure) → B (deep, master) → C (ice) */
const TOOTH_DEPTH = 0.22;
const GEARS: readonly GearSpec[] = [
  {
    teeth: 12,
    pitchR: 0.95,
    thickness: 0.3,
    kind: 'azure',
    pos: [-1.8, 1.19, -0.12],
    ratio: -16 / 12,
    phase: 0.13,
    slip: 0.09,
  },
  {
    teeth: 16,
    pitchR: 1.27,
    thickness: 0.38,
    kind: 'deep',
    pos: [0.1, 0.1, 0],
    ratio: 1,
    phase: 0,
    slip: 0,
  },
  {
    teeth: 10,
    pitchR: 0.79,
    thickness: 0.3,
    kind: 'ice',
    pos: [1.76, -1.06, 0.1],
    ratio: -16 / 10,
    phase: 0.21,
    slip: -0.11,
  },
];

/* the fourth gear — joins the train through `feature`, meshing off C */
const JOINER: GearSpec = {
  teeth: 7,
  pitchR: 0.56,
  thickness: 0.26,
  kind: 'azure',
  pos: [2.52, 0.03, 0.2],
  ratio: (16 / 10) * (10 / 7),
  phase: 0.4,
  slip: 0.16,
};
const JOINER_AWAY: readonly [number, number, number] = [4.1, -1.7, 1.0];

/* module-scope temp — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();

export default function HomeServicesScene() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const gearRefs = useRef<(THREE.Mesh | null)[]>([]);
  const joinerRef = useRef<THREE.Mesh>(null);
  const master = useRef(0);
  const report = useHotspotReporter('ind-home-deep-gear');

  const geometries = useMemo(
    () =>
      GEARS.map((g) =>
        buildGearGeometry(g.teeth, g.pitchR, TOOTH_DEPTH, g.thickness),
      ),
    [],
  );
  const joinerGeo = useMemo(
    () =>
      buildGearGeometry(
        JOINER.teeth,
        JOINER.pitchR,
        TOOTH_DEPTH,
        JOINER.thickness,
      ),
    [],
  );
  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose());
      joinerGeo.dispose();
    },
    [geometries, joinerGeo],
  );

  useFrame((state, delta) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const feature = anim ? getSectionProgress('feature') : 1;
    const intro = anim ? smooth(Math.min(el / 1.7, 1)) : 1;

    const g = group.current;
    if (g) g.position.y = -1.1 * (1 - intro);

    /* master angle accumulates only while animating */
    if (anim) master.current += delta * 0.22 * intro;
    const lock = smooth(sectionRange(feature, 0.08, 0.78));

    /* the standing train — slip fades as the train phase-locks */
    for (let i = 0; i < GEARS.length; i++) {
      const m = gearRefs.current[i];
      if (!m) continue;
      const s = GEARS[i];
      m.rotation.z =
        master.current * s.ratio +
        s.phase +
        (anim ? s.slip * el * (1 - lock) : 0);
      const pop = anim
        ? smooth(Math.min(Math.max((el - 0.1 - i * 0.13) / 0.75, 0), 1))
        : 1;
      m.scale.setScalar(Math.max(pop, 0.001));
    }

    /* the fourth gear glides in on an arc and seats into the train */
    const j = joinerRef.current;
    if (j) {
      const join = smooth(sectionRange(feature, 0.5, 0.95));
      const arc = Math.sin(join * Math.PI) * 0.55;
      j.position.set(
        JOINER_AWAY[0] + (JOINER.pos[0] - JOINER_AWAY[0]) * join,
        JOINER_AWAY[1] + (JOINER.pos[1] - JOINER_AWAY[1]) * join + arc,
        JOINER_AWAY[2] + (JOINER.pos[2] - JOINER_AWAY[2]) * join,
      );
      j.rotation.z =
        master.current * JOINER.ratio +
        JOINER.phase +
        (anim
          ? (JOINER.slip * 2.2 * (1 - join) + JOINER.slip * (1 - lock)) * el
          : 0);
      const pop = anim ? smooth(Math.min(Math.max((el - 0.45) / 0.8, 0), 1)) : 1;
      j.scale.setScalar(Math.max(pop, 0.001) * (0.55 + 0.45 * join));
    }

    /* hotspot rides the deep master gear */
    const deep = gearRefs.current[1];
    if (deep) report(deep, state.camera, 0.55 + 0.4 * lock);

    /* camera — slow ±6° drift + pointer parallax, eased */
    const az = anim ? Math.sin(el * 0.05) * 0.105 + pointer.x * 0.05 : 0.06;
    const radius = 9.7 - intro * 0.5;
    _camTarget.set(
      Math.sin(az) * radius - 0.3,
      1.05 + (anim ? pointer.y * 0.25 : 0),
      Math.cos(az) * radius,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    state.camera.lookAt(-0.25, 0.05, 0);
  });

  return (
    <group ref={group}>
      <SceneLightRig />

      {/* the gear train — centred and slightly scaled down */}
      <group position={[-0.35, -0.05, 0]} scale={0.92}>
        {GEARS.map((s, i) => (
          <mesh
            key={`${s.kind}-${s.teeth}`}
            ref={(m) => {
              gearRefs.current[i] = m;
            }}
            geometry={geometries[i]}
            position={[s.pos[0], s.pos[1], s.pos[2]]}
          >
            <GlassMaterial kind={s.kind} />
          </mesh>
        ))}
        <mesh
          ref={joinerRef}
          geometry={joinerGeo}
          position={[JOINER_AWAY[0], JOINER_AWAY[1], JOINER_AWAY[2]]}
        >
          <GlassMaterial kind={JOINER.kind} />
        </mesh>
      </group>

      <ParticleField
        count={Math.floor(1500 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.3}
      />
    </group>
  );
}
