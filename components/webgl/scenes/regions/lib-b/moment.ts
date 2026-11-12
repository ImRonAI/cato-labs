'use client';

import { getSectionProgress, sectionRange, smooth } from '../../../scroll-store';

/**
 * The signature-moment dwell shared by lib-b region pages.
 *
 * Each page renders <MomentDwell/> — a 280vh section (220vh on compact screens)
 * with a sticky 100vh stage and the scene-section id `moment`. ScrollDirector
 * reports its progress from "top hits bottom" (0) to "bottom leaves top" (1).
 */
export const MOMENT_ID = 'moment';
export const DWELL_VH = 280;
export const DWELL_VH_COMPACT = 220;
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
  const vh =
    typeof window !== 'undefined' && window.innerWidth <= 820
      ? DWELL_VH_COMPACT
      : DWELL_VH;
  const total = vh + 100;
  const stickIn = 100 / total;
  const stickOut = vh / total;

  out.p = p;
  out.t = sectionRange(p, stickIn, stickOut);
  const enter = smooth(sectionRange(p, stickIn * 0.35, stickIn));
  const leave = 1 - smooth(sectionRange(p, stickOut, stickOut + (1 - stickOut) * 0.6));
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
