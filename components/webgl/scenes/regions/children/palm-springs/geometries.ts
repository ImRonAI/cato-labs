'use client';

import * as THREE from 'three';

/**
 * Procedural 3D architectural geometry builders for Palm Springs:
 *  - Mount San Jacinto & Chino Canyon faceted granite relief + contour lines
 *  - Mid-Century Modern Butterfly-Roof Pavilion (Krisel / Kaufmann tribute)
 *  - Palm Springs Aerial Tramway (Valley Station, Lattice Tower 1, Mountain Station,
 *    twin catenary cables & rotating circular tramcars)
 *  - California Fan Palms (Washingtonia filifera) with ringed trunks & arched fan crowns
 *  - San Gorgonio Pass Wind Farm (5 tapered towers + 3-blade aerodynamic rotors)
 *
 * Geometries sharing a material are merged at build time so the entire miniature
 * renders in ~32 draw calls with zero per-frame allocations.
 */

const _m4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

/** Merge an array of BufferGeometries into a single non-indexed BufferGeometry with normals. */
function mergeGeos(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed = geos.map((g) => {
    const ni = g.index ? g.toNonIndexed() : g.clone();
    if (!ni.getAttribute('normal')) ni.computeVertexNormals();
    return ni;
  });

  let totalVerts = 0;
  for (const g of nonIndexed) {
    totalVerts += g.getAttribute('position').count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  let offset = 0;

  for (const g of nonIndexed) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const n = g.getAttribute('normal') as THREE.BufferAttribute;
    positions.set(p.array as Float32Array, offset * 3);
    if (n) normals.set(n.array as Float32Array, offset * 3);
    offset += p.count;
    g.dispose();
  }
  for (const g of geos) g.dispose();

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return merged;
}

function transformedBox(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  _euler.set(rx, ry, rz);
  _quat.setFromEuler(_euler);
  _pos.set(x, y, z);
  _scale.set(1, 1, 1);
  _m4.compose(_pos, _quat, _scale);
  g.applyMatrix4(_m4);
  return g;
}

function transformedCylinder(
  rTop: number,
  rBot: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  _euler.set(rx, ry, rz);
  _quat.setFromEuler(_euler);
  _pos.set(x, y, z);
  _scale.set(1, 1, 1);
  _m4.compose(_pos, _quat, _scale);
  g.applyMatrix4(_m4);
  return g;
}

/* ============================================================================
   1. MOUNT SAN JACINTO & SAN GORGONIO PASS ESCARPMENT
   ============================================================================ */

