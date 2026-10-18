/**
 * Home choreography — the single source of timing shared by the GL scene
 * and the DOM manifesto, so the ball lands exactly as the punch line does.
 *
 * All values are `manifesto` section progress (0..1). The section is a
 * sticky dwell (≈300vh tall → 400vh of travel), so its sticky phase spans
 * roughly 0.25 → 0.75.
 */
export const WRECK = {
  /** the cable resolves out of the sky */
  cableIn: [0.17, 0.27] as const,
  /** release: the ball leaves its pulled-back pose */
  swingFrom: 0.3,
  /** contact — the frame the ball meets the core block */
  strike: 0.42,
  /** recording fully played (debris at rest) */
  swingTo: 0.74,
  /** wreck leaves through the top as the page moves on */
  exit: [0.76, 1] as const,
};

/** DOM manifesto cues (start, end) in manifesto progress */
export const COPY = {
  /** per-word cascade: word i reveals over [from + i*step, from + i*step + span] */
  lead: { from: 0.175, step: 0.012, span: 0.035 },
  accent: { from: 0.3, step: 0.01, span: 0.03 },
  /** lands with the strike: fully set a hair after contact */
  punch: { from: WRECK.strike - 0.03, step: 0.007, span: 0.022 },
  /** the punctuation between disciplines (the boundaries) is removed on impact */
  boundaries: [WRECK.strike + 0.004, WRECK.strike + 0.05] as const,
  /** the lead recedes once the boundaries are gone */
  recede: [WRECK.strike + 0.02, WRECK.strike + 0.1] as const,
  body: [0.5, 0.56] as const,
};

/** shared damping for scroll drivers (GL + DOM use the same so they stay in step) */
export const SCRUB_DAMP = 0.14;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** remap progress into [from,to] → 0..1 */
export const range = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

/**
 * Manifesto progress → normalized recording time, piecewise so that the
 * strike frame of the bake (`hit`, 0..1) lands exactly on WRECK.strike.
 */
export function simTime(p: number, hit: number) {
  if (p <= WRECK.swingFrom) return 0;
  if (p < WRECK.strike) return range(p, WRECK.swingFrom, WRECK.strike) * hit;
  return hit + range(p, WRECK.strike, WRECK.swingTo) * (1 - hit);
}
