import { sectionRange, smooth } from '@/components/webgl/scroll-store';

/** Deterministic PRNG — diorama layouts must match between SSR and client. */
export function seededRandom(seed: number): () => number {
  let s = Math.floor(seed * 9973) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Cross-fade weight for a practice section: ramps in as the section enters,
 * holds 1 while it crosses the middle band of the viewport, fades out as the
 * next section arrives.
 */
export function practiceWeight(progress: number): number {
  return (
    smooth(sectionRange(progress, 0.06, 0.3)) *
    (1 - smooth(sectionRange(progress, 0.62, 0.9)))
  );
}

/** Hero weight: 1 at the top of the page, receding as cap-hero scrolls away. */
export function heroWeight(progress: number): number {
  return 1 - smooth(sectionRange(progress, 0.28, 0.8));
}

/** Outro weight: rises as cap-outro takes the viewport — everything calms. */
export function outroWeight(progress: number): number {
  return smooth(sectionRange(progress, 0.12, 0.5));
}

/**
 * Frame-rate-independent damped approach. Honors reduced motion by snapping
 * directly to the target (no eased animation when q.animate is false).
 */
export function damp(
  current: number,
  target: number,
  lambda: number,
  animate: boolean
): number {
  return animate ? current + (target - current) * lambda : target;
}
