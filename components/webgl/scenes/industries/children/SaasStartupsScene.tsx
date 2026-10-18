'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, GradientGlassMaterial, type GlassKind } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';

/**
 * SaasStartupsScene — "The Flywheel".
 *
 * A great glass torus stands in the void — the flywheel. Hub and spokes
 * make its turn visible; small glass marbles (azure & ice mini-cubes) roll
 * along its inner track, lagging the rim. Through `feature` the wheel
 * gains momentum. Through `detail`, one deep marble glides to the release
 * point at the top of its orbit and escapes tangentially into an upward
 * arc — breakout growth — while the wheel keeps turning. The escaping
 * marble is reported to ProximityType as hotspot 'ind-saas-breakout'.
 *
 * Camera: near-frontal, slow breathing drift + pointer parallax. Zero
 * allocations in useFrame; reduced motion renders the escaped marble and
 * the turning wheel as a still.
 */

const TRACK_R = 1.62;
const CENTER: readonly [number, number] = [0.35, 0.05];
const MARBLE_COUNT = 8;
/** release angle on the track — clockwise travel launches up-right here */
const RELEASE = (100 * Math.PI) / 180;
const RELEASE_X = Math.sin(RELEASE);
const RELEASE_Y = -Math.cos(RELEASE);

/** marble tints — index 0 is the deep breakout marble */
const KINDS: readonly GlassKind[] = [
  'deep',
  'azure',
  'ice',
  'azure',
  'ice',
  'azure',
  'ice',
  'azure',
];

/* module-scope temp — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();

export default function SaasStartupsScene() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const wheelRef = useRef<THREE.Group>(null);
  const marbleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const omega = useRef(0);
  const report = useHotspotReporter('ind-saas-breakout');

  /* even distribution of marbles around the track */
  const phases = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < MARBLE_COUNT; i++)
      arr.push((i / MARBLE_COUNT) * Math.PI * 2);
    return arr;
  }, []);

  useFrame((state, delta) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const feature = anim ? getSectionProgress('feature') : 1;
    const detail = anim ? getSectionProgress('detail') : 1;
    const intro = anim ? smooth(Math.min(el / 1.6, 1)) : 1;

    const g = group.current;
    if (g) {
      g.position.y = -1.2 * (1 - intro);
      g.scale.setScalar(0.82 + 0.18 * intro);
    }

    /* the flywheel gains momentum through the feature section */
    const momentum = smooth(sectionRange(feature, 0.05, 0.9));
    if (anim) omega.current += delta * (0.16 + 1.0 * momentum) * intro;

    const w = wheelRef.current;
    if (w) w.rotation.z = -omega.current;

    /* marbles roll along the inner track, lagging the rim */
    const travel = omega.current * 0.82;
    const eLock = smooth(sectionRange(detail, 0.12, 0.42));
    const eEsc = smooth(sectionRange(detail, 0.38, 0.85));
    for (let i = 0; i < MARBLE_COUNT; i++) {
      const m = marbleRefs.current[i];
      if (!m) continue;
      const slosh = anim ? Math.sin(el * 0.85 + i * 1.9) * 0.05 : 0;
      let angle: number;
      if (i === 0) {
        /* the breakout marble glides to the release point, then launches */
        const trackAngle = phases[0] - travel + slosh * (1 - eLock);
        angle = RELEASE + (trackAngle - RELEASE) * (1 - eLock);
      } else {
        angle = phases[i] - travel + slosh;
      }
      m.position.set(
        CENTER[0] + Math.cos(angle) * TRACK_R,
        CENTER[1] + Math.sin(angle) * TRACK_R,
        0,
      );
      if (i === 0) {
        /* tangential escape, arcing upward out of the wheel */
        m.position.x += RELEASE_X * 2.15 * eEsc;
        m.position.y += RELEASE_Y * 2.15 * eEsc + 0.38 * eEsc * eEsc;
        m.position.z += 0.6 * eEsc;
        m.rotation.z = -travel * 2.2 - eEsc * 5.0;
        m.rotation.x = 0.4 + eEsc * 1.2;
        report(m, state.camera, 0.5 + 0.5 * eEsc);
      } else {
        m.rotation.z = -(phases[i] - travel) * 2.2;
        m.rotation.x = 0.4;
      }
      const pop = anim
        ? smooth(Math.min(Math.max((el - 0.25 - i * 0.08) / 0.65, 0), 1))
        : 1;
      m.scale.setScalar(Math.max(pop, 0.001));
    }

    /* camera — near-frontal, slow breathing drift + pointer parallax */
    const az = anim
      ? -0.1 + Math.sin(el * 0.045) * 0.05 + pointer.x * 0.045
      : -0.06;
    const radius = 9.4 - intro * 0.6;
    _camTarget.set(
      CENTER[0] + Math.sin(az) * radius,
      0.95 + (anim ? pointer.y * 0.22 : 0),
      Math.cos(az) * radius,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    state.camera.lookAt(CENTER[0], 0.15, 0);
  });

  return (
    <group ref={group}>
      <SceneLightRig />

      {/* the glass track — the signature flywheel in gradient glass */}
      <mesh position={[CENTER[0], CENTER[1], 0]}>
        <torusGeometry args={[TRACK_R, 0.3, 42, 128]} />
        <GradientGlassMaterial />
      </mesh>

      {/* hub + spokes — the visible turn of the wheel */}
      <group ref={wheelRef} position={[CENTER[0], CENTER[1], 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.5, 36]} />
          <GlassMaterial kind="azure" />
        </mesh>
        {[0, 1, 2].map((k) => (
          <group key={k} rotation={[0, 0, (k * Math.PI * 2) / 3]}>
            <RoundedBox
              args={[1.32, 0.07, 0.07]}
              radius={0.03}
              smoothness={3}
              position={[0.95, 0, 0]}
            >
              <GlassMaterial kind="pane" />
            </RoundedBox>
          </group>
        ))}
      </group>

      {/* the marbles — one deep, the rest azure & ice */}
      {phases.map((p, i) => (
        <RoundedBox
          key={i}
          ref={(m) => {
            marbleRefs.current[i] = m;
          }}
          args={[0.26, 0.26, 0.26]}
          radius={0.08}
          smoothness={4}
          position={[
            CENTER[0] + Math.cos(p) * TRACK_R,
            CENTER[1] + Math.sin(p) * TRACK_R,
            0,
          ]}
        >
          <GlassMaterial kind={KINDS[i]} />
        </RoundedBox>
      ))}

      <ParticleField
        count={Math.floor(1400 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.3}
      />
    </group>
  );
}
