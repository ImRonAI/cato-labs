'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import {
  GlassMaterial,
  GradientGlassMaterial,
} from '../../../lib/materials';
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
 * HealthWellnessScene — "The Coherent Breath Gyroscope".
 *
 * Wellness is a membership rhythm: scattered one-off appointments finding a
 * calm, recurring cadence.
 *
 * Three concentric refractive glass rings (azure outer, crystal meridian,
 * deep-sapphire inner harmonic) surround a liquid-glass breath core above a
 * frosted sanctuary reflection plinth, accompanied by twelve prism cadence
 * pearls.
 *
 * Across the 280vh `moment` dwell (t: 0 → 1):
 *   • 0.04 → 0.48: From a single quiet azure breath ring, the crystal and
 *     deep harmonic rings unfurl from the liquid core onto orthogonal
 *     gyroscopic planes.
 *   • 0.36 → 0.82: Out-of-phase rhythms lock into a unified 4-7-7 harmonic
 *     breath cadence while twelve prism pearls spiral inward onto nodal
 *     meridians.
 *   • 0.74 → 0.98: Coherence crowns — the liquid core and deep ring warm with
 *     sapphire light and a serene ripple expands across the sanctuary plinth.
 *
 * Continues choreographing across `market-truth`, `feature`, `detail`, and
 * `cta`. Hotspot 'health-breath' rides the primary azure ring.
 */

const BREATH_CYCLE = 18;
const PEARL_COUNT = 12;
const PLINTH_Y = -1.92;
const COHERENCE_AT = 0.74;
const TAU_RATE = 4.8;

/** 4-7-7 breath cadence — returns 0..1 (1 = full inhale hold) */
function breathAt(t: number): number {
  const p = ((t % BREATH_CYCLE) + BREATH_CYCLE) % BREATH_CYCLE;
  if (p < 4) {
    const u = p / 4;
    return u * u * (3 - 2 * u);
  }
  if (p < 11) return 1;
  const w = 1 - (p - 11) / 7;
  return w * w * (3 - 2 * w);
}

interface PearlSpec {
  ringIdx: 0 | 1 | 2;
  nodeAngle: number;
  scatterR: number;
  scatterY: number;
  scatterZ: number;
  speed: number;
  phase: number;
}

function buildPearls(): PearlSpec[] {
  return Array.from({ length: PEARL_COUNT }, (_, i) => {
    const ringIdx = (i % 3) as 0 | 1 | 2;
    const slot = Math.floor(i / 3);
    const nodeAngle = (slot / 4) * Math.PI * 2 + ringIdx * 0.52;
    const seed = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
    const f1 = seed - Math.floor(seed);
    const f2 = (seed * 1.618) - Math.floor(seed * 1.618);
    return {
      ringIdx,
      nodeAngle,
      scatterR: 2.35 + f1 * 0.95,
      scatterY: (f2 - 0.5) * 2.1,
      scatterZ: ((f1 + f2) % 1 - 0.5) * 1.8,
      speed: 0.28 + f1 * 0.24,
      phase: i * 0.85,
    };
  });
}

const RING_RADII = [1.62, 1.18, 0.78] as const;

/* module-scope scratch objects — zero per-frame allocations */
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _pPos = new THREE.Vector3();
const _pTarget = new THREE.Vector3();
const _pQuat = new THREE.Quaternion();
const _pScale = new THREE.Vector3();
const _pMat = new THREE.Matrix4();
const _ringEuler = new THREE.Euler();
const _ringQuat = new THREE.Quaternion();
const _emissive = new THREE.Color('#2e4bff');

