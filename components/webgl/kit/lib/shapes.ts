'use client';

/**
 * shapes — hand-authored, SIMPLIFIED brand marks as single-path SVG data.
 *
 * Every path is authored in a `0 0 100 100` viewBox and filled by
 * `sampleSvgPath` with the even-odd rule, so compound sub-paths punch holes
 * (rings, the YouTube play button). Strokes are thick and detail is minimal
 * on purpose: these are read as ~2200-point particle clouds, not as icons.
 *
 * Pass a key of SHAPES to `<ParticleSculpture shape="…" />`, or merge your
 * own via the `shapes` prop.
 */

export const SHAPES = {
  /**
   * Cato "CL" monogram — echoes app/icon.svg: corner brackets top-left /
   * bottom-right, the open C ring, the L, and the electric-blue pixel pair.
   */
  cato: [
    'M6.25 6.25 H34.4 V12.8 H12.8 V34.4 H6.25 Z', // top-left bracket
    'M65.6 93.75 H93.75 V65.6 H87.2 V87.2 H65.6 Z', // bottom-right bracket
    'M71.9 6.25 H79.1 V13.4 H71.9 Z', // blue pixel
    'M84.4 18.75 H89.7 V24.1 H84.4 Z', // ink pixel
    'M55.5 38.3 A18.75 18.75 0 1 0 55.5 61.7 L49.2 56.8 A10.9 10.9 0 1 1 49.2 43.2 Z', // C ring
    'M61.7 37.5 H69.5 V58.6 H82.8 V66.4 H61.7 Z', // L
  ].join(' '),

  /** Instagram — rounded-square ring + lens ring + flash dot (holes via even-odd). */
  instagram: [
    'M32 8 H68 A24 24 0 0 1 92 32 V68 A24 24 0 0 1 68 92 H32 A24 24 0 0 1 8 68 V32 A24 24 0 0 1 32 8 Z', // outer rounded square
    'M32 17 H68 A15 15 0 0 1 83 32 V68 A15 15 0 0 1 68 83 H32 A15 15 0 0 1 17 68 V32 A15 15 0 0 1 32 17 Z', // inner cutout → ring
    'M50 32 A18 18 0 1 0 50 68 A18 18 0 1 0 50 32 Z', // lens outer
    'M50 40 A10 10 0 1 0 50 60 A10 10 0 1 0 50 40 Z', // lens inner → ring
    'M73.5 21 A5.5 5.5 0 1 0 73.5 32 A5.5 5.5 0 1 0 73.5 21 Z', // flash dot
  ].join(' '),

  /** TikTok — stylized note: stem, ring note-head, top-right flare. */
  tiktok: [
    'M56 18 H68 V66 H56 Z', // stem
    'M41 46 A17 17 0 1 0 41 80 A17 17 0 1 0 41 46 Z', // note head outer
    'M41 55 A8 8 0 1 0 41 71 A8 8 0 1 0 41 55 Z', // note head inner → ring
    'M56 18 A26 26 0 0 1 82 44 L70 44 A14 14 0 0 0 56 30 Z', // top flare
  ].join(' '),

  /** LinkedIn — "in" letterforms: dot, i-stem, n with arch. */
  linkedin: [
    'M24 13 A8 8 0 1 0 24 29 A8 8 0 1 0 24 13 Z', // i dot
    'M17 34 H31 V84 H17 Z', // i stem
    'M41 34 H55 V84 H41 Z', // n left leg
    'M41 56 A21 21 0 0 1 83 56 L69 56 A7 7 0 0 0 55 56 Z', // n arch
    'M69 56 H83 V84 H69 Z', // n right leg
  ].join(' '),

  /** X — the letterform as two crossing bars. */
  x: [
    'M17 12 L27 20 L83 88 L73 80 Z',
    'M73 12 L83 20 L27 88 L17 80 Z',
  ].join(' '),

  /** YouTube — rounded rect with the play triangle punched out (even-odd). */
  youtube: [
    'M30 22 H70 A18 18 0 0 1 88 40 V60 A18 18 0 0 1 70 78 H30 A18 18 0 0 1 12 60 V40 A18 18 0 0 1 30 22 Z',
    'M43 37 L43 63 L63 50 Z', // play triangle hole
  ].join(' '),
} satisfies Record<string, string>;

export type ShapeName = keyof typeof SHAPES;

/** All built-in shape keys — handy for pickers / morph carousels. */
export const SHAPE_NAMES = Object.keys(SHAPES) as ShapeName[];
