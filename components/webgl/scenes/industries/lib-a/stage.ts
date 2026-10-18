'use client';

import * as THREE from 'three';
import { getSectionProgress, sectionRange, smooth, pointer } from '../../../scroll-store';

/**
 * Stage helpers for the industries signature moments.
 *
 * Every moment lives in a "dwell" section (see MomentDwell): an outer
 * section DWELL_VH tall with a sticky 100vh inner. ScrollDirector tracks the
 * outer element from `top bottom` to `bottom top`, so the sticky hold spans
 * progress [100/(h+100), h/(h+100)]. `readPhases` splits that into
 * approach (section rising into view), play (the pinned moment) and exit.
 */

export const DWELL_VH = 300;
export const DWELL_VH_COMPACT = 220;
export const DWELL_VH_REDUCED = 120;

export interface Phases {
  /** raw section progress 0..1 */
  raw: number;
  /** 0→1 eased while the dwell rises into the viewport */
  approach: number;
  /** 0→1 linear across the pinned hold — scrub the moment with this */
  play: number;
  /** 0→1 eased while the dwell leaves */
  exit: number;
  /** 0→1 linear while the dwell leaves — page-locked lifts use this */
  exitLin: number;
}

export function createPhases(): Phases {
  return { raw: 0, approach: 0, play: 0, exit: 0, exitLin: 0 };
}

/** dwell height in vh — must mirror moment.css */
export function dwellVh(compact: boolean, animate = true): number {
  return !animate ? DWELL_VH_REDUCED : compact ? DWELL_VH_COMPACT : DWELL_VH;
}

export function dwellBounds(vh: number): [number, number] {
  return [100 / (vh + 100), vh / (vh + 100)];
}

export function phasesFrom(p: number, vh: number, out: Phases): Phases {
  const [a, b] = dwellBounds(vh);
  out.raw = p;
  out.approach = smooth(sectionRange(p, 0, a));
  /* small margins so the finished state holds before the pin releases */
  out.play = sectionRange(p, a + 0.01, b - 0.035);
  out.exitLin = sectionRange(p, b, 1);
  out.exit = smooth(out.exitLin);
  return out;
}

/** read the dwell; reduced motion keeps scroll-locked framing but forces the finished moment */
export function readPhases(id: string, compact: boolean, animate: boolean, out: Phases): Phases {
  phasesFrom(getSectionProgress(id), dwellVh(compact, animate), out);
  if (!animate) out.play = 1;
  return out;
}

/** world-units lift that keeps an object page-locked as the dwell leaves (32° fov). */
export function liftFor(distance: number, halfHeight: number, exitLin: number) {
  return exitLin * (distance * 0.5735 + halfHeight * 1.2);
}

/* ---------------- easing ---------------- */

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const range = sectionRange;
export { smooth };
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInCubic = (t: number) => {
  const c = clamp01(t);
  return c * c * c;
};
export const easeInOutCubic = (t: number) => {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
/** overshoot then settle — for parts landing in place */
export const easeOutBack = (t: number, s = 1.4) => {
  const c = clamp01(t) - 1;
  return c * c * ((s + 1) * c + s) + 1;
};
/** damped settle: 0→1 with a small decaying wobble */
export const settle = (t: number, wobbles = 2.2, damping = 5) => {
  const c = clamp01(t);
  return 1 - Math.exp(-damping * c) * Math.cos(c * Math.PI * wobbles) * (1 - c);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** mount intro — the scene assembles out of light over `dur` seconds */
export function introT(elapsed: number, animate: boolean, dur = 1.6) {
  return animate ? smooth(clamp01(elapsed / dur)) : 1;
}

/* ---------------- camera ---------------- */

export interface Pose {
  pos: readonly [number, number, number];
  look: readonly [number, number, number];
}

export interface MutablePose {
  pos: [number, number, number];
  look: [number, number, number];
}

export function makePose(): MutablePose {
  return { pos: [0, 0, 0], look: [0, 0, 0] };
}

/** out = a→b at t (allocation-free) */
export function mixPose(out: MutablePose, a: Pose, b: Pose, t: number): MutablePose {
  for (let i = 0; i < 3; i++) {
    out.pos[i] = a.pos[i] + (b.pos[i] - a.pos[i]) * t;
    out.look[i] = a.look[i] + (b.look[i] - a.look[i]) * t;
  }
  return out;
}

const _p = new THREE.Vector3();
const _l = new THREE.Vector3();
const _pB = new THREE.Vector3();
const _lB = new THREE.Vector3();
const _look = new THREE.Vector3(0, 0, 0);
let lookPrimed = false;

/**
 * Blend hero → moment → rest poses by approach/exit, add pointer parallax,
 * and ease the real camera toward it (≈0.05 damping). Allocation-free.
 */
export function stageCamera(
  camera: THREE.Camera,
  hero: Pose,
  moment: Pose,
  rest: Pose,
  approach: number,
  exit: number,
  parallax = 0.4,
  damp = 0.05,
) {
  _p.set(hero.pos[0], hero.pos[1], hero.pos[2]);
  _pB.set(moment.pos[0], moment.pos[1], moment.pos[2]);
  _p.lerp(_pB, approach);
  _pB.set(rest.pos[0], rest.pos[1], rest.pos[2]);
  _p.lerp(_pB, exit);

  _l.set(hero.look[0], hero.look[1], hero.look[2]);
  _lB.set(moment.look[0], moment.look[1], moment.look[2]);
  _l.lerp(_lB, approach);
  _lB.set(rest.look[0], rest.look[1], rest.look[2]);
  _l.lerp(_lB, exit);

  _p.x += pointer.x * parallax;
  _p.y += pointer.y * parallax * 0.6;

  if (!lookPrimed || damp >= 1) {
    _look.copy(_l);
    lookPrimed = true;
  }
  camera.position.lerp(_p, damp);
  _look.lerp(_l, damp * 1.4);
  camera.lookAt(_look);
}

/** re-prime the eased look target on scene mount */
export function resetCameraLook() {
  lookPrimed = false;
}

/** damped pointer tilt for a group — the object leans toward the cursor */
export function pointerTilt(obj: THREE.Object3D, strength = 0.12, damp = 0.04, baseX = 0, baseY = 0) {
  obj.rotation.y += (baseY + pointer.x * strength - obj.rotation.y) * damp;
  obj.rotation.x += (baseX - pointer.y * strength * 0.6 - obj.rotation.x) * damp;
}

/** deterministic PRNG (Park–Miller) */
export function rng(seed: number) {
  let s = Math.max(1, Math.floor(seed * 9973) % 2147483647);
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