export function buildMountainAndPassGeometries(): {
  mountainGeo: THREE.BufferGeometry;
  mountainCoreGeo: THREE.BufferGeometry;
  mountainEdgesGeo: THREE.BufferGeometry;
} {
  const cols = 22;
  const rows = 12;
  const xMin = -2.45;
  const xMax = 2.45;
  const zMin = -1.68;
  const zMax = -0.42;
  const baseY = -0.58;

  function smoothStep(a: number, b: number, v: number) {
    const t = THREE.MathUtils.clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  const heightAt = (x: number, z: number): number => {
    const depthT = THREE.MathUtils.clamp((zMax - z) / (zMax - zMin), 0, 1);
    const frontRamp = Math.sin(depthT * Math.PI * 0.78);
    const edgeFadeX = 1 - Math.pow(Math.max(0, (Math.abs(x) - 1.95) / 0.55), 2);

    /* San Jacinto main summit peak at x = -0.42, z = -1.15 (10,834 ft sheer granite face) */
    const dMain = Math.hypot((x + 0.42) * 0.92, (z + 1.15) * 1.45);
    const mainPeak = 2.65 * Math.exp(-dMain * dMain * 1.38);

    /* West shoulder (Folly Peak / Chino West ridge at x = -1.55, z = -1.05) */
    const dWest = Math.hypot((x + 1.55) * 1.05, (z + 1.05) * 1.55);
    const westPeak = 1.88 * Math.exp(-dWest * dWest * 1.65);

    /* East shoulder (Jean Peak / Cornell Peak crag at x = 0.28, z = -1.22) */
    const dEast = Math.hypot((x - 0.28) * 1.25, (z + 1.22) * 1.5);
    const eastPeak = 1.58 * Math.exp(-dEast * dEast * 2.1);

    /* Chino Canyon gorge crease running from (-1.72, -0.52) to (-0.42, -1.02) */
    const canyonLineX = -1.72 + ((z - -0.52) / (-1.02 - -0.52)) * 1.3;
    const canyonDist = Math.abs(x - canyonLineX);
    const canyonCarve = 0.22 * Math.exp(-canyonDist * canyonDist * 14.0) * smoothStep(0.1, 0.8, depthT);

    /* San Gorgonio Pass low desert wind ridge on the right (x = 0.8..2.35) */
    const dPass = Math.hypot((x - 1.62) * 0.75, (z + 1.15) * 1.6);
    const passRidge = 0.64 * Math.exp(-dPass * dPass * 1.25);

    const raw = Math.max(
      0,
      (mainPeak + westPeak * 0.72 + eastPeak * 0.68 - canyonCarve + passRidge) * frontRamp * edgeFadeX,
    );
    const facetNoise =
      0.055 * Math.sin(x * 5.2 + z * 4.1) * Math.cos(x * 3.7 - z * 6.3) * Math.min(1, raw * 1.2);
    return baseY + raw + facetNoise;
  };

  const grid: THREE.Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: THREE.Vector3[] = [];
    const v = r / rows;
    const z = THREE.MathUtils.lerp(zMax, zMin, v);
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const x = THREE.MathUtils.lerp(xMin, xMax, u);
      const isBorder = r === 0 || r === rows || c === 0 || c === cols;
      const y = isBorder ? baseY : heightAt(x, z);
      row.push(new THREE.Vector3(x, y, z));
    }
    grid.push(row);
  }

  const tris: number[] = [];
  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p00 = grid[r][c];
      const p10 = grid[r][c + 1];
      const p01 = grid[r + 1][c];
      const p11 = grid[r + 1][c + 1];
      if ((r + c) % 2 === 0) {
        pushTri(p00, p10, p11);
        pushTri(p00, p11, p01);
      } else {
        pushTri(p00, p10, p01);
        pushTri(p10, p11, p01);
      }
    }
  }

  const mountainGeo = new THREE.BufferGeometry();
  mountainGeo.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  mountainGeo.computeVertexNormals();

  /* Inner luminous granite core slightly inset under San Jacinto Peak */
  const corePrisms: THREE.BufferGeometry[] = [
    transformedCylinder(0.04, 0.82, 1.95, 6, -0.45, baseY + 0.98, -1.12, 0, 0.4, 0),
    transformedCylinder(0.04, 0.62, 1.42, 6, -1.42, baseY + 0.71, -1.02, 0, -0.3, 0),
    transformedCylinder(0.03, 0.52, 1.25, 6, 0.22, baseY + 0.62, -1.16, 0, 0.2, 0),
  ];
  const mountainCoreGeo = mergeGeos(corePrisms);

  const mountainEdgesGeo = new THREE.EdgesGeometry(mountainGeo, 11);

  return { mountainGeo, mountainCoreGeo, mountainEdgesGeo };
}

/* ============================================================================
   2. MID-CENTURY MODERN BUTTERFLY-ROOF PAVILION, POOL DECK & TRAM STATIONS
   ============================================================================ */

export const FLOOR_Y = -0.58;

