import * as THREE from 'three';
import {
  buildLineGeometry,
  mergeBufferGeometries,
  transformedBox,
  transformedCylinder,
} from '../orange-county/geom';
import { hashString, mulberry32 } from '../../../../kit/lib/samplePath';

export const DESERT_Y = -0.68;
export const GRID_COLS = 18;
export const GRID_ROWS = 14;
export const METRO_NODE_COUNT = GRID_COLS * GRID_ROWS; // 252 instanced nodes

/**
 * Evaluates the iconic Camelback Mountain profile along x in [-1.85 .. +1.85], z centered at -0.85:
 * - Camel's Head & Praying Monk pinnacle on the west (x ~ -1.05, y ~ +0.52)
 * - Echo Canyon saddle (x ~ -0.58, y ~ +0.02)
 * - Main Camelback Hump summit (x ~ +0.12, y ~ +1.08)
 * - Cholla eastern ridge tapering down (x ~ +0.95 .. +1.65)
 */
function camelbackHeight(lx: number, lz: number): number {
  // Distance from ridge spine z(x)
  const spineZ = -0.88 + 0.14 * Math.sin(lx * 1.3);
  const dz = (lz - spineZ) / 0.62;
  const crossFalloff = Math.exp(-dz * dz * 1.65);

  // Head peak (-1.06), Hump summit (+0.12), Eastern shoulder (+0.88)
  const head = 1.18 * Math.exp(-Math.pow((lx + 1.06) / 0.34, 2));
  const monk = 0.52 * Math.exp(-Math.pow((lx + 0.78) / 0.12, 2));
  const hump = 1.74 * Math.exp(-Math.pow((lx - 0.12) / 0.56, 2));
  const eastShoulder = 0.86 * Math.exp(-Math.pow((lx - 0.88) / 0.46, 2));

  const profile = Math.max(head, monk * 0.95, hump, eastShoulder * 0.92);

  // Add angular geologic facet planes
  const facet =
    0.055 * Math.sin(lx * 7.5 + lz * 5.0) + 0.035 * Math.cos(lx * 12.0 - lz * 8.0);

  return Math.max(0, (profile + facet) * crossFalloff);
}

/**
 * Builds one sculpted multi-armed Sonoran Saguaro cactus monolith at (sx, sy, sz).
 */
function buildSaguaroParts(
  sx: number,
  sy: number,
  sz: number,
  h: number,
  yaw: number,
  seed: number,
): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const r = 0.024 * (0.85 + 0.3 * (h / 0.42));
  // Main fluted column + rounded crown
  parts.push(transformedCylinder(r * 0.92, r * 1.08, h, 7, sx, sy + h * 0.5, sz, 0, yaw, 0));

  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);

  // Left arm (elbow + vertical riser)
  const arm1Y = sy + h * 0.46;
  const out1 = r * 2.4;
  const arm1H = h * 0.38;
  parts.push(
    transformedBox(out1, r * 1.35, r * 1.35, sx - cosY * out1 * 0.5, arm1Y, sz + sinY * out1 * 0.5, 0, yaw, 0),
    transformedCylinder(
      r * 0.78,
      r * 0.85,
      arm1H,
      7,
      sx - cosY * out1,
      arm1Y + arm1H * 0.5,
      sz + sinY * out1,
    ),
  );

  // Right arm (slightly higher or lower per seed)
  if (seed > 0.2) {
    const arm2Y = sy + h * (0.36 + 0.22 * seed);
    const out2 = r * 2.2;
    const arm2H = h * (0.30 + 0.14 * seed);
    parts.push(
      transformedBox(out2, r * 1.3, r * 1.3, sx + cosY * out2 * 0.5, arm2Y, sz - sinY * out2 * 0.5, 0, yaw, 0),
      transformedCylinder(
        r * 0.76,
        r * 0.82,
        arm2H,
        7,
        sx + cosY * out2,
        arm2Y + arm2H * 0.5,
        sz - sinY * out2,
      ),
    );
  }
  return parts;
}

/**
 * Builds a procedural branching 3D monsoon lightning filament geometry with
 * vertex attributes `aProgress` (0 at cloud -> 1 at ground) and `aBoltId` (0..4)
 * so the shader can animate crisp electric-blue strikes with zero CPU work.
 */
