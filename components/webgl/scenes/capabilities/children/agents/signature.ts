import { getSectionProgress, sectionRange } from '../../../../scroll-store';

/**
 * Shared choreography for the AI & Agent Systems family's signature moments.
 *
 * Every page in the family renders a <SignatureDwell id="…"/> section
 * (app/capabilities/ai-agent-systems/SignatureDwell.tsx): 280vh tall with a
 * 100vh sticky stage. ScrollDirector reports raw progress for the outer
 * element (top enters bottom → bottom leaves top), so the sticky phase lives
 * in [100/380, 280/380]. These helpers split that raw progress into the three
 * beats every scene uses: arrive (object glides to centre stage), play (the
 * scrubbed physical event) and leave (object retires to a quiet backdrop).
 */

export const DWELL_VH = 280;
const SPAN = DWELL_VH + 100;
export const STICK_IN = 100 / SPAN;
export const STICK_OUT = DWELL_VH / SPAN;

export interface DwellBeats {
  /** 0→1 while the dwell scrolls up into the viewport */
  arrive: number;
  /** 0→1 across the pinned phase (completes a beat before the unpin) */
  play: number;
  /** 0→1 while the dwell scrolls away */
  leave: number;
}

export function readDwell(id: string, out: DwellBeats): DwellBeats {
  const raw = getSectionProgress(id);
  out.arrive = sectionRange(raw, 0.04, STICK_IN);
  out.play = sectionRange(raw, STICK_IN + 0.01, STICK_OUT - 0.05);
  out.leave = sectionRange(raw, STICK_OUT, 0.96);
  return out;
}

/** critically-damped-looking ease with a soft landing */
export function easeOutCubic(t: number) {
  const u = 1 - t;
  return 1 - u * u * u;
}

export function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/** overshoot ease (magnetic snap) */
export function easeOutBack(t: number, k = 1.4) {
  const u = t - 1;
  return 1 + (k + 1) * u * u * u + k * u * u;
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** deterministic PRNG */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