export function buildPavilionAndTerraceGeometries(): {
  porcelainGeo: THREE.BufferGeometry;
  enamelGeo: THREE.BufferGeometry;
  glassGeo: THREE.BufferGeometry;
  edgesGeo: THREE.BufferGeometry;
} {
  const porcelain: THREE.BufferGeometry[] = [];
  const enamel: THREE.BufferGeometry[] = [];
  const glass: THREE.BufferGeometry[] = [];

  /* --- A. Two-tier architectural plinth & pool coping --- */
  enamel.push(transformedCylinder(2.58, 2.64, 0.05, 48, 0, FLOOR_Y - 0.11, -0.05));
  porcelain.push(transformedCylinder(2.52, 2.56, 0.08, 48, 0, FLOOR_Y - 0.05, -0.05));

  /* Swimming pool coping border (pool center at x = 0.58, z = 0.74, size 1.56 x 0.94) */
  const px = 0.58;
  const pz = 0.74;
  const pw = 1.56;
  const pd = 0.94;
  const rimH = 0.048;
  const rimT = 0.085;
  porcelain.push(
    transformedBox(pw + rimT * 2, rimH, rimT, px, FLOOR_Y + rimH * 0.5, pz - pd * 0.5 - rimT * 0.5),
    transformedBox(pw + rimT * 2, rimH, rimT, px, FLOOR_Y + rimH * 0.5, pz + pd * 0.5 + rimT * 0.5),
    transformedBox(rimT, rimH, pd, px - pw * 0.5 - rimT * 0.5, FLOOR_Y + rimH * 0.5, pz),
    transformedBox(rimT, rimH, pd, px + pw * 0.5 + rimT * 0.5, FLOOR_Y + rimH * 0.5, pz),
  );
  /* Electric-blue waterline tile trim inside the pool perimeter */
  enamel.push(
    transformedBox(pw, 0.026, 0.02, px, FLOOR_Y + 0.022, pz - pd * 0.5),
    transformedBox(pw, 0.026, 0.02, px, FLOOR_Y + 0.022, pz + pd * 0.5),
    transformedBox(0.02, 0.026, pd, px - pw * 0.5, FLOOR_Y + 0.022, pz),
    transformedBox(0.02, 0.026, pd, px + pw * 0.5, FLOOR_Y + 0.022, pz),
  );
  /* Minimalist diving board at left end + pool ladder */
  porcelain.push(transformedBox(0.36, 0.024, 0.12, px - pw * 0.5 + 0.11, FLOOR_Y + 0.078, pz, 0, 0, 0.04));
  enamel.push(
    transformedBox(0.042, 0.058, 0.095, px - pw * 0.5 - 0.02, FLOOR_Y + 0.046, pz),
    transformedCylinder(0.009, 0.009, 0.17, 8, px + pw * 0.5 - 0.12, FLOOR_Y + 0.085, pz - pd * 0.5 - 0.02),
    transformedCylinder(0.009, 0.009, 0.17, 8, px + pw * 0.5 - 0.22, FLOOR_Y + 0.085, pz - pd * 0.5 - 0.02),
    transformedBox(0.11, 0.014, 0.022, px + pw * 0.5 - 0.17, FLOOR_Y + 0.16, pz - pd * 0.5 - 0.02),
  );

  /* --- B. Mid-Century Modern Butterfly-Roof Pavilion (Krisel / Kaufmann House) --- */
  const hx = -0.84;
  const hz = 0.06;
  porcelain.push(transformedBox(1.88, 0.06, 1.06, hx, FLOOR_Y + 0.03, hz));
  porcelain.push(
    /* Back shear wall */
    transformedBox(1.68, 0.68, 0.07, hx, FLOOR_Y + 0.37, hz - 0.38),
    /* Left wing privacy wall */
    transformedBox(0.07, 0.76, 0.88, hx - 0.80, FLOOR_Y + 0.41, hz + 0.02),
    /* Central sculptural fireplace & chimney mass piercing the butterfly roof valley */
    transformedBox(0.28, 1.16, 0.32, hx + 0.05, FLOOR_Y + 0.58, hz - 0.18),
  );
  enamel.push(transformedBox(0.31, 0.035, 0.35, hx + 0.05, FLOOR_Y + 1.17, hz - 0.18));

  /* Floor-to-ceiling glass curtain walls & clerestory glazing */
  glass.push(
    transformedBox(1.48, 0.66, 0.035, hx + 0.02, FLOOR_Y + 0.39, hz + 0.38),
    transformedBox(0.035, 0.68, 0.76, hx + 0.74, FLOOR_Y + 0.40, hz),
    transformedBox(0.88, 0.52, 0.04, hx - 0.12, FLOOR_Y + 0.32, hz + 0.04),
  );

  for (let i = 0; i < 6; i++) {
    const mx = hx - 0.62 + i * 0.26;
    enamel.push(transformedBox(0.018, 0.68, 0.048, mx, FLOOR_Y + 0.39, hz + 0.38));
  }
  for (let j = 0; j < 4; j++) {
    const mz = hz - 0.32 + j * 0.22;
    enamel.push(transformedBox(0.048, 0.68, 0.018, hx + 0.74, FLOOR_Y + 0.40, mz));
  }

  /* THE ICONIC V-SHAPED BUTTERFLY ROOF */
  const valleyX = hx - 0.06;
  const valleyY = FLOOR_Y + 0.68;
  const leftPitch = -0.29;
  const rightPitch = 0.32;

  const leftLen = 0.98;
  const leftCx = valleyX - Math.cos(leftPitch) * (leftLen * 0.5) + 0.02;
  const leftCy = valleyY - Math.sin(leftPitch) * (leftLen * 0.5);
  porcelain.push(transformedBox(leftLen, 0.048, 1.24, leftCx, leftCy, hz + 0.04, 0, 0, leftPitch));
  enamel.push(transformedBox(leftLen + 0.02, 0.018, 1.26, leftCx, leftCy + 0.028, hz + 0.04, 0, 0, leftPitch));

  const rightLen = 1.34;
  const rightCx = valleyX + Math.cos(rightPitch) * (rightLen * 0.5) - 0.02;
  const rightCy = valleyY + Math.sin(rightPitch) * (rightLen * 0.5);
  porcelain.push(transformedBox(rightLen, 0.048, 1.24, rightCx, rightCy, hz + 0.04, 0, 0, rightPitch));
  enamel.push(transformedBox(rightLen + 0.02, 0.018, 1.26, rightCx, rightCy + 0.028, hz + 0.04, 0, 0, rightPitch));

  for (let b = 0; b < 5; b++) {
    const bz = hz - 0.48 + b * 0.26;
    enamel.push(
      transformedBox(leftLen + 0.14, 0.036, 0.032, leftCx - 0.03, leftCy - 0.032, bz, 0, 0, leftPitch),
      transformedBox(rightLen + 0.18, 0.036, 0.032, rightCx + 0.04, rightCy - 0.032, bz, 0, 0, rightPitch),
    );
  }
  enamel.push(
    transformedCylinder(0.014, 0.014, 0.96, 8, hx + 0.96, FLOOR_Y + 0.46, hz + 0.44, 0, 0, -0.16),
    transformedCylinder(0.014, 0.014, 0.96, 8, hx + 0.96, FLOOR_Y + 0.46, hz - 0.34, 0, 0, -0.16),
  );

  /* Breeze-block screen coping cap & end pilasters */
  porcelain.push(
    transformedBox(1.42, 0.04, 0.09, 0.52, FLOOR_Y + 0.74, 0.08),
    transformedBox(0.06, 0.74, 0.09, -0.16, FLOOR_Y + 0.37, 0.08),
    transformedBox(0.06, 0.74, 0.09, 1.20, FLOOR_Y + 0.37, 0.08),
  );

  /* --- C. Poolside Lounge Chairs & Mid-Century Striped Parasol Umbrella --- */
  const buildLounger = (lx: number, lz: number, yaw: number) => {
    porcelain.push(
      transformedBox(0.18, 0.025, 0.34, lx, FLOOR_Y + 0.065, lz + 0.06, 0, yaw, 0),
      transformedBox(0.18, 0.025, 0.18, lx, FLOOR_Y + 0.125, lz - 0.16, 0.55, yaw, 0),
    );
    enamel.push(
      transformedBox(0.15, 0.018, 0.31, lx, FLOOR_Y + 0.082, lz + 0.06, 0, yaw, 0),
      transformedBox(0.15, 0.018, 0.16, lx, FLOOR_Y + 0.138, lz - 0.155, 0.55, yaw, 0),
    );
  };
  buildLounger(1.62, 0.56, -0.18);
  buildLounger(1.90, 0.50, -0.22);

  /* Poolside octagonal parasol umbrella at (1.76, 0.24) with crisp blue dome & valance */
  const ux = 1.76;
  const uz = 0.24;
  enamel.push(
    transformedCylinder(0.013, 0.015, 0.68, 8, ux, FLOOR_Y + 0.34, uz),
    transformedCylinder(0.11, 0.12, 0.025, 16, ux, FLOOR_Y + 0.015, uz),
    /* Rich blue upper canopy & scalloped valance rim so it pops against white */
    transformedCylinder(0.03, 0.36, 0.13, 8, ux, FLOOR_Y + 0.66, uz, 0.08, 0.2, -0.1),
  );
  porcelain.push(
    transformedCylinder(0.18, 0.375, 0.032, 8, ux, FLOOR_Y + 0.615, uz, 0.08, 0.2, -0.1),
  );

  /* --- D. Palm Springs Aerial Tramway Stations & Lattice Tower 1 --- */
  porcelain.push(
    transformedBox(0.38, 0.22, 0.28, -1.72, FLOOR_Y + 0.24, -0.52, 0, 0.32, 0),
    transformedBox(0.46, 0.032, 0.34, -1.72, FLOOR_Y + 0.36, -0.52, -0.12, 0.32, 0.18),
  );
  glass.push(transformedBox(0.32, 0.16, 0.22, -1.72, FLOOR_Y + 0.26, -0.50, 0, 0.32, 0));

  /* Lattice Tower 1 on Chino Canyon spur: (-1.08, y = 0.28..1.08, -0.78) */
  const tx = -1.08;
  const tz = -0.78;
  const tBaseY = 0.24;
  const tTopY = 1.06;
  const tH = tTopY - tBaseY;
  const tMidY = (tBaseY + tTopY) * 0.5;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      enamel.push(
        transformedCylinder(
          0.009,
          0.014,
          tH,
          6,
          tx + sx * 0.048,
          tMidY,
          tz + sz * 0.048,
          sz * 0.06,
          0,
          -sx * 0.06,
        ),
      );
    }
  }
  enamel.push(
    transformedBox(0.11, 0.018, 0.11, tx, tBaseY + tH * 0.45, tz),
    transformedBox(0.08, 0.018, 0.08, tx, tBaseY + tH * 0.82, tz),
    transformedBox(0.12, 0.026, 0.28, tx, tTopY, tz, 0, 0, 0.56),
  );

  /* Mountain Station cantilevered near San Jacinto summit: (-0.42, 1.88, -0.98) */
  porcelain.push(
    transformedBox(0.42, 0.16, 0.32, -0.42, 1.86, -0.98, 0, 0.15, 0),
  );
  enamel.push(
    transformedBox(0.50, 0.032, 0.38, -0.42, 1.96, -0.98, 0, 0.15, 0.08),
    transformedCylinder(0.008, 0.012, 0.20, 8, -0.42, 2.06, -0.98),
  );
  glass.push(transformedBox(0.38, 0.12, 0.28, -0.42, 1.88, -0.96, 0, 0.15, 0));

  const porcelainGeo = mergeGeos(porcelain);
  const enamelGeo = mergeGeos(enamel);
  const glassGeo = mergeGeos(glass);
  const edgesGeo = new THREE.EdgesGeometry(porcelainGeo, 24);

  return { porcelainGeo, enamelGeo, glassGeo, edgesGeo };
}

