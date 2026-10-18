'use client';

/**
 * skylines — stylized city-silhouette point clouds for region pages.
 *
 * Each skyline is a procedural base of building bars (seeded per slug, so
 * SSR and client agree) plus ONE recognizable landmark accent drawn on top.
 * The drawing happens on an offscreen canvas and reuses the samplePath grid
 * sampler core, so output format matches every other sculpture target:
 * centered [-1, 1]², y-up, z≈0, `targetCount * 3` floats.
 *
 * Usage:
 *   <ParticleSculpture points={skylinePoints('palm-springs', 2200)} />
 */

import { hashString, mulberry32, sampleCanvas, type CanvasDraw } from './samplePath';

export const SKYLINE_SLUGS = [
  'palm-springs',
  'palm-desert',
  'indio',
  'san-bernardino',
  'big-bear',
  'los-angeles',
  'orange-county',
  'san-francisco',
  'napa',
  'phoenix',
  'salt-lake-city',
] as const;

export type SkylineSlug = (typeof SKYLINE_SLUGS)[number];

type Landmark = (ctx: CanvasRenderingContext2D, s: number, rand: () => number) => void;

/** Seeded building bars along a common baseline — the shared skyline body. */
function drawBuildings(ctx: CanvasRenderingContext2D, s: number, rand: () => number) {
  const base = s * 0.82;
  let x = 0;
  while (x < s) {
    const w = s * (0.045 + rand() * 0.055);
    const h = s * (0.1 + rand() * 0.28);
    ctx.fillRect(x, base - h, w + 1, h + (s - base));
    x += w + s * (0.006 + rand() * 0.016);
  }
}

