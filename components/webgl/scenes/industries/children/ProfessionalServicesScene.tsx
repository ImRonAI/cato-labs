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
 * ProfessionalServicesScene — "The Balance Beam".
 *
 * A slender crystal beam balanced on a small pyramid fulcrum. Three glass
 * weights ride the beam — two ice (the effort) clustered heavy on the left,
 * one azure (the outcome) far right — so the beam starts tipped. As the
 * `feature` section scrolls, each weight glides along the beam on a
 * staggered arc; as `detail` arrives the beam levels to equilibrium with a
 * slow, confident, damped settle. The beam's centre is reported to
 * ProximityType as hotspot 'ps-beam'.
 *
 * Camera: slow ±7° orbit + pointer parallax. Zero allocations in useFrame;
 * reduced motion renders the levelled equilibrium as a still.
 */

interface WeightSpec {
  kind: GlassKind;
  /** resting x on the beam before the slide (heavy side / far side) */
  from: number;
  /** equilibrium x on the beam after the slide */
  to: number;
  size: number;
  seed: number;
}

const BEAM_LEN = 5.4;
const BEAM_H = 0.13;
const BEAM_D = 0.46;
const FULCRUM_H = 0.52;
/** beam tips left (effort outweighs) until the plays rebalance it */
const TILT_0 = 0.13;

const WEIGHTS: readonly WeightSpec[] = [
  { kind: 'ice', from: -2.4, to: -1.55, size: 0.42, seed: 0.31 },
  { kind: 'ice', from: -1.9, to: -0.8, size: 0.42, seed: 0.72 },
  { kind: 'azure', from: 2.45, to: 1.7, size: 0.5, seed: 0.53 },
];

/* module-scope temp — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();

export default function ProfessionalServicesScene() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const fulcrumRef = useRef<THREE.Mesh>(null);
  const weightRefs = useRef<(THREE.Mesh | null)[]>([]);
  const report = useHotspotReporter('ps-beam');

  const weights = useMemo(() => WEIGHTS, []);

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const marketTruth = anim ? getSectionProgress('market-truth') : 1;
    const feature = anim ? getSectionProgress('feature') : 1;
    const detail = anim ? getSectionProgress('detail') : 1;
    const intro = anim ? smooth(Math.min(el / 1.7, 1)) : 1;

    const g = group.current;
    if (g) g.position.y = -1.15 * (1 - intro);

    /* the market truth steadies the wobble before the plays begin */
    const focus = smooth(sectionRange(marketTruth, 0.25, 0.95));

    /* weights: slide along the beam, staggered across `feature` */
    for (let i = 0; i < weights.length; i++) {
      const m = weightRefs.current[i];
      if (!m) continue;
      const s = weights[i];
      const t = smooth(sectionRange(feature, 0.06 + i * 0.15, 0.5 + i * 0.15));
      const x = s.from + (s.to - s.from) * t;
      const y =
        BEAM_H + s.size / 2 +
        Math.sin(t * Math.PI) * 0.16 +
        (anim ? Math.sin(el * 1.1 + s.seed * 8.2) * 0.02 * (1 - t) : 0);
      m.position.set(x, y, 0);
      m.rotation.y = anim ? Math.sin(el * 0.4 + s.seed * 5) * 0.1 * (1 - t) : 0;
      const pop = anim
        ? smooth(Math.min(Math.max((el - 0.4 - i * 0.12) / 0.7, 0), 1))
        : 1;
      m.scale.setScalar(Math.max(pop, 0.001));
    }

    /* the beam: tipped until `detail`, then a slow confident settle */
    const p = pivot.current;
    if (p) {
      const td = smooth(sectionRange(detail, 0.08, 0.72));
      const wobble = anim
        ? Math.sin(el * 0.9) * 0.012 * (1 - td) * (1 - focus * 0.65)
        : 0;
      const settle = Math.sin(td * Math.PI * 2) * 0.018 * (1 - td);
      p.rotation.z = TILT_0 * (1 - td) + wobble + settle;
    }

    /* fulcrum & beam assemble from light */
    const f = fulcrumRef.current;
    if (f) {
      const pop = anim ? smooth(Math.min(Math.max((el - 0.1) / 0.6, 0), 1)) : 1;
      f.scale.setScalar(Math.max(pop, 0.001));
    }
    const b = beamRef.current;
    if (b) {
      const pop = anim ? smooth(Math.min(Math.max((el - 0.28) / 0.7, 0), 1)) : 1;
      b.scale.set(Math.max(pop, 0.001), 1, 1);
      report(b, state.camera, 0.5 + 0.45 * smooth(sectionRange(detail, 0.1, 0.8)));
    }

    /* camera — slow ±7° orbit + pointer parallax, eased */
    const orbit = anim ? (Math.sin(el * 0.06) * 7 * Math.PI) / 180 : 0.42;
    const radius = 9.3 - intro * 0.6;
    _camTarget.set(
      Math.sin(orbit) * radius + (anim ? pointer.x * 0.45 : 0),
      4.6 + (anim ? pointer.y * 0.3 : 0),
      Math.cos(orbit) * radius,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    state.camera.lookAt(0, 0.4, 0);
  });

  return (
    <group ref={group}>
      <SceneLightRig />

      {/* the fulcrum — a small crystal pyramid */}
      <mesh ref={fulcrumRef} position={[0, FULCRUM_H / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.4, FULCRUM_H, 4]} />
        <GlassMaterial kind="crystal" />
      </mesh>

      {/* the beam — pivots on the fulcrum tip */}
      <group ref={pivot} position={[0, FULCRUM_H, 0]} rotation={[0, 0, TILT_0]}>
        <RoundedBox
          ref={beamRef}
          args={[BEAM_LEN, BEAM_H, BEAM_D]}
          radius={0.05}
          smoothness={4}
          position={[0, BEAM_H / 2, 0]}
        >
          <GlassMaterial kind="azure" />
        </RoundedBox>

        {/* the weights — effort (ice) and outcome (azure) */}
        {weights.map((s, i) => (
          <RoundedBox
            key={i}
            ref={(m) => {
              weightRefs.current[i] = m;
            }}
            args={[s.size, s.size, s.size]}
            radius={0.07}
            smoothness={4}
            position={[s.from, BEAM_H + s.size / 2, 0]}
          >
            <GlassMaterial kind={s.kind} />
          </RoundedBox>
        ))}
      </group>

      <ParticleField
        count={Math.floor(1300 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.32}
      />
    </group>
  );
}