/* ============================================================================
   3. THE PALM SPRINGS AERIAL TRAMWAY — CABLES & ROTATING CIRCULAR TRAMCAR
   ============================================================================ */

const TRAM_WAYPOINTS: [number, number, number][] = [
  [-1.72, -0.14, -0.52], // Valley Station launch
  [-1.40, 0.44, -0.65],  // Lower canyon span
  [-1.08, 1.06, -0.78],  // Lattice Tower 1 saddle
  [-0.75, 1.48, -0.88],  // Upper sheer cliff span
  [-0.42, 1.92, -0.98],  // Mountain Station docking
];

export function sampleTramPath(
  t: number,
  trackOffsetZ: number,
  outPos: THREE.Vector3,
): number {
  const u = THREE.MathUtils.clamp(t, 0, 1) * (TRAM_WAYPOINTS.length - 1);
  const idx = Math.min(TRAM_WAYPOINTS.length - 2, Math.floor(u));
  const f = u - idx;
  const a = TRAM_WAYPOINTS[idx];
  const b = TRAM_WAYPOINTS[idx + 1];

  const sag = Math.sin(f * Math.PI) * 0.028;
  outPos.set(
    THREE.MathUtils.lerp(a[0], b[0], f),
    THREE.MathUtils.lerp(a[1], b[1], f) - sag,
    THREE.MathUtils.lerp(a[2], b[2], f) + trackOffsetZ,
  );
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

export function buildTramwayGeometries(): {
  tramCablesGeo: THREE.BufferGeometry;
  tramHangerGeo: THREE.BufferGeometry;
  tramCabinGlassGeo: THREE.BufferGeometry;
  tramCabinEnamelGeo: THREE.BufferGeometry;
} {
  const linePts: number[] = [];
  const tempA = new THREE.Vector3();
  const tempB = new THREE.Vector3();
  const segs = 40;

  for (const zOff of [-0.075, 0.075]) {
    for (const yOff of [0, 0.018]) {
      for (let i = 0; i < segs; i++) {
        sampleTramPath(i / segs, zOff, tempA);
        sampleTramPath((i + 1) / segs, zOff, tempB);
        linePts.push(tempA.x, tempA.y + yOff, tempA.z, tempB.x, tempB.y + yOff, tempB.z);
      }
    }
  }
  const tramCablesGeo = new THREE.BufferGeometry();
  tramCablesGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));

  const hangerParts: THREE.BufferGeometry[] = [
    transformedBox(0.13, 0.024, 0.032, 0, 0.008, 0, 0, 0, 0.92),
    transformedCylinder(0.009, 0.011, 0.14, 8, 0, -0.065, 0),
    transformedCylinder(0.038, 0.042, 0.022, 16, 0, -0.13, 0),
  ];
  const tramHangerGeo = mergeGeos(hangerParts);

  const cabinGlassParts: THREE.BufferGeometry[] = [
    transformedCylinder(0.125, 0.125, 0.13, 24, 0, 0, 0),
  ];
  const tramCabinGlassGeo = mergeGeos(cabinGlassParts);

  const cabinEnamelParts: THREE.BufferGeometry[] = [
    transformedCylinder(0.085, 0.132, 0.028, 24, 0, 0.072, 0),
    transformedCylinder(0.132, 0.118, 0.034, 24, 0, -0.072, 0),
    transformedCylinder(0.134, 0.134, 0.016, 24, 0, -0.028, 0),
    transformedCylinder(0.131, 0.131, 0.012, 24, 0, 0.052, 0),
  ];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    cabinEnamelParts.push(
      transformedBox(0.008, 0.12, 0.008, Math.cos(a) * 0.127, 0, Math.sin(a) * 0.127, 0, -a, 0),
    );
  }
  const tramCabinEnamelGeo = mergeGeos(cabinEnamelParts);

  return { tramCablesGeo, tramHangerGeo, tramCabinGlassGeo, tramCabinEnamelGeo };
}

