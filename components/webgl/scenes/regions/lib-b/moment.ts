'use client';

import { getSectionProgress, sectionRange, smooth } from '../../../scroll-store';

/**
 * The signature-moment dwell shared by the second six region pages.
 *
 * Each page renders <MomentDwell/> — a 280vh section with a sticky 100vh
 * stage and the scene-section id `moment`. ScrollDirector reports its
 * progress from "top hits bottom" (0) to "bottom leaves top" (1), so with
 * H = 280vh the sticky window is p ∈ [100/380, 280/380].
 */
export const MOMENT_ID = 'moment';
export const DWELL_VH = 280;
const TOTAL = DWELL_VH + 100;
export const STICK_IN = 100 / TOTAL; // ≈ 0.263
export const STICK_OUT = DWELL_VH / TOTAL; // ≈ 0.737

export interface MomentState {
  /** 0→1 through the sticky window (the set piece's timeline) */
  t: number;
  /** 0→1→0 stage weight: fades in as the dwell arrives, out as it leaves */
  w: number;
  /** raw section progress */
  p: number;
}

/** Read the moment transiently (call inside useFrame). Writes into `out`. */
export function readMoment(out: MomentState): MomentState {
  const p = getSectionProgress(MOMENT_ID);
  out.p = p;
  out.t = sectionRange(p, STICK_IN, STICK_OUT);
  const enter = smooth(sectionRange(p, STICK_IN * 0.35, STICK_IN));
  const leave = 1 - smooth(sectionRange(p, STICK_OUT, STICK_OUT + (1 - STICK_OUT) * 0.6));
  out.w = enter * leave;
  return out;
}

/** Frame-rate independent damping toward a target (exact under rewind). */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * Math.min(dt, 0.1)));
}

/** Remap + clamp + smoothstep in one call. */
export function phase(t: number, from: number, to: number): number {
  return smooth(sectionRange(t, from, to));
}

/** Clamp to [0,1]. */
export function sat(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
