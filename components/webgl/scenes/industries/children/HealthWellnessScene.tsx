'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';

/**
 * HealthWellnessScene — "The Breath".
 *
 * A single luminous azure glass ring breathing in a 4-7-7 cadence
 * (inhale 4s ease-in → hold 7s → exhale 7s ease-out, scale 1 → 1.18).
 * A soft additive halo and a flattened ParticleField halo ride the same
 * breath — halo opacity tracks scale. As `feature` scrolls in, a second,
 * smaller deep-blue ring joins at a half-cycle offset — two rhythms
 * finding coherence. Hotspot 'health-breath' rides the main ring.
 *
 * Camera: slow ±7° drift + pointer parallax. Zero allocations in useFrame;
 * reduced motion renders the mid-breath still with both rings present.
 */

/* 4-7-7 breath cadence — returns 0..1 (1 = fully inhaled) */
const BREATH_CYCLE = 18;
function breathAt(t: number): number {
  const p = ((t % BREATH_CYCLE) + BREATH_CYCLE) % BREATH_CYCLE;
  if (p < 4) {
    const u = p / 4;
    return u * u; /* inhale — ease-in */
  }
  if (p < 11) return 1; /* hold */
  const w = 1 - (p - 11) / 7;
  return w * w; /* exhale — ease-out */
}

/* module-scope temps — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();

export default function HealthWellnessScene() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMeshRef = useRef<THREE.Mesh>(null);
  const haloDustRef = useRef<THREE.Group>(null);
  const report = useHotspotReporter('health-breath');

  /* soft halo disc — imperatively allocated, so freed on unmount */
  const haloGeo = React.useMemo(
    () => new THREE.RingGeometry(1.72, 3.15, 96),
    [],
  );
  useEffect(() => () => haloGeo.dispose(), [haloGeo]);

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const feature = anim ? getSectionProgress('feature') : 1;
    const intro = anim ? smooth(Math.min(el / 1.9, 1)) : 1;

    const breath = anim ? breathAt(el) : 0.55;
    const ringScale = (1 + 0.18 * breath) * (0.2 + 0.8 * intro);

    /* the main ring — the breath itself */
    const r = ringRef.current;
    if (r) {
      r.scale.setScalar(Math.max(ringScale, 0.001));
      if (anim) {
        r.rotation.x = Math.sin(el * 0.12) * 0.1;
        r.rotation.y = Math.sin(el * 0.09) * 0.12;
      }
      report(r, state.camera, 0.45 + 0.45 * breath);
    }

    /* halo — opacity and spread track the breath */
    const hm = haloMatRef.current;
    if (hm) hm.opacity = (0.05 + 0.17 * breath) * intro;
    const h = haloMeshRef.current;
    if (h) h.scale.setScalar(Math.max(0.85 + 0.33 * breath, 0.001));
    const hd = haloDustRef.current;
    if (hd) hd.scale.setScalar(Math.max(ringScale, 0.001));

    /* the second rhythm — joins on feature, offset half a cycle */
    const r2 = ring2Ref.current;
    if (r2) {
      const join = smooth(sectionRange(feature, 0.14, 0.62));
      const breath2 = anim ? breathAt(el - BREATH_CYCLE / 2) : 0.55;
      r2.scale.setScalar(Math.max(join * (1 + 0.14 * breath2), 0.001));
      r2.position.y = -0.9 + (anim ? Math.sin(el * 0.35) * 0.06 * join : 0);
      if (anim) {
        r2.rotation.x = Math.sin(el * 0.1 + 1.7) * 0.12;
        r2.rotation.y = Math.sin(el * 0.08 + 0.6) * 0.14;
      }
    }

    /* assembly out of light */
    const g = group.current;
    if (g) g.position.y = -1.2 * (1 - intro);

    /* camera — slow drift + pointer parallax, eased */
    const orbit = anim ? (Math.sin(el * 0.055) * 7 * Math.PI) / 180 : 0.32;
    const radius = 9.2 - intro * 0.6;
    _camTarget.set(
      Math.sin(orbit) * radius + (anim ? pointer.x * 0.42 : 0),
      0.85 + (anim ? pointer.y * 0.28 : 0),
      Math.cos(orbit) * radius,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    state.camera.lookAt(0, 0.1, 0);
  });

  return (
    <group ref={group}>
      <SceneLightRig />

      {/* soft luminous halo behind the ring — breathes with it */}
      <mesh ref={haloMeshRef} geometry={haloGeo} position={[0, 0.15, -0.9]}>
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

      {/* the breath — one luminous azure glass ring */}
      <mesh ref={ringRef} position={[0, 0.15, 0]}>
        <torusGeometry args={[1.55, 0.16, 48, 128]} />
        <GlassMaterial kind="azure" />
      </mesh>

      {/* the second rhythm — a smaller deep ring in offset coherence */}
      <mesh ref={ring2Ref} position={[1.9, -0.9, -1.4]}>
        <torusGeometry args={[0.82, 0.1, 40, 96]} />
        <GlassMaterial kind="deep" />
      </mesh>

      {/* particle halo — flattened dust ringed around the breath */}
      <group ref={haloDustRef} position={[0, 0.15, 0]}>
        <ParticleField
          count={Math.floor(650 * q.particles)}
          spread={[3.1, 3.1, 1.3]}
          size={0.026}
          opacity={0.34}
          drift={q.animate ? 0.08 : 0}
          parallax={0.6}
        />
      </group>

      {/* ambient dust */}
      <ParticleField
        count={Math.floor(900 * q.particles)}
        opacity={0.24}
        drift={q.animate ? 0.1 : 0}
      />
    </group>
  );
}