/* ============================================================================
   4. CALIFORNIA FAN PALMS (WASHINGTONIA FILIFERA)
   ============================================================================ */

export interface PalmSpec {
  x: number;
  z: number;
  height: number;
  leanX: number;
  leanZ: number;
  crownScale: number;
  phase: number;
  topPos: [number, number, number];
}

export const PALM_SPECS: PalmSpec[] = [
  { x: -1.88, z: 0.42, height: 1.82, leanX: -0.16, leanZ: 0.12, crownScale: 1.02, phase: 0.0, topPos: [0, 0, 0] },
  { x: -1.52, z: 0.72, height: 1.44, leanX: -0.10, leanZ: 0.15, crownScale: 0.86, phase: 1.3, topPos: [0, 0, 0] },
  { x: -0.08, z: -0.34, height: 2.02, leanX: 0.10, leanZ: -0.08, crownScale: 1.08, phase: 2.4, topPos: [0, 0, 0] },
  { x: 1.42, z: -0.12, height: 1.72, leanX: 0.15, leanZ: 0.06, crownScale: 0.94, phase: 3.7, topPos: [0, 0, 0] },
  { x: 2.06, z: 0.22, height: 1.38, leanX: 0.20, leanZ: 0.12, crownScale: 0.82, phase: 5.1, topPos: [0, 0, 0] },
];

