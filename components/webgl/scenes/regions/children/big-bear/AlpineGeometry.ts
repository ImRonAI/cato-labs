import * as THREE from 'three';

/**
 * Procedural architectural & topographic geometry for Big Bear ("Two-Season Alpine Basin"):
 * - Twin peaks relief: Snow Summit (left-back) & Bear Mountain (right-back)
 * - Sculpted ski run with a kicker jump ramp and landing apron
 * - Recessed Big Bear Lake shoreline basin
 * - Exact marching-squares topographic contour lines
 * - Summit chairlift towers, terminals & haul cable loop
 * - Lakefront A-frame cabin, chimney, shoreline dock & moored boat
 * - Tiered alpine pine forest instancing data
 */

export const PLINTH_RX = 2.68;
export const PLINTH_RZ = 2.08;
export const LAKE_Y = 0.17;

/** Deterministic pseudo-random in [0, 1]. */
function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise for subtle crystalline rock facets. */
function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/** Gaussian ridge helper with elliptical rotation. */
function peak(
  x: number,
  z: number,
  cx: number,
  cz: number,
  h: number,
  sx: number,
  sz: number,
  angle = 0,
): number {
  const dx = x - cx;
  const dz = z - cz;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const rx = (dx * c + dz * s) / sx;
  const rz = (-dx * s + dz * c) / sz;
  const d2 = rx * rx + rz * rz;
  return h * Math.exp(-d2);
}

/**
 * Exact elevation of the Big Bear diorama at local (x, z).
 * Returns height y above the plinth top (y = 0).
 */
export function terrainHeightAt(x: number, z: number): number {
  // Elliptical mask so the relief tapers cleanly to the plinth rim
  const nx = x / (PLINTH_RX * 0.96);
  const nz = z / (PLINTH_RZ * 0.96);
  const r2 = nx * nx + nz * nz;
  if (r2 >= 1) return 0.02;
  const rimFade = Math.pow(1 - r2, 1.35);

  // 1. Twin Peaks: Snow Summit (8,200' — left-back) & Bear Mountain (8,805' — right-back)
  const snowSummit =
    peak(x, z, -0.98, -0.68, 2.08, 0.92, 0.72, -0.28) +
    peak(x, z, -1.62, -0.22, 1.18, 0.68, 0.62, 0.35);
  const bearMountain =
    peak(x, z, 0.96, -0.82, 2.38, 0.96, 0.74, 0.32) +
    peak(x, z, 1.72, -0.25, 1.24, 0.65, 0.62, -0.25);
  const highSaddle = peak(x, z, 0.0, -0.88, 1.48, 0.85, 0.55, 0.0);

  // 2. Mid-slope ski run bench & kicker ramp (from [-0.95,-0.55] toward [0.0, 0.25])
  const kickerRamp = peak(x, z, -0.14, 0.18, 0.44, 0.32, 0.24, -0.55);

  // 3. Right shoreline bench for the A-frame cabin & landing apron
  const cabinBench = peak(x, z, 1.18, 0.62, 0.38, 0.88, 0.65, -0.15);

  // 4. Faceted alpine arête crease lines
  const facet =
    (valueNoise(x * 2.4 + 3.1, z * 2.4 + 1.7) - 0.5) * 0.14 +
    (valueNoise(x * 5.2 - 1.4, z * 5.2 + 4.2) - 0.5) * 0.05;

  let h = (snowSummit + bearMountain + highSaddle * 0.55 + kickerRamp + cabinBench + facet) * rimFade;

  // 5. Carve the Big Bear Lake basin on the front-left / center-front
  const lakeDx = (x + 0.48) / 1.42;
  const lakeDz = (z - 0.86) / 0.68;
  const lakeDist = lakeDx * lakeDx + lakeDz * lakeDz;
  const lakeCarve = Math.exp(-lakeDist * 1.65);
  h = h * (1 - lakeCarve * 0.82) - lakeCarve * 0.12;

  return Math.max(0.03, h + 0.14 * rimFade);
}

/**
 * Builds the faceted alpine relief mesh with vertex normals and a custom
 * `aMeta` attribute (x: normalized elevation, y: lake proximity, z: ski-run proximity).
 */
