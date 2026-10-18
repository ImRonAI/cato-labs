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
 * HospitalityScene — "The Welcome Light".
 *
 * A quiet glass lobby: a low concierge-desk slab of frosted pane glass on an
 * ice floor plate, and three pendant lights hanging from a slim canopy bar on
 * hairline rods — ice, azure, and ONE deep-blue pendant. The pendants sway
 * gently out of phase; as `feature` scrolls in, the deep pendant descends
 * slightly and its core brightens (the welcome that notices you); as `detail`
 * arrives, all three converge into one calm, in-phase rhythm. The deep
 * pendant is reported to ProximityType as hotspot 'hospitality-welcome'.
 *
 * Camera: slow ±5° drift + pointer parallax. Zero allocations in useFrame;
 * reduced motion renders the final, settled pose as a still.
 */

interface PendantSpec {
  /** ceiling anchor — the sway pivot (bottom face of the canopy bar) */
  anchor: readonly [number, number, number];
  /** rod length from anchor to shade centre */
  len: number;
  kind: GlassKind;
  /** shade radius */
  radius: number;
  /** idle sway character */
  phase: number;
  amp: number;
  speed: number;
  /** unlit core tint */
  core: string;
  deep?: boolean;
}

const CANOPY_Y = 3.05;
const ANCHOR_Y = CANOPY_Y - 0.03;

const PENDANTS: readonly PendantSpec[] = [
  {
    anchor: [-1.55, ANCHOR_Y, -0.1],
    len: 1.35,
    kind: 'ice',
    radius: 0.16,
    phase: 0.3,
    amp: 0.05,
    speed: 0.9,
    core: '#aebdff',
  },
  {
    anchor: [0.05, ANCHOR_Y, 0.12],
    len: 1.9,
    kind: 'deep',
    radius: 0.19,
    phase: 2.1,
    amp: 0.062,
    speed: 0.8,
    core: '#2e4bff',
    deep: true,
  },
  {
    anchor: [1.6, ANCHOR_Y, -0.06],
    len: 1.05,
    kind: 'azure',
    radius: 0.15,
    phase: 4.4,
    amp: 0.045,
    speed: 1.05,
    core: '#93a9ff',
  },
];

const DEEP_INDEX = 1;
const SHARED_SPEED = 0.85;
const SHARED_AMP = 0.028;