export function buildPalmGeometries(): {
  palmTrunksGeo: THREE.BufferGeometry;
  palmCrownGeo: THREE.BufferGeometry;
} {
  const trunkSegs: THREE.BufferGeometry[] = [];

  for (const palm of PALM_SPECS) {
    const steps = 11;
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const tm = (t0 + t1) * 0.5;
      const curve = tm * tm;
      const px = palm.x + palm.leanX * curve;
      const pz = palm.z + palm.leanZ * curve;
      const py = FLOOR_Y + tm * palm.height;
      const segH = (palm.height / steps) * 1.04;
      const rBot = THREE.MathUtils.lerp(0.048, 0.024, t0);
      const rTop = THREE.MathUtils.lerp(0.048, 0.024, t1) * 1.06;
      const rx = (palm.leanZ * 2 * tm) / palm.height;
      const rz = (-palm.leanX * 2 * tm) / palm.height;
      trunkSegs.push(transformedCylinder(rTop, rBot, segH, 8, px, py, pz, rx, 0, rz));
    }
    palm.topPos = [
      palm.x + palm.leanX,
      FLOOR_Y + palm.height,
      palm.z + palm.leanZ,
    ];
    /* Desert palm petiole skirt collar */
    trunkSegs.push(
      transformedCylinder(0.058, 0.032, 0.15, 10, palm.topPos[0], palm.topPos[1] - 0.05, palm.topPos[2]),
    );
  }

  const palmTrunksGeo = mergeGeos(trunkSegs);

  /* Sculptural arched California Fan Palm crown:
     3-segment curved arching fronds with drooping tips so they read crisply from every angle */
  const fronds: THREE.BufferGeometry[] = [];
  const frondCount = 12;
  for (let i = 0; i < frondCount; i++) {
    const tier = i < 7 ? 0 : 1;
    const yaw = (i / (tier === 0 ? 7 : 5)) * Math.PI * 2 + tier * 0.45;
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);

    /* 3 arched segments along the frond stem + fanned leaflet tips */
    const segSpecs =
      tier === 0
        ? [
            { r0: 0.02, r1: 0.14, y0: 0.02, y1: 0.09, w: 0.045 },
            { r0: 0.14, r1: 0.28, y0: 0.09, y1: 0.05, w: 0.085 },
            { r0: 0.28, r1: 0.42, y0: 0.05, y1: -0.07, w: 0.055 },
          ]
        : [
            { r0: 0.02, r1: 0.12, y0: 0.0, y1: 0.03, w: 0.042 },
            { r0: 0.12, r1: 0.24, y0: 0.03, y1: -0.05, w: 0.078 },
            { r0: 0.24, r1: 0.35, y0: 0.05, y1: -0.16, w: 0.048 },
          ];

    for (const seg of segSpecs) {
      const dr = seg.r1 - seg.r0;
      const dy = seg.y1 - seg.y0;
      const segLen = Math.hypot(dr, dy);
      const rm = (seg.r0 + seg.r1) * 0.5;
      const ym = (seg.y0 + seg.y1) * 0.5;
      const pitch = -Math.atan2(dy, dr);
      fronds.push(
        transformedBox(
          seg.w,
          0.016,
          segLen + 0.015,
          sinY * rm,
          ym,
          cosY * rm,
          pitch,
          yaw,
          0,
        ),
      );
    }
  }
  const palmCrownGeo = mergeGeos(fronds);

  return { palmTrunksGeo, palmCrownGeo };
}

