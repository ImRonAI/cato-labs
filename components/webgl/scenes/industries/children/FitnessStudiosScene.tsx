'use client';

import React, { useMemo, useRef } from 'react';
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
 * FitnessStudiosScene — "The Interval".
 *
 * Eight glass bars in a row, pulsing like a heart-rate readout: a tall
 * gaussian pulse travels down the line with restless jitter on top —
 * high-energy, random effort. As `feature` scrolls in, the chaos smooths
 * into a strong steady beat: every bar moves on one rhythm in a
 * programmed work/rest pattern — training by design, not by accident.
 * The final bar is deep blue, the anchor of the program. A small crest
 * marker rides the tallest bar (settling over the deep bar) and reports
 * hotspot 'fitness-crest'.
 *
 * Camera: slow drift + pointer parallax. Zero allocations in useFrame;
 * reduced motion renders the steady program as a still.
 */

const BAR_COUNT = 8;
const SPACING = 0.62;
const FLOOR = -1.5;

const KINDS: readonly GlassKind[] = [
  'azure',
  'ice',
  'azure',
  'ice',
  'azure',
  'ice',
  'azure',
  'deep',
];

/* steady-program pattern — alternating work/rest intervals, deep bar tallest */
const PROGRAM: readonly number[] = [1.45, 0.85, 1.45, 0.85, 1.45, 0.85, 1.45, 1.75];

/* module-scope temps — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();

export default function FitnessStudiosScene() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const barRefs = useRef<(THREE.Mesh | null)[]>([]);
  const markerRef = useRef<THREE.Mesh>(null);
  const report = useHotspotReporter('fitness-crest');

  /* HDR azure for the crest marker — feeds the global bloom */
  const markerColor = useMemo(() => new THREE.Color(0.6, 0.9, 2.6), []);

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const feature = anim ? getSectionProgress('feature') : 1;
    const intro = anim ? smooth(Math.min(el / 1.8, 1)) : 1;
    const steady = smooth(sectionRange(feature, 0.15, 0.7));

    /* the traveling pulse position (hero chaos) and the shared beat (program) */
    const pulsePos = ((el * 2.4) % 10) - 1.2;
    const beat = anim ? Math.pow(Math.max(Math.sin(el * 2.2), 0), 1.5) : 0.85;

    let crestIdx = 0;
    let crestH = 0;

    for (let i = 0; i < BAR_COUNT; i++) {
      const m = barRefs.current[i];
      if (!m) continue;

      /* hero: a tall wave crest traveling the line + nervous jitter */
      const d = i - pulsePos;
      const pulse = Math.exp(-(d * d) / 1.2);
      const heroH =
        0.45 +
        2.0 * pulse +
        (anim ? 0.14 * Math.sin(el * 2.1 + i * 1.9) : 0);

      /* steady: one rhythm, programmed heights */
      const steadyH = 0.9 + beat * PROGRAM[i];

      let h = heroH * (1 - steady) + steadyH * steady;

      /* staggered assembly out of the floor */
      if (anim) {
        const pop = smooth(Math.min(Math.max((el - 0.15 - i * 0.07) / 0.7, 0), 1));
        h *= Math.max(pop, 0.001);
      }

      m.scale.y = Math.max(h, 0.001);
      m.position.y = FLOOR + h / 2;

      if (h > crestH) {
        crestH = h;
        crestIdx = i;
      }
    }

    /* crest marker — rides the tallest bar, settles over the deep anchor */
    const mk = markerRef.current;
    if (mk) {
      const tx =
        ((crestIdx - (BAR_COUNT - 1) / 2) * (1 - steady) +
          ((BAR_COUNT - 1) / 2) * steady) * SPACING;
      const lastH = 0.9 + beat * PROGRAM[BAR_COUNT - 1];
      const ty = FLOOR + crestH * (1 - steady) + lastH * steady + 0.34;
      mk.position.x += (tx - mk.position.x) * 0.12;
      mk.position.y += (ty - mk.position.y) * 0.12;
      const glow = 0.75 + 0.45 * beat;
      mk.scale.setScalar(glow * Math.max(intro, 0.001));
      report(mk, state.camera, 0.55 + 0.35 * beat);
    }

    /* assembly out of light */
    const g = group.current;
    if (g) g.position.y = -1.1 * (1 - intro);

    /* camera — slow drift + pointer parallax, eased */
    const orb = anim ? (Math.sin(el * 0.06) * 6 * Math.PI) / 180 : 0.28;
    const radius = 9.6 - intro * 0.6;
    _camTarget.set(
      Math.sin(orb) * radius + (anim ? pointer.x * 0.42 : 0),
      1.05 + (anim ? pointer.y * 0.26 : 0),
      Math.cos(orb) * radius,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    state.camera.lookAt(0, -0.45, 0);
  });

  return (
    <group ref={group}>
      <SceneLightRig />

      {/* the interval readout — eight glass bars */}
      {KINDS.map((kind, i) => (
        <RoundedBox
          key={i}
          ref={(m) => {
            barRefs.current[i] = m;
          }}
          args={[0.34, 1, 0.34]}
          radius={0.06}
          smoothness={4}
          position={[(i - (BAR_COUNT - 1) / 2) * SPACING, FLOOR + 0.5, 0]}
        >
          <GlassMaterial kind={kind} />
        </RoundedBox>
      ))}

      {/* the crest marker — a small point of light over the tallest bar */}
      <mesh ref={markerRef} position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial
          color={markerColor}
          toneMapped={false}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* fine dust */}
      <ParticleField
        count={Math.floor(1200 * q.particles)}
        opacity={0.3}
        drift={q.animate ? 0.11 : 0}
      />
    </group>
  );
}
