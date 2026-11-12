import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface PalmDesertGeometries {
  plinthPorcelainGeo: THREE.BufferGeometry;
  plinthAzureGeo: THREE.BufferGeometry;
  storefrontsPorcelainGeo: THREE.BufferGeometry;
  storefrontsGlassGeo: THREE.BufferGeometry;
  storefrontsGlowGeo: THREE.BufferGeometry;
  mountainsGeo: THREE.BufferGeometry;
  mountainsLineGeo: THREE.BufferGeometry;
  palmsTrunksGeo: THREE.BufferGeometry;
  palmsAndFloraGeo: THREE.BufferGeometry;
  golfGreenGeo: THREE.BufferGeometry;
  waterPondGeo: THREE.BufferGeometry;
  bunkerGeo: THREE.BufferGeometry;
  flagstickGeo: THREE.BufferGeometry;
  flagPennantGeo: THREE.BufferGeometry;
  sunHaloGeo: THREE.BufferGeometry;
  lineworkGeo: THREE.BufferGeometry;
  dispose: () => void;
}

/**
 * Height function for the sculpted Santa Rosa Mountains backdrop.
 * Local x in [-2.65, 2.65], z in [-1.62, -0.48].
 */
export function mountainHeightAt(x: number, z: number): number {
  const zCenter = -1.12 + 0.08 * Math.sin(x * 1.1);
  const dz = z - zCenter;
  const frontSlope =
    dz > 0
      ? Math.exp(-(dz * dz) / (0.36 * 0.36))
      : Math.exp(-(dz * dz) / (0.28 * 0.28));
  const xEdge = 1 - smoothStep(2.05, 2.62, Math.abs(x));

  const westPeak = 1.56 * Math.exp(-((x + 1.48) * (x + 1.48)) / (0.72 * 0.72));
  const saddle = 0.62 * Math.exp(-((x + 0.22) * (x + 0.22)) / (0.55 * 0.55));
  const toroPeak = 2.16 * Math.exp(-((x - 1.02) * (x - 1.02)) / (0.88 * 0.88));
  const eastShoulder = 1.28 * Math.exp(-((x - 2.05) * (x - 2.05)) / (0.58 * 0.58));

  const spurZ = z - -0.74;
  const spurEnv = Math.exp(-(spurZ * spurZ) / (0.22 * 0.22));
  const spurs =
    spurEnv *
    (0.56 * Math.exp(-((x + 0.95) * (x + 0.95)) / (0.38 * 0.38)) +
      0.72 * Math.exp(-((x - 0.45) * (x - 0.45)) / (0.42 * 0.42)) +
      0.52 * Math.exp(-((x - 1.65) * (x - 1.65)) / (0.36 * 0.36)));

  const facet =
    0.09 * Math.abs(Math.sin(x * 4.2 + z * 2.6)) +
    0.05 * Math.cos(x * 7.5 - z * 5.0);

  const raw = (westPeak + saddle + toroPeak + eastShoulder) * frontSlope + spurs;
  return Math.max(0, (raw + facet * frontSlope) * xEdge);
}

/**
 * Height function for the Championship Golf Green on the east terrace.
 * Center around (1.66, 0.42), cup at (1.88, 0.38).
 */
export function greenHeightAt(x: number, z: number): number {
  const dx = (x - 1.66) / 0.86;
  const dz = (z - 0.42) / 0.68;
  const r2 = dx * dx + dz * dz;
  const mound = 0.15 * Math.exp(-r2 * 1.1);
  const tier = 0.032 * Math.sin((x - 1.3) * 3.2 + z * 1.8) * Math.exp(-r2 * 0.9);
  const cx = x - 1.88;
  const cz = z - 0.38;
  const cupDip = -0.045 * Math.exp(-(cx * cx + cz * cz) / (0.075 * 0.075));
  return 0.045 + mound + tier + cupDip;
}

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function toNonIndexedWithNormals(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g.clone();
  g.dispose();
  const keep = new Set(['position', 'normal']);
  for (const name of Object.keys(out.attributes)) {
    if (!keep.has(name)) out.deleteAttribute(name);
  }
  out.computeVertexNormals();
  return out;
}

function makeRoundedPlinth(
  w: number,
  d: number,
  h: number,
  r: number,
  y0: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hd = d / 2;
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  return toNonIndexedWithNormals(geo);
}

function boxGeo(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  ry = 0,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry !== 0) g.rotateY(ry);
  g.translate(x, y, z);
  return toNonIndexedWithNormals(g);
}

function cylGeo(
  rt: number,
  rb: number,
  h: number,
  seg: number,
  x: number,
  y: number,
  z: number,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y, z);
  return toNonIndexedWithNormals(g);
}

/**
 * Builds an arched, pleated 3D California Fan Palm frond radiating from (topX, topY, topZ).
 */