const LANDMARKS: Record<string, Landmark> = {
  /** Palm Springs — a windmill trio of blades on a slim tower. */
  'palm-springs': (ctx, s) => {
    const hx = s * 0.62;
    const hy = s * 0.42;
    const base = s * 0.82;
    ctx.fillRect(hx - s * 0.008, hy, s * 0.016, base - hy); // tower
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + k * ((Math.PI * 2) / 3) + 0.35;
      const len = s * 0.17;
      const w = s * 0.035;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const px = -dy;
      const py = dx;
      ctx.beginPath();
      ctx.moveTo(hx + px * w * 0.3, hy + py * w * 0.3);
      ctx.lineTo(hx + dx * len + px * w, hy + dy * len + py * w);
      ctx.lineTo(hx + dx * len - px * w, hy + dy * len - py * w);
      ctx.lineTo(hx - px * w * 0.3, hy - py * w * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(hx, hy, s * 0.02, 0, Math.PI * 2);
    ctx.fill();
  },

  /** San Francisco — Transamerica pyramid triangle + spire. */
  'san-francisco': (ctx, s) => {
    const base = s * 0.82;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.2);
    ctx.lineTo(s * 0.4, base);
    ctx.lineTo(s * 0.6, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(s * 0.494, s * 0.12, s * 0.012, s * 0.1); // spire
  },

  /** Big Bear — twin mountain peaks rising behind the town. */
  'big-bear': (ctx, s) => {
    const base = s * 0.82;
    ctx.beginPath();
    ctx.moveTo(s * 0.06, base);
    ctx.lineTo(s * 0.34, s * 0.36);
    ctx.lineTo(s * 0.52, base);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.44, base);
    ctx.lineTo(s * 0.7, s * 0.3);
    ctx.lineTo(s * 0.94, base);
    ctx.closePath();
    ctx.fill();
  },

  /** Phoenix — Camelback mountain: tall head hump + lower hump. */
  phoenix: (ctx, s) => {
    const base = s * 0.82;
    ctx.beginPath();
    ctx.arc(s * 0.6, base, s * 0.14, Math.PI, 0); // head
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.8, base, s * 0.1, Math.PI, 0); // hump
    ctx.fill();
    ctx.fillRect(s * 0.42, base - s * 0.02, s * 0.5, s * 0.02); // saddle line
  },

  /** Salt Lake City — jagged Wasatch ridge across the whole width. */
  'salt-lake-city': (ctx, s, rand) => {
    const base = s * 0.82;
    ctx.beginPath();
    ctx.moveTo(0, base);
    const peaks = 9;
    for (let i = 0; i <= peaks; i++) {
      const x = (i / peaks) * s;
      const y = s * (0.42 + rand() * 0.2);
      ctx.lineTo(x, y);
      if (i < peaks) ctx.lineTo(((i + 0.5) / peaks) * s, s * (0.56 + rand() * 0.14));
    }
    ctx.lineTo(s, base);
    ctx.closePath();
    ctx.fill();
  },

  /** Napa — rolling hill arcs with vine-row dashes along the crests. */
  napa: (ctx, s) => {
    const base = s * 0.82;
    const hills: Array<[number, number]> = [
      [s * 0.28, s * 0.3],
      [s * 0.62, s * 0.36],
      [s * 0.92, s * 0.28],
    ];
    for (const [cx, r] of hills) {
      ctx.beginPath();
      ctx.arc(cx, base, r, Math.PI, 0);
      ctx.fill();
      // vine rows: short dashes marching along the hill crest
      for (let i = -3; i <= 3; i++) {
        const t = Math.PI + ((i + 3.5) / 7) * Math.PI;
        const vx = cx + Math.cos(t) * (r - s * 0.035);
        const vy = base + Math.sin(t) * (r - s * 0.035);
        ctx.fillRect(vx - s * 0.004, vy - s * 0.022, s * 0.008, s * 0.022);
      }
    }
  },

  /** Los Angeles — downtown tower cluster + one thin spire. */
  'los-angeles': (ctx, s) => {
    const base = s * 0.82;
    const towers: Array<[number, number, number]> = [
      [0.38, 0.34, 0.05],
      [0.45, 0.46, 0.055],
      [0.53, 0.56, 0.05], // tallest — carries the spire
      [0.6, 0.4, 0.055],
      [0.68, 0.3, 0.045],
    ];
    for (const [tx, th, tw] of towers) {
      ctx.fillRect(s * (tx - tw / 2), base - s * th, s * tw, s * th);
    }
    ctx.fillRect(s * 0.526, base - s * 0.56 - s * 0.16, s * 0.008, s * 0.16); // spire
  },

  /** Orange County — a pier running out over a water line. */
  'orange-county': (ctx, s) => {
    ctx.fillRect(s * 0.48, s * 0.845, s * 0.48, s * 0.018); // deck
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(s * (0.54 + i * 0.1), s * 0.863, s * 0.012, s * 0.07); // posts
    }
    ctx.fillRect(s * 0.88, s * 0.79, s * 0.08, s * 0.055); // hut at the end
    ctx.fillRect(0, s * 0.93, s, s * 0.014); // water line
  },

  /** San Bernardino — twin mountains split by a deep gap. */
  'san-bernardino': (ctx, s) => {
    const base = s * 0.82;
    ctx.beginPath();
    ctx.moveTo(0, base);
    ctx.lineTo(s * 0.3, s * 0.3);
    ctx.lineTo(s * 0.5, s * 0.58); // the gap
    ctx.lineTo(s * 0.72, s * 0.26);
    ctx.lineTo(s, base);
    ctx.closePath();
    ctx.fill();
  },

  /** Palm Desert — a pair of stroked palm silhouettes. */
  'palm-desert': (ctx, s) => {
    const base = s * 0.82;
    const palms: Array<[number, number, number]> = [
      [0.36, 0.44, -0.07], // x, top height, lean
      [0.66, 0.5, 0.06],
    ];
    for (const [px, top, lean] of palms) {
      const bx = s * px;
      const tx = bx + s * lean;
      const ty = s * (1 - top) - s * 0.14;
      // trunk — a curved stroke
      ctx.lineWidth = s * 0.02;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, base);
      ctx.quadraticCurveTo(bx + s * lean * 0.4, base - s * 0.2, tx, ty);
      ctx.stroke();
      // fronds — arcs fanning out from the crown
      ctx.lineWidth = s * 0.013;
      for (let f = -2; f <= 2; f++) {
        const a = -Math.PI / 2 + f * 0.55;
        const ex = tx + Math.cos(a) * s * 0.11;
        const ey = ty + Math.sin(a) * s * 0.07 + s * 0.035;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + Math.cos(a) * s * 0.06, ty + Math.sin(a) * s * 0.05 - s * 0.02, ex, ey);
        ctx.stroke();
      }
    }
  },

  /** Indio — festival tent peaks in a row, each flying a small flag. */
  indio: (ctx, s) => {
    const base = s * 0.82;
    const tents: Array<[number, number, number]> = [
      [0.28, 0.58, 0.11],
      [0.5, 0.5, 0.12],
      [0.72, 0.6, 0.11],
    ];
    for (const [cx, apexY, halfW] of tents) {
      ctx.beginPath();
      ctx.moveTo(s * (cx - halfW), base);
      ctx.lineTo(s * cx, s * apexY);
      ctx.lineTo(s * (cx + halfW), base);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(s * cx - s * 0.004, s * apexY - s * 0.05, s * 0.008, s * 0.05); // flag pole
      ctx.beginPath(); // flag
      ctx.moveTo(s * cx, s * apexY - s * 0.05);
      ctx.lineTo(s * cx + s * 0.035, s * apexY - s * 0.038);
      ctx.lineTo(s * cx, s * apexY - s * 0.026);
      ctx.closePath();
      ctx.fill();
    }
  },
};

const skylineCache = new Map<string, Float32Array>();
const MAX_CACHE = 32;

/**
 * Point-cloud skyline for a region slug. Deterministic per slug (seeded
 * PRNG). Unknown slugs still return the seeded building base with no
 * landmark accent, so region pages never render empty.
 * The returned array is shared from a cache — do not mutate it.
 */
export function skylinePoints(slug: string, targetCount: number): Float32Array {
  const key = `${slug}|${targetCount}`;
  const hit = skylineCache.get(key);
  if (hit) return hit;

  const rand = mulberry32(hashString(`skyline:${slug}`));
  const landmark = LANDMARKS[slug];
  const draw: CanvasDraw = (ctx, s) => {
    drawBuildings(ctx, s, rand);
    if (landmark) landmark(ctx, s, rand);
  };
  const pts = sampleCanvas(draw, targetCount, hashString(`skyline-sample:${slug}`));

  if (skylineCache.size >= MAX_CACHE) {
    const first = skylineCache.keys().next().value;
    if (first !== undefined) skylineCache.delete(first);
  }
  skylineCache.set(key, pts);
  return pts;
}