/* ============================================================================
   5. SAN GORGONIO PASS WIND FARM (5 TURBINES + 3-BLADE ROTORS)
   ============================================================================ */

export interface TurbineSpec {
  x: number;
  baseY: number;
  z: number;
  height: number;
  rotorScale: number;
  speed: number;
  phase: number;
  hubPos: [number, number, number];
}

export const TURBINE_SPECS: TurbineSpec[] = [
  { x: 0.78, baseY: -0.18, z: -0.92, height: 1.12, rotorScale: 0.95, speed: 1.85, phase: 0.2, hubPos: [0, 0, 0] },
  { x: 1.24, baseY: -0.08, z: -1.08, height: 1.28, rotorScale: 1.08, speed: 1.65, phase: 1.4, hubPos: [0, 0, 0] },
  { x: 1.68, baseY: -0.02, z: -0.96, height: 1.18, rotorScale: 1.00, speed: 1.95, phase: 2.7, hubPos: [0, 0, 0] },
  { x: 2.06, baseY: -0.12, z: -1.16, height: 1.05, rotorScale: 0.90, speed: 1.75, phase: 4.0, hubPos: [0, 0, 0] },
  { x: 2.34, baseY: -0.26, z: -0.86, height: 0.92, rotorScale: 0.82, speed: 2.05, phase: 5.2, hubPos: [0, 0, 0] },
];

