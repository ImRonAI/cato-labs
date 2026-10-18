'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../../shared/SceneLightRig';
import ParticleField from '../../../shared/ParticleField';
import { GlassMaterial, type GlassKind } from '../../../../lib/materials';
import { useQuality } from '../../../../lib/quality';
import { pointer } from '../../../../scroll-store';
import { useHotspotReporter } from '../../../../kit/ProximityType';
import { readDwell, clamp01, lerp, easeInOutSine, type DwellBeats } from './signature';

/**
 * CustomerExperienceScene — "The Calder Mobile".
 *
 * A hanging mobile of fine glass rods. In the signature dwell five glass
 * discs (touchpoints) drop one by one onto its hooks. Each arrival tips its
 * rod and, through the tree, the whole mobile; it rings, damps and finds a
 * new balance. When the last touchpoint lands every rod hangs level: many
 * moments, one composed experience. The mobile turns slowly in the air.
 *
 * Physics: each rod hangs from a pivot above its centre of mass, so its
 * equilibrium tilt is atan(net torque / (M·h)). Each arrival is a damped
 * step response, so the pose is a pure function of scroll progress and
 * rewinds exactly. Reduced motion: fully weighted and level, at rest.
 */

interface Bar {
  /** parent bar index (-1 = ceiling) and which end of it (-1 left, 1 right) */
  parent: number;
  side: -1 | 1;
  drop: number;
  lL: number;
  lR: number;
}
interface Weight {
  bar: number;
  side: -1 | 1;
  drop: number;
  mass: number;
  kind: GlassKind;
  /** play time it lands */
  at: number;
}

/* arm lengths chosen so the fully weighted mobile is exactly level */
const BARS: Bar[] = [
  { parent: -1, side: 1, drop: 0.6, lL: (3.0 * 1.9) / 3.4, lR: (3.0 * 1.5) / 3.4 },
  { parent: 0, side: -1, drop: 0.78, lL: 0.8, lR: 0.7 },
  { parent: 0, side: 1, drop: 0.6, lL: (1.8 * 1.0) / 1.9, lR: (1.8 * 0.9) / 1.9 },
  { parent: 2, side: 1, drop: 0.55, lL: 0.4, lR: 0.6 },
];
const WEIGHTS: Weight[] = [
  { bar: 1, side: -1, drop: 0.5, mass: 0.7, kind: 'azure', at: 0.1 },
  { bar: 2, side: -1, drop: 0.66, mass: 0.9, kind: 'ice', at: 0.27 },
  { bar: 1, side: 1, drop: 0.72, mass: 0.8, kind: 'core', at: 0.44 },
  { bar: 3, side: -1, drop: 0.46, mass: 0.6, kind: 'ice', at: 0.61 },
  { bar: 3, side: 1, drop: 0.6, mass: 0.4, kind: 'deep', at: 0.78 },
];
const H = 0.32; // pivot height above rod's centre of mass
const MAX_TILT = 0.42;
const CEIL_Y = 2.15;
const TOP_Y = CEIL_Y - BARS[0].drop;

/** equilibrium tilt (rad, CCW = right end up) of every rod with the first `k` weights attached */
function equilibrium(k: number): number[] {
  const mass = new Array(BARS.length).fill(0) as number[];
  const left = new Array(BARS.length).fill(0) as number[];
  const right = new Array(BARS.length).fill(0) as number[];
  for (let w = 0; w < k; w++) {
    const W = WEIGHTS[w];
    if (W.side < 0) left[W.bar] += W.mass;
    else right[W.bar] += W.mass;
  }
  for (let b = BARS.length - 1; b >= 0; b--) {
    mass[b] = left[b] + right[b];
    const B = BARS[b];
    if (B.parent >= 0) {
      if (B.side < 0) left[B.parent] += mass[b];
      else right[B.parent] += mass[b];
    }
  }
  /* recompute masses including sub-bars (parents were filled above) */
  return BARS.map((B, b) => {
    const M = left[b] + right[b];
    const tau = left[b] * B.lL - right[b] * B.lR;
    return Math.max(-MAX_TILT, Math.min(MAX_TILT, Math.atan2(tau, M * H + 0.08)));
  });
}
const TARGETS = Array.from({ length: WEIGHTS.length + 1 }, (_, k) => equilibrium(k));