export function buildMountainReliefGeo(segX = 84, segZ = 68): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(PLINTH_RX * 1.94, PLINTH_RZ * 1.94, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const meta = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const x0 = pos.getX(i);
    const z0 = pos.getZ(i);
    // Project square grid onto elliptical plinth footprint for zero wasted triangles
    const u = x0 / (PLINTH_RX * 0.97);
    const v = z0 / (PLINTH_RZ * 0.97);
    const ex = u * Math.sqrt(Math.max(0, 1 - 0.5 * v * v)) * PLINTH_RX * 0.96;
    const ez = v * Math.sqrt(Math.max(0, 1 - 0.5 * u * u)) * PLINTH_RZ * 0.96;

    const y = terrainHeightAt(ex, ez);
    pos.setXYZ(i, ex, y, ez);

    // Distance to the primary ski run centerline (from [-0.95,-0.55] to [-0.12, 0.22])
    const tRun = Math.max(0, Math.min(1, ((ex + 0.95) * 0.83 + (ez + 0.55) * 0.77) / 1.28));
    const rx = -0.95 + tRun * 0.83;
    const rz = -0.55 + tRun * 0.77;
    const dRun = Math.hypot(ex - rx, ez - rz);
    const runMask = Math.exp(-(dRun * dRun) / 0.08);

    // Shore / lake basin proximity
    const shoreMask = y < LAKE_Y + 0.08 ? 1.0 : 0.0;

    meta[i * 3] = Math.min(1, y / 2.35);
    meta[i * 3 + 1] = shoreMask;
    meta[i * 3 + 2] = runMask;
  }

  geo.setAttribute('aMeta', new THREE.BufferAttribute(meta, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Extracts crisp marching-squares topographic contour lines across the twin peaks.
 */
export function buildTopoLinesGeo(): THREE.BufferGeometry {
  const nx = 64;
  const nz = 52;
  const vals = new Float32Array((nx + 1) * (nz + 1));
  const xs = new Float32Array(nx + 1);
  const zs = new Float32Array(nz + 1);

  for (let i = 0; i <= nx; i++) {
    xs[i] = ((i / nx) * 2 - 1) * PLINTH_RX * 0.94;
  }
  for (let j = 0; j <= nz; j++) {
    zs[j] = ((j / nz) * 2 - 1) * PLINTH_RZ * 0.94;
  }
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      vals[j * (nx + 1) + i] = terrainHeightAt(xs[i], zs[j]);
    }
  }

  const levels = [0.32, 0.48, 0.65, 0.82, 1.0, 1.18, 1.36, 1.54, 1.72, 1.9, 2.08, 2.24];
  const pts: number[] = [];

  const interp = (v1: number, v2: number, level: number) => {
    const denom = v2 - v1;
    if (Math.abs(denom) < 1e-6) return 0.5;
    return Math.max(0, Math.min(1, (level - v1) / denom));
  };

  for (const level of levels) {
    const yLift = level + 0.012;
    for (let j = 0; j < nz; j++) {
      const z0 = zs[j];
      const z1 = zs[j + 1];
      for (let i = 0; i < nx; i++) {
        const x0 = xs[i];
        const x1 = xs[i + 1];
        // Skip outside ellipse
        const cx = 0.5 * (x0 + x1);
        const cz = 0.5 * (z0 + z1);
        if ((cx * cx) / (PLINTH_RX * PLINTH_RX) + (cz * cz) / (PLINTH_RZ * PLINTH_RZ) > 0.88) {
          continue;
        }

        const v00 = vals[j * (nx + 1) + i];
        const v10 = vals[j * (nx + 1) + i + 1];
        const v11 = vals[(j + 1) * (nx + 1) + i + 1];
        const v01 = vals[(j + 1) * (nx + 1) + i];

        const crossings: [number, number][] = [];
        if ((v00 < level) !== (v10 < level)) {
          crossings.push([x0 + (x1 - x0) * interp(v00, v10, level), z0]);
        }
        if ((v10 < level) !== (v11 < level)) {
          crossings.push([x1, z0 + (z1 - z0) * interp(v10, v11, level)]);
        }
        if ((v11 < level) !== (v01 < level)) {
          crossings.push([x1 + (x0 - x1) * interp(v11, v01, level), z1]);
        }
        if ((v01 < level) !== (v00 < level)) {
          crossings.push([x0, z1 + (z0 - z1) * interp(v01, v00, level)]);
        }

        if (crossings.length >= 2) {
          pts.push(
            crossings[0][0],
            yLift,
            crossings[0][1],
            crossings[1][0],
            yLift,
            crossings[1][1],
          );
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

/**
 * Builds Cato's complete ski/snowboard run + big-air jump curve:
 * - u ∈ [0.00, 0.45]: Carving down Snow Summit upper & mid slope to the kicker lip
 * - u ∈ [0.45, 0.78]: Airborne parabolic jump & flip over the lake channel
 * - u ∈ [0.78, 1.00]: Landing apron run-out beside the A-frame cabin & dock
 */
export function buildSnowboardRunCurve(): {
  curve: THREE.CatmullRomCurve3;
  carveRibbonGeo: THREE.BufferGeometry;
  jumpArcGeo: THREE.BufferGeometry;
} {
  const ptOnSlope = (x: number, z: number, lift = 0.04) =>
    new THREE.Vector3(x, terrainHeightAt(x, z) + lift, z);

  const waypoints = [
    ptOnSlope(-1.02, -0.58, 0.04), // 0: Summit drop-in
    ptOnSlope(-0.82, -0.34, 0.04), // 1: Upper carve left
    ptOnSlope(-0.54, -0.14, 0.04), // 2: Mid carve right
    ptOnSlope(-0.32, 0.05, 0.05),  // 3: Kicker approach
    ptOnSlope(-0.12, 0.20, 0.08),  // 4: Kicker launch lip (u ≈ 0.44)
    new THREE.Vector3(0.14, terrainHeightAt(-0.12, 0.20) + 0.56, 0.39), // 5: Big-air apex!
    new THREE.Vector3(0.40, terrainHeightAt(0.58, 0.65) + 0.38, 0.54),  // 6: Descent arc
    ptOnSlope(0.62, 0.66, 0.04),   // 7: Landing touch-down
    ptOnSlope(0.84, 0.84, 0.04),   // 8: Cabin run-out stop
  ];

  const curve = new THREE.CatmullRomCurve3(waypoints, false, 'centripetal', 0.35);

  // Build snow-carve ribbon on the slope portions (u: 0..0.44 and 0.76..1.0)
  const ribbonVerts: number[] = [];
  const ribbonUvs: number[] = [];
  const ribbonIndices: number[] = [];
  const samples = 72;
  const p = new THREE.Vector3();
  const tang = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, tang);
    side.crossVectors(tang, up).normalize();
    // Narrow to zero while airborne (u ∈ [0.44, 0.75])
    const airborne =
      u > 0.43 && u < 0.76
        ? Math.sin(((u - 0.43) / 0.33) * Math.PI)
        : 0;
    const halfW = 0.055 * (1 - airborne * 0.88);
    const groundY = airborne > 0.05 ? p.y - 0.02 : terrainHeightAt(p.x, p.z) + 0.018;

    ribbonVerts.push(
      p.x - side.x * halfW,
      groundY,
      p.z - side.z * halfW,
      p.x + side.x * halfW,
      groundY,
      p.z + side.z * halfW,
    );
    ribbonUvs.push(u, 0, u, 1);

    if (i < samples) {
      const b = i * 2;
      ribbonIndices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }

  const carveRibbonGeo = new THREE.BufferGeometry();
  carveRibbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(ribbonVerts, 3));
  carveRibbonGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ribbonUvs, 2));
  carveRibbonGeo.setIndex(ribbonIndices);
  carveRibbonGeo.computeVertexNormals();

  // Dashed trajectory arc + vertical drop ticks for the airborne jump
  const arcPts: number[] = [];
  const arcSteps = 44;
  const pNext = new THREE.Vector3();
  for (let i = 0; i < arcSteps; i++) {
    const u0 = i / arcSteps;
    const u1 = (i + 0.6) / arcSteps;
    curve.getPointAt(u0, p);
    curve.getPointAt(Math.min(1, u1), pNext);
    arcPts.push(p.x, p.y + 0.03, p.z, pNext.x, pNext.y + 0.03, pNext.z);

    // Vertical drop lines under the airborne jump
    if (u0 >= 0.44 && u0 <= 0.76 && i % 3 === 0) {
      const gy = Math.max(LAKE_Y, terrainHeightAt(p.x, p.z));
      arcPts.push(p.x, gy + 0.02, p.z, p.x, p.y, p.z);
    }
  }
  const jumpArcGeo = new THREE.BufferGeometry();
  jumpArcGeo.setAttribute('position', new THREE.Float32BufferAttribute(arcPts, 3));

  return { curve, carveRibbonGeo, jumpArcGeo };
}

/**
 * Summit Express Chairlift: 4 lattice towers along the West Ridge + haul cables.
 */
export interface ChairliftData {
  towerPositions: [number, number, number][];
  cableGeo: THREE.BufferGeometry;
  basePos: [number, number, number];
  summitPos: [number, number, number];
}

export function buildChairliftData(): ChairliftData {
  const x0 = -1.92;
  const z0 = 0.36;
  const x1 = -1.06;
  const z1 = -0.68;

  const towerPositions: [number, number, number][] = [];
  const towerFracs = [0.0, 0.32, 0.66, 1.0];
  for (const f of towerFracs) {
    const tx = x0 + (x1 - x0) * f;
    const tz = z0 + (z1 - z0) * f;
    const ty = terrainHeightAt(tx, tz);
    towerPositions.push([tx, ty, tz]);
  }

  // Build dual haul cables (uphill left strand + downhill right strand) with catenary sag
  const cablePts: number[] = [];
  const perpX = -(z1 - z0);
  const perpZ = x1 - x0;
  const pLen = Math.hypot(perpX, perpZ) || 1;
  const ox = (perpX / pLen) * 0.085;
  const oz = (perpZ / pLen) * 0.085;
  const towerTopOffset = 0.34;

  for (let side of [-1, 1]) {
    for (let s = 0; s < towerPositions.length - 1; s++) {
      const A = towerPositions[s];
      const B = towerPositions[s + 1];
      const segs = 12;
      for (let k = 0; k < segs; k++) {
        const u0 = k / segs;
        const u1 = (k + 1) / segs;
        const sag0 = Math.sin(u0 * Math.PI) * 0.028;
        const sag1 = Math.sin(u1 * Math.PI) * 0.028;
        cablePts.push(
          A[0] + (B[0] - A[0]) * u0 + ox * side,
          A[1] + (B[1] - A[1]) * u0 + towerTopOffset - sag0,
          A[2] + (B[2] - A[2]) * u0 + oz * side,
          A[0] + (B[0] - A[0]) * u1 + ox * side,
          A[1] + (B[1] - A[1]) * u1 + towerTopOffset - sag1,
          A[2] + (B[2] - A[2]) * u1 + oz * side,
        );
      }
    }
  }

  const cableGeo = new THREE.BufferGeometry();
  cableGeo.setAttribute('position', new THREE.Float32BufferAttribute(cablePts, 3));

  return {
    towerPositions,
    cableGeo,
    basePos: towerPositions[0],
    summitPos: towerPositions[towerPositions.length - 1],
  };
}

/**
 * Deterministic placements for the alpine pine forest framing Big Bear Lake and the slopes.
 */
export interface PinePlacement {
  x: number;
  y: number;
  z: number;
  s: number;
  ry: number;
}

export function buildPinePlacements(): PinePlacement[] {
  const candidates: [number, number, number][] = [
    // West forest along chairlift & shoreline
    [-2.15, 0.12, 0.95],
    [-1.98, 0.42, 0.88],
    [-1.75, 0.72, 1.02],
    [-2.18, -0.25, 1.05],
    [-1.85, -0.52, 0.92],
    [-1.55, -0.82, 0.85],
    [-1.42, -0.18, 0.78],
    [-1.68, 0.08, 0.84],
    // Central ridge between Snow Summit & Bear Mountain
    [-0.38, -0.95, 0.92],
    [-0.12, -1.12, 1.05],
    [0.18, -0.98, 0.88],
    [0.42, -0.62, 0.82],
    [0.15, -0.42, 0.76],
    [0.52, -0.28, 0.90],
    // East forest behind & around the A-frame cabin
    [1.68, 0.12, 1.08],
    [1.92, 0.38, 0.95],
    [1.76, 0.68, 0.86],
    [1.54, 0.95, 0.92],
    [2.12, 0.05, 0.82],
    [1.85, -0.35, 0.94],
    [1.48, -0.45, 0.85],
    [1.22, -0.18, 0.78],
    // South shoreline coves
    [0.48, 1.25, 0.82],
    [0.78, 1.18, 0.90],
    [1.12, 1.12, 0.76],
    [-1.35, 1.22, 0.84],
    [-1.02, 1.38, 0.74],
    [-1.62, 0.98, 0.88],
    // High alpine timberline accents
    [-1.28, -0.95, 0.72],
    [1.38, -0.92, 0.74],
    [0.65, -1.15, 0.68],
    [-0.65, -1.18, 0.70],
  ];

  return candidates.map(([x, z, s], idx) => ({
    x,
    y: terrainHeightAt(x, z) - 0.01,
    z,
    s,
    ry: (idx * 1.91) % (Math.PI * 2),
  }));
}