function buildMonsoonArcFilaments(): THREE.BufferGeometry {
  const rng = mulberry32(hashString('phx-monsoon-arcs'));
  const positions: number[] = [];
  const progresses: number[] = [];
  const boltIds: number[] = [];
  const branchWeights: number[] = [];

  const bolts = [
    { start: [-0.95, 1.56, -0.82], end: [-1.04, DESERT_Y + 1.12, -0.86], id: 0 }, // Strikes Camelback Head
    { start: [0.18, 1.62, -0.84], end: [0.12, DESERT_Y + 1.68, -0.86], id: 1 }, // Strikes Camelback Hump
    { start: [-0.25, 1.58, -0.15], end: [-0.32, DESERT_Y + 0.02, 0.28], id: 2 }, // Strikes Central Metro Grid
    { start: [0.88, 1.54, -0.25], end: [0.96, DESERT_Y + 0.02, 0.42], id: 3 }, // Strikes East Valley / Scottsdale
    { start: [-1.28, 1.50, -0.05], end: [-1.36, DESERT_Y + 0.02, 0.52], id: 4 }, // Strikes West Valley
  ];

  function addBranch(
    p0: [number, number, number],
    p1: [number, number, number],
    prog0: number,
    prog1: number,
    boltId: number,
    weight: number,
    segs: number,
    jitterAmp: number,
  ) {
    const pts: [number, number, number][] = [p0];
    for (let i = 1; i < segs; i++) {
      const u = i / segs;
      const env = Math.sin(u * Math.PI);
      pts.push([
        THREE.MathUtils.lerp(p0[0], p1[0], u) + (rng() - 0.5) * jitterAmp * env,
        THREE.MathUtils.lerp(p0[1], p1[1], u),
        THREE.MathUtils.lerp(p0[2], p1[2], u) + (rng() - 0.5) * jitterAmp * env,
      ]);
    }
    pts.push(p1);

    for (let i = 0; i < pts.length - 1; i++) {
      const u0 = THREE.MathUtils.lerp(prog0, prog1, i / (pts.length - 1));
      const u1 = THREE.MathUtils.lerp(prog0, prog1, (i + 1) / (pts.length - 1));
      positions.push(...pts[i], ...pts[i + 1]);
      progresses.push(u0, u1);
      boltIds.push(boltId, boltId);
      branchWeights.push(weight, weight);

      // Spawn secondary forks off primary leader
      if (weight > 0.8 && i > 2 && i < pts.length - 3 && rng() < 0.32) {
        const forkEnd: [number, number, number] = [
          pts[i][0] + (rng() - 0.5) * 0.52,
          pts[i][1] - (0.28 + rng() * 0.35),
          pts[i][2] + (rng() - 0.5) * 0.36,
        ];
        addBranch(pts[i], forkEnd, u0, Math.min(1, u0 + 0.28), boltId, 0.48, 6, jitterAmp * 0.65);
      }
    }
  }

  for (const b of bolts) {
    addBranch(
      b.start as [number, number, number],
      b.end as [number, number, number],
      0,
      1,
      b.id,
      1.0,
      18,
      0.22,
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('aProgress', new THREE.BufferAttribute(new Float32Array(progresses), 1));
  geo.setAttribute('aBoltId', new THREE.BufferAttribute(new Float32Array(boltIds), 1));
  geo.setAttribute('aWeight', new THREE.BufferAttribute(new Float32Array(branchWeights), 1));
  return geo;
}

export function buildPhoenixMonolithsAndGrid() {
  // 1. Faceted Camelback Mountain Monolith (low-poly crystalline facets for dramatic refraction)
  const segX = 34;
  const segZ = 20;
  const camelbackGeo = new THREE.PlaneGeometry(3.8, 1.55, segX, segZ);
  camelbackGeo.rotateX(-Math.PI / 2);
  camelbackGeo.translate(0, DESERT_Y, -0.88);

  const pos = camelbackGeo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const pz = pos.getZ(i);
    const rx = Math.abs(px) / 1.9;
    const rz = Math.abs(pz + 0.88) / 0.775;
    const skirt = 1 - THREE.MathUtils.smoothstep(Math.max(rx, rz), 0.80, 1.0);
    pos.setY(i, DESERT_Y + camelbackHeight(px, pz) * skirt);
  }
  const facetedCamelback = camelbackGeo.toNonIndexed();
  facetedCamelback.computeVertexNormals();
  camelbackGeo.dispose();

  // Inner smaller glowing sapphire core inside Camelback
  const coreGeo = facetedCamelback.clone();
  coreGeo.scale(0.92, 0.86, 0.88);
  coreGeo.translate(0, -0.06, -0.08);

  const camelbackEdgesGeo = new THREE.EdgesGeometry(facetedCamelback, 14);

  // 2. Sculpted Saguaro Desert Ridge Monoliths along foreground bajada & flanks
  const saguaroSpecs: [number, number, number, number, number][] = [
    [-1.78, -0.18, 0.48, 0.25, 0.85],
    [-1.42, 0.52, 0.42, -0.35, 0.62],
    [-0.96, 1.18, 0.36, 0.15, 0.35],
    [1.12, 1.15, 0.44, -0.22, 0.91],
    [1.58, 0.68, 0.38, 0.42, 0.48],
    [1.86, -0.12, 0.46, -0.18, 0.74],
    [-1.92, 0.88, 0.32, 0.55, 0.12],
    [1.42, -0.45, 0.34, 0.10, 0.56],
  ];
  const saguaroParts: THREE.BufferGeometry[] = [];
  const bajadaParts: THREE.BufferGeometry[] = [];

  for (const [sx, sz, sh, syaw, sseed] of saguaroSpecs) {
    // Small faceted desert boulder pedestal under each saguaro
    const pedestal = new THREE.ConeGeometry(0.16, 0.08, 6);
    pedestal.translate(sx, DESERT_Y + 0.03, sz);
    bajadaParts.push(pedestal);
    saguaroParts.push(...buildSaguaroParts(sx, DESERT_Y + 0.04, sz, sh, syaw, sseed));
  }

  // Downtown Phoenix & Scottsdale Mid-Rise Prism Cluster on the Valley Grid
  const metroPrisms: [number, number, number, number, number][] = [
    [-0.32, 0.28, 0.11, 0.34, 0.11],
    [-0.16, 0.24, 0.10, 0.28, 0.10],
    [-0.46, 0.32, 0.09, 0.24, 0.09],
    [-0.28, 0.42, 0.10, 0.22, 0.10],
    [0.92, 0.36, 0.09, 0.20, 0.09], // Scottsdale Quarter / Kierland node
    [0.78, 0.46, 0.08, 0.16, 0.08],
  ];
  for (const [mx, mz, mw, mh, md] of metroPrisms) {
    bajadaParts.push(transformedBox(mw, mh, md, mx, DESERT_Y + mh * 0.5, mz));
  }

  // 3. Crisp Valley of the Sun Metropolitan Arterial Grid Lines
  const gridSegs: number[] = [];
  const xMin = -2.25;
  const xMax = 2.25;
  const zMin = -0.25;
  const zMax = 1.65;

  for (let c = 0; c < GRID_COLS; c++) {
    const gx = THREE.MathUtils.lerp(xMin, xMax, c / (GRID_COLS - 1));
    gridSegs.push(gx, DESERT_Y + 0.004, zMin, gx, DESERT_Y + 0.004, zMax);
  }
  for (let r = 0; r < GRID_ROWS; r++) {
    const gz = THREE.MathUtils.lerp(zMin, zMax, r / (GRID_ROWS - 1));
    gridSegs.push(xMin, DESERT_Y + 0.004, gz, xMax, DESERT_Y + 0.004, gz);
  }
  // Grand Avenue iconic diagonal arterial cutting across the Phoenix grid!
  gridSegs.push(-1.85, DESERT_Y + 0.006, -0.22, -0.18, DESERT_Y + 0.006, 0.45);

  // Unit geometry for the 252 Instanced Metropolitan Light Nodes
  const nodeGeo = new THREE.OctahedronGeometry(0.024, 0);
  nodeGeo.scale(1.0, 1.35, 1.0);

  return {
    camelbackGeo: facetedCamelback,
    camelbackCoreGeo: coreGeo,
    camelbackEdgesGeo,
    saguaroGeo: mergeBufferGeometries(saguaroParts),
    bajadaPorcelainGeo: mergeBufferGeometries(bajadaParts),
    metroGridLinesGeo: buildLineGeometry(gridSegs),
    monsoonArcsGeo: buildMonsoonArcFilaments(),
    nodeGeo,
    camelbackHeadPos: [-1.06, DESERT_Y + 1.18, -0.88] as [number, number, number],
  };
}
