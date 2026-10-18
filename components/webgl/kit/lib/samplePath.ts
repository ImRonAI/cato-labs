'use client';

/**
 * samplePath — rasterize vector art into normalized point clouds.
 *
 * The shared core (`sampleCanvas`) draws any canvas callback onto a small
 * offscreen canvas, grid-samples the filled pixels, and returns them as a
 * centered [-1, 1]² point cloud (y-up, z = tiny jitter) ready to feed
 * ParticleSculpture. `sampleSvgPath` wraps it for single-path SVG data
 * (authored in a `0 0 100 100` viewBox) and caches per path.
 *
 * Returned arrays are READ-ONLY for consumers — they are shared from a cache.
 * Sampling is deterministic (seeded PRNG) so SSR and client renders agree.
 */

export type CanvasDraw = (ctx: CanvasRenderingContext2D, size: number) => void;

const BOX = 256;
const GRID_STEP = 2;
const ALPHA_THRESHOLD = 110;
const MAX_PATH_CACHE = 48;

/** mulberry32 — tiny deterministic PRNG; every sampler is seeded, never Math.random. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a — stable string → uint32 hash (per-slug / per-path seeds). */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Core grid sampler. Draws `draw` on a 256² offscreen canvas (black fill /
 * stroke on transparent), collects filled cells, normalizes them into a
 * centered [-1, 1]² cloud. If the art has fewer cells than `targetCount`,
 * cells repeat with sub-cell jitter; if more, a seeded shuffle picks an even
 * subset. Returns `targetCount * 3` floats (x, y, z≈0).
 */
function sampleCanvasCore(
  draw: CanvasDraw,
  targetCount: number,
  rand: () => number,
): Float32Array {
  const out = new Float32Array(Math.max(0, targetCount) * 3);
  if (targetCount <= 0 || typeof document === 'undefined') return out;

  const canvas = document.createElement('canvas');
  canvas.width = BOX;
  canvas.height = BOX;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return out;

  ctx.clearRect(0, 0, BOX, BOX);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  draw(ctx, BOX);

  const img = ctx.getImageData(0, 0, BOX, BOX).data;
  const cells: number[] = [];
  let minX = BOX;
  let minY = BOX;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < BOX; y += GRID_STEP) {
    for (let x = 0; x < BOX; x += GRID_STEP) {
      if (img[(y * BOX + x) * 4 + 3] > ALPHA_THRESHOLD) {
        cells.push(x, y);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const n = cells.length / 2;
  if (n === 0) return out;

  // seeded shuffle → even sub-sample when target < cell count
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = order[i];
    order[i] = order[j];
    order[j] = t;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX + GRID_STEP, maxY - minY + GRID_STEP);
  const s = 2 / span; // longer axis maps exactly to [-1, 1]

  for (let i = 0; i < targetCount; i++) {
    const c = order[i % n];
    const wrap = i >= n; // duplicate cell → jitter so copies don't stack
    const jx = wrap ? (rand() - 0.5) * GRID_STEP : 0;
    const jy = wrap ? (rand() - 0.5) * GRID_STEP : 0;
    const px = cells[c * 2] + GRID_STEP / 2 + jx;
    const py = cells[c * 2 + 1] + GRID_STEP / 2 + jy;
    out[i * 3] = (px - cx) * s;
    out[i * 3 + 1] = -(py - cy) * s; // canvas y-down → world y-up
    out[i * 3 + 2] = (rand() - 0.5) * 0.05; // tiny z jitter so the cloud has depth
  }
  return out;
}

/**
 * Sample an arbitrary canvas drawing into a point cloud. This is the shared
 * core — skylines.ts composes its silhouettes with it.
 * `seed` makes the sub-sampling/jitter deterministic (pass hashString(slug)).
 */
export function sampleCanvas(
  draw: CanvasDraw,
  targetCount: number,
  seed = 1,
): Float32Array {
  return sampleCanvasCore(draw, targetCount, mulberry32(seed));
}

const pathCache = new Map<string, Float32Array>();

/**
 * Sample single-path SVG data (authored in a `0 0 100 100` viewBox, filled
 * with the even-odd rule so compound paths can punch holes — e.g. the
 * YouTube play triangle). Results are cached per (path, count); the returned
 * array is shared — do not mutate it.
 */
export function sampleSvgPath(pathData: string, targetCount: number): Float32Array {
  const key = `${targetCount}|${pathData}`;
  const hit = pathCache.get(key);
  if (hit) return hit;

  const pts = sampleCanvasCore(
    (ctx, size) => {
      const path = new Path2D(pathData);
      ctx.save();
      ctx.scale(size / 100, size / 100); // authored in a 0 0 100 100 viewBox
      ctx.fill(path, 'evenodd');
      ctx.restore();
    },
    targetCount,
    mulberry32(hashString(pathData)),
  );

  if (pathCache.size >= MAX_PATH_CACHE) {
    const first = pathCache.keys().next().value;
    if (first !== undefined) pathCache.delete(first);
  }
  pathCache.set(key, pts);
  return pts;
}
