'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, type GlassKind } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import { pointer } from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { beat, damp, introAt, newMoment, readMoment, useLensShift } from '../lib-b/stage';
import ShockRing, { useShockMaterial } from '../lib-b/ShockRing';
import { useDust } from '../lib-b/ImpactDust';

/**
 * LegalScene — "The Gavel".
 *
 * A stack of precedent slabs sits slightly askew: the facts, unordered. A
 * glass gavel hangs over the sound block on top. Through the `moment` dwell
 * the gavel winds up, then strikes. The impact is a real event: a ring of
 * light leaves the block, a shockwave travels DOWN the stack slab by slab —
 * each one flashes, shivers and snaps square as the wave passes — and when it
 * reaches the plinth a wide ring and a skirt of dust roll out across the
 * floor. Precedent set. Every value is a pure function of scroll, so
 * scrolling up rewinds the strike exactly.
 *
 * Reduced motion: the struck, squared stack with the gavel at rest.
 */

const N = 9;
const SLAB_W = 2.5;
const SLAB_H = 0.09;
const SLAB_D = 1.7;
const PITCH = 0.135;
const BASE_Y = -1.05;
const STACK_TOP = BASE_Y + (N - 1) * PITCH + SLAB_H / 2;

const BLOCK_R = 0.46;
const BLOCK_H = 0.17;
const BLOCK_TOP = STACK_TOP + BLOCK_H;

const HEAD_R = 0.2;
const HEAD_L = 0.72;
const ARM = 1.95; // pivot → head centre
/** head barrel stands vertical at the strike; its lower face meets the block */
const PIVOT: [number, number, number] = [ARM, BLOCK_TOP + HEAD_L / 2, 0];

/** moment beats (0..1 of the pinned dwell) */
const WIND_FROM = 0.06;
const WIND_TO = 0.4;
const STRIKE = 0.45;
/** seconds of event time per unit of moment after impact */
const TAU_RATE = 6.2;
const WAVE_START = 0.03;
const WAVE_STEP = 0.06;
const FLOOR_TAU = WAVE_START + N * WAVE_STEP;

const ANGLE_IDLE = -0.36;
const ANGLE_WIND = -1.12;

interface SlabSpec {
  kind: GlassKind;
  rot: number;
  dx: number;
  dz: number;
  seed: number;
}