/* module-scope temps — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _dim = new THREE.Color('#2e4bff');
const _bright = new THREE.Color('#b9ccff');
const _core = new THREE.Color();

export default function HospitalityScene() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const canopyRef = useRef<THREE.Mesh>(null);
  const deskRef = useRef<THREE.Mesh>(null);
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const lineRefs = useRef<(THREE.Mesh | null)[]>([]);
  const shadeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const coreRefs = useRef<(THREE.Mesh | null)[]>([]);
  const report = useHotspotReporter('hospitality-welcome');

  const pendants = useMemo(() => PENDANTS, []);

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const feature = anim ? getSectionProgress('feature') : 1;
    const detail = anim ? getSectionProgress('detail') : 1;
    const intro = anim ? smooth(Math.min(el / 1.6, 1)) : 1;

    /* the lobby assembles out of light — one soft lift */
    const g = group.current;
    if (g) g.position.y = -0.9 * (1 - intro);

    const canopy = canopyRef.current;
    if (canopy) {
      const pop = anim ? smooth(Math.min(Math.max(el / 0.7, 0), 1)) : 1;
      canopy.scale.set(Math.max(pop, 0.001), 1, 1);
    }
    const desk = deskRef.current;
    if (desk) {
      const pop = anim ? smooth(Math.min(Math.max((el - 0.55) / 0.8, 0), 1)) : 1;
      desk.scale.setScalar(Math.max(pop, 0.001));
    }

    /* the welcome notices you — deep pendant descends + brightens on feature */
    const descend = smooth(sectionRange(feature, 0.15, 0.85));
    /* detail — every pendant settles into one calm rhythm */
    const align = smooth(sectionRange(detail, 0.1, 0.75));

    for (let i = 0; i < pendants.length; i++) {
      const s = pendants[i];
      const pg = groupRefs.current[i];
      if (!pg) continue;

      /* sway: individual phase/speed converge to a shared rhythm at detail */
      const phase = s.phase * (1 - align);
      const speed = s.speed + (SHARED_SPEED - s.speed) * align;
      const amp = anim ? s.amp * (1 - align) + SHARED_AMP * align : 0;
      pg.rotation.z = Math.sin(el * speed + phase) * amp;
      pg.rotation.x = Math.cos(el * speed * 0.7 + phase) * amp * 0.4;

      const pop = anim
        ? smooth(Math.min(Math.max((el - 0.25 - i * 0.14) / 0.75, 0), 1))
        : 1;
      const len = s.deep ? s.len + descend * 0.38 : s.len;

      const line = lineRefs.current[i];
      if (line) {
        line.scale.set(Math.max(pop, 0.001), len, Math.max(pop, 0.001));
        line.position.y = -len / 2;
      }
      const shade = shadeRefs.current[i];
      if (shade) {
        shade.position.y = -len;
        shade.scale.setScalar(Math.max(pop, 0.001));
      }
      const core = coreRefs.current[i];
      if (core) {
        core.position.y = -len;
        let scale = Math.max(pop, 0.001);
        if (s.deep) {
          /* the welcome brightens — dim brand blue → lit ice blue */
          const m = core.material as THREE.MeshBasicMaterial;
          _core.copy(_dim).lerp(_bright, descend);
          m.color.copy(_core);
          m.opacity = 0.82 + descend * 0.18;
          if (anim) scale *= 1 + Math.sin(el * 1.8) * 0.05 * descend;
          scale *= 1 + descend * 0.35;
        }
        core.scale.setScalar(scale);
      }
    }

    /* hotspot: the deep pendant, always reported, brighter as it wakes */
    const deepShade = shadeRefs.current[DEEP_INDEX];
    if (deepShade) report(deepShade, state.camera, 0.5 + 0.5 * descend);

    /* camera — slow ±5° drift + pointer parallax, eased */
    const orbit = anim ? (Math.sin(el * 0.055) * 5 * Math.PI) / 180 : 0.22;
    const radius = 9.7 - intro * 0.7;
    _camTarget.set(
      Math.sin(orbit) * radius + (anim ? pointer.x * 0.4 : 0),
      4.85 + (anim ? pointer.y * 0.28 : 0),
      Math.cos(orbit) * radius,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    _lookTarget.set(0, 0.5, 0);
    state.camera.lookAt(_lookTarget);
  });

  return (
    <group ref={group}>
      <SceneLightRig />

      {/* lobby floor — one low plate of ice glass */}
      <RoundedBox args={[5.6, 0.08, 3.6]} radius={0.03} smoothness={4} position={[0, -1.62, 0]}>
        <GlassMaterial kind="ice" />
      </RoundedBox>

      {/* the concierge desk — a low slab of frosted pane glass */}
      <RoundedBox
        ref={deskRef}
        args={[3.3, 0.36, 1.15]}
        radius={0.05}
        smoothness={4}
        position={[0, -1.32, 0]}
      >
        <GlassMaterial kind="pane" />
      </RoundedBox>

      {/* a small object on the desk — the bell, in hero crystal */}
      <RoundedBox
        args={[0.22, 0.22, 0.22]}
        radius={0.05}
        smoothness={4}
        position={[-0.9, -1.03, 0.12]}
        rotation={[0, Math.PI / 5, 0]}
      >
        <GlassMaterial kind="azure" />
      </RoundedBox>

      {/* the canopy bar the pendants hang from */}
      <RoundedBox
        ref={canopyRef}
        args={[4.6, 0.06, 0.34]}
        radius={0.02}
        smoothness={4}
        position={[0, CANOPY_Y, 0]}
      >
        <GlassMaterial kind="ice" />
      </RoundedBox>

      {/* pendant lights — hairline rod, glass shade, luminous core */}
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
            <cylinderGeometry args={[0.006, 0.006, 1, 6]} />
            <meshBasicMaterial color="#93a9ff" transparent opacity={0.5} />
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
            <sphereGeometry args={[s.radius * 0.42, 16, 12]} />
            <meshBasicMaterial
              color={s.core}
              toneMapped={false}
              transparent
              opacity={s.deep ? 0.82 : 0.7}
            />
          </mesh>
        </group>
      ))}

      <ParticleField
        count={Math.floor(1200 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.3}
        position={[0, 0.6, 0]}
      />
    </group>
  );
}
