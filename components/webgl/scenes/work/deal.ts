/**
 * Shared timing for the /work "deal" set piece — imported by the scene and
 * by the page's DOM step list so both land on the same beats.
 * Units: pinned progress (0..1) of the `deal` dwell section.
 */
export const DEAL_FROM = 0.04;
export const DEAL_STAGGER = 0.14;
export const DEAL_DUR = 0.22;
export const DEAL_COUNT = 5;

/** progress at which deal k has (visually) landed */
export const DEAL_MARKS: number[] = Array.from(
  { length: DEAL_COUNT },
  (_, k) => DEAL_FROM + k * DEAL_STAGGER + DEAL_DUR * 0.8,
);
