/**
 * Origami engine for the contact paper plane.
 *
 * A sheet (x ∈ [-W, W], y ∈ [-H, H], A-series proportions, nose at (0, H))
 * is folded into a classic dart in four sequential steps:
 *
 *   step 0  both top corners to the centre line
 *   step 1  the new diagonal edges to the centre line again
 *   step 2  the keel: fold in half along the centre line
 *   step 3  both wings out, along creases parallel to the keel
 *
 * At build time the sheet is cut into rigid convex facets by replaying the
 * flat folds exactly (2D reflections + half-plane clipping). Every fold has
 * a fixed world axis (it lies on material that is stationary while it acts)
 * and each facet records the folds that carry it, so any scrubbed state is a
 * short chain of axis rotations per vertex: real folding, reversible, and
 * allocation-free at runtime.
 */

export const W = 1;
export const H = 1.414;
/** distance from the keel to the wing creases */
export const KEEL = 0.3;
/** half-angle of the keel V in the finished plane */
export const KEEL_HALF = 0.2;

type V2 = [number, number];
/** 2D affine map [a, b, c, d, tx, ty]: (x, y) → (a x + b y + tx, c x + d y + ty) */
type Aff = [number, number, number, number, number, number];

const ID: Aff = [1, 0, 0, 1, 0, 0];

function apply(m: Aff, p: V2): V2 {
  return [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
}
function mul(a: Aff, b: Aff): Aff {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[0] * b[4] + a[1] * b[5] + a[4],
    a[2] * b[4] + a[3] * b[5] + a[5],
  ];
}
function inv(m: Aff): Aff {
  const det = m[0] * m[3] - m[1] * m[2];
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + b * m[5]), -(c * m[4] + d * m[5])];
}
function reflect(p: V2, u: V2): Aff {
  const l = Math.hypot(u[0], u[1]);
  const ux = u[0] / l;
  const uy = u[1] / l;
  const a = 2 * ux * ux - 1;
  const b = 2 * ux * uy;
  const d = 2 * uy * uy - 1;
  return [a, b, b, d, p[0] - (a * p[0] + b * p[1]), p[1] - (b * p[0] + d * p[1])];
}
function side(p: V2, u: V2, q: V2): number {
  return u[0] * (q[1] - p[1]) - u[1] * (q[0] - p[0]);
}
function area(q: V2[]): number {
  let s = 0;
  for (let i = 0; i < q.length; i++) {
    const a = q[i];
    const b = q[(i + 1) % q.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}
/** split a convex polygon by a line → [left, right] */
function clip(poly: V2[], p: V2, u: V2): [V2[], V2[]] {
  const L: V2[] = [];
  const R: V2[] = [];
  const eps = 1e-9;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(p, u, a);
    const sb = side(p, u, b);
    if (sa >= -eps) L.push(a);
    if (sa <= eps) R.push(a);
    if ((sa > eps && sb < -eps) || (sa < -eps && sb > eps)) {
      const t = sa / (sa - sb);
      const x: V2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      L.push(x);
      R.push(x);
    }
  }
  return [
    L.length >= 3 && Math.abs(area(L)) > 1e-6 ? L : [],
    R.length >= 3 && Math.abs(area(R)) > 1e-6 ? R : [],
  ];
}

export interface FoldAxis {
  px: number;
  py: number;
  pz: number;
  ux: number;
  uy: number;
  uz: number;
}

export interface Facet {
  /** sheet-space polygon, CCW, flat [x0, y0, x1, y1, …] */
  poly: Float32Array;
  /** folds carrying this facet, in fold order */
  folds: number[];
  /** layer count (number of flat folds applied) */
  layer: number;
}

export interface FoldModel {
  facets: Facet[];
  axes: FoldAxis[];
  /** signed final angle per fold */
  angles: number[];
  /** scrub step (0..3) of each fold */
  step: number[];
  triVerts: number;
  edgeVerts: number;
}

/** Rodrigues rotation of (x, y, z) about an axis; writes out[o..o+2] */
export function rotateAbout(
  ax: FoldAxis,
  ang: number,
  x: number,
  y: number,
  z: number,
  out: Float32Array | number[],
  o: number,
) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const px = x - ax.px;
  const py = y - ax.py;
  const pz = z - ax.pz;
  const ux = ax.ux;
  const uy = ax.uy;
  const uz = ax.uz;
  const dot = ux * px + uy * py + uz * pz;
  const cx = uy * pz - uz * py;
  const cy = uz * px - ux * pz;
  const cz = ux * py - uy * px;
  out[o] = px * c + cx * s + ux * dot * (1 - c) + ax.px;
  out[o + 1] = py * c + cy * s + uy * dot * (1 - c) + ax.py;
  out[o + 2] = pz * c + cz * s + uz * dot * (1 - c) + ax.pz;
}

