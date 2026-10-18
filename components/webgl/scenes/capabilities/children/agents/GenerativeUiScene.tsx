'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../../shared/SceneLightRig';
import ParticleField from '../../../shared/ParticleField';
import { GlassMaterial, type GlassKind } from '../../../../lib/materials';
import { useQuality } from '../../../../lib/quality';
import { pointer } from '../../../../scroll-store';
import { useHotspotReporter } from '../../../../kit/ProximityType';
import { useBakedSimulation, type Rapier, type PhysicsWorld } from '../../../../lib/physics-bake';
import { readDwell, clamp01, lerp, easeInOutSine, easeOutBack, rng, type DwellBeats } from './signature';

/**
 * GenerativeUiScene — "Layout Drop".
 *
 * Interface tiles (nav, hero, side modules, three cards, footer) hang as
 * scattered glass panes above an empty table. In the signature dwell they
 * fall: a real baked Rapier drop, tiles clattering into a loose pile. Then
 * the design system takes hold: each tile lifts, turns square and snaps
 * magnetically into its slot on the column grid, and the grid's hairlines
 * light up beneath the finished page. Chaos in, a governed layout out.
 *
 * Fully scrubbed (physics recording + analytic snap), so it rewinds exactly.
 * Reduced motion: the composed page on its lit grid.
 */

const T = 0.03; // tile half-thickness
const G = 0.08; // gutter
const W = 3.6;
const CARD_W = (W - 2 * G) / 3;
/** slot: centre x, centre z, width, depth, glass */
const SLOTS: { x: number; z: number; w: number; d: number; kind: GlassKind }[] = [
  { x: 0, z: -1.1, w: W, d: 0.2, kind: 'pane' }, // nav
  { x: -0.6, z: -0.36, w: 2.4, d: 1.12, kind: 'azure' }, // hero
  { x: 1.24, z: -0.66, w: 1.12, d: 0.52, kind: 'ice' }, // side a
  { x: 1.24, z: -0.06, w: 1.12, d: 0.52, kind: 'pane' }, // side b
  { x: -(CARD_W + G), z: 0.64, w: CARD_W, d: 0.72, kind: 'ice' }, // card 1
  { x: 0, z: 0.64, w: CARD_W, d: 0.72, kind: 'core' }, // card 2
  { x: CARD_W + G, z: 0.64, w: CARD_W, d: 0.72, kind: 'ice' }, // card 3
  { x: 0, z: 1.14, w: W, d: 0.12, kind: 'pane' }, // footer
];
const COUNT = SLOTS.length;
/** drop order — big pieces first so the small ones land on top */
const ORDER = [1, 4, 2, 6, 0, 3, 5, 7];

const DROPS = (() => {
  const r = rng(4242);
  return SLOTS.map((_, i) => {
    const k = ORDER.indexOf(i);
    const e = new THREE.Euler((r() - 0.5) * 1.4, r() * Math.PI * 2, (r() - 0.5) * 1.2);
    const q = new THREE.Quaternion().setFromEuler(e);
    return {
      p: [(r() - 0.5) * 2.4, 1.5 + k * 0.42, (r() - 0.5) * 1.4] as [number, number, number],
      q: [q.x, q.y, q.z, q.w] as [number, number, number, number],
      w: [(r() - 0.5) * 3, (r() - 0.5) * 2, (r() - 0.5) * 3] as [number, number, number],
    };
  });
})();

function setupWorld(R: Rapier, world: PhysicsWorld) {
  const g = world.createRigidBody(R.RigidBodyDesc.fixed());
  world.createCollider(R.ColliderDesc.cuboid(8, 0.1, 8).setTranslation(0, -0.1, 0).setFriction(0.6), g);
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
      R.ColliderDesc.roundCuboid(s.w / 2 - 0.01, T - 0.008, s.d / 2 - 0.01, 0.008)
        .setFriction(0.55)
        .setRestitution(0.18)
        .setDensity(1),
      b,
    );
    return b;
  });
}

/* the column grid the layout snaps to — hairlines on the table */
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
    /* 12 columns across the page width, 8 rows */
    vec2 q = vec2((vP.x + uHalfW) / (2.0 * uHalfW) * 12.0, (vP.y + uHalfD) / (2.0 * uHalfD) * 8.0);
    vec2 f = abs(fract(q) - 0.5);
    vec2 w = fwidth(q);
    float line = max(1.0 - smoothstep(0.0, w.x * 1.2, 0.5 - f.x), 1.0 - smoothstep(0.0, w.y * 1.2, 0.5 - f.y));
    float inside = step(abs(vP.x), uHalfW) * step(abs(vP.y), uHalfD);
    float r = length(vP / vec2(uHalfW * 1.9, uHalfD * 2.2));
    float pool = smoothstep(1.0, 0.0, r) * 0.22;
    vec3 col = vec3(0.18, 0.29, 1.0);
    float a = line * inside * (0.05 + uLit * 0.28) + pool * (0.35 + uLit * 0.4);
    gl_FragColor = vec4(mix(vec3(0.85, 0.89, 1.0), col, line * inside), a);
  }
