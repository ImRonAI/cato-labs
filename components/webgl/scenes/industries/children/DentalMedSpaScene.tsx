'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, GradientGlassMaterial } from '../../../lib/materials';
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
 * DentalMedSpaScene — "The Precision Optical Prism & Symmetry Arc".
 *
 * A lathe-turned refractive crown prism surrounded by six optical meniscus
 * facets, twin calibrated symmetry meridian arcs, and an equatorial polish
 * light ring. Across the 280vh `moment` dwell (t: 0 → 1):
 *   • 0.00 → 0.55: Eccentric, tilted optical facets glide radially and
 *     snap pair-by-pair into bilateral aesthetic symmetry around the crown.
 *   • 0.36 → 0.76: Twin meridian caliper arcs and the wandering azure
 *     polish pass lock into coaxial & equatorial alignment.
 *   • 0.72 → 1.00: Coaxial lock triggers a luminous caustic shock-ring and
 *     focuses an axial sapphire-ice light beam through the prism apex.
 *
 * Continues choreographing across `market-truth`, `feature`, `detail`,
 * `faq`, and `cta`. Hotspot 'dental-gem' rides the central prism.
 * Zero allocations in useFrame; reduced motion renders the locked assembly.
 */

const PETAL_COUNT = 6;
const SPARKLE_COUNT = 12;
const LOCK_AT = 0.72;
const TAU_RATE = 5.4;