export function buildWindFarmGeometries(): {
  windTowersGeo: THREE.BufferGeometry;
  windRotorGeo: THREE.BufferGeometry;
} {
  const towers: THREE.BufferGeometry[] = [];
  for (const t of TURBINE_SPECS) {
    const topY = t.baseY + t.height;
    t.hubPos = [t.x, topY, t.z + 0.045];
    towers.push(
      transformedCylinder(0.015, 0.030, t.height, 10, t.x, t.baseY + t.height * 0.5, t.z),
      transformedCylinder(0.044, 0.050, 0.04, 10, t.x, t.baseY + 0.02, t.z),
      transformedBox(0.045, 0.046, 0.11, t.x, topY, t.z + 0.01),
    );
  }
  const windTowersGeo = mergeGeos(towers);

  const rotorParts: THREE.BufferGeometry[] = [
    transformedCylinder(0.004, 0.026, 0.055, 10, 0, 0, 0.02, Math.PI * 0.5, 0, 0),
  ];
  const bladeLen = 0.35;
  for (let b = 0; b < 3; b++) {
    const angle = (b / 3) * Math.PI * 2;
    const bx = Math.cos(angle) * (bladeLen * 0.5 + 0.015);
    const by = Math.sin(angle) * (bladeLen * 0.5 + 0.015);
    rotorParts.push(
      transformedBox(bladeLen, 0.026, 0.008, bx, by, 0.01, 0.22, 0, angle),
    );
  }
  const windRotorGeo = mergeGeos(rotorParts);

  return { windTowersGeo, windRotorGeo };
}

/* ============================================================================
   6. CELESTIAL SOLAR ARC & ARCHITECTURAL PLINTH DIAL LINES
   ============================================================================ */

export function buildCelestialDialLines(): THREE.BufferGeometry {
  const pts: number[] = [];

  const arcSteps = 56;
  for (let i = 0; i < arcSteps; i += 2) {
    const t0 = i / arcSteps;
    const t1 = (i + 1) / arcSteps;
    const az0 = -1.12 + 2.24 * t0;
    const az1 = -1.12 + 2.24 * t1;
    const el0 = 0.28 + 0.58 * Math.sin(Math.PI * t0);
    const el1 = 0.28 + 0.58 * Math.sin(Math.PI * t1);
    pts.push(
      Math.sin(az0) * 2.35, 1.05 + Math.sin(el0) * 1.02, -0.85,
      Math.sin(az1) * 2.35, 1.05 + Math.sin(el1) * 1.02, -0.85,
    );
  }

  const rInner = 2.46;
  const rOuter = 2.54;
  const tickY = FLOOR_Y + 0.005;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const major = i % 6 === 0 ? 0.045 : 0.0;
    pts.push(
      Math.cos(a) * (rInner - major),
      tickY,
      Math.sin(a) * (rInner - major) - 0.05,
      Math.cos(a) * rOuter,
      tickY,
      Math.sin(a) * rOuter - 0.05,
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}
