'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import {
  GlassMaterial,
  GradientGlassMaterial,
  type GlassKind,
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
 * HospitalityScene — "The Atrium Welcome Constellation".
 *
 * A glass atrium: an ice-glass lobby floor, a frosted pane concierge desk
 * carrying a direct-booking keycard prism, an overhead gradient-glass canopy
 * halo, and five suspended glass pendants (one singular deep-sapphire welcome
 * light at the centre).
 *
 * Across the 280vh `moment` dwell (t: 0 → 1):
 *   • 0.04 → 0.52: The five pendants unfurl downward from the canopy halo in
 *     a staggered architectural cascade.
 *   • 0.44 → 0.88: Out-of-phase sways converge into one serene atrium breath;
 *     the deep-sapphire welcome pendant descends toward the concierge desk,
 *     brightening the keycard prism and casting a luminous reflection ring
 *     across the lobby floor.
 *
 * Continues choreographing across `market-truth`, `feature`, `detail`, and
 * `cta`. Hotspot 'hospitality-welcome' rides the deep pendant.
 */

interface PendantSpec {
  anchor: readonly [number, number, number];
  len: number;
  kind: GlassKind;
  radius: number;
  phase: number;
  amp: number;
  speed: number;
  core: string;
  deep?: boolean;
}

const CANOPY_Y = 2.95;
const ANCHOR_Y = CANOPY_Y - 0.04;
const FLOOR_Y = -1.62;
const WELCOME_AT = 0.72;
const TAU_RATE = 5.0;

const PENDANTS: readonly PendantSpec[] = [
  {
    anchor: [-1.45, ANCHOR_Y, -0.28],
    len: 1.32,
    kind: 'ice',
    radius: 0.15,
    phase: 0.4,
    amp: 0.055,
    speed: 0.92,
    core: '#aebdff',
  },
  {
    anchor: [-0.72, ANCHOR_Y, 0.48],
    len: 1.62,
    kind: 'crystal',
    radius: 0.16,
    phase: 1.5,
    amp: 0.05,
    speed: 0.86,
    core: '#c9d7ff',
  },
  {
    anchor: [0.05, ANCHOR_Y, 0.06],
    len: 1.96,
    kind: 'deep',
    radius: 0.21,
    phase: 2.3,
    amp: 0.065,
    speed: 0.78,
    core: '#2e4bff',
    deep: true,
  },
  {
    anchor: [0.82, ANCHOR_Y, -0.44],
    len: 1.48,
    kind: 'prism',
    radius: 0.155,
    phase: 3.4,
    amp: 0.048,
    speed: 0.98,
    core: '#dce4ff',
  },
  {
    anchor: [1.52, ANCHOR_Y, 0.22],
    len: 1.15,
    kind: 'azure',
    radius: 0.145,
    phase: 4.5,
    amp: 0.045,
    speed: 1.04,
    core: '#93a9ff',
  },
];

const DEEP_INDEX = 2;
const SHARED_SPEED = 0.82;
const SHARED_AMP = 0.024;

const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _dim = new THREE.Color('#2e4bff');
const _bright = new THREE.Color('#dce4ff');
const _core = new THREE.Color();