function rand(seedStart: number) {
  let s = seedStart * 9973;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function gemRadius(v: number): number {
  const bulge = Math.pow(Math.sin(Math.PI * v), 0.52);
  const waist = 0.82 + 0.18 * Math.pow(Math.abs(Math.cos(Math.PI * v)), 1.4);
  return 0.58 * bulge * waist + 0.001;
}

interface SparkleSpec {
  pos: readonly [number, number, number];
  period: number;
  phase: number;
}

interface PetalSpec {
  angle: number;
  pairIdx: number;
  driftR: number;
  driftY: number;
  tiltX: number;
  tiltZ: number;
}

const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

export default function DentalMedSpaScene() {
  const q = useQuality();
  const lens = useLensShift();
  const moment = useRef(newMoment());
  const startAt = useRef<number | null>(null);

  const groupRef = useRef<THREE.Group>(null);
  const rigRef = useRef<THREE.Group>(null);
  const gemRef = useRef<THREE.Mesh>(null);
  const coreMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const petalRefs = useRef<(THREE.Group | null)[]>([]);
  const arcARef = useRef<THREE.Mesh>(null);
  const arcBRef = useRef<THREE.Mesh>(null);
  const haloGroupRef = useRef<THREE.Group>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const beamMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const sparklesRef = useRef<THREE.InstancedMesh>(null);
  const tilt = useRef({ x: 0, y: 0 });

  const report = useHotspotReporter('dental-gem');

  const gemGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const N = 30;
    for (let i = 0; i <= N; i++) {
      const v = i / N;
      pts.push(new THREE.Vector2(gemRadius(v), (v - 0.5) * 1.24));
    }
    return new THREE.LatheGeometry(pts, 64);
  }, []);
  useEffect(() => () => gemGeo.dispose(), [gemGeo]);

  const petals = useMemo<PetalSpec[]>(() => {
    const r = rand(41);
    return Array.from({ length: PETAL_COUNT }, (_, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      return {
        angle: (i / PETAL_COUNT) * Math.PI * 2,
        pairIdx: Math.floor(i / 2), // 3 bilateral pairs
        driftR: 0.78 + r() * 0.45,
        driftY: side * (0.32 + r() * 0.28),
        tiltX: side * (0.45 + r() * 0.35),
        tiltZ: -side * (0.38 + r() * 0.3),
      };
    });
  }, []);

  const sparkles = useMemo<SparkleSpec[]>(() => {
    const r = rand(17);
    return Array.from({ length: SPARKLE_COUNT }, () => {
      const v = 0.16 + r() * 0.68;
      const theta = r() * Math.PI * 2;
      const rad = gemRadius(v) + 0.02;
      return {
        pos: [
          Math.cos(theta) * rad,
          (v - 0.5) * 1.24,
          Math.sin(theta) * rad,
        ] as const,
        period: 1.6 + r() * 2.4,
        phase: r(),
      };
    });
  }, []);

  const shockMat = useShockMaterial({
    speed: 1.15,
    width: 0.028,
    color: '#7d97ff',
    hot: '#ffffff',
  });
  const ringColor = useMemo(() => new THREE.Color(0.58, 0.84, 2.5), []);
  const glintColor = useMemo(() => new THREE.Color(2.2, 2.45, 3.1), []);
  const beamColor = useMemo(() => new THREE.Color(0.55, 0.82, 2.35), []);

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
      groupRef.current.position.y = -0.9 * (1 - intro);
    }

    /* shock-ring caustic sweep at bilateral symmetry lock */
    const tau = settled > LOCK_AT ? (settled - LOCK_AT) * TAU_RATE : 0;
    shockMat.uniforms.uTau.value = anim && mo.leave < 0.8 ? tau : 0;

    /* central crown prism + sapphire seed */
    const lockFactor = beat(settled, 0.55, 0.82);
    const gem = gemRef.current;
    if (gem) {
      const pop = anim ? introAt(el, 0.05, 0.85) : 1;
      gem.scale.setScalar(Math.max(pop, 0.001) * (1 + lockFactor * 0.05));
      if (anim) {
        gem.rotation.y = el * (0.22 - 0.06 * lockFactor) + settled * 0.85;
        gem.rotation.z = Math.sin(el * 0.28) * 0.045 * (1 - lockFactor * 0.7);
      } else {
        gem.rotation.set(0, 0.62, 0);
      }
      report(gem, state.camera, 0.52 + 0.38 * lockFactor + 0.1 * truth);
    }
    if (coreMatRef.current) {
      coreMatRef.current.emissiveIntensity = 0.35 + lockFactor * 0.95 + det * 0.25;
    }

    /* 6 bilateral optical meniscus facets snap coaxially pair-by-pair */
    for (let i = 0; i < PETAL_COUNT; i++) {
      const pg = petalRefs.current[i];
      if (!pg) continue;
      const spec = petals[i];
      const pairStart = 0.06 + spec.pairIdx * 0.14;
      const align = beat(settled, pairStart, pairStart + 0.32);
      const unaligned = 1 - align;
      const idleFloat = anim
        ? Math.sin(el * 0.75 + i * 1.1) * 0.05 * unaligned
        : 0;
      const rad = 0.92 + spec.driftR * unaligned + det * 0.08;
      pg.position.set(
        Math.cos(spec.angle) * rad,
        0.05 + spec.driftY * unaligned + idleFloat,
        Math.sin(spec.angle) * rad,
      );
      pg.rotation.set(
        spec.tiltX * unaligned,
        -spec.angle + Math.PI / 2,
        spec.tiltZ * unaligned + 0.16 * align,
      );
      const pop = anim ? introAt(el, 0.14 + i * 0.06, 0.75) : 1;
      pg.scale.setScalar(Math.max(pop, 0.001));
    }

    /* twin calibrated symmetry meridian arcs align orthogonally */
    const arcAlign = beat(settled, 0.34, 0.74);
    if (arcARef.current) {
      const pop = anim ? introAt(el, 0.25, 0.8) : 1;
      arcARef.current.scale.setScalar(Math.max(pop, 0.001));
      arcARef.current.rotation.set(
        (1 - arcAlign) * 0.65,
        (anim ? el * 0.08 : 0.2) * (1 - arcAlign * 0.6) + 0.35,
        (1 - arcAlign) * -0.42,
      );
    }
    if (arcBRef.current) {
      const pop = anim ? introAt(el, 0.32, 0.8) : 1;
      arcBRef.current.scale.setScalar(Math.max(pop, 0.001));
      arcBRef.current.rotation.set(
        (1 - arcAlign) * -0.58,
        (anim ? -el * 0.09 : -0.2) * (1 - arcAlign * 0.6) + 0.35 + Math.PI / 2,
        (1 - arcAlign) * 0.48,
      );
    }

    /* equatorial polish halo — wandering tilt settles into crisp level equator */
    const haloAlign = beat(settled, 0.42, 0.78);
    if (haloGroupRef.current) {
      const wander = 1 - haloAlign;
      haloGroupRef.current.rotation.x =
        Math.PI / 2 + (anim ? (0.85 + Math.sin(el * 0.5) * 0.45) * wander : 0);
      haloGroupRef.current.rotation.z = anim
        ? Math.sin(el * 0.36 + 1.1) * 0.42 * wander
        : 0;
      haloGroupRef.current.position.y =
        0.05 + (anim ? Math.sin(el * 0.6) * 0.22 * wander : 0);
      haloGroupRef.current.scale.setScalar(Math.max(intro * (1.06 - 0.06 * haloAlign), 0.001));
    }
    if (haloMatRef.current) {
      haloMatRef.current.opacity =
        (0.55 + 0.4 * haloAlign) * smooth(Math.min(Math.max((intro - 0.2) / 0.6, 0), 1));
    }

    /* axial optical focus beam ignites at coaxial lock */
    const beamOn = beat(settled, 0.68, 0.94);
    if (beamRef.current) {
      beamRef.current.scale.set(1, Math.max(beamOn * intro, 0.0001), 1);
    }
    if (beamMatRef.current) {
      beamMatRef.current.opacity = beamOn * 0.46 * intro;
    }

    /* instanced specular glints riding the rotating crown */
    const sInst = sparklesRef.current;
    if (sInst && gem) {
      _q.identity();
      for (let i = 0; i < SPARKLE_COUNT; i++) {
        const sp = sparkles[i];
        let glint = 0;
        if (anim) {
          const g = (((el / sp.period + sp.phase) % 1) + 1) % 1;
          if (g < 0.28) {
            glint = Math.pow(Math.sin((Math.PI * g) / 0.28), 3);
          }
          glint = Math.max(glint, lockFactor * (i % 3 === 0 ? 0.42 : 0.12));
        } else {
          glint = i % 3 === 0 ? 0.48 : 0.12;
        }
        _p.set(sp.pos[0], sp.pos[1], sp.pos[2]).applyEuler(gem.rotation);
        _p.y += 0.05;
        _s.setScalar(Math.max(glint * intro, 0.0001));
        _m.compose(_p, _q, _s);
        sInst.setMatrixAt(i, _m);
      }
      sInst.instanceMatrix.needsUpdate = true;
    }

    /* pointer tilt on the whole optical rig */
    if (rigRef.current) {
      tilt.current.x = damp(tilt.current.x, anim ? -pointer.y * 0.08 : 0, 3.5, dt);
      tilt.current.y = damp(
        tilt.current.y,
        (anim ? pointer.x * 0.14 : 0) + feat * 0.22 - det * 0.14,
        3.5,
        dt,
      );
      rigRef.current.rotation.x = tilt.current.x;
      rigRef.current.rotation.y = tilt.current.y;
    }

    /* camera choreography across hero → moment → market-truth → feature → detail → cta */
    const inMoment = anim ? mo.enter * (1 - mo.leave) : 0;
    const orb =
      (anim ? Math.sin(el * 0.055) * 0.08 : 0.18) +
      inMoment * -0.1 +
      feat * 0.24 -
      det * 0.18;
    const radius =
      (q.compact ? 10.6 : 8.2) -
      intro * 0.45 -
      inMoment * 0.85 -
      det * 0.45 +
      cta * 0.75;
    _cam.set(
      Math.sin(orb) * radius + (anim ? pointer.x * 0.34 : 0),
      0.92 + inMoment * 0.38 - feat * 0.18 + cta * 0.35 + (anim ? pointer.y * 0.22 : 0),
      Math.cos(orb) * radius,
    );
    if (anim) state.camera.position.lerp(_cam, 0.055);
    else state.camera.position.copy(_cam);

    _look.set(0, 0.05 + det * 0.04, 0);
    state.camera.lookAt(_look);

    /* lens shift: stage-right alongside copy, dead-centre on the pinned moment */
    if (q.compact) lens(0, -0.08 + inMoment * 0.08);
    else lens(0.22 * (1 - inMoment), -0.03 * (1 - inMoment));
  });

  return (
    <group ref={groupRef}>
      <SceneLightRig />

      <group ref={rigRef}>
        {/* central refractive crown prism + inner sapphire focus seed */}
        <mesh ref={gemRef} geometry={gemGeo} position={[0, 0.05, 0]}>
          <GradientGlassMaterial />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <octahedronGeometry args={[0.19, 1]} />
          <GlassMaterial
            ref={coreMatRef}
            kind="deep"
            emissive="#2e4bff"
            emissiveIntensity={0.4}
          />
        </mesh>

        {/* 6 bilateral optical meniscus facets */}
        {petals.map((_, i) => (
          <group
            key={i}
            ref={(g) => {
              petalRefs.current[i] = g;
            }}
          >
            <RoundedBox
              args={[0.38, 0.64, 0.075]}
              radius={0.032}
              smoothness={4}
            >
              <GlassMaterial kind={i % 2 === 0 ? 'prism' : 'crystal'} />
            </RoundedBox>
          </group>
        ))}

        {/* twin calibrated symmetry meridian caliper arcs */}
        <mesh ref={arcARef} position={[0, 0.05, 0]}>
          <torusGeometry args={[1.38, 0.014, 16, 112]} />
          <GlassMaterial kind="azure" />
        </mesh>
        <mesh ref={arcBRef} position={[0, 0.05, 0]}>
          <torusGeometry args={[1.52, 0.011, 14, 112]} />
          <GlassMaterial kind="ice" />
        </mesh>

        {/* equatorial azure polish pass */}
        <group ref={haloGroupRef} position={[0, 0.05, 0]}>
          <mesh>
            <torusGeometry args={[1.18, 0.015, 16, 128]} />
            <meshBasicMaterial
              ref={haloMatRef}
              color={ringColor}
              toneMapped={false}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* axial focused sapphire-ice beam */}
        <mesh ref={beamRef} position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 2.9, 16, 1, true]} />
          <meshBasicMaterial
            ref={beamMatRef}
            color={beamColor}
            toneMapped={false}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* instanced surface glints (1 draw call) */}
        <instancedMesh
          ref={sparklesRef}
          args={[undefined, undefined, SPARKLE_COUNT]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.024, 10, 10]} />
          <meshBasicMaterial
            color={glintColor}
            toneMapped={false}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </instancedMesh>

        {/* symmetry lock caustic ring */}
        <ShockRing material={shockMat} radius={2.8} position={[0, 0.05, 0]} />
      </group>

      <ParticleField
        count={Math.floor(1100 * q.particles)}
        opacity={0.3}
        drift={q.animate ? 0.09 : 0}
      />
    </group>
  );
}