function makeFanFrond(
  topX: number,
  topY: number,
  topZ: number,
  angleY: number,
  len: number,
  liftAngle: number,
  droop: number,
  width: number,
): THREE.BufferGeometry {
  const segs = 5;
  const tris: number[] = [];
  const pushTri = (a: number[], b: number[], c: number[]) => {
    tris.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };

  const cosA = Math.cos(angleY);
  const sinA = Math.sin(angleY);
  const toWorld = (r: number, y: number, w: number): [number, number, number] => [
    topX + cosA * r - sinA * w,
    topY + y,
    topZ + sinA * r + cosA * w,
  ];

  for (let i = 0; i < segs; i++) {
    const u0 = i / segs;
    const u1 = (i + 1) / segs;
    const r0 = u0 * len;
    const r1 = u1 * len;

    // Parabolic arch: rises initially with liftAngle, then curves gracefully downward
    const y0 = Math.sin(liftAngle) * r0 - droop * u0 * u0 * len;
    const y1 = Math.sin(liftAngle) * r1 - droop * u1 * u1 * len;

    // Fan leaflet width envelope: narrow petiole at base, broad fan in mid-outer, tapered tip
    const env0 = Math.sin(Math.pow(u0, 0.65) * Math.PI) * width;
    const env1 = i === segs - 1 ? 0.004 : Math.sin(Math.pow(u1, 0.65) * Math.PI) * width;

    // V-shaped pleated midrib ridge for 3D light catch
    const ridge0 = 0.018 * (1 - u0 * 0.5);
    const ridge1 = 0.018 * (1 - u1 * 0.5);

    const c0 = toWorld(r0, y0 + ridge0, 0);
    const c1 = toWorld(r1, y1 + ridge1, 0);
    const l0 = toWorld(r0, y0, -env0);
    const l1 = toWorld(r1, y1, -env1);
    const rt0 = toWorld(r0, y0, env0);
    const rt1 = toWorld(r1, y1, env1);

    // Left blade half
    pushTri(c0, l0, c1);
    pushTri(c1, l0, l1);
    // Right blade half
    pushTri(c0, c1, rt0);
    pushTri(c1, rt1, rt0);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  g.computeVertexNormals();
  return g;
}

export function buildPalmDesertGeometries(compact: boolean): PalmDesertGeometries {
  /* ======================================================================
   * 1. PLINTH & BOULEVARD BASE
   * ====================================================================== */
  const plinthParts: THREE.BufferGeometry[] = [];
  // Upper porcelain terrace deck
  plinthParts.push(makeRoundedPlinth(5.48, 3.28, 0.11, 0.44, -0.11));
  // El Paseo north promenade sidewalk (under storefronts)
  plinthParts.push(boxGeo(3.62, 0.04, 0.82, -0.58, 0.02, -0.2));
  // El Paseo south sidewalk promenade
  plinthParts.push(boxGeo(3.42, 0.035, 0.22, -0.68, 0.0175, 0.92));
  // Divided median planter curbs (3 low islands along El Paseo)
  for (const mx of [-1.85, -0.65, 0.42]) {
    plinthParts.push(boxGeo(0.84, 0.048, 0.15, mx, 0.024, 0.62));
  }
  const plinthPorcelainGeo = mergeGeometries(plinthParts, false);
  plinthParts.forEach((g) => g.dispose());

  const azureBaseParts: THREE.BufferGeometry[] = [];
  // Lower azure plinth reveal
  azureBaseParts.push(makeRoundedPlinth(5.64, 3.44, 0.12, 0.48, -0.24));
  // El Paseo divided boulevard roadbed
  azureBaseParts.push(boxGeo(3.56, 0.016, 0.64, -0.62, 0.008, 0.56));
  // Median planter beds (azure soil top)
  for (const mx of [-1.85, -0.65, 0.42]) {
    azureBaseParts.push(boxGeo(0.78, 0.054, 0.1, mx, 0.027, 0.62));
  }
  const plinthAzureGeo = mergeGeometries(azureBaseParts, false);
  azureBaseParts.forEach((g) => g.dispose());

  /* ======================================================================
   * 2. EL PASEO LUXURY STOREFRONTS (Porcelain, Glass Vitrines, Interior Glow)
   * ====================================================================== */
  const sfPorcelain: THREE.BufferGeometry[] = [];
  const sfGlass: THREE.BufferGeometry[] = [];
  const sfGlowGeos: { geo: THREE.BufferGeometry; storeIdx: number }[] = [];

  // --- Storefront 0: West Desert-Modern Gallery (x = -1.78, z = -0.28) ---
  {
    const cx = -1.78;
    const cz = -0.28;
    sfPorcelain.push(boxGeo(0.96, 0.78, 0.07, cx, 0.43, cz - 0.24));
    sfPorcelain.push(boxGeo(0.08, 0.78, 0.52, cx - 0.44, 0.43, cz));
    sfPorcelain.push(boxGeo(0.08, 0.78, 0.52, cx + 0.44, 0.43, cz));
    sfPorcelain.push(boxGeo(1.12, 0.07, 0.74, cx, 0.84, cz + 0.06));
    sfPorcelain.push(boxGeo(1.06, 0.04, 0.68, cx, 0.9, cz + 0.03));
    for (let i = 0; i < 4; i++) {
      sfPorcelain.push(boxGeo(1.02, 0.018, 0.03, cx, 0.78, cz + 0.28 + i * 0.045));
    }
    sfPorcelain.push(boxGeo(0.24, 0.22, 0.18, cx - 0.12, 0.15, cz - 0.02));
    sfPorcelain.push(cylGeo(0.09, 0.09, 0.24, 16, cx - 0.12, 0.36, cz - 0.02));
    sfPorcelain.push(boxGeo(0.18, 0.32, 0.14, cx + 0.18, 0.2, cz - 0.04));

    sfGlass.push(boxGeo(0.8, 0.68, 0.025, cx, 0.38, cz + 0.22));
    sfGlowGeos.push({
      geo: boxGeo(0.78, 0.64, 0.02, cx, 0.39, cz - 0.18),
      storeIdx: 0,
    });
  }

  // --- Storefront 1: Central Two-Story Flagship Pavilion (x = -0.52, z = -0.30) ---
  {
    const cx = -0.52;
    const cz = -0.3;
    sfPorcelain.push(boxGeo(1.26, 0.98, 0.08, cx, 0.53, cz - 0.26));
    sfPorcelain.push(boxGeo(0.09, 0.98, 0.56, cx - 0.585, 0.53, cz));
    sfPorcelain.push(boxGeo(0.09, 0.98, 0.56, cx + 0.585, 0.53, cz));
    sfPorcelain.push(boxGeo(1.34, 0.065, 0.68, cx, 0.62, cz + 0.04));
    sfPorcelain.push(boxGeo(1.4, 0.07, 0.76, cx, 1.04, cz + 0.06));
    sfPorcelain.push(boxGeo(1.22, 0.045, 0.58, cx, 1.1, cz));
    for (const dx of [-0.52, -0.18, 0.18, 0.52]) {
      sfPorcelain.push(cylGeo(0.026, 0.026, 0.58, 12, cx + dx, 0.33, cz + 0.28));
    }
    for (const dx of [-0.34, 0, 0.34]) {
      sfPorcelain.push(boxGeo(0.2, 0.24, 0.18, cx + dx, 0.16, cz - 0.02));
    }

    sfGlass.push(boxGeo(1.08, 0.52, 0.025, cx, 0.32, cz + 0.2));
    sfGlass.push(boxGeo(1.08, 0.34, 0.025, cx, 0.83, cz + 0.16));
    sfGlowGeos.push({
      geo: boxGeo(1.04, 0.48, 0.02, cx, 0.33, cz - 0.2),
      storeIdx: 1,
    });
    sfGlowGeos.push({
      geo: boxGeo(1.02, 0.28, 0.02, cx, 0.83, cz - 0.2),
      storeIdx: 1,
    });
  }

  // --- Storefront 2: East Boutique & Butterfly Canopy (x = +0.58, z = -0.26) ---
  {
    const cx = 0.58;
    const cz = -0.26;
    sfPorcelain.push(boxGeo(0.84, 0.68, 0.07, cx, 0.38, cz - 0.22));
    sfPorcelain.push(boxGeo(0.075, 0.68, 0.48, cx - 0.38, 0.38, cz));
    sfPorcelain.push(boxGeo(0.075, 0.68, 0.48, cx + 0.38, 0.38, cz));
    const roof = new THREE.BoxGeometry(0.98, 0.055, 0.68);
    roof.rotateZ(0.07);
    roof.translate(cx, 0.75, cz + 0.05);
    sfPorcelain.push(toNonIndexedWithNormals(roof));
    sfPorcelain.push(boxGeo(0.88, 0.035, 0.14, cx, 0.54, cz + 0.26));
    sfPorcelain.push(boxGeo(0.36, 0.18, 0.2, cx, 0.13, cz - 0.02));

    sfGlass.push(boxGeo(0.68, 0.56, 0.025, cx, 0.32, cz + 0.18));
    sfGlowGeos.push({
      geo: boxGeo(0.64, 0.5, 0.02, cx, 0.34, cz - 0.16),
      storeIdx: 2,
    });
  }

  const storefrontsPorcelainGeo = mergeGeometries(sfPorcelain, false);
  sfPorcelain.forEach((g) => g.dispose());

  const storefrontsGlassGeo = mergeGeometries(sfGlass, false);
  sfGlass.forEach((g) => g.dispose());

  const taggedGlows = sfGlowGeos.map(({ geo, storeIdx }) => {
    const count = geo.attributes.position.count;
    const arr = new Float32Array(count);
    arr.fill(storeIdx);
    geo.setAttribute('aStore', new THREE.BufferAttribute(arr, 1));
    return geo;
  });
  const storefrontsGlowGeo = mergeGeometries(taggedGlows, false);
  taggedGlows.forEach((g) => g.dispose());

  /* ======================================================================
   * 3. SANTA ROSA MOUNTAINS BACKDROP & TOPOGRAPHIC CONTOUR LINES
   * ====================================================================== */
  const mCols = compact ? 56 : 84;
  const mRows = compact ? 24 : 36;
  const mX0 = -2.56;
  const mX1 = 2.56;
  const mZ0 = -1.58;
  const mZ1 = -0.48;

  const gridH: number[][] = [];
  for (let r = 0; r <= mRows; r++) {
    const row: number[] = [];
    const z = mZ0 + (mZ1 - mZ0) * (r / mRows);
    for (let c = 0; c <= mCols; c++) {
      const x = mX0 + (mX1 - mX0) * (c / mCols);
      row.push(mountainHeightAt(x, z));
    }
    gridH.push(row);
  }

  const mTriCount = mCols * mRows * 2;
  const mPos = new Float32Array(mTriCount * 9);
  let mPtr = 0;
  const pushTri = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
  ) => {
    mPos[mPtr++] = ax;
    mPos[mPtr++] = ay;
    mPos[mPtr++] = az;
    mPos[mPtr++] = bx;
    mPos[mPtr++] = by;
    mPos[mPtr++] = bz;
    mPos[mPtr++] = cx;
    mPos[mPtr++] = cy;
    mPos[mPtr++] = cz;
  };

  for (let r = 0; r < mRows; r++) {
    const z0 = mZ0 + (mZ1 - mZ0) * (r / mRows);
    const z1 = mZ0 + (mZ1 - mZ0) * ((r + 1) / mRows);
    for (let c = 0; c < mCols; c++) {
      const x0 = mX0 + (mX1 - mX0) * (c / mCols);
      const x1 = mX0 + (mX1 - mX0) * ((c + 1) / mCols);
      const h00 = gridH[r][c];
      const h10 = gridH[r][c + 1];
      const h01 = gridH[r + 1][c];
      const h11 = gridH[r + 1][c + 1];
      pushTri(x0, h00, z0, x0, h01, z1, x1, h10, z0);
      pushTri(x1, h10, z0, x0, h01, z1, x1, h11, z1);
    }
  }
  const mountainsGeo = new THREE.BufferGeometry();
  mountainsGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  mountainsGeo.computeVertexNormals();

  const mLinePts: number[] = [];
  for (let c = 0; c < mCols; c++) {
    const x0 = mX0 + (mX1 - mX0) * (c / mCols);
    const x1 = mX0 + (mX1 - mX0) * ((c + 1) / mCols);
    const z0 = -1.12 + 0.08 * Math.sin(x0 * 1.1);
    const z1 = -1.12 + 0.08 * Math.sin(x1 * 1.1);
    const y0 = mountainHeightAt(x0, z0) + 0.008;
    const y1 = mountainHeightAt(x1, z1) + 0.008;
    if (y0 > 0.06 || y1 > 0.06) {
      mLinePts.push(x0, y0, z0, x1, y1, z1);
    }
  }
  for (let c = 4; c < mCols; c += 4) {
    const x = mX0 + (mX1 - mX0) * (c / mCols);
    for (let r = 0; r < mRows; r++) {
      const z0 = mZ0 + (mZ1 - mZ0) * (r / mRows);
      const z1 = mZ0 + (mZ1 - mZ0) * ((r + 1) / mRows);
      const y0 = gridH[r][c];
      const y1 = gridH[r + 1][c];
      if (y0 > 0.12 && y1 > 0.12) {
        mLinePts.push(x, y0 + 0.005, z0, x, y1 + 0.005, z1);
      }
    }
  }
  for (let r = 2; r < mRows; r += 3) {
    const z = mZ0 + (mZ1 - mZ0) * (r / mRows);
    for (let c = 0; c < mCols; c++) {
      const x0 = mX0 + (mX1 - mX0) * (c / mCols);
      const x1 = mX0 + (mX1 - mX0) * ((c + 1) / mCols);
      const y0 = gridH[r][c];
      const y1 = gridH[r][c + 1];
      if (y0 > 0.14 && y1 > 0.14) {
        mLinePts.push(x0, y0 + 0.004, z, x1, y1 + 0.004, z);
      }
    }
  }
  const mountainsLineGeo = new THREE.BufferGeometry();
  mountainsLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(mLinePts, 3));

  /* ======================================================================
   * 4. CALIFORNIA FAN PALMS (Washingtonia filifera) & DESERT FLORA
   *    Positioned to frame the storefronts & green without blocking Cato's walk!
   * ====================================================================== */
  const palmSpecs = [
    // West El Paseo gateway palms
    { x: -2.36, y: 0.03, z: -0.1, h: 1.52, leanX: -0.1, leanZ: 0.04, rot: 0.2 },
    { x: -2.24, y: 0.03, z: 0.56, h: 1.34, leanX: -0.06, leanZ: 0.05, rot: 1.4 },
    // Plaza palms set back between the three storefronts (z = -0.08, behind Cato's promenade)
    { x: -1.18, y: 0.04, z: -0.08, h: 1.58, leanX: 0.04, leanZ: -0.03, rot: 2.1 },
    { x: 0.08, y: 0.04, z: -0.08, h: 1.64, leanX: -0.05, leanZ: -0.02, rot: 0.8 },
    // Transition palm between East Boutique and Country Club Green
    { x: 1.06, y: 0.04, z: -0.22, h: 1.48, leanX: 0.06, leanZ: -0.04, rot: 1.9 },
    // Country Club green framing palms on the far east
    { x: 2.28, y: 0.04, z: -0.18, h: 1.7, leanX: -0.08, leanZ: 0.04, rot: 0.4 },
    { x: 2.4, y: 0.04, z: 0.42, h: 1.4, leanX: 0.09, leanZ: 0.05, rot: 2.7 },
  ];

  const trunkParts: THREE.BufferGeometry[] = [];
  const frondAndFloraParts: { geo: THREE.BufferGeometry; wind: number }[] = [];

  for (const p of palmSpecs) {
    // Continuous overlapping trunk segments with subtle ring collars
    const segs = 10;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs;
      const t1 = (s + 1) / segs;
      const tm = (t0 + t1) * 0.5;
      const segH = (p.h / segs) * 1.04; // slight overlap so no gaps
      const rBot = 0.048 * (1 - t0 * 0.42);
      const rTop = 0.048 * (1 - t1 * 0.42) * 1.04;
      const sx = p.x + p.leanX * tm * tm;
      const sz = p.z + p.leanZ * tm * tm;
      const sy = p.y + tm * p.h;
      const g = new THREE.CylinderGeometry(rTop, rBot, segH, 10);
      g.rotateZ(-p.leanX * tm * 0.55);
      g.rotateX(p.leanZ * tm * 0.55);
      g.translate(sx, sy, sz);
      trunkParts.push(toNonIndexedWithNormals(g));
    }

    const topX = p.x + p.leanX;
    const topY = p.y + p.h;
    const topZ = p.z + p.leanZ;

    // Shaggy petiole crown heart
    const heart = new THREE.SphereGeometry(0.076, 10, 8);
    heart.scale(1, 1.3, 1);
    heart.translate(topX, topY - 0.03, topZ);
    trunkParts.push(toNonIndexedWithNormals(heart));

    // 16 lush, arching fan fronds in 3 canopy tiers
    const frondCount = 16;
    for (let f = 0; f < frondCount; f++) {
      const tier = f % 3; // 0 = upper, 1 = mid, 2 = lower skirt
      const angle = p.rot + (f / frondCount) * Math.PI * 2 + tier * 0.12;
      const len = tier === 0 ? 0.34 : tier === 1 ? 0.4 : 0.35;
      const liftAngle = tier === 0 ? 0.58 : tier === 1 ? 0.28 : 0.02;
      const droop = tier === 0 ? 0.32 : tier === 1 ? 0.46 : 0.58;
      const width = tier === 1 ? 0.072 : 0.062;
      const frondGeo = makeFanFrond(
        topX,
        topY + (tier === 0 ? 0.02 : 0),
        topZ,
        angle,
        len,
        liftAngle,
        droop,
        width,
      );
      frondAndFloraParts.push({ geo: frondGeo, wind: 0.75 + 0.25 * (tier / 2) });
    }
  }

  // Desert Agave Rosettes (architectural succulent stars in median & foothills)
  const agaveSpots = [
    { x: -1.68, y: 0.05, z: 0.62, s: 1.05 },
    { x: -1.98, y: 0.05, z: 0.62, s: 0.88 },
    { x: -0.78, y: 0.05, z: 0.62, s: 0.96 },
    { x: -0.48, y: 0.05, z: 0.62, s: 0.86 },
    { x: 0.32, y: 0.05, z: 0.62, s: 0.95 },
    { x: 0.56, y: 0.05, z: 0.62, s: 0.82 },
    { x: 0.96, y: 0.04, z: -0.38, s: 1.18 },
    { x: -2.28, y: 0.04, z: -0.35, s: 1.12 },
    { x: 2.18, y: 0.05, z: 0.82, s: 1.1 },
  ];
  for (const ag of agaveSpots) {
    const blades = 10;
    for (let b = 0; b < blades; b++) {
      const a = (b / blades) * Math.PI * 2 + ag.x;
      const inner = b % 2 === 0;
      const bl = new THREE.ConeGeometry(0.03 * ag.s, (inner ? 0.15 : 0.18) * ag.s, 4);
      bl.translate(0, (inner ? 0.075 : 0.09) * ag.s, 0);
      bl.rotateX(inner ? 0.46 : 0.86);
      bl.rotateY(a);
      bl.translate(ag.x, ag.y, ag.z);
      frondAndFloraParts.push({ geo: toNonIndexedWithNormals(bl), wind: 0.06 });
    }
  }

  // Golden Barrel Cacti clusters (ribbed geometric spheres)
  const barrelSpots = [
    { x: -1.52, y: 0.05, z: 0.62, r: 0.062 },
    { x: -0.62, y: 0.05, z: 0.62, r: 0.058 },
    { x: 1.18, y: 0.04, z: -0.44, r: 0.078 },
    { x: 1.32, y: 0.04, z: -0.36, r: 0.056 },
  ];
  for (const bc of barrelSpots) {
    const g = new THREE.DodecahedronGeometry(bc.r, 1);
    g.scale(1, 1.15, 1);
    g.translate(bc.x, bc.y + bc.r * 0.9, bc.z);
    frondAndFloraParts.push({ geo: toNonIndexedWithNormals(g), wind: 0.0 });
  }

  const palmsTrunksGeo = mergeGeometries(trunkParts, false);
  trunkParts.forEach((g) => g.dispose());

  const taggedFlora = frondAndFloraParts.map(({ geo, wind }) => {
    const count = geo.attributes.position.count;
    const wArr = new Float32Array(count);
    wArr.fill(wind);
    geo.setAttribute('aWind', new THREE.BufferAttribute(wArr, 1));
    return geo;
  });
  const palmsAndFloraGeo = mergeGeometries(taggedFlora, false);
  taggedFlora.forEach((g) => g.dispose());

  /* ======================================================================
   * 5. CHAMPIONSHIP GOLF GREEN, WATER POND, BUNKER & FLAGSTICK
   * ====================================================================== */
  const gSeg = compact ? 28 : 42;
  const greenPlane = new THREE.PlaneGeometry(1.66, 1.38, gSeg, gSeg);
  greenPlane.rotateX(-Math.PI / 2);
  greenPlane.translate(1.66, 0, 0.42);
  const gPos = greenPlane.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < gPos.count; i++) {
    const gx = gPos.getX(i);
    const gz = gPos.getZ(i);
    const nx = (gx - 1.66) / 0.83;
    const nz = (gz - 0.42) / 0.69;
    const ang = Math.atan2(nz, nx);
    const kidney = 1 + 0.12 * Math.cos(ang * 2 - 0.6) + 0.06 * Math.sin(ang * 3);
    const rad = Math.hypot(nx, nz);
    const clampedR = Math.min(rad, kidney);
    const cx = 1.66 + (rad > 1e-4 ? (nx / rad) * clampedR : 0) * 0.83;
    const cz = 0.42 + (rad > 1e-4 ? (nz / rad) * clampedR : 0) * 0.69;
    const edgeFade = 1 - smoothStep(kidney * 0.78, kidney, clampedR);
    const gy = 0.022 + (greenHeightAt(cx, cz) - 0.022) * edgeFade;
    gPos.setXYZ(i, cx, gy, cz);
  }
  const golfGreenGeo = toNonIndexedWithNormals(greenPlane);

  // Shimmering water hazard pond beside the green (x = 1.96, z = -0.26)
  const waterCyl = new THREE.CylinderGeometry(0.44, 0.44, 0.028, 28);
  waterCyl.scale(1.18, 1, 0.72);
  waterCyl.translate(1.96, 0.018, -0.26);
  const waterPondGeo = toNonIndexedWithNormals(waterCyl);

  // White-porcelain sand bunker with raised lip (x = 1.24, z = 0.94)
  const bunkerCyl = new THREE.CylinderGeometry(0.3, 0.26, 0.032, 24);
  bunkerCyl.scale(1.32, 1, 0.76);
  bunkerCyl.translate(1.24, 0.022, 0.94);
  const bunkerGeo = toNonIndexedWithNormals(bunkerCyl);

  // Putting cup rim + tall slender flagstick at (1.88, greenHeightAt(1.88, 0.38), 0.38)
  const cupY = greenHeightAt(1.88, 0.38);
  const flagParts: THREE.BufferGeometry[] = [];
  flagParts.push(cylGeo(0.058, 0.058, 0.028, 18, 1.88, cupY + 0.012, 0.38));
  flagParts.push(cylGeo(0.012, 0.015, 1.22, 10, 1.88, cupY + 0.61, 0.38));
  const finial = new THREE.SphereGeometry(0.028, 10, 8);
  finial.translate(1.88, cupY + 1.23, 0.38);
  flagParts.push(toNonIndexedWithNormals(finial));
  const flagstickGeo = mergeGeometries(flagParts, false);
  flagParts.forEach((g) => g.dispose());

  // Triangular pennant flag attached near top of flagstick
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0);
  flagShape.lineTo(0.46, -0.12);
  flagShape.lineTo(0, -0.25);
  flagShape.closePath();
  const flagPennantRaw = new THREE.ExtrudeGeometry(flagShape, {
    depth: 0.014,
    bevelEnabled: false,
  });
  flagPennantRaw.translate(0.01, 0, -0.007);
  const flagPennantGeo = toNonIndexedWithNormals(flagPennantRaw);

  /* ======================================================================
   * 6. DAWN SUN HALO RINGS
   * ====================================================================== */
  const haloPts: number[] = [];
  for (const r of [0.58, 0.78, 1.02, 1.28]) {
    const segs = 64;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      haloPts.push(
        Math.cos(a0) * r,
        Math.sin(a0) * r,
        0,
        Math.cos(a1) * r,
        Math.sin(a1) * r,
        0,
      );
    }
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI - Math.PI * 0.05;
    if (a >= -0.1 && a <= Math.PI + 0.1) {
      haloPts.push(
        Math.cos(a) * 0.62,
        Math.sin(a) * 0.62,
        0,
        Math.cos(a) * 1.18,
        Math.sin(a) * 1.18,
        0,
      );
    }
  }
  const sunHaloGeo = new THREE.BufferGeometry();
  sunHaloGeo.setAttribute('position', new THREE.Float32BufferAttribute(haloPts, 3));

  /* ======================================================================
   * 7. ARCHITECTURAL LINEWORK (Mullions, Datum Rim, Boulevard Lanes, Putting Arc)
   * ====================================================================== */
  const lines: number[] = [];
  const seg = (
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
  ) => {
    lines.push(x0, y0, z0, x1, y1, z1);
  };
  const rectXZ = (cx: number, y: number, cz: number, w: number, d: number) => {
    const hw = w / 2;
    const hd = d / 2;
    seg(cx - hw, y, cz - hd, cx + hw, y, cz - hd);
    seg(cx + hw, y, cz - hd, cx + hw, y, cz + hd);
    seg(cx + hw, y, cz + hd, cx - hw, y, cz + hd);
    seg(cx - hw, y, cz + hd, cx - hw, y, cz - hd);
  };
  const rectXY = (cx: number, cy: number, z: number, w: number, h: number) => {
    const hw = w / 2;
    const hh = h / 2;
    seg(cx - hw, cy - hh, z, cx + hw, cy - hh, z);
    seg(cx + hw, cy - hh, z, cx + hw, cy + hh, z);
    seg(cx + hw, cy + hh, z, cx - hw, cy + hh, z);
    seg(cx - hw, cy + hh, z, cx - hw, cy - hh, z);
  };

  // Storefront 0 window mullions & roof datum
  rectXY(-1.78, 0.38, -0.045, 0.8, 0.68);
  seg(-1.78 - 0.16, 0.04, -0.045, -1.78 - 0.16, 0.72, -0.045);
  seg(-1.78 + 0.16, 0.04, -0.045, -1.78 + 0.16, 0.72, -0.045);
  seg(-1.78 - 0.4, 0.54, -0.045, -1.78 + 0.4, 0.54, -0.045);
  rectXZ(-1.78, 0.878, -0.22, 1.12, 0.74);

  // Storefront 1 (Central Flagship) mullions, mezzanine band & roof datum
  rectXY(-0.52, 0.32, -0.085, 1.08, 0.52);
  rectXY(-0.52, 0.83, -0.125, 1.08, 0.34);
  for (const dx of [-0.36, 0, 0.36]) {
    seg(-0.52 + dx, 0.06, -0.085, -0.52 + dx, 0.58, -0.085);
    seg(-0.52 + dx, 0.66, -0.125, -0.52 + dx, 1.0, -0.125);
  }
  rectXZ(-0.52, 0.655, -0.26, 1.34, 0.68);
  rectXZ(-0.52, 1.078, -0.24, 1.4, 0.76);

  // Storefront 2 (East Boutique) mullions & awning datum
  rectXY(0.58, 0.32, -0.065, 0.68, 0.56);
  seg(0.58, 0.04, -0.065, 0.58, 0.6, -0.065);
  seg(0.58 - 0.34, 0.44, -0.065, 0.58 + 0.34, 0.44, -0.065);

  // El Paseo boulevard curbs & dashed lane markings
  seg(-2.38, 0.02, 0.24, 1.05, 0.02, 0.24);
  seg(-2.38, 0.02, 0.86, 1.05, 0.02, 0.86);
  for (let x = -2.25; x < 0.9; x += 0.24) {
    seg(x, 0.02, 0.42, x + 0.12, 0.02, 0.42);
    seg(x, 0.02, 0.74, x + 0.12, 0.02, 0.74);
  }
  for (let z = 0.28; z <= 0.82; z += 0.07) {
    seg(-1.14, 0.022, z, -1.0, 0.022, z);
    seg(0.02, 0.022, z, 0.16, 0.022, z);
  }

  // Golf green contour rings & dashed putting trajectory arc
  for (const rScale of [0.52, 0.76, 0.98]) {
    const pts = 42;
    for (let i = 0; i < pts; i++) {
      const a0 = (i / pts) * Math.PI * 2;
      const a1 = ((i + 1) / pts) * Math.PI * 2;
      const k0 = (1 + 0.12 * Math.cos(a0 * 2 - 0.6) + 0.06 * Math.sin(a0 * 3)) * rScale;
      const k1 = (1 + 0.12 * Math.cos(a1 * 2 - 0.6) + 0.06 * Math.sin(a1 * 3)) * rScale;
      const x0 = 1.66 + Math.cos(a0) * k0 * 0.83;
      const z0 = 0.42 + Math.sin(a0) * k0 * 0.69;
      const x1 = 1.66 + Math.cos(a1) * k1 * 0.83;
      const z1 = 0.42 + Math.sin(a1) * k1 * 0.69;
      seg(
        x0,
        greenHeightAt(x0, z0) + 0.005,
        z0,
        x1,
        greenHeightAt(x1, z1) + 0.005,
        z1,
      );
    }
  }
  // Putting trajectory dashed line from (1.12, 0.72) to cup (1.88, 0.38)
  const puttSteps = 22;
  for (let i = 0; i < puttSteps; i += 2) {
    const u0 = i / puttSteps;
    const u1 = (i + 1) / puttSteps;
    const px0 = 1.12 + (1.88 - 1.12) * u0;
    const pz0 = 0.72 + (0.38 - 0.72) * u0 - 0.14 * Math.sin(Math.PI * u0);
    const px1 = 1.12 + (1.88 - 1.12) * u1;
    const pz1 = 0.72 + (0.38 - 0.72) * u1 - 0.14 * Math.sin(Math.PI * u1);
    seg(
      px0,
      greenHeightAt(px0, pz0) + 0.012,
      pz0,
      px1,
      greenHeightAt(px1, pz1) + 0.012,
      pz1,
    );
  }

  // Plinth perimeter architectural datum border
  const pw = 5.42 / 2;
  const pd = 3.22 / 2;
  seg(-pw + 0.4, 0.005, pd, pw - 0.4, 0.005, pd);
  seg(-pw + 0.4, 0.005, -pd, pw - 0.4, 0.005, -pd);
  seg(-pw, 0.005, -pd + 0.4, -pw, 0.005, pd - 0.4);
  seg(pw, 0.005, -pd + 0.4, pw, 0.005, pd - 0.4);

  const lineworkGeo = new THREE.BufferGeometry();
  lineworkGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));

  return {
    plinthPorcelainGeo,
    plinthAzureGeo,
    storefrontsPorcelainGeo,
    storefrontsGlassGeo,
    storefrontsGlowGeo,
    mountainsGeo,
    mountainsLineGeo,
    palmsTrunksGeo,
    palmsAndFloraGeo,
    golfGreenGeo,
    waterPondGeo,
    bunkerGeo,
    flagstickGeo,
    flagPennantGeo,
    sunHaloGeo,
    lineworkGeo,
    dispose() {
      plinthPorcelainGeo.dispose();
      plinthAzureGeo.dispose();
      storefrontsPorcelainGeo.dispose();
      storefrontsGlassGeo.dispose();
      storefrontsGlowGeo.dispose();
      mountainsGeo.dispose();
      mountainsLineGeo.dispose();
      palmsTrunksGeo.dispose();
      palmsAndFloraGeo.dispose();
      golfGreenGeo.dispose();
      waterPondGeo.dispose();
      bunkerGeo.dispose();
      flagstickGeo.dispose();
      flagPennantGeo.dispose();
      sunHaloGeo.dispose();
      lineworkGeo.dispose();
    },
  };
}