export default function HospitalityScene() {
  const q = useQuality();
  const lens = useLensShift();
  const moment = useRef(newMoment());
  const startAt = useRef<number | null>(null);

  const groupRef = useRef<THREE.Group>(null);
  const rigRef = useRef<THREE.Group>(null);
  const canopyRef = useRef<THREE.Mesh>(null);
  const deskRef = useRef<THREE.Mesh>(null);
  const keycardRef = useRef<THREE.Mesh>(null);
  const keycardMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const lineRefs = useRef<(THREE.Mesh | null)[]>([]);
  const shadeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const coreRefs = useRef<(THREE.Mesh | null)[]>([]);
  const tilt = useRef({ x: 0, y: 0 });

  const report = useHotspotReporter('hospitality-welcome');
  const pendants = useMemo(() => PENDANTS, []);
  const floorGlow = useShockMaterial({
    speed: 0.95,
    width: 0.032,
    color: '#5f7dff',
    hot: '#dce4ff',
  });

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = now;
    const el = now - startAt.current;
    const anim = q.animate;
    const dt = Math.min(delta, 0.05);

    const mo = readMoment(moment.current, anim);
    const t = mo.t;
    const settled = anim ? Math.max(t, mo.leave > 0 ? 1 : 0) : 1;

    const truth = smooth(sectionRange(getSectionProgress('market-truth'), 0.05, 0.9));
    const feat = smooth(sectionRange(getSectionProgress('feature'), 0.05, 0.9));
    const det = smooth(sectionRange(getSectionProgress('detail'), 0.08, 0.88));
    const cta = smooth(sectionRange(getSectionProgress('cta'), 0.05, 0.85));

    const intro = anim ? introAt(el, 0, 1.55) : 1;
    if (groupRef.current) {
      groupRef.current.position.y = -0.85 * (1 - intro);
    }

    if (canopyRef.current) {
      const pop = anim ? introAt(el, 0.05, 0.7) : 1;
      canopyRef.current.scale.setScalar(Math.max(pop, 0.001));
    }
    if (deskRef.current) {
      const pop = anim ? introAt(el, 0.35, 0.75) : 1;
      deskRef.current.scale.setScalar(Math.max(pop, 0.001));
    }

    /* moment beats: cascade unfurl (0.04→0.52), welcome descend & phase-lock (0.44→0.88) */
    const welcome = beat(settled, 0.44, 0.88);
    const coherence = Math.min(1, beat(settled, 0.52, 0.92) + det * 0.25);

    for (let i = 0; i < pendants.length; i++) {
      const s = pendants[i];
      const pg = groupRefs.current[i];
      if (!pg) continue;

      const unfurl = anim
        ? 0.42 + 0.58 * beat(settled, 0.04 + i * 0.07, 0.36 + i * 0.07)
        : 1;
      const phase = s.phase * (1 - coherence);
      const speed = s.speed + (SHARED_SPEED - s.speed) * coherence;
      const amp = anim ? s.amp * (1 - coherence) + SHARED_AMP * coherence : 0;

      pg.rotation.z = Math.sin(el * speed + phase) * amp;
      pg.rotation.x = Math.cos(el * speed * 0.7 + phase) * amp * 0.45;

      const pop = anim ? introAt(el, 0.14 + i * 0.08, 0.72) : 1;
      const len =
        s.len * unfurl + (s.deep ? welcome * 0.42 : 0);

      const line = lineRefs.current[i];
      if (line) {
        line.scale.set(Math.max(pop, 0.001), len, Math.max(pop, 0.001));
        line.position.y = -len / 2;
      }
      const shade = shadeRefs.current[i];
      if (shade) {
        shade.position.y = -len;
        shade.scale.setScalar(Math.max(pop, 0.001) * (s.deep ? 1 + welcome * 0.08 : 1));
      }
      const core = coreRefs.current[i];
      if (core) {
        core.position.y = -len;
        let scale = Math.max(pop, 0.001);
        if (s.deep) {
          const m = core.material as THREE.MeshBasicMaterial;
          _core.copy(_dim).lerp(_bright, welcome);
          m.color.copy(_core);
          m.opacity = 0.78 + welcome * 0.22;
          if (anim) scale *= 1 + Math.sin(el * 1.8) * 0.055 * welcome;
          scale *= 1 + welcome * 0.38;
        }
        core.scale.setScalar(scale);
      }
    }

    /* concierge desk direct-booking keycard prism responds to the welcome light */
    if (keycardRef.current) {
      const pop = anim ? introAt(el, 0.5, 0.7) : 1;
      keycardRef.current.scale.setScalar(Math.max(pop, 0.001));
      if (anim) {
        keycardRef.current.rotation.y = Math.PI / 5 + el * 0.22 * welcome;
      }
    }
    if (keycardMatRef.current) {
      keycardMatRef.current.emissiveIntensity = welcome * 0.65 + det * 0.25;
    }

    /* floor caustic shock-ring when the welcome light reaches its greeting height */
    const tau = settled > WELCOME_AT ? (settled - WELCOME_AT) * TAU_RATE : 0;
    floorGlow.uniforms.uTau.value = anim && mo.leave < 0.8 ? tau : 0;

    const deepShade = shadeRefs.current[DEEP_INDEX];
    if (deepShade) {
      report(deepShade, state.camera, 0.52 + 0.42 * welcome + 0.08 * truth);
    }

    /* pointer tilt on the atrium rig */
    if (rigRef.current) {
      tilt.current.x = damp(tilt.current.x, anim ? -pointer.y * 0.05 : 0, 3.2, dt);
      tilt.current.y = damp(
        tilt.current.y,
        (anim ? pointer.x * 0.11 : 0) + feat * 0.2 - det * 0.14,
        3.2,
        dt,
      );
      rigRef.current.rotation.x = tilt.current.x;
      rigRef.current.rotation.y = tilt.current.y;
    }

    /* camera choreography across hero → moment → market-truth → feature → detail → cta */
    const inMoment = anim ? mo.enter * (1 - mo.leave) : 0;
    const orbit =
      (anim ? Math.sin(el * 0.05) * 0.08 : 0.18) -
      inMoment * 0.08 +
      feat * 0.16;
    const radius =
      (q.compact ? 11.8 : 9.1) -
      intro * 0.55 -
      inMoment * 0.75 -
      det * 0.4 +
      cta * 0.75;

    _cam.set(
      Math.sin(orbit) * radius + (anim ? pointer.x * 0.36 : 0),
      3.85 - inMoment * 0.85 - det * 0.35 + cta * 0.45 + (anim ? pointer.y * 0.24 : 0),
      Math.cos(orbit) * radius,
    );
    if (anim) state.camera.position.lerp(_cam, 0.05);
    else state.camera.position.copy(_cam);

    _look.set(0, 0.35 - welcome * 0.15, 0);
    state.camera.lookAt(_look);

    /* lens shift: stage-right alongside copy, centred on the pinned moment */
    if (q.compact) lens(0, -0.08 + inMoment * 0.08);
    else lens(0.22 * (1 - inMoment), -0.03 * (1 - inMoment));
  });

  return (
    <group ref={groupRef}>
      <SceneLightRig />

      <group ref={rigRef}>
        {/* lobby floor plate */}
        <RoundedBox
          args={[5.6, 0.08, 3.6]}
          radius={0.03}
          smoothness={4}
          position={[0, FLOOR_Y, 0]}
        >
          <GlassMaterial kind="ice" />
        </RoundedBox>

        {/* frosted pane concierge desk */}
        <RoundedBox
          ref={deskRef}
          args={[3.3, 0.36, 1.15]}
          radius={0.05}
          smoothness={4}
          position={[0, -1.32, 0]}
        >
          <GlassMaterial kind="pane" />
        </RoundedBox>

        {/* direct-booking crystal keycard prism on the concierge desk */}
        <RoundedBox
          ref={keycardRef}
          args={[0.26, 0.22, 0.18]}
          radius={0.04}
          smoothness={4}
          position={[-0.82, -1.03, 0.14]}
          rotation={[0, Math.PI / 5, 0]}
        >
          <GlassMaterial
            ref={keycardMatRef}
            kind="crystal"
            emissive="#2e4bff"
            emissiveIntensity={0}
          />
        </RoundedBox>

        {/* overhead gradient-glass atrium canopy ring + bar */}
        <mesh
          ref={canopyRef}
          position={[0, CANOPY_Y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[1.65, 0.028, 18, 96]} />
          <GradientGlassMaterial opacity={0.92} />
        </mesh>

        {/* 5 suspended atrium pendant lights */}
        {pendants.map((s, i) => (
          <group
            key={i}
            ref={(g) => {
              groupRefs.current[i] = g;
            }}
            position={[s.anchor[0], s.anchor[1], s.anchor[2]]}
          >
            <mesh
              ref={(m) => {
                lineRefs.current[i] = m;
              }}
              position={[0, -s.len / 2, 0]}
              scale={[1, s.len, 1]}
            >
              <cylinderGeometry args={[0.006, 0.006, 1, 8]} />
              <meshBasicMaterial color="#93a9ff" transparent opacity={0.55} />
            </mesh>
            <mesh
              ref={(m) => {
                shadeRefs.current[i] = m;
              }}
              position={[0, -s.len, 0]}
            >
              <sphereGeometry args={[s.radius, 32, 24]} />
              <GlassMaterial kind={s.kind} />
            </mesh>
            <mesh
              ref={(m) => {
                coreRefs.current[i] = m;
              }}
              position={[0, -s.len, 0]}
            >
              <sphereGeometry args={[s.radius * 0.44, 16, 12]} />
              <meshBasicMaterial
                color={s.core}
                toneMapped={false}
                transparent
                opacity={s.deep ? 0.84 : 0.68}
              />
            </mesh>
          </group>
        ))}

        {/* floor welcome reflection ring */}
        <ShockRing
          material={floorGlow}
          radius={2.9}
          position={[0.05, FLOOR_Y + 0.045, 0.06]}
        />
      </group>

      <ParticleField
        count={Math.floor(1200 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.3}
        position={[0, 0.6, 0]}
      />
    </group>
  );
}
