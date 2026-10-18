'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GradientGlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';

/**
 * DentalMedSpaScene — "The Polish".
 *
 * A small tooth-gem — a lathe-turned crystal form with a slight waist —
 * rotating slowly while a thin ring of azure light orbits it at varying
 * tilt angles: the polish pass. HDR-white sparkle points glint off its
 * edges at staggered deterministic intervals. As `feature` scrolls in,
 * the wandering orbit settles into a perfect halo at the gem's equator.
 * Hotspot 'dental-gem' rides the gem.
 *
 * Camera: slow drift + pointer parallax. Zero allocations in useFrame;
 * reduced motion renders the settled halo as a still.
 */

const SPARKLE_COUNT = 10;

/* deterministic PRNG — stable glint layout across renders */
function rand(seedStart: number) {
  let s = seedStart * 9973;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* gem profile — rounded capsule with a slight waist, lathe-turned */
function gemRadius(v: number): number {
  const bulge = Math.pow(Math.sin(Math.PI * v), 0.55);
  const waist = 0.82 + 0.18 * Math.pow(Math.abs(Math.cos(Math.PI * v)), 1.4);
  return 0.58 * bulge * waist + 0.001;
}

interface SparkleSpec {
  pos: readonly [number, number, number];
  period: number;
  phase: number;
}

/* module-scope temps — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();

export default function DentalMedSpaScene() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const gemRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<THREE.Group>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const sparkleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const report = useHotspotReporter('dental-gem');

  /* the gem — lathe geometry, freed on unmount */
  const gemGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const N = 26;
    for (let i = 0; i <= N; i++) {
      const v = i / N;
      pts.push(new THREE.Vector2(gemRadius(v), (v - 0.5) * 1.15));
    }
    return new THREE.LatheGeometry(pts, 56);
  }, []);
  useEffect(() => () => gemGeo.dispose(), [gemGeo]);

  /* glint points scattered over the gem's surface */
  const sparkles = useMemo<SparkleSpec[]>(() => {
    const r = rand(17);
    return Array.from({ length: SPARKLE_COUNT }, () => {
      const v = 0.16 + r() * 0.68;
      const theta = r() * Math.PI * 2;
      const rad = gemRadius(v) + 0.015;
      return {
        pos: [
          Math.cos(theta) * rad,
          (v - 0.5) * 1.15,
          Math.sin(theta) * rad,
        ] as const,
        period: 1.6 + r() * 2.8,
        phase: r(),
      };
    });
  }, []);

  /* HDR azure for the light ring, HDR white for glints — both feed bloom */
  const ringColor = useMemo(() => new THREE.Color(0.55, 0.8, 2.4), []);
  const glintColor = useMemo(() => new THREE.Color(2.2, 2.4, 3.0), []);

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const feature = anim ? getSectionProgress('feature') : 1;
    const intro = anim ? smooth(Math.min(el / 1.7, 1)) : 1;
    const settle = smooth(sectionRange(feature, 0.18, 0.72)); /* → perfect halo */

    /* the gem — slow proud rotation */
    const gem = gemRef.current;
    if (gem) {
      gem.scale.setScalar(Math.max(smooth(Math.min(intro * 1.15, 1)), 0.001));
      if (anim) {
        gem.rotation.y = el * 0.24;
        gem.rotation.z = Math.sin(el * 0.16) * 0.045;
      } else {
        gem.rotation.set(0, 0.6, 0);
      }
      report(gem, state.camera, 0.5 + 0.4 * settle);
    }

    /* the polish pass — wandering tilt lerps into a level halo */
    const orbit = orbitRef.current;
    if (orbit) {
      const wander = 1 - settle;
      orbit.rotation.x = anim
        ? (0.95 + Math.sin(el * 0.42) * 0.55) * wander
        : 0;
      orbit.rotation.z = anim ? Math.sin(el * 0.31 + 1.2) * 0.4 * wander : 0;
      orbit.rotation.y = anim ? el * (0.55 - 0.35 * settle) : 0.5;
      orbit.position.y = anim ? Math.sin(el * 0.5) * 0.28 * wander : 0;
      const rs = (1 - 0.1 * settle) * intro;
      orbit.scale.setScalar(Math.max(rs, 0.001));
    }
    const rm = ringMatRef.current;
    if (rm) rm.opacity = 0.92 * smooth(Math.min(Math.max((intro - 0.3) / 0.5, 0), 1));

    /* glints — sharp deterministic pulses riding the rotating gem */
    for (let i = 0; i < sparkles.length; i++) {
      const m = sparkleRefs.current[i];
      if (!m) continue;
      let glint = 0;
      if (anim) {
        const s = sparkles[i];
        const g = ((el / s.period + s.phase) % 1 + 1) % 1;
        if (g < 0.26) {
          const u = g / 0.26;
          glint = Math.pow(Math.sin(Math.PI * u), 3);
        }
      } else {
        glint = i % 4 === 0 ? 0.35 : 0; /* a few resting glints in the still */
      }
      m.scale.setScalar(Math.max(glint, 0.0001));
    }

    /* assembly out of light */
    const g = group.current;
    if (g) g.position.y = -1.1 * (1 - intro);

    /* camera — slow drift + pointer parallax, eased */
    const orb = anim ? (Math.sin(el * 0.06) * 7 * Math.PI) / 180 : 0.3;
    const radius = 8.6 - intro * 0.5;
    _camTarget.set(
      Math.sin(orb) * radius + (anim ? pointer.x * 0.4 : 0),
      1.0 + (anim ? pointer.y * 0.26 : 0),
      Math.cos(orb) * radius,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    state.camera.lookAt(0, 0.05, 0);
  });

  return (
    <group ref={group}>
      <SceneLightRig />

      {/* the gem — signature gradient glass, slight waist, carries its glints */}
      <mesh ref={gemRef} geometry={gemGeo} position={[0, 0.05, 0]}>
        <GradientGlassMaterial />
        {sparkles.map((s, i) => (
          <mesh
            key={i}
            ref={(m) => {
              sparkleRefs.current[i] = m;
            }}
            position={[s.pos[0], s.pos[1], s.pos[2]]}
          >
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshBasicMaterial
              color={glintColor}
              toneMapped={false}
              transparent
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </mesh>

      {/* the polish pass — a thin ring of azure light */}
      <group ref={orbitRef} position={[0, 0.05, 0]}>
        <mesh>
          <torusGeometry args={[1.02, 0.014, 16, 128]} />
          <meshBasicMaterial
            ref={ringMatRef}
            color={ringColor}
            toneMapped={false}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* fine dust */}
      <ParticleField
        count={Math.floor(1100 * q.particles)}
        opacity={0.3}
        drift={q.animate ? 0.09 : 0}
      />
    </group>
  );
}