export default function HealthWellnessScene() {
  const q = useQuality();
  const lens = useLensShift();
  const moment = useRef(newMoment());
  const startAt = useRef<number | null>(null);

  const groupRef = useRef<THREE.Group>(null);
  const rigRef = useRef<THREE.Group>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const midRingRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const innerMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const coreGlowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const datumRingRef = useRef<THREE.Mesh>(null);
  const plinthRef = useRef<THREE.Mesh>(null);
  const haloMeshRef = useRef<THREE.Mesh>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloDustRef = useRef<THREE.Group>(null);
  const pearlsRef = useRef<THREE.InstancedMesh>(null);
  const tilt = useRef({ x: 0, y: 0 });

  const report = useHotspotReporter('health-breath');

  const pearls = useMemo(buildPearls, []);
  const rippleMat = useShockMaterial({
    speed: 0.92,
    width: 0.028,
    color: '#7d97ff',
    hot: '#eef2ff',
  });

  const haloGeo = useMemo(() => new THREE.RingGeometry(1.68, 3.18, 96), []);
  useEffect(() => () => haloGeo.dispose(), [haloGeo]);

  useFrame((state, delta) => {
    if (startAt.current === null) startAt.current = state.clock.elapsedTime;
    const el = state.clock.elapsedTime - startAt.current;
    const anim = q.animate;
    const dt = Math.min(delta, 0.05);

    const mo = readMoment(moment.current, anim);
    const settled = anim ? Math.max(mo.t, mo.leave > 0 ? 1 : 0) : 1;
    const truth = anim ? getSectionProgress('market-truth') : 0;
    const feature = anim ? getSectionProgress('feature') : 0;
    const detail = anim ? getSectionProgress('detail') : 0;
    const cta = anim ? getSectionProgress('cta') : 0;

    const intro = anim ? introAt(el, 0, 1.7) : 1;
    if (groupRef.current) {
      groupRef.current.position.y = -0.95 * (1 - intro);
    }

    /* moment choreography beats */
    const unfold = beat(settled, 0.04, 0.48);
    const coherence = beat(settled, 0.36, 0.82);
    const climax = beat(settled, 0.74, 0.96);
    const tau = settled > COHERENCE_AT ? (settled - COHERENCE_AT) * TAU_RATE : 0;

    /* 4-7-7 cadences — out of phase initially, locking into one breath */
    const bPrimary = anim ? breathAt(el) : 0.62;
    const bMidRaw = anim ? breathAt(el - 5.5) : 0.62;
    const bInnerRaw = anim ? breathAt(el - 11.0) : 0.62;
    const bMid = bMidRaw + (bPrimary - bMidRaw) * coherence;
    const bInner = bInnerRaw + (bPrimary - bInnerRaw) * coherence;

    /* detail subtly expands gyroscopic separation for inspection */
    const detailOpen = smooth(sectionRange(detail, 0.1, 0.75));
    const ctaCalm = smooth(sectionRange(cta, 0.1, 0.8));

    /* 1. Outer azure ring — primary breath */
    const outerScale = (1 + 0.14 * bPrimary) * (0.25 + 0.75 * intro);
    const r0 = outerRingRef.current;
    let r0Rx = 0.08;
    let r0Ry = -0.14;
    if (r0) {
      r0Rx =
        (anim ? Math.sin(el * 0.14) * 0.09 : 0.06) +
        coherence * 0.12 +
        detailOpen * 0.1;
      r0Ry =
        (anim ? Math.sin(el * 0.1) * 0.12 : -0.14) -
        coherence * 0.18 +
        feature * 0.22;
      r0.rotation.set(r0Rx, r0Ry, 0);
      r0.scale.setScalar(Math.max(outerScale, 0.001));
      report(r0, state.camera, 0.48 + 0.44 * Math.max(bPrimary, coherence));
    }

    /* 2. Middle crystal meridian ring — unfolds onto an inclined plane */
    const midPop = anim ? introAt(el, 0.18, 0.9) : 1;
    const midAppear = 0.22 + 0.78 * unfold;
    const midScale = midPop * midAppear * (1 + 0.12 * bMid);
    const r1 = midRingRef.current;
    let r1Rx = 0;
    let r1Ry = 0;
    let r1Rz = 0;
    if (r1) {
      r1Rx = unfold * (0.72 + detailOpen * 0.16) + (anim ? Math.cos(el * 0.16) * 0.07 : 0);
      r1Ry = unfold * 0.48 + (anim ? el * 0.08 * (0.35 + 0.65 * coherence) : 0.35);
      r1Rz = unfold * 0.24;
      r1.rotation.set(r1Rx, r1Ry, r1Rz);
      r1.scale.setScalar(Math.max(midScale, 0.001));
    }

    /* 3. Inner deep-sapphire harmonic ring — orthogonal retention core */
    const innerPop = anim ? introAt(el, 0.32, 0.95) : 1;
    const innerAppear = 0.16 + 0.84 * beat(settled, 0.14, 0.58);
    const innerScale = innerPop * innerAppear * (1 + 0.15 * bInner);
    const r2 = innerRingRef.current;
    let r2Rx = 0;
    let r2Ry = 0;
    let r2Rz = 0;
    if (r2) {
      r2Rx = -unfold * (0.86 + detailOpen * 0.14) + (anim ? Math.sin(el * 0.19 + 1.1) * 0.08 : 0);
      r2Ry = -unfold * 0.52 - (anim ? el * 0.11 * (0.3 + 0.7 * coherence) : 0.28);
      r2Rz = unfold * 0.58;
      r2.rotation.set(r2Rx, r2Ry, r2Rz);
      r2.scale.setScalar(Math.max(innerScale, 0.001));
    }
    if (innerMatRef.current) {
      innerMatRef.current.emissiveIntensity =
        (0.12 + 0.55 * climax + 0.22 * bInner) * (1 - ctaCalm * 0.25);
    }

    /* 4. Central liquid-glass breath core */
    const core = coreRef.current;
    if (core) {
      const corePop = anim ? introAt(el, 0.12, 0.85) : 1;
      const pulse = 0.78 + 0.28 * coherence + 0.14 * bPrimary;
      core.scale.setScalar(Math.max(corePop * pulse, 0.001));
      if (anim) {
        core.rotation.y = el * 0.18;
        core.rotation.x = Math.sin(el * 0.22) * 0.15;
      }
    }
    if (coreGlowMatRef.current) {
      coreGlowMatRef.current.opacity =
        (0.18 + 0.48 * coherence + 0.22 * bPrimary) * intro;
    }

    /* 5. Equatorial gradient-glass horizon ring + sanctuary plinth */
    if (datumRingRef.current) {
      const dPop = anim ? introAt(el, 0.28, 0.9) : 1;
      const dScale = dPop * (0.65 + 0.35 * unfold) * (1 + 0.04 * bPrimary);
      datumRingRef.current.scale.setScalar(Math.max(dScale, 0.001));
      datumRingRef.current.rotation.x = Math.PI / 2 - 0.18 + coherence * 0.08;
      datumRingRef.current.rotation.z = anim ? el * 0.04 : 0.2;
    }
    if (plinthRef.current) {
      const pPop = anim ? introAt(el, 0.05, 0.75) : 1;
      plinthRef.current.scale.set(Math.max(pPop, 0.001), 1, Math.max(pPop, 0.001));
    }

    /* 6. Instanced prism cadence pearls — spiral from ambient cloud onto ring nodes */
    const pm = pearlsRef.current;
    if (pm) {
      for (let i = 0; i < PEARL_COUNT; i++) {
        const s = pearls[i];
        const ringR =
          s.ringIdx === 0
            ? RING_RADII[0] * outerScale
            : s.ringIdx === 1
              ? RING_RADII[1] * midScale
              : RING_RADII[2] * innerScale;

        const ang =
          s.nodeAngle + (anim ? el * 0.22 * (s.ringIdx === 2 ? -1 : 1) : 0);
        _pTarget.set(Math.cos(ang) * ringR, Math.sin(ang) * ringR, 0);

        if (s.ringIdx === 0) _ringEuler.set(r0Rx, r0Ry, 0);
        else if (s.ringIdx === 1) _ringEuler.set(r1Rx, r1Ry, r1Rz);
        else _ringEuler.set(r2Rx, r2Ry, r2Rz);

        _ringQuat.setFromEuler(_ringEuler);
        _pTarget.applyQuaternion(_ringQuat);
        _pTarget.y += 0.15;

        /* scattered orbit before coherence */
        const driftAng = s.nodeAngle + (anim ? el * s.speed : 0) + s.phase;
        _pPos.set(
          Math.cos(driftAng) * s.scatterR,
          0.15 + s.scatterY + (anim ? Math.sin(el * 0.6 + s.phase) * 0.14 : 0),
          Math.sin(driftAng) * s.scatterR * 0.55 + s.scatterZ * 0.35,
        );

        const lock = beat(settled, 0.16 + (i / PEARL_COUNT) * 0.28, 0.76 + (i / PEARL_COUNT) * 0.14);
        _pPos.lerp(_pTarget, lock);

        const pPop = anim ? introAt(el, 0.2 + i * 0.04, 0.65) : 1;
        const pS = Math.max(pPop * (0.62 + 0.38 * lock) * (1 + 0.12 * bPrimary), 0.001);
        _pScale.setScalar(pS);
        _pQuat.copy(_ringQuat);
        _pMat.compose(_pPos, _pQuat, _pScale);
        pm.setMatrixAt(i, _pMat);
      }
      pm.instanceMatrix.needsUpdate = true;
    }

    /* 7. Luminous breath halo + floor ripple */
    if (haloMatRef.current) {
      haloMatRef.current.opacity =
        (0.05 + 0.15 * bPrimary + 0.08 * climax) * intro;
    }
    if (haloMeshRef.current) {
      haloMeshRef.current.scale.setScalar(
        Math.max(0.84 + 0.28 * bPrimary + 0.08 * coherence, 0.001),
      );
    }
    if (haloDustRef.current) {
      haloDustRef.current.scale.setScalar(Math.max(outerScale, 0.001));
    }
    rippleMat.uniforms.uTau.value = tau;

    /* 8. Pointer tilt on rig */
    if (rigRef.current) {
      tilt.current.x = damp(tilt.current.x, anim ? pointer.y * 0.05 : 0, 3.2, dt);
      tilt.current.y = damp(tilt.current.y, anim ? pointer.x * 0.11 : 0, 3.2, dt);
      rigRef.current.rotation.x = tilt.current.x;
      rigRef.current.rotation.y =
        tilt.current.y + truth * 0.12 - detailOpen * 0.16 + ctaCalm * 0.1;
    }

    /* 9. Camera & lens shift */
    const inMoment = anim ? Math.max(mo.enter * (1 - mo.leave), 0) : 0;
    const orbit =
      (anim ? Math.sin(el * 0.055) * 0.11 : 0.24) +
      inMoment * -0.08 +
      feature * 0.22 -
      detailOpen * 0.18 +
      ctaCalm * 0.08;
    const radius =
      (q.compact ? 11.4 : 8.7) -
      intro * 0.45 -
      inMoment * 0.65 +
      detailOpen * 0.35 +
      ctaCalm * 0.55;
    const camY =
      0.72 +
      inMoment * 0.22 +
      truth * 0.18 +
      detailOpen * 0.42 -
      ctaCalm * 0.2 +
      (anim ? pointer.y * 0.24 : 0);

    _cam.set(
      Math.sin(orbit) * radius + (anim ? pointer.x * 0.36 : 0),
      camY,
      Math.cos(orbit) * radius,
    );
    if (anim) state.camera.position.lerp(_cam, 0.05);
    else state.camera.position.copy(_cam);

    _look.set(0, 0.08 - inMoment * 0.06, 0);
    state.camera.lookAt(_look);

    const k = anim ? 0.05 : 1;
    if (q.compact) lens(0, -0.08 + inMoment * 0.08, k);
    else lens(0.22 * (1 - inMoment), -0.03 * (1 - inMoment), k);
  });

  return (
    <group ref={groupRef}>
      <SceneLightRig />

      <group ref={rigRef}>
        {/* soft luminous halo behind the gyroscope */}
        <mesh ref={haloMeshRef} geometry={haloGeo} position={[0, 0.15, -0.95]}>
          <meshBasicMaterial
            ref={haloMatRef}
            color="#8aa2ff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* sanctuary reflection plinth */}
        <mesh ref={plinthRef} position={[0, PLINTH_Y, 0]}>
          <cylinderGeometry args={[2.2, 2.32, 0.06, 72]} />
          <GlassMaterial kind="ice" />
        </mesh>

        {/* coherence ripple across the sanctuary plinth */}
        <ShockRing
          material={rippleMat}
          radius={2.8}
          position={[0, PLINTH_Y + 0.036, 0]}
        />

        {/* equatorial gradient-glass horizon datum */}
        <mesh
          ref={datumRingRef}
          position={[0, 0.15, 0]}
          rotation={[Math.PI / 2 - 0.18, 0, 0]}
        >
          <torusGeometry args={[2.08, 0.016, 16, 112]} />
          <GradientGlassMaterial opacity={0.9} />
        </mesh>

        {/* outer azure ring — primary breath */}
        <mesh ref={outerRingRef} position={[0, 0.15, 0]}>
          <torusGeometry args={[RING_RADII[0], 0.145, 44, 128]} />
          <GlassMaterial kind="azure" />
        </mesh>

        {/* middle crystal meridian ring */}
        <mesh ref={midRingRef} position={[0, 0.15, 0]}>
          <torusGeometry args={[RING_RADII[1], 0.105, 40, 112]} />
          <GlassMaterial kind="crystal" />
        </mesh>

        {/* inner deep-sapphire harmonic retention ring */}
        <mesh ref={innerRingRef} position={[0, 0.15, 0]}>
          <torusGeometry args={[RING_RADII[2], 0.082, 36, 96]} />
          <GlassMaterial
            ref={innerMatRef}
            kind="deep"
            emissive={_emissive}
            emissiveIntensity={0.12}
          />
        </mesh>

        {/* central liquid-glass breath core + inner sapphire seed */}
        <mesh ref={coreRef} position={[0, 0.15, 0]}>
          <icosahedronGeometry args={[0.34, 4]} />
          <GlassMaterial kind="liquid" />
          <mesh scale={0.38}>
            <sphereGeometry args={[0.34, 24, 24]} />
            <meshBasicMaterial
              ref={coreGlowMatRef}
              color="#2e4bff"
              transparent
              opacity={0.25}
              toneMapped={false}
            />
          </mesh>
        </mesh>

        {/* 12 instanced prism cadence pearls */}
        <instancedMesh
          ref={pearlsRef}
          args={[undefined, undefined, PEARL_COUNT]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.055, 20, 20]} />
          <GlassMaterial kind="prism" />
        </instancedMesh>

        {/* particle halo ringed around the breath */}
        <group ref={haloDustRef} position={[0, 0.15, 0]}>
          <ParticleField
            count={Math.floor(550 * q.particles)}
            spread={[3.1, 3.1, 1.3]}
            size={0.025}
            opacity={0.32}
            drift={q.animate ? 0.08 : 0}
            parallax={0.55}
          />
        </group>
      </group>

      <ParticleField
        count={Math.floor(850 * q.particles)}
        opacity={0.24}
        drift={q.animate ? 0.1 : 0}
      />
    </group>
  );
}
