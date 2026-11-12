'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../../shared/SceneLightRig';
import ParticleField from '../../../shared/ParticleField';
import {
  GlassMaterial,
  GradientGlassMaterial,
  type GlassKind,
} from '../../../../lib/materials';
import { useQuality } from '../../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../../scroll-store';
import { useHotspotReporter } from '../../../../kit/ProximityType';
import {
  useBakedSimulation,
  type Rapier,
  type PhysicsWorld,
} from '../../../../lib/physics-bake';
import ShockRing, { useShockMaterial } from '../../../industries/lib-b/ShockRing';
import {
  readDwell,
  clamp01,
  lerp,
  easeInOutSine,
  easeOutBack,
  rng,
  type DwellBeats,
} from './signature';

/**
 * GenerativeUiScene — "Layout Drop".
 *
 * Eight refractive interface tiles (navigation bar, flagship hero surface with
 * a gradient-glass focal jewel, twin context sidebars, three metric cards, and
 * a governance footer) hang tumbled above a 12-column optical artboard. Across
 * the 280vh `signature` dwell:
 *   • 0.00 → 0.52: Baked Rapier rigid-body fall — tiles clatter onto the table.
 *   • 0.56 → 0.92: Design-system governance takes hold — every tile lifts,
 *     squares, and snaps magnetically into its column-grid slot while a
 *     luminous shockwave and 12-column hairline grid ignite underneath.
 *
 * Continues choreographing across `feature` (tilted editorial inspection),
 * `detail` (z-axis token elevation hierarchy), `faq`, and `cta`.
 * Hotspot 'genui-cluster' rides the hero tile. Zero allocations in useFrame.
 */

const T = 0.032; // tile half-thickness
const G = 0.08; // gutter
const W = 3.6;
const CARD_W = (W - 2 * G) / 3;

const SLOTS: {
  x: number;
  z: number;
  w: number;
  d: number;
  kind: GlassKind;
  tierLift: number;
}[] = [
  { x: 0, z: -1.1, w: W, d: 0.2, kind: 'pane', tierLift: 0.16 }, // nav
  { x: -0.6, z: -0.36, w: 2.4, d: 1.12, kind: 'azure', tierLift: 0.24 }, // hero
  { x: 1.24, z: -0.66, w: 1.12, d: 0.52, kind: 'ice', tierLift: 0.12 }, // side a
  { x: 1.24, z: -0.06, w: 1.12, d: 0.52, kind: 'crystal', tierLift: 0.18 }, // side b
  { x: -(CARD_W + G), z: 0.64, w: CARD_W, d: 0.72, kind: 'ice', tierLift: 0.1 }, // card 1
  { x: 0, z: 0.64, w: CARD_W, d: 0.72, kind: 'core', tierLift: 0.28 }, // card 2 (deep/core accent)
  { x: CARD_W + G, z: 0.64, w: CARD_W, d: 0.72, kind: 'ice', tierLift: 0.1 }, // card 3
  { x: 0, z: 1.14, w: W, d: 0.12, kind: 'pane', tierLift: 0.06 }, // footer
];

const COUNT = SLOTS.length;
const ORDER = [1, 4, 2, 6, 0, 3, 5, 7];

const DROPS = (() => {
  const r = rng(4242);
  return SLOTS.map((_, i) => {
    const k = ORDER.indexOf(i);
    const e = new THREE.Euler(
      (r() - 0.5) * 1.4,
      r() * Math.PI * 2,
      (r() - 0.5) * 1.2,
    );
    const q = new THREE.Quaternion().setFromEuler(e);
    return {
      p: [
        (r() - 0.5) * 2.4,
        1.5 + k * 0.42,
        (r() - 0.5) * 1.4,
      ] as [number, number, number],
      q: [q.x, q.y, q.z, q.w] as [number, number, number, number],
      w: [
        (r() - 0.5) * 3,
        (r() - 0.5) * 2,
        (r() - 0.5) * 3,
      ] as [number, number, number],
    };
  });
})();

