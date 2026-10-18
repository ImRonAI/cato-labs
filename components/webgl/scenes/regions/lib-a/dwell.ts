'use client';

import { getSectionProgress, sectionRange, smooth } from '../../../scroll-store';

/**
 * Dwell math for the region signature moments.
 *
 * A dwell section is `H` vh tall with a 100vh sticky inner. ScrollDirector
 * reports progress from "top enters bottom" to "bottom leaves top", so the
 * inner is pinned for progress ∈ [100 / (H + 100), H / (H + 100)]. The
 * moment plays inside that window; `focus` eases the stage in before it and
 * out after it, so scenes can centre the set piece only while it is pinned.
 *
 * Keep DWELL_VH / DWELL_VH_COMPACT in sync with lib-a/stage.css.
 */
export const DWELL_VH = 280;
export const DWELL_VH_COMPACT = 220;
export const MOMENT_ID = 'moment';

export function dwellHeight(compact: boolean): number {
  return compact ? DWELL_VH_COMPACT : DWELL_VH;
}

export function pinnedRange(heightVh: number): [number, number] {
  return [100 / (heightVh + 100), heightVh / (heightVh + 100)];
}

/** 0→1 while the dwell is pinned (linear — ease per beat in the scene). */
export function momentT(progress: number, heightVh: number): number {
  const [a, b] = pinnedRange(heightVh);
  return sectionRange(progress, a + 0.01, b - 0.01);
}

/** 0 before the dwell, 1 while pinned, back to 0 after — eased. */
export function stageFocus(progress: number, heightVh: number): number {
  const [a, b] = pinnedRange(heightVh);
  const into = smooth(sectionRange(progress, a * 0.45, a));
  const out = smooth(sectionRange(progress, b, b + (1 - b) * 0.55));
  return into * (1 - out);
}

/** Per-frame stage read-out, written into a caller-owned object (no allocation). */
export interface StageState {
  /** 0→1 while the set piece travels in from below (before the pin) */
  into: number;
  /** 0→1 while it leaves upward (after the pin) */
  out: number;
  /** 0→1 scrubbed moment time while pinned */
  t: number;
  /** into·(1−out) — how centred the stage is */
  focus: number;
  /** true once the dwell has been pinned past its end */
  after: boolean;
  /** reduced motion: true while the stage is the viewport's subject */
  staticVisible: boolean;
}

export function createStageState(): StageState {
  return { into: 0, out: 0, t: 0, focus: 0, after: false, staticVisible: false };
}

export function readStage(
  out: StageState,
  q: { animate: boolean; compact: boolean },
): StageState {
  const p = getSectionProgress(MOMENT_ID);
  if (!q.animate) {
    out.into = 1;
    out.out = 0;
    out.t = 1;
    out.focus = 1;
    out.after = false;
    out.staticVisible = p > 0.22 && p < 0.78;
    return out;
  }
  const h = dwellHeight(q.compact);
  const [a, b] = pinnedRange(h);
  out.into = smooth(sectionRange(p, a * 0.35, a));
  out.out = smooth(sectionRange(p, b, b + (1 - b) * 0.65));
  out.t = momentT(p, h);
  out.focus = out.into * (1 - out.out);
  out.after = p >= b;
  out.staticVisible = false;
  return out;
}

/** Frame-rate independent exponential damping toward a target. */
export function damp(current: number, target: number, lambda: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * Math.min(delta, 0.1)));
}

/** Beat helper: where `t` sits inside [from, to], eased. */
export function beat(t: number, from: number, to: number): number {
  return smooth(sectionRange(t, from, to));
}