interface BuildFacet {
  poly: V2[];
  m: Aff;
  folds: number[];
}

const FLAP = Math.PI - 0.03;

export function buildFoldModel(): FoldModel {
  let facets: BuildFacet[] = [
    { poly: [[-W, -H], [W, -H], [W, H], [-W, H]], m: ID, folds: [] },
  ];
  const axes: FoldAxis[] = [];
  const angles: number[] = [];
  const step: number[] = [];
  const tmp = [0, 0, 0];

  /** in-plane axis through p along u, with angle sign chosen so `probe`
      lifts toward +z (front) or −z at the half-way point */
  const planeAxis = (p: V2, u: V2, probe: V2, mag: number, zSign: 1 | -1) => {
    const l = Math.hypot(u[0], u[1]);
    const ax: FoldAxis = { px: p[0], py: p[1], pz: 0, ux: u[0] / l, uy: u[1] / l, uz: 0 };
    rotateAbout(ax, mag / 2, probe[0], probe[1], 0, tmp, 0);
    return { ax, ang: Math.sign(tmp[2]) === zSign ? mag : -mag };
  };

  /** flat fold: every facet on the probe's side of the crease is carried */
  const flat = (k: number, s: number, p: V2, u: V2, probe: V2, zSign: 1 | -1) => {
    const dir: V2 = side(p, u, probe) > 0 ? u : [-u[0], -u[1]];
    const R = reflect(p, dir);
    const out: BuildFacet[] = [];
    for (const f of facets) {
      const wp = f.poly.map((q) => apply(f.m, q));
      const [l, r] = clip(wp, p, dir);
      const im = inv(f.m);
      if (r.length) out.push({ poly: r.map((q) => apply(im, q)), m: f.m, folds: f.folds });
      if (l.length) out.push({ poly: l.map((q) => apply(im, q)), m: mul(R, f.m), folds: [...f.folds, k] });
    }
    facets = out;
    const { ax, ang } = planeAxis(p, dir, probe, FLAP, zSign);
    axes[k] = ax;
    angles[k] = ang;
    step[k] = s;
  };

  const cut = (p: V2, u: V2) => {
    const out: BuildFacet[] = [];
    for (const f of facets) {
      const wp = f.poly.map((q) => apply(f.m, q));
      const [l, r] = clip(wp, p, u);
      const im = inv(f.m);
      if (l.length) out.push({ poly: l.map((q) => apply(im, q)), m: f.m, folds: f.folds });
      if (r.length) out.push({ poly: r.map((q) => apply(im, q)), m: f.m, folds: f.folds });
    }
    facets = out;
  };

  const nose: V2 = [0, H];
  const t8 = Math.tan(Math.PI / 8);

  /* step 0 — corners to the centre (flaps fold toward the viewer) */
  flat(0, 0, nose, [-W, -W], [-W, H - 0.05], 1);
  flat(1, 0, nose, [W, -W], [W, H - 0.05], 1);
  /* step 1 — edges to the centre again */
  flat(2, 1, nose, [-t8, -1], [-W, -H * 0.5], 1);
  flat(3, 1, nose, [t8, -1], [W, -H * 0.5], 1);

  /* split along the keel and the wing creases */
  cut([0, 0], [0, 1]);
  cut([KEEL, 0], [0, 1]);
  cut([-KEEL, 0], [0, 1]);

  /* membership by flat (step-1) world centroid */
  for (const f of facets) {
    const wp = f.poly.map((q) => apply(f.m, q));
    const cx = wp.reduce((s, q) => s + q[0], 0) / wp.length;
    if (cx < 0) f.folds = [...f.folds, 4];
    if (cx < -KEEL) f.folds = [...f.folds, 5];
    if (cx > KEEL) f.folds = [...f.folds, 6];
  }

  /* step 2 — keel: the left half swings round in front (+z), so the
     flaps (folded toward +z) end up tucked inside the V */
  const keelMag = Math.PI - 2 * KEEL_HALF;
  {
    const { ax, ang } = planeAxis([0, 0], [0, 1], [-W, 0], keelMag, 1);
    axes[4] = ax;
    angles[4] = ang;
    step[4] = 2;
  }

  /* step 3 — wings. Hinges parallel to the keel; each wing opens away
     from the other half by (90° − half-V), so the wings end up flat. */
  const wingMag = Math.PI / 2 - KEEL_HALF;
  const dist2 = (a: number[], b: number[]) =>
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const leftHinge = [0, 0, 0];
  rotateAbout(axes[4], angles[4], -KEEL, 0, 0, leftHinge, 0);
  const leftTip = [0, 0, 0];
  rotateAbout(axes[4], angles[4], -W, 0, 0, leftTip, 0);
  const pick = (ax: FoldAxis, tip: number[], away: number[]) => {
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    rotateAbout(ax, wingMag, tip[0], tip[1], tip[2], a, 0);
    rotateAbout(ax, -wingMag, tip[0], tip[1], tip[2], b, 0);
    return dist2(a, away) > dist2(b, away) ? wingMag : -wingMag;
  };
  axes[6] = { px: KEEL, py: 0, pz: 0, ux: 0, uy: 1, uz: 0 };
  angles[6] = pick(axes[6], [W, 0, 0], leftHinge);
  step[6] = 3;
  axes[5] = { px: leftHinge[0], py: 0, pz: leftHinge[2], ux: 0, uy: 1, uz: 0 };
  angles[5] = pick(axes[5], leftTip, [KEEL, 0, 0]);
  step[5] = 3;

  const out: Facet[] = facets.map((f) => {
    /* keep polygons CCW in sheet space */
    const poly = area(f.poly) < 0 ? [...f.poly].reverse() : f.poly;
    const arr = new Float32Array(poly.length * 2);
    poly.forEach((q, i) => {
      arr[i * 2] = q[0];
      arr[i * 2 + 1] = q[1];
    });
    return { poly: arr, folds: f.folds, layer: f.folds.filter((k) => k <= 3).length };
  });

  let triVerts = 0;
  let edgeVerts = 0;
  for (const f of out) {
    const n = f.poly.length / 2;
    triVerts += (n - 2) * 3;
    edgeVerts += n * 2;
  }

  return { facets: out, axes, angles, step, triVerts, edgeVerts };
}

/**
 * Pose a sheet-space vertex for fold progress `steps` (4 values 0..1).
 * Folds act in index order, matching how the model was built.
 */
export function poseVertex(
  model: FoldModel,
  folds: number[],
  steps: ArrayLike<number>,
  x: number,
  y: number,
  z: number,
  out: Float32Array | number[],
  o: number,
) {
  out[o] = x;
  out[o + 1] = y;
  out[o + 2] = z;
  for (let j = 0; j < folds.length; j++) {
    const k = folds[j];
    const a = model.angles[k] * steps[model.step[k]];
    if (a === 0) continue;
    rotateAbout(model.axes[k], a, out[o], out[o + 1], out[o + 2], out, o);
  }
}
