'use client';

import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { getSectionProgress, sectionRange, smooth } from '../../../scroll-store';

/**
 * Stage helpers shared by the industries-b scenes (legal, financial,
 * dental, fitness, saas, architecture).
 *
 * Every one of those pages carries a dwell block, `data-scene-section="moment"`,
 * that is MOMENT_DWELL viewport-heights tall with a 100vh sticky inner
 * (see MomentRail). ScrollDirector reports 0→1 from "top enters bottom" to
 * "bottom leaves top", so the pinned window is [1/(D+1), D/(D+1)].
 */

export const MOMENT_ID = 'moment';
/** must match `--mrail-dwell` in moment-rail.css (280vh) */
export const MOMENT_DWELL = 2.8;

const PIN_START = 1 / (MOMENT_DWELL + 1);
const PIN_END = MOMENT_DWELL / (MOMENT_DWELL + 1);

export interface MomentState {
  /** 0→1 while the stage is pinned — the signature moment's clock */
  t: number;
  /** 0→1 as the dwell block rises into view (before pinning) */
  enter: number;
  /** 0→1 as the dwell block scrolls away (after the moment) */
  leave: number;
}

/** Transient read of the moment clock. Writes into `out`, allocates nothing. */
export function readMoment(out: MomentState, animate: boolean): MomentState {
  if (!animate) {
    out.t = 1;
    out.enter = 1;
    out.leave = 0;
    return out;
  }
  const p = getSectionProgress(MOMENT_ID);
  out.t = sectionRange(p, PIN_START, PIN_END);
  out.enter = smooth(sectionRange(p, 0.02, PIN_START));
  out.leave = smooth(sectionRange(p, PIN_END, 1));
  return out;
}

export function newMoment(): MomentState {
  return { t: 0, enter: 0, leave: 0 };
}

/** Same pinned window, for DOM consumers (MomentRail). */
export function momentLocalFromProgress(p: number): number {
  return sectionRange(p, PIN_START, PIN_END);
}

/** Smoothstep within [a, b] — the per-beat choreography tool. */
export function beat(t: number, a: number, b: number): number {
  return smooth(sectionRange(t, a, b));
}

/** Critically-damped-feel exponential approach, frame-rate independent. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Mount intro 0→1 over `dur` seconds, eased. */
export function introAt(elapsed: number, delay: number, dur: number): number {
  return smooth(Math.min(Math.max((elapsed - delay) / dur, 0), 1));
}

/**
 * Lens shift — composes the subject off-centre WITHOUT changing the
 * perspective (camera.setViewOffset). `fx` is the subject's screen offset
 * from centre as a fraction of viewport width (+ right), `fy` of height
 * (+ up). Values are damped; the offset is cleared on unmount so the next
 * route's scene receives a clean camera.
 */
export function useLensShift() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const cur = useRef({ x: 0, y: 0, primed: false });

  useEffect(
    () => () => {
      camera.clearViewOffset();
    },
    [camera],
  );

  return useCallback(
    (fx: number, fy: number, k = 0.05) => {
      const c = cur.current;
      if (!c.primed) {
        c.x = fx;
        c.y = fy;
        c.primed = true;
      } else {
        c.x += (fx - c.x) * k;
        c.y += (fy - c.y) * k;
      }
      camera.setViewOffset(1000, 1000, -c.x * 1000, c.y * 1000, 1000, 1000);
    },
    [camera],
  );
}