function setupWorld(R: Rapier, world: PhysicsWorld) {
  const g = world.createRigidBody(R.RigidBodyDesc.fixed());
  world.createCollider(
    R.ColliderDesc.cuboid(8, 0.1, 8).setTranslation(0, -0.1, 0).setFriction(0.6),
    g,
  );
  return SLOTS.map((s, i) => {
    const d = DROPS[i];
    const b = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(d.p[0], d.p[1], d.p[2])
        .setRotation({ x: d.q[0], y: d.q[1], z: d.q[2], w: d.q[3] })
        .setAngvel({ x: d.w[0], y: d.w[1], z: d.w[2] })
        .setLinearDamping(0.05)
        .setAngularDamping(0.3),
    );
    world.createCollider(
      R.ColliderDesc.roundCuboid(
        s.w / 2 - 0.01,
        T - 0.008,
        s.d / 2 - 0.01,
        0.008,
      )
        .setFriction(0.55)
        .setRestitution(0.18)
        .setDensity(1),
      b,
    );
    return b;
  });
}

const gridVert = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const gridFrag = /* glsl */ `
  varying vec2 vP;
  uniform float uLit;
  uniform float uHalfW;
  uniform float uHalfD;
  void main() {
    vec2 q = vec2((vP.x + uHalfW) / (2.0 * uHalfW) * 12.0, (vP.y + uHalfD) / (2.0 * uHalfD) * 8.0);
    vec2 f = abs(fract(q) - 0.5);
    vec2 w = fwidth(q);
    float line = max(1.0 - smoothstep(0.0, w.x * 1.2, 0.5 - f.x), 1.0 - smoothstep(0.0, w.y * 1.2, 0.5 - f.y));
    float inside = step(abs(vP.x), uHalfW) * step(abs(vP.y), uHalfD);
    float r = length(vP / vec2(uHalfW * 1.9, uHalfD * 2.2));
    float pool = smoothstep(1.0, 0.0, r) * 0.24;
    vec3 col = vec3(0.18, 0.29, 1.0);
    float a = line * inside * (0.06 + uLit * 0.32) + pool * (0.35 + uLit * 0.42);
    gl_FragColor = vec4(mix(vec3(0.85, 0.89, 1.0), col, line * inside), a);
  }
`;

/* module temps — zero allocations in useFrame */
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _tp = new THREE.Vector3();
const _tq = new THREE.Quaternion();
const _look = new THREE.Vector3();
const _cam = new THREE.Vector3();
const beats: DwellBeats = { arrive: 0, play: 0, leave: 0 };

const FALL_END = 0.52;
const SNAP_START = 0.56;
const SNAP_SPAN = 0.2;
const SNAP_STAGGER = 0.022;
const LOCK_PULSE_AT = 0.84;

