/**
 * Shared timing for the /work/resting-art "joinery" set piece — the scene
 * and the page's DOM step list land on the same beats.
 * Units: pinned progress (0..1) of the `joinery` dwell section.
 *   stage 0 legs stand · 1 side rails drop · 2 stretchers drop · 3 top seats
 */
export const JOIN_STAGES: readonly (readonly [number, number])[] = [
  [0.02, 0.26],
  [0.24, 0.48],
  [0.46, 0.7],
  [0.68, 0.92],
];

/** progress at which each stage has seated */
export const JOIN_MARKS: number[] = JOIN_STAGES.map(([a, b]) => a + (b - a) * 0.85);