`;

/* module temps */
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _tp = new THREE.Vector3();
const _tq = new THREE.Quaternion();
const _look = new THREE.Vector3();
const beats: DwellBeats = { arrive: 0, play: 0, leave: 0 };
const FALL_END = 0.52;
const SNAP_START = 0.56;
const SNAP_SPAN = 0.2;
const SNAP_STAGGER = 0.022;

export default function GenerativeUiScene() {
  const q = useQuality();
  const stage = useRef<THREE.Group>(null);
  const tiles = useRef<(THREE.Group | null)[]>([]);
  const anchor = useRef<THREE.Object3D>(null);
  const report = useHotspotReporter('genui-cluster');
  const born = useRef(-1);

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
        uniforms: { uLit: { value: 0 }, uHalfW: { value: W / 2 + 0.04 }, uHalfD: { value: 1.24 } },
      }),
    [],
  );
  useEffect(() => () => grid.dispose(), [grid]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (born.current < 0) born.current = t;
    const animate = q.animate;
    const intro = animate ? easeInOutSine(clamp01((t - born.current) / 1.8)) : 1;
    readDwell('signature', beats);
    const play = animate ? beats.play : 1;
    const arrive = animate ? easeInOutSine(beats.arrive) : 1;
    const leave = animate ? easeInOutSine(beats.leave) : 0;
    const baked = sim.current;
    const fallT = clamp01(play / FALL_END);
    let snapped = 0;

    for (let i = 0; i < COUNT; i++) {
      const g = tiles.current[i];
      if (!g) continue;
      const s = SLOTS[i];
      if (baked) baked.sample(i, fallT, _p, _q);
      else {
        _p.set(DROPS[i].p[0], DROPS[i].p[1], DROPS[i].p[2]);
        _q.set(DROPS[i].q[0], DROPS[i].q[1], DROPS[i].q[2], DROPS[i].q[3]);
      }
      /* idle float while hanging (before the drop) */
      if (animate && play <= 0.001) {
        _p.y += Math.sin(t * 0.7 + i * 1.3) * 0.06;
      }
      /* magnetic snap: lift, square up, settle with a touch of overshoot */
      const k = ORDER.indexOf(i);
      const u = animate ? clamp01((play - SNAP_START - k * SNAP_STAGGER) / SNAP_SPAN) : 1;
      if (u > 0) {
        const e = easeOutBack(u, 1.15);
        _tp.set(s.x, T, s.z);
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
    grid.uniforms.uLit.value = animate
      ? clamp01((play - SNAP_START - 0.05) / 0.3) * 0.6 + (snapped / COUNT) * 0.4
      : 1;

    const g = stage.current;
    if (g) {
      const hx = q.compact ? 0 : 2.5;
      const hy = q.compact ? -1.9 : -1.15;
      g.position.set(
        lerp(lerp(hx, 0.3, arrive), q.compact ? 0 : 2.7, leave),
        lerp(lerp(hy, -0.75, arrive), -1.0, leave),
        lerp(lerp(-1.2, 0, arrive), -3, leave),
      );
      g.scale.setScalar((q.compact ? 0.58 : 1) * lerp(0.72, 1, arrive));
      const px = animate ? pointer.x : 0;
      const py = animate ? pointer.y : 0;
      g.rotation.y += (lerp(-0.45, -0.12, arrive) + px * 0.12 - g.rotation.y) * 0.05;
      g.rotation.x += (-py * 0.05 - g.rotation.x) * 0.05;
    }
    if (anchor.current) report(anchor.current, state.camera, 0.4 + (snapped / COUNT) * 0.55);

    const cam = state.camera;
    const cy = lerp(lerp(1.6, 4.6, arrive), 1.6, leave);
    const cz = lerp(lerp(9, 7.4, arrive), 9, leave) + (q.compact ? 3.6 : 0);
    if (animate) {
      cam.position.x += (pointer.x * 0.25 - cam.position.x) * 0.05;
      cam.position.y += (cy + pointer.y * 0.15 - cam.position.y) * 0.05;
      cam.position.z += (cz - cam.position.z) * 0.05;
    } else {
      cam.position.set(0, 4.6, 7.4 + (q.compact ? 3.6 : 0));
    }
    _look.set(lerp(q.compact ? 0 : 1.3, 0.3, arrive) * (1 - leave) + (q.compact ? 0 : 1.4) * leave, -0.55, 0);
    cam.lookAt(_look);
  });

  return (
    <group>
      <SceneLightRig />
      <ParticleField count={Math.floor(1200 * q.particles)} drift={q.animate ? 0.1 : 0} opacity={0.3} />
      <group ref={stage} position={[2.5, -1.15, -1.2]}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} material={grid}>
          <planeGeometry args={[W * 1.9, 2.48 * 2.2]} />
        </mesh>
        <object3D ref={anchor} position={[-0.6, 0.1, -0.36]} />
        {SLOTS.map((s, i) => (
          <group
            key={i}
            ref={(el) => {
              tiles.current[i] = el;
            }}
            position={DROPS[i].p}
          >
            <RoundedBox args={[s.w, T * 2, s.d]} radius={0.02} smoothness={3}>
              <GlassMaterial kind={s.kind} thickness={0.35} />
            </RoundedBox>
          </group>
        ))}
      </group>
    </group>
  );
}