export default function GenerativeUiScene() {
  const q = useQuality();
  const stage = useRef<THREE.Group>(null);
  const tiles = useRef<(THREE.Group | null)[]>([]);
  const jewelRef = useRef<THREE.Mesh>(null);
  const anchor = useRef<THREE.Object3D>(null);
  const report = useHotspotReporter('genui-cluster');
  const born = useRef<number | null>(null);

  const sim = useBakedSimulation({
    key: 'genui-layout-drop-v1',
    steps: 260,
    dt: 1 / 60,
    substeps: 3,
    solverIterations: 10,
    setup: setupWorld,
  });

  const grid = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: gridVert,
        fragmentShader: gridFrag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uLit: { value: 0 },
          uHalfW: { value: W / 2 + 0.04 },
          uHalfD: { value: 1.24 },
        },
      }),
    [],
  );
  useEffect(() => () => grid.dispose(), [grid]);

  const shockMat = useShockMaterial({
    speed: 1.25,
    width: 0.028,
    color: '#2e4bff',
    hot: '#dce4ff',
  });

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (born.current === null) born.current = now;
    const el = now - born.current;
    const animate = q.animate;
    const intro = animate ? easeInOutSine(clamp01(el / 1.7)) : 1;

    readDwell('signature', beats);
    const feat = smooth(sectionRange(getSectionProgress('feature'), 0.04, 0.92));
    const det = smooth(sectionRange(getSectionProgress('detail'), 0.08, 0.88));
    const faq = smooth(sectionRange(getSectionProgress('faq'), 0.06, 0.9));
    const cta = smooth(sectionRange(getSectionProgress('cta'), 0.06, 0.85));

    const play = animate ? Math.max(beats.play, beats.leave > 0 ? 1 : 0) : 1;
    const arrive = animate ? easeInOutSine(beats.arrive) : 1;
    const leave = animate ? easeInOutSine(beats.leave) : 0;
    const baked = sim.current;
    const fallT = clamp01(play / FALL_END);
    let snapped = 0;

    /* token-tier inspection lift on `detail` */
    const hierarchyLift = det * (1 - faq * 0.8);

    for (let i = 0; i < COUNT; i++) {
      const g = tiles.current[i];
      if (!g) continue;
      const s = SLOTS[i];
      if (baked) baked.sample(i, fallT, _p, _q);
      else {
        _p.set(DROPS[i].p[0], DROPS[i].p[1], DROPS[i].p[2]);
        _q.set(DROPS[i].q[0], DROPS[i].q[1], DROPS[i].q[2], DROPS[i].q[3]);
      }
      if (animate && play <= 0.001) {
        _p.y += Math.sin(el * 0.7 + i * 1.3) * 0.06;
      }
      const k = ORDER.indexOf(i);
      const u = animate
        ? clamp01((play - SNAP_START - k * SNAP_STAGGER) / SNAP_SPAN)
        : 1;
      if (u > 0) {
        const e = easeOutBack(u, 1.15);
        _tp.set(s.x, T + hierarchyLift * s.tierLift, s.z);
        _p.lerp(_tp, e);
        _p.y += Math.sin(Math.PI * Math.min(1, u * 1.1)) * 0.38;
        _tq.identity();
        _q.slerp(_tq, clamp01(easeInOutSine(Math.min(1, u * 1.25))));
        if (u >= 1) snapped++;
      }
      g.position.copy(_p);
      g.quaternion.copy(_q);
      g.scale.setScalar(Math.max(1e-4, intro));
    }

    if (jewelRef.current && animate) {
      jewelRef.current.rotation.y = el * 0.45;
    }

    grid.uniforms.uLit.value = animate
      ? clamp01((play - SNAP_START - 0.05) / 0.3) * 0.6 + (snapped / COUNT) * 0.4
      : 1;

    const tau = play > LOCK_PULSE_AT ? (play - LOCK_PULSE_AT) * 5.8 : 0;
    shockMat.uniforms.uTau.value = animate && leave < 0.75 ? tau : 0;

    /* stage choreography: hero right → dwell centre → tilted gallery artboard */
    const g = stage.current;
    if (g) {
      const hx = q.compact ? 0 : 2.4;
      const hy = q.compact ? -1.8 : -1.05;
      const postX = q.compact ? 0 : 2.1 - det * 0.35 + cta * 0.25;
      const postY = -0.68 + feat * 0.18 + det * 0.24 - cta * 0.15;
      const postZ = -1.65 + feat * 0.4 + det * 0.55 - cta * 0.65;

      g.position.set(
        lerp(lerp(hx, 0.3, arrive), postX, leave),
        lerp(lerp(hy, -0.72, arrive), postY, leave) - (1 - intro) * 0.5,
        lerp(lerp(-1.2, 0, arrive), postZ, leave),
      );
      g.scale.setScalar(
        (q.compact ? 0.6 : 1) * lerp(0.75, 1, arrive) * (0.88 + 0.12 * intro),
      );
      const px = animate ? pointer.x : 0;
      const py = animate ? pointer.y : 0;
      const targetRY =
        lerp(-0.44, -0.12, arrive) +
        leave * (-0.22 + det * 0.14) +
        px * 0.12;
      /* tilt artboard gently toward the viewer after the dwell so layout reads clearly */
      const targetRX = -py * 0.05 + leave * (0.34 - cta * 0.12);
      if (animate) {
        g.rotation.y += (targetRY - g.rotation.y) * 0.05;
        g.rotation.x += (targetRX - g.rotation.x) * 0.05;
      } else {
        g.rotation.set(0, -0.12, 0);
      }
    }

    if (anchor.current) {
      report(
        anchor.current,
        state.camera,
        0.44 + (snapped / COUNT) * 0.48 + det * 0.08,
      );
    }

    const cam = state.camera;
    const postCy = 2.85 - det * 0.65 + cta * 0.6;
    const cy = lerp(lerp(1.7, 4.6, arrive), postCy, leave);
    const postCz = 8.3 - feat * 0.35 - det * 0.55 + cta * 0.75;
    const cz =
      lerp(lerp(9.0, 7.4, arrive), postCz, leave) +
      (q.compact ? 3.5 : 0) +
      (1 - intro) * 1.3;

    _cam.set(
      (animate ? pointer.x * 0.25 : 0) - det * 0.2,
      cy + (animate ? pointer.y * 0.15 : 0),
      cz,
    );
    const lookX =
      lerp(q.compact ? 0 : 1.25, 0.3, arrive) * (1 - leave) +
      (q.compact ? 0 : 1.15 - det * 0.2) * leave;

    if (animate) {
      cam.position.lerp(_cam, 0.05);
      _look.x += (lookX - _look.x) * 0.055;
      _look.y += (-0.52 + leave * 0.12 - _look.y) * 0.055;
      _look.z = 0;
    } else {
      cam.position.set(0, 4.6, 7.4 + (q.compact ? 3.5 : 0));
      _look.set(q.compact ? 0 : 0.3, -0.52, 0);
    }
    cam.lookAt(_look);
  });

  return (
    <group>
      <SceneLightRig />
      <ParticleField
        count={Math.floor(1200 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.3}
      />
      <group ref={stage} position={[2.4, -1.05, -1.2]}>
        {/* subtle structural glass artboard platen */}
        <RoundedBox
          args={[W + 0.32, 0.026, 2.72]}
          radius={0.012}
          smoothness={3}
          position={[0, -0.016, 0]}
        >
          <GlassMaterial kind="ice" thickness={0.25} />
        </RoundedBox>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]} material={grid}>
          <planeGeometry args={[W * 1.9, 2.48 * 2.2]} />
        </mesh>
        <ShockRing material={shockMat} radius={2.8} position={[0, 0.006, 0]} />
        <object3D ref={anchor} position={[-0.6, 0.1, -0.36]} />

        {SLOTS.map((s, i) => (
          <group
            key={i}
            ref={(el) => {
              tiles.current[i] = el;
            }}
            position={DROPS[i].p}
          >
            <RoundedBox args={[s.w, T * 2, s.d]} radius={0.022} smoothness={3}>
              <GlassMaterial kind={s.kind} thickness={0.42} />
            </RoundedBox>
            {/* Hero tile carries a focal gradient-glass prism jewel */}
            {i === 1 ? (
              <mesh ref={jewelRef} position={[0.68, T + 0.09, 0]}>
                <octahedronGeometry args={[0.14, 0]} />
                <GradientGlassMaterial />
              </mesh>
            ) : null}
            {/* Core metric card carries an electric-blue token badge */}
            {i === 5 ? (
              <RoundedBox
                args={[s.w * 0.62, 0.02, 0.09]}
                radius={0.008}
                smoothness={2}
                position={[0, T + 0.015, -0.18]}
              >
                <GlassMaterial kind="deep" emissive="#2e4bff" emissiveIntensity={0.45} />
              </RoundedBox>
            ) : null}
          </group>
        ))}
      </group>
    </group>
  );
}