function rand(seedStart: number) {
  let s = seedStart * 9973;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildSlabs(): SlabSpec[] {
  const r = rand(23);
  return Array.from({ length: N }, (_, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    return {
      kind: i === 0 ? 'azure' : i % 3 === 1 ? 'pane' : 'ice',
      rot: side * (0.05 + r() * 0.11),
      dx: (r() - 0.5) * 0.3,
      dz: (r() - 0.5) * 0.2,
      seed: r(),
    };
  });
}

function slabY(i: number) {
  return BASE_Y + i * PITCH;
}

/** gavel angle around the pivot (0 = head resting on the block) */
function gavelAngle(t: number, tau: number): number {
  if (t < WIND_TO) {
    return ANGLE_IDLE + (ANGLE_WIND - ANGLE_IDLE) * beat(t, WIND_FROM, WIND_TO);
  }
  if (t < STRIKE) {
    const u = (t - WIND_TO) / (STRIKE - WIND_TO);
    return ANGLE_WIND * (1 - u * u * u);
  }
  /* rebound: two small hops, then rest */
  return -0.13 * Math.exp(-tau * 3.4) * Math.abs(Math.sin(tau * 7.5));
}

const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _emissive = new THREE.Color('#2e4bff');

export default function LegalScene() {
  const q = useQuality();
  const lens = useLensShift();
  const moment = useRef(newMoment());
  const group = useRef<THREE.Group>(null);
  const stack = useRef<THREE.Group>(null);
  const gavel = useRef<THREE.Group>(null);
  const block = useRef<THREE.Mesh>(null);
  const plinth = useRef<THREE.Mesh>(null);
  const slabRefs = useRef<(THREE.Mesh | null)[]>([]);
  const slabMats = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const blockMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const tilt = useRef({ x: 0, y: 0 });
  const report = useHotspotReporter('legal-seal');

  const slabs = useMemo(buildSlabs, []);
  const topRing = useShockMaterial({ speed: 1.25, width: 0.03, color: '#7d97ff' });
  const floorRing = useShockMaterial({ speed: 0.95, width: 0.022, color: '#2e4bff' });
  const dust = useDust({
    count: Math.floor((q.compact ? 140 : 320) * q.particles),
    origin: [0, BASE_Y - 0.05, 0],
    spread: 2.3,
    lift: 0.55,
    size: 2.6,
    seed: 11,
  });

  useFrame((state, delta) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const m = readMoment(moment.current, anim);
    const t = m.t;
    const tau = t > STRIKE ? (t - STRIKE) * TAU_RATE : 0;
    const dt = Math.min(delta, 0.05);

    /* intro — the stack assembles out of light */
    const intro = anim ? introAt(el, 0, 1.6) : 1;
    if (group.current) group.current.position.y = -0.8 * (1 - intro);

    /* slabs: askew until the wave passes, then square */
    for (let i = 0; i < N; i++) {
      const mesh = slabRefs.current[i];
      if (!mesh) continue;
      const s = slabs[i];
      const fromTop = N - 1 - i;
      const u = tau - (WAVE_START + fromTop * WAVE_STEP);
      const hit = u > 0 ? u : 0;
      const square = u > 0 ? beat(hit, 0, 0.32) : 0;
      const shiver = u > 0 ? Math.exp(-hit * 6.5) * Math.sin(hit * 30) : 0;
      const idle = anim ? Math.sin(el * 0.9 + s.seed * 7) * 0.012 * (1 - square) : 0;
      mesh.position.set(
        s.dx * (1 - square) + shiver * 0.035 * (i % 2 ? 1 : -1),
        slabY(i) - (u > 0 ? Math.exp(-hit * 7) * Math.sin(hit * 24) * 0.03 * (1 + fromTop * 0.15) : 0) + idle,
        s.dz * (1 - square),
      );
      mesh.rotation.y = s.rot * (1 - square) + shiver * 0.02;
      const pop = anim ? introAt(el, 0.08 + i * 0.06, 0.7) : 1;
      mesh.scale.setScalar(Math.max(pop, 0.001));

      const mat = slabMats.current[i];
      if (mat) {
        const flash = u > 0 ? Math.exp(-hit * 5.5) * (1 - Math.exp(-hit * 40)) : 0;
        mat.emissiveIntensity = flash * 0.9;
      }
    }

    /* the sound block — takes the blow */
    const b = block.current;
    if (b) {
      const squash = tau > 0 ? Math.exp(-tau * 9) * Math.sin(tau * 26) : 0;
      b.position.set(0, STACK_TOP + BLOCK_H / 2 - Math.max(squash, 0) * 0.02, 0);
      b.scale.set(1 + squash * 0.06, 1 - squash * 0.12, 1 + squash * 0.06);
      const pop = anim ? introAt(el, 0.7, 0.7) : 1;
      b.scale.multiplyScalar(Math.max(pop, 0.001));
      report(b, state.camera, 0.55 + 0.4 * beat(t, 0.3, STRIKE));
    }
    if (blockMat.current) {
      blockMat.current.emissiveIntensity = tau > 0 ? Math.exp(-tau * 4) * 1.4 : 0;
    }

    const p = plinth.current;
    if (p) {
      const pop = anim ? introAt(el, 0, 0.6) : 1;
      p.scale.set(Math.max(pop, 0.001), 1, Math.max(pop, 0.001));
    }

    /* the gavel */
    const g = gavel.current;
    if (g) {
      const sway = anim && t < WIND_FROM ? Math.sin(el * 0.7) * 0.025 : 0;
      g.rotation.z = gavelAngle(t, tau) + sway;
      const pop = anim ? introAt(el, 0.9, 0.9) : 1;
      g.scale.setScalar(Math.max(pop, 0.001));
    }

    /* rings + dust run on event time */
    topRing.uniforms.uTau.value = tau;
    floorRing.uniforms.uTau.value = Math.max(tau - FLOOR_TAU, 0);
    dust.material.uniforms.uTau.value = Math.max(tau - FLOOR_TAU + 0.02, 0);

    /* pointer: the whole set leans a breath toward the cursor */
    const st = stack.current;
    if (st) {
      tilt.current.x = damp(tilt.current.x, anim ? pointer.y * 0.04 : 0, 3, dt);
      tilt.current.y = damp(tilt.current.y, anim ? pointer.x * 0.12 : 0, 3, dt);
      st.rotation.x = tilt.current.x;
      st.rotation.y = tilt.current.y;
    }

    /* camera: three-quarter view, eases in for the strike, tiny impact kick */
    const focus = anim ? beat(t, 0.02, 0.3) * (1 - m.leave) : 0;
    const orbit = anim ? Math.sin(el * 0.05) * 0.06 + 0.5 - focus * 0.12 : 0.44;
    const radius = (q.compact ? 15.5 : 11.2) - focus * (q.compact ? 1.5 : 1.6);
    const kick = tau > 0 ? Math.exp(-tau * 7) * Math.sin(tau * 46) * 0.025 : 0;
    _cam.set(
      Math.sin(orbit) * radius + (anim ? pointer.x * 0.35 : 0),
      4.4 - focus * 0.9 + (anim ? pointer.y * 0.25 : 0) + kick,
      Math.cos(orbit) * radius,
    );
    state.camera.position.lerp(_cam, 0.05);
    _look.set(0.35, 0.05 - focus * 0.05, 0);
    state.camera.lookAt(_look);

    /* framing: right of the hero copy, centred while the moment plays */
    const centre = anim ? Math.max(m.enter * (1 - m.leave), 0) : 0;
    if (q.compact) lens(0, -0.1 + centre * 0.1);
    else lens(0.24 * (1 - centre), -0.06 * (1 - centre));
  });

  return (
    <group ref={group}>
      <SceneLightRig />

      <group ref={stack}>
        {/* plinth */}
        <RoundedBox
          ref={plinth}
          args={[3.3, 0.08, 2.4]}
          radius={0.03}
          smoothness={4}
          position={[0, BASE_Y - SLAB_H / 2 - 0.06, 0]}
        >
          <GlassMaterial kind="pane" />
        </RoundedBox>

        {/* precedent slabs */}
        {slabs.map((s, i) => (
          <RoundedBox
            key={i}
            ref={(mesh) => {
              slabRefs.current[i] = mesh;
            }}
            args={[SLAB_W, SLAB_H, SLAB_D]}
            radius={0.028}
            smoothness={3}
            position={[s.dx, slabY(i), s.dz]}
            rotation={[0, s.rot, 0]}
          >
            <GlassMaterial
              ref={(mat) => {
                slabMats.current[i] = mat;
              }}
              kind={s.kind}
              emissive={_emissive}
              emissiveIntensity={0}
            />
          </RoundedBox>
        ))}

        {/* sound block */}
        <mesh ref={block} position={[0, STACK_TOP + BLOCK_H / 2, 0]}>
          <cylinderGeometry args={[BLOCK_R, BLOCK_R * 1.04, BLOCK_H, 64]} />
          <GlassMaterial ref={blockMat} kind="deep" emissive={_emissive} emissiveIntensity={0} />
        </mesh>

        {/* gavel — pivots at the end of its handle */}
        <group ref={gavel} position={PIVOT} rotation={[0, 0, ANGLE_IDLE]}>
          <mesh position={[-ARM / 2 + 0.1, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.045, 0.06, ARM - 0.05, 24]} />
            <GlassMaterial kind="azure" />
          </mesh>
          <group position={[-ARM, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[HEAD_R, HEAD_R, HEAD_L, 48]} />
              <GlassMaterial kind="crystal" />
            </mesh>
            {[-1, 1].map((sgn) => (
              <mesh key={sgn} position={[0, sgn * (HEAD_L / 2 - 0.07), 0]}>
                <cylinderGeometry args={[HEAD_R * 1.06, HEAD_R * 1.06, 0.07, 48]} />
                <GlassMaterial kind="deep" />
              </mesh>
            ))}
          </group>
        </group>

        <ShockRing material={topRing} radius={2.2} position={[0, BLOCK_TOP + 0.005, 0]} />
        <ShockRing material={floorRing} radius={6.5} position={[0, BASE_Y - SLAB_H / 2 - 0.1, 0]} />
        {dust.node}
      </group>

      <ParticleField count={Math.floor(1100 * q.particles)} drift={q.animate ? 0.1 : 0} opacity={0.28} />
    </group>
  );
}
