'use client';

import React, { useMemo, useRef } from 'react';
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
import {
  beat,
  damp,
  introAt,
  newMoment,
  readMoment,
  useLensShift,
} from '../lib-b/stage';
import ShockRing, { useShockMaterial } from '../lib-b/ShockRing';

/**
 * FitnessStudiosScene — "Kinetic Cadence Rings & Harmonic Pulse Sculpture".
 *
 * Twelve refractive glass cadence rings suspended along a precision optical
 * spine. In the hero they oscillate out of phase at erratic tilts — raw,
 * unprogrammed effort. Across the 280vh `moment` dwell (t: 0 → 1):
 *   • 0.04 → 0.56: Ring by ring, chaotic offsets snap onto the coaxial
 *     spine into a coherent helical cadence progression.
 *   • 0.48 → 0.88: A harmonic pulse wave sweeps left-to-right across all
 *     twelve locked rings, culminating at the deep-sapphire anchor ring
 *     with a luminous cadence shockwave.
 *
 * Continues choreographing camera + stage through `market-truth`, `feature`,
 * `detail`, and `cta`. Hotspot 'fitness-crest' rides the crest beacon.
 * Zero allocations in useFrame; reduced motion renders the locked harmonic crest.
 */

const RING_COUNT = 12;
const SPACING = 0.42;
const SPAN_HALF = ((RING_COUNT - 1) * SPACING) / 2;
const CREST_HIT = 0.8;
const TAU_RATE = 5.6;

const KINDS: readonly GlassKind[] = [
  'ice',
  'azure',
  'crystal',
  'ice',
  'azure',
  'crystal',
  'ice',
  'azure',
  'crystal',
  'ice',
  'azure',
  'deep',
];

/* programmed harmonic radius envelope — rises toward the deep anchor */
const RADII: readonly number[] = [
  0.66, 0.78, 0.9, 0.76, 0.88, 1.0, 0.82, 0.96, 1.08, 0.9, 1.06, 1.24,
];

interface RingChaos {
  dy: number;
  dz: number;
  rx: number;
  rz: number;
  freq: number;
  phase: number;
}