/** damped step response in play units — rings ~3 times, settles */
function step(tau: number) {
  if (tau <= 0) return 0;
  return 1 - Math.exp(-tau / 0.03) * Math.cos((tau * Math.PI * 2) / 0.055);
}
const DROP_SPAN = 0.07;

/* module temps */
const pivX = new Float32Array(BARS.length);
const pivY = new Float32Array(BARS.length);
const ang = new Float32Array(BARS.length);
const _look = new THREE.Vector3();
const beats: DwellBeats = { arrive: 0, play: 0, leave: 0 };

export default function CustomerExperienceScene() {
  const q = useQuality();
  const stage = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const rods = useRef<(THREE.Mesh | null)[]>([]);
  const beads = useRef<(THREE.Mesh | null)[]>([]);
  const discs = useRef<(THREE.Mesh | null)[]>([]);
  const report = useHotspotReporter('cx-handoff');
  const born = useRef(-1);

  const rodGeo = useMemo(() => new THREE.CylinderGeometry(0.012, 0.012, 1, 10).rotateZ(Math.PI / 2), []);
  const threads = useMemo(() => {
    const segs = BARS.length + WEIGHTS.length;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(segs * 6);
    const col = new Float32Array(segs * 8);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false });
    const obj = new THREE.LineSegments(g, m);
    obj.frustumCulled = false;
    return { g, m, obj, pos, col };
  }, []);
  useEffect(
    () => () => {
      rodGeo.dispose();
      threads.g.dispose();
      threads.m.dispose();
    },
    [rodGeo, threads],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (born.current < 0) born.current = t;
    const animate = q.animate;
    const intro = animate ? easeInOutSine(clamp01((t - born.current) / 2)) : 1;
    readDwell('signature', beats);
    const play = animate ? beats.play : 1;
    const arrive = animate ? easeInOutSine(beats.arrive) : 1;
    const leave = animate ? easeInOutSine(beats.leave) : 0;

    /* ---- rod angles: initial + damped responses to each arrival ---- */
    for (let b = 0; b < BARS.length; b++) {
      let a = TARGETS[0][b];
      for (let k = 0; k < WEIGHTS.length; k++) {
        a += (TARGETS[k + 1][b] - TARGETS[k][b]) * (animate ? step(play - WEIGHTS[k].at) : 1);
      }
      /* air: a breath of sway while idle */
      if (animate) a += Math.sin(t * 0.6 + b * 1.9) * 0.012;
      ang[b] = a;
    }

    /* ---- forward kinematics in the mobile's plane ---- */
    const pos = threads.pos;
    const col = threads.col;
    let seg = 0;
    const writeSeg = (x0: number, y0: number, x1: number, y1: number, alpha: number) => {
      const o = seg * 6;
      pos[o] = x0;
      pos[o + 1] = y0;
      pos[o + 2] = 0;
      pos[o + 3] = x1;
      pos[o + 4] = y1;
      pos[o + 5] = 0;
      const c = seg * 8;
      col[c] = 0.18;
      col[c + 1] = 0.29;
      col[c + 2] = 1;
      col[c + 3] = alpha;
      col[c + 4] = 0.18;
      col[c + 5] = 0.29;
      col[c + 6] = 1;
      col[c + 7] = alpha;
      seg++;
    };
    for (let b = 0; b < BARS.length; b++) {
      const B = BARS[b];
      let hx = 0;
      let hy = CEIL_Y;
      if (B.parent >= 0) {
        const p = B.parent;
        const arm = B.side < 0 ? -BARS[p].lL : BARS[p].lR;
        hx = pivX[p] + Math.cos(ang[p]) * arm;
        hy = pivY[p] + Math.sin(ang[p]) * arm;
      }
      pivX[b] = hx;
      pivY[b] = hy - B.drop;
      writeSeg(hx, B.parent < 0 ? CEIL_Y + 3 : hy, hx, pivY[b], 0.42 * intro);
      const rod = rods.current[b];
      if (rod) {
        const off = (B.lR - B.lL) / 2;
        rod.position.set(pivX[b] + Math.cos(ang[b]) * off, pivY[b] + Math.sin(ang[b]) * off, 0);
        rod.rotation.z = ang[b];
        rod.scale.set((B.lL + B.lR) * intro + 1e-4, 1, 1);
      }
      const bead = beads.current[b];
      if (bead) bead.position.set(pivX[b], pivY[b], 0);
    }
    let landed = 0;
    for (let w = 0; w < WEIGHTS.length; w++) {
      const W = WEIGHTS[w];
      const B = BARS[W.bar];
      const arm = W.side < 0 ? -B.lL : B.lR;
      const ex = pivX[W.bar] + Math.cos(ang[W.bar]) * arm;
      const ey = pivY[W.bar] + Math.sin(ang[W.bar]) * arm;
      /* fall in from above with gravity's ease-in; hangs once landed */
      const f = animate ? clamp01((play - (W.at - DROP_SPAN)) / DROP_SPAN) : 1;
      const r = 0.16 + Math.sqrt(W.mass) * 0.16;
      const restY = ey - W.drop - r;
      const fall = (1 - f * f) * 2.6;
      const d = discs.current[w];
      if (d) {
        d.position.set(ex, restY + fall, 0);
        d.scale.setScalar(Math.max(1e-4, (f > 0 ? Math.min(1, f * 3) : 0) * intro));
        if (animate) d.rotation.y = Math.sin(t * 0.5 + w) * 0.5;
      }
      if (f >= 1) landed++;
      writeSeg(ex, ey, ex, restY + r, f >= 1 ? 0.42 * intro : 0);
    }
    (threads.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (threads.g.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    /* ---- the mobile turns slowly in the air; the pointer stirs it ---- */
    if (spin.current) {
      const target = (animate ? Math.sin(t * 0.07) * 0.5 : 0.2) + (animate ? pointer.x * 0.25 : 0);
      spin.current.rotation.y += (target - spin.current.rotation.y) * 0.03;
    }

    const g = stage.current;
    if (g) {
      const hx = q.compact ? 0 : 2.6;
      const hy = q.compact ? -0.9 : -0.2;
      g.position.set(
        lerp(lerp(hx, 0.5, arrive), q.compact ? 0 : 2.8, leave),
        lerp(lerp(hy, -0.25, arrive), 0, leave),
        lerp(lerp(-1.5, 0, arrive), -3.2, leave),
      );
      g.scale.setScalar((q.compact ? 0.62 : 1) * lerp(0.78, 1, arrive));
    }
    const disc = discs.current[2];
    if (disc) report(disc, state.camera, 0.4 + (landed / WEIGHTS.length) * 0.55);

    const cam = state.camera;
    const cz = 9 + (q.compact ? 3.6 : 0);
    if (animate) {
      cam.position.x += (pointer.x * 0.3 - cam.position.x) * 0.05;
      cam.position.y += (0.2 + pointer.y * 0.2 - cam.position.y) * 0.05;
      cam.position.z += (cz - cam.position.z) * 0.05;
    } else {
      cam.position.set(0, 0.2, cz);
    }
    _look.set(lerp(q.compact ? 0 : 1.3, 0.5, arrive) * (1 - leave) + (q.compact ? 0 : 1.4) * leave, 0, 0);
    cam.lookAt(_look);
  });

  return (
    <group>
      <SceneLightRig />
      <ParticleField count={Math.floor(1300 * q.particles)} drift={q.animate ? 0.1 : 0} opacity={0.3} />
      <group ref={stage} position={[2.6, -0.2, -1.5]}>
        <group ref={spin}>
          <primitive object={threads.obj} />
          {BARS.map((_, b) => (
            <React.Fragment key={b}>
              <mesh
                ref={(el) => {
                  rods.current[b] = el;
                }}
                geometry={rodGeo}
              >
                <meshStandardMaterial color="#1f38e0" roughness={0.3} metalness={0.4} />
              </mesh>
              <mesh
                ref={(el) => {
                  beads.current[b] = el;
                }}
              >
                <sphereGeometry args={[0.03, 16, 16]} />
                <GlassMaterial kind="deep" />
              </mesh>
            </React.Fragment>
          ))}
          {WEIGHTS.map((w, i) => {
            const r = 0.16 + Math.sqrt(w.mass) * 0.16;
            return (
              <mesh
                key={i}
                ref={(el) => {
                  discs.current[i] = el;
                }}
                rotation-x={Math.PI / 2}
                scale={0.0001}
              >
                <cylinderGeometry args={[r, r, 0.05, 48]} />
                <GlassMaterial kind={w.kind} thickness={0.5} />
              </mesh>
            );
          })}
        </group>
      </group>
    </group>
  );
}

export { TOP_Y as CX_TOP_Y };