function rand(seedStart: number) {
  let s = seedStart * 9973;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _emissive = new THREE.Color('#2e4bff');

export default function FitnessStudiosScene() {
  const q = useQuality();
  const lens = useLensShift();
  const moment = useRef(newMoment());
  const startAt = useRef<number | null>(null);

  const groupRef = useRef<THREE.Group>(null);
  const rigRef = useRef<THREE.Group>(null);
  const spineRef = useRef<THREE.Mesh>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ringMats = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const nodesRef = useRef<THREE.InstancedMesh>(null);
  const crestRef = useRef<THREE.Mesh>(null);
  const tilt = useRef({ x: 0, y: 0 });

  const report = useHotspotReporter('fitness-crest');

  const chaos = useMemo<RingChaos[]>(() => {
    const r = rand(53);
    return Array.from({ length: RING_COUNT }, (_, i) => {
      const sgn = i % 2 === 0 ? 1 : -1;
      return {
        dy: sgn * (0.28 + r() * 0.42),
        dz: -sgn * (0.22 + r() * 0.36),
        rx: (r() - 0.5) * 1.15,
        rz: sgn * (0.35 + r() * 0.55),
        freq: 1.5 + r() * 1.8,
        phase: r() * Math.PI * 2,
      };
    });
  }, []);

  const shockMat = useShockMaterial({
    speed: 1.2,
    width: 0.03,
    color: '#2e4bff',
    hot: '#e8eeff',
  });
  const nodeColor = useMemo(() => new THREE.Color(0.65, 0.92, 2.7), []);
  const crestColor = useMemo(() => new THREE.Color(0.95, 1.25, 3.1), []);

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = now;
    const el = now - startAt.current;
    const anim = q.animate;
    const dt = Math.min(delta, 0.05);

    const mo = readMoment(moment.current, anim);
    const t = mo.t;
    const settled = anim ? Math.max(t, mo.leave > 0 ? 1 : 0) : 1;

    /* post-dwell section reads */
    const truth = smooth(sectionRange(getSectionProgress('market-truth'), 0.05, 0.9));
    const feat = smooth(sectionRange(getSectionProgress('feature'), 0.05, 0.9));
    const det = smooth(sectionRange(getSectionProgress('detail'), 0.08, 0.88));
    const cta = smooth(sectionRange(getSectionProgress('cta'), 0.05, 0.85));

    const intro = anim ? introAt(el, 0, 1.55) : 1;
    if (groupRef.current) {
      groupRef.current.position.y = -0.85 * (1 - intro);
    }

    /* optical spine materializes as rings lock */
    const spineLock = beat(settled, 0.08, 0.52);
    if (spineRef.current) {
      spineRef.current.scale.set(
        1,
        Math.max(intro * (0.15 + 0.85 * spineLock), 0.001),
        1,
      );
    }

    /* travelling harmonic wave position (0..RING_COUNT-1) */
    const sweepActive = beat(settled, 0.44, 0.86);
    const waveIdx =
      mo.leave > 0.08 && anim
        ? ((el * 2.6) % (RING_COUNT + 3)) - 1.5
        : -1.2 + sweepActive * (RING_COUNT + 0.4);

    let peakX = SPAN_HALF;
    let peakY = RADII[RING_COUNT - 1] + 0.22;
    let peakGlow = 0.5;

    const nInst = nodesRef.current;
    _q.identity();

    for (let i = 0; i < RING_COUNT; i++) {
      const ring = ringRefs.current[i];
      if (!ring) continue;
      const c = chaos[i];
      const x = i * SPACING - SPAN_HALF;

      /* per-ring coaxial lock from left to right */
      const lockStart = 0.04 + (i / RING_COUNT) * 0.36;
      const lock = beat(settled, lockStart, lockStart + 0.22);
      const loose = 1 - lock;

      /* erratic hero jitter vs unified harmonic breath */
      const jitterY = anim ? Math.sin(el * c.freq + c.phase) * 0.18 * loose : 0;
      const jitterRot = anim ? Math.cos(el * (c.freq * 0.8) + c.phase) * 0.22 * loose : 0;

      /* travelling cadence wave amplitude */
      const dist = i - waveIdx;
      const pulse =
        settled > 0.42
          ? Math.exp(-(dist * dist) / 1.45) * (anim ? 1 : i === RING_COUNT - 1 ? 1 : 0.25)
          : 0;
      const harmonicBreath = anim
        ? Math.sin(el * 2.1 - i * 0.42) * 0.045 * lock
        : 0;

      const y = c.dy * loose + jitterY + harmonicBreath * 1.4;
      const z = c.dz * loose;
      ring.position.set(x, y, z);

      /* helical torsional twist along the spine when locked */
      const lockedTwist = i * 0.18 + (anim ? el * 0.32 : 0.4) + pulse * 0.35;
      ring.rotation.set(
        c.rx * loose + Math.sin(lockedTwist) * 0.12 * lock,
        Math.PI / 2 + jitterRot,
        c.rz * loose + lockedTwist * lock,
      );

      const pop = anim ? introAt(el, 0.06 + i * 0.045, 0.7) : 1;
      const swell = 1 + pulse * 0.16 + harmonicBreath;
      ring.scale.setScalar(Math.max(pop * swell, 0.001));

      const mat = ringMats.current[i];
      if (mat) {
        mat.emissiveIntensity =
          pulse * 0.95 + (i === RING_COUNT - 1 ? lock * 0.32 : 0);
      }

      /* harmonic pulse node orbiting the upper arc of each ring */
      if (nInst) {
        const nodeAngle = Math.PI / 2 + (anim ? Math.sin(el * 1.4 + i * 0.5) * 0.35 * lock : 0);
        const rWorld = RADII[i] * swell;
        _p.set(
          x,
          y + Math.sin(nodeAngle) * rWorld,
          z + Math.cos(nodeAngle) * rWorld * 0.25,
        );
        const nScale = Math.max(pop * (0.55 + pulse * 0.95 + lock * 0.25), 0.0001);
        _s.setScalar(nScale);
        _m.compose(_p, _q, _s);
        nInst.setMatrixAt(i, _m);
      }

      if (i === RING_COUNT - 1) {
        peakX = x;
        peakY = y + RADII[i] * swell + 0.2;
        peakGlow = 0.55 + pulse * 0.45 + lock * 0.2;
      }
    }
    if (nInst) nInst.instanceMatrix.needsUpdate = true;

    /* cadence crest beacon over the deep anchor ring */
    const cr = crestRef.current;
    if (cr) {
      cr.position.x = damp(cr.position.x, peakX, 8, dt);
      cr.position.y = damp(cr.position.y, peakY, 8, dt);
      cr.scale.setScalar(Math.max(intro * peakGlow, 0.001));
      report(cr, state.camera, Math.min(1, peakGlow + truth * 0.12));
    }

    /* shockwave ring when the harmonic wave hits the deep anchor */
    const tau = settled > CREST_HIT ? (settled - CREST_HIT) * TAU_RATE : 0;
    shockMat.uniforms.uTau.value = anim && mo.leave < 0.8 ? tau : 0;

    /* pointer tilt + oblique sculptural presentation */
    if (rigRef.current) {
      tilt.current.x = damp(tilt.current.x, anim ? -pointer.y * 0.07 : 0, 3.5, dt);
      tilt.current.y = damp(
        tilt.current.y,
        -0.32 + (anim ? pointer.x * 0.12 : 0) + feat * 0.24 - det * 0.16,
        3.5,
        dt,
      );
      rigRef.current.rotation.x = 0.12 + tilt.current.x;
      rigRef.current.rotation.y = tilt.current.y;
    }

    /* camera choreography across hero → moment → market-truth → feature → detail → cta */
    const inMoment = anim ? mo.enter * (1 - mo.leave) : 0;
    const orb =
      (anim ? Math.sin(el * 0.05) * 0.07 : 0.14) -
      inMoment * 0.08 +
      feat * 0.18 -
      det * 0.14;
    const radius =
      (q.compact ? 11.8 : 9.1) -
      intro * 0.5 -
      inMoment * 0.9 -
      det * 0.45 +
      cta * 0.85;

    _cam.set(
      Math.sin(orb) * radius + (anim ? pointer.x * 0.36 : 0),
      0.95 + inMoment * 0.32 - feat * 0.15 + cta * 0.35 + (anim ? pointer.y * 0.22 : 0),
      Math.cos(orb) * radius,
    );
    if (anim) state.camera.position.lerp(_cam, 0.055);
    else state.camera.position.copy(_cam);

    _look.set(0.15 * spineLock, 0, 0);
    state.camera.lookAt(_look);

    /* lens shift: stage-right alongside copy, centred on the pinned moment */
    if (q.compact) lens(0, -0.08 + inMoment * 0.08);
    else lens(0.22 * (1 - inMoment), -0.03 * (1 - inMoment));
  });

  return (
    <group ref={groupRef}>
      <SceneLightRig />

      <group ref={rigRef}>
        {/* coaxial optical cadence spine */}
        <mesh ref={spineRef} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.022, 0.022, SPAN_HALF * 2 + 0.9, 20]} />
          <GlassMaterial kind="pane" />
        </mesh>

        {/* 12 sculpted refractive cadence rings */}
        {KINDS.map((kind, i) => (
          <mesh
            key={i}
            ref={(m) => {
              ringRefs.current[i] = m;
            }}
            position={[i * SPACING - SPAN_HALF, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <torusGeometry
              args={[
                RADII[i],
                i === RING_COUNT - 1 ? 0.052 : 0.034,
                22,
                84,
              ]}
            />
            <GlassMaterial
              ref={(mat) => {
                ringMats.current[i] = mat;
              }}
              kind={kind}
              emissive={_emissive}
              emissiveIntensity={0}
            />
          </mesh>
        ))}

        {/* 12 instanced harmonic pulse nodes (1 draw call) */}
        <instancedMesh
          ref={nodesRef}
          args={[undefined, undefined, RING_COUNT]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.036, 12, 12]} />
          <meshBasicMaterial
            color={nodeColor}
            toneMapped={false}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </instancedMesh>

        {/* cadence crest beacon over the deep anchor ring */}
        <mesh ref={crestRef} position={[SPAN_HALF, 1.45, 0]}>
          <sphereGeometry args={[0.058, 16, 16]} />
          <meshBasicMaterial
            color={crestColor}
            toneMapped={false}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* climax shockwave beneath the deep-sapphire anchor */}
        <ShockRing
          material={shockMat}
          radius={3.1}
          position={[SPAN_HALF, -1.35, 0]}
        />
      </group>

      <ParticleField
        count={Math.floor(1200 * q.particles)}
        opacity={0.3}
        drift={q.animate ? 0.11 : 0}
      />
    </group>
  );
}
