import * as THREE from 'three';
import {
  buildLineGeometry,
  mergeBufferGeometries,
  transformedBox,
  transformedCylinder,
} from './geom';

export const OCEAN_Y = -0.62;
export const RIB_COUNT = 44;
export const TUBE_Z_START = 3.1;
export const TUBE_Z_END = -2.15;

/**
 * Builds a smooth crescent-like hydrofoil arc segment in the XY plane
 * starting near the origin (0,0) and curving along an arc of `arcAngle` radians
 * with radius `radius`, thickness tapering from `t0` to `t1`, and depth `depthZ`.
 */
function buildArcFoilGeometry({
  radius,
  arcAngle,
  t0,
  t1,
  depthZ,
  segs = 14,
}: {
  radius: number;
  arcAngle: number;
  t0: number;
  t1: number;
  depthZ: number;
  segs?: number;
}): THREE.BufferGeometry {
  const shape = new THREE.Shape();

  // Outer curve from angle 0 to arcAngle
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const ang = u * arcAngle;
    const thick = THREE.MathUtils.lerp(t0, t1, u);
    const rOut = radius + thick * 0.5;
    const x = rOut * Math.cos(ang) - radius;
    const y = rOut * Math.sin(ang);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }

  // Inner curve back from arcAngle to 0
  for (let i = segs; i >= 0; i--) {
    const u = i / segs;
    const ang = u * arcAngle;
    const thick = THREE.MathUtils.lerp(t0, t1, u);
    const rIn = Math.max(0.05, radius - thick * 0.5);
    const x = rIn * Math.cos(ang) - radius;
    const y = rIn * Math.sin(ang);
    shape.lineTo(x, y);
  }
  shape.closePath();

  const extrude = new THREE.ExtrudeGeometry(shape, {
    depth: depthZ,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
  });
  extrude.translate(0, 0, -depthZ * 0.5);
  extrude.computeVertexNormals();
  return extrude;
}

/**
 * Builds the 3 articulated hydrofoil rib geometries for InstancedMesh rendering,
 * plus the parametric UV grid for the continuous refractive spiral wave-veil shader.
 */
export function buildBarrelWaveGeometries() {
  const baseRibGeo = buildArcFoilGeometry({
    radius: 1.08,
    arcAngle: 0.68,
    t0: 0.095,
    t1: 0.068,
    depthZ: 0.062,
    segs: 12,
  });

  const wallRibGeo = buildArcFoilGeometry({
    radius: 0.88,
    arcAngle: 0.92,
    t0: 0.068,
    t1: 0.048,
    depthZ: 0.058,
    segs: 14,
  });

  const lipRibGeo = buildArcFoilGeometry({
    radius: 0.66,
    arcAngle: 1.05,
    t0: 0.048,
    t1: 0.014,
    depthZ: 0.052,
    segs: 16,
  });

  // Parametric UV grid (u = arc 0..1, v = along-tube 0..1) deformed in vertex shader
  const veilSegU = 42;
  const veilSegV = 64;
  const veilGeo = new THREE.PlaneGeometry(1, 1, veilSegU, veilSegV);
  // Shift plane coordinates from [-0.5..0.5] to [0..1] in x and y for clean parametric math
  veilGeo.translate(0.5, 0.5, 0);

  return {
    baseRibGeo,
    wallRibGeo,
    lipRibGeo,
    veilGeo,
  };
}

/**
 * Builds the Orange County coastal horizon set piece:
 * - Sculpted Laguna/Dana Point terraced coastal headland bluffs + contour lines
 * - Huntington / Newport architectural pier (trestle pilings, deck, end pavilion)
 * - Coastal bluff villas & sculpted palms
 * - Horizon azimuth arc lines
 */
export function buildCoastalHorizonGeometries() {
  // 1. Terraced coastal headland bluff on the right/horizon (-Z, +X)
  const bluffParts: THREE.BufferGeometry[] = [];
  const contourSegs: number[] = [];

  const terraceLevels = [
    { y: OCEAN_Y + 0.09, rx: 1.85, rz: 1.15, cx: 1.65, cz: -3.45, h: 0.18 },
    { y: OCEAN_Y + 0.26, rx: 1.52, rz: 0.94, cx: 1.78, cz: -3.58, h: 0.17 },
    { y: OCEAN_Y + 0.43, rx: 1.22, rz: 0.76, cx: 1.90, cz: -3.70, h: 0.17 },
    { y: OCEAN_Y + 0.60, rx: 0.92, rz: 0.58, cx: 2.02, cz: -3.80, h: 0.18 },
    { y: OCEAN_Y + 0.78, rx: 0.62, rz: 0.40, cx: 2.12, cz: -3.88, h: 0.18 },
  ];

  for (let lv = 0; lv < terraceLevels.length; lv++) {
    const T = terraceLevels[lv];
    const sides = 18;
    const shape = new THREE.Shape();
    const ringPts: [number, number][] = [];
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const ridgeMod =
        1 +
        0.14 * Math.sin(a * 3 + lv * 0.7) +
        0.08 * Math.cos(a * 5 - lv * 0.4);
      const px = Math.cos(a) * T.rx * ridgeMod;
      const pz = Math.sin(a) * T.rz * ridgeMod;
      ringPts.push([T.cx + px, T.cz - pz]);
      if (i === 0) shape.moveTo(px, pz);
      else shape.lineTo(px, pz);
    }
    const ext = new THREE.ExtrudeGeometry(shape, {
      depth: T.h,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });
    ext.rotateX(-Math.PI / 2);
    ext.translate(T.cx, T.y - T.h * 0.5, T.cz);
    bluffParts.push(ext);

    for (let i = 0; i < ringPts.length - 1; i++) {
      const [x0, z0] = ringPts[i];
      const [x1, z1] = ringPts[i + 1];
      const topY = T.y + T.h * 0.5 + 0.022;
      contourSegs.push(x0, topY, z0, x1, topY, z1);
    }
  }

  // Secondary distant Catalina / Palos Verdes horizon silhouette on far left (-X, -Z)
  const farIsland = new THREE.ConeGeometry(1.15, 0.48, 7);
  farIsland.scale(1.65, 1, 0.62);
  farIsland.translate(-2.45, OCEAN_Y + 0.22, -4.55);
  bluffParts.push(farIsland);

  const farRidge = new THREE.ConeGeometry(0.85, 0.36, 6);
  farRidge.scale(1.5, 1, 0.55);
  farRidge.translate(-1.35, OCEAN_Y + 0.16, -4.65);
  bluffParts.push(farRidge);

  const bluffGeo = mergeBufferGeometries(bluffParts);
  const bluffContoursGeo = buildLineGeometry(contourSegs);

  // 2. Huntington / Newport Architectural Pier stretching from bluff out into the surf
  // Pier runs from x = 1.45, z = -3.15 out to pier head at x = -0.68, z = -2.85
  const pierEnamelParts: THREE.BufferGeometry[] = [];
  const pierPorcelainParts: THREE.BufferGeometry[] = [];
  const pierGlassParts: THREE.BufferGeometry[] = [];
  const pierLineSegs: number[] = [];

  const pierBents = 13;
  const deckY = OCEAN_Y + 0.30;
  const pStartX = 1.42;
  const pStartZ = -3.18;
  const pEndX = -0.78;
  const pEndZ = -2.82;
  const pierAngle = Math.atan2(pEndZ - pStartZ, pEndX - pStartX);
  const pierLen = Math.hypot(pEndX - pStartX, pEndZ - pStartZ);
  const midX = (pStartX + pEndX) * 0.5;
  const midZ = (pStartZ + pEndZ) * 0.5;

  // Main pier boardwalk deck
  pierPorcelainParts.push(
    transformedBox(pierLen, 0.036, 0.22, midX, deckY, midZ, 0, -pierAngle, 0),
  );
  // PierHead octagonal platform
  pierPorcelainParts.push(
    transformedCylinder(0.24, 0.22, 0.044, 8, pEndX, deckY + 0.004, pEndZ),
  );

  // Trestle pilings + cross-bracing
  for (let i = 0; i <= pierBents; i++) {
    const u = i / pierBents;
    const bx = THREE.MathUtils.lerp(pStartX, pEndX, u);
    const bz = THREE.MathUtils.lerp(pStartZ, pEndZ, u);
    const perpX = -Math.sin(pierAngle) * 0.078;
    const perpZ = Math.cos(pierAngle) * 0.078;
    const pileH = 0.38;
    const pileY = deckY - pileH * 0.5;

    pierEnamelParts.push(
      transformedCylinder(0.014, 0.016, pileH, 6, bx + perpX, pileY, bz + perpZ),
      transformedCylinder(0.014, 0.016, pileH, 6, bx - perpX, pileY, bz - perpZ),
    );
    // Cross-brace line
    pierLineSegs.push(
      bx + perpX,
      deckY - 0.03,
      bz + perpZ,
      bx - perpX,
      OCEAN_Y + 0.03,
      bz - perpZ,
      bx - perpX,
      deckY - 0.03,
      bz - perpZ,
      bx + perpX,
      OCEAN_Y + 0.03,
      bz + perpZ,
    );
  }

  // Pier railings
  for (const s of [-1, 1]) {
    const perpX = -Math.sin(pierAngle) * 0.102 * s;
    const perpZ = Math.cos(pierAngle) * 0.102 * s;
    pierLineSegs.push(
      pStartX + perpX,
      deckY + 0.045,
      pStartZ + perpZ,
      pEndX + perpX,
      deckY + 0.045,
      pEndZ + perpZ,
    );
  }

  // Iconic Huntington-style Pier-End Glass Pavilion + Lifeguard Tower
  // Pavilion crystalline walls
  pierGlassParts.push(
    transformedCylinder(0.145, 0.145, 0.16, 8, pEndX, deckY + 0.10, pEndZ),
  );
  // Stepped pyramidal coastal roof in electric enamel
  pierEnamelParts.push(
    transformedCylinder(0.02, 0.20, 0.13, 4, pEndX, deckY + 0.245, pEndZ, 0, Math.PI * 0.25, 0),
    transformedCylinder(0.008, 0.008, 0.12, 6, pEndX, deckY + 0.35, pEndZ),
  );
  // Mid-pier observation kiosk
  const midKioskX = THREE.MathUtils.lerp(pStartX, pEndX, 0.55);
  const midKioskZ = THREE.MathUtils.lerp(pStartZ, pEndZ, 0.55);
  pierGlassParts.push(
    transformedBox(0.14, 0.10, 0.14, midKioskX, deckY + 0.07, midKioskZ, 0, -pierAngle, 0),
  );
  pierEnamelParts.push(
    transformedCylinder(0.015, 0.13, 0.08, 4, midKioskX, deckY + 0.16, midKioskZ, 0, Math.PI * 0.25 - pierAngle, 0),
  );

  // Coastal modernist bluff villas perched on the Laguna terraces
  pierPorcelainParts.push(
    transformedBox(0.32, 0.11, 0.20, 1.72, OCEAN_Y + 0.58, -3.52, 0, 0.28, 0),
    transformedBox(0.26, 0.09, 0.18, 2.02, OCEAN_Y + 0.76, -3.72, 0, -0.18, 0),
  );
  pierGlassParts.push(
    transformedBox(0.28, 0.07, 0.04, 1.70, OCEAN_Y + 0.58, -3.41, 0, 0.28, 0),
    transformedBox(0.22, 0.06, 0.04, 2.00, OCEAN_Y + 0.76, -3.62, 0, -0.18, 0),
  );

  // Sculpted coastal palms along the bluff
  const palmCoords: [number, number, number, number][] = [
    [1.38, OCEAN_Y + 0.36, -3.28, 0.28],
    [1.54, OCEAN_Y + 0.36, -3.38, 0.32],
    [1.88, OCEAN_Y + 0.54, -3.48, 0.26],
    [2.18, OCEAN_Y + 0.88, -3.82, 0.24],
  ];
  for (const [px, py, pz, ph] of palmCoords) {
    pierEnamelParts.push(
      transformedCylinder(0.010, 0.016, ph, 6, px, py + ph * 0.5, pz, 0.06, 0, -0.08),
      transformedCylinder(0.085, 0.01, 0.045, 7, px - 0.015, py + ph + 0.01, pz + 0.01),
    );
  }

  // Horizon celestial arc lines behind the pier & sun
  const arcPts = 48;
  for (let i = 0; i < arcPts; i++) {
    const a0 = THREE.MathUtils.lerp(0.12, Math.PI - 0.12, i / arcPts);
    const a1 = THREE.MathUtils.lerp(0.12, Math.PI - 0.12, (i + 1) / arcPts);
    const r = 2.65;
    pierLineSegs.push(
      -0.35 + Math.cos(a0) * r,
      OCEAN_Y + Math.sin(a0) * r * 0.72,
      -4.6,
      -0.35 + Math.cos(a1) * r,
      OCEAN_Y + Math.sin(a1) * r * 0.72,
      -4.6,
    );
  }

  return {
    bluffGeo,
    bluffContoursGeo,
    pierEnamelGeo: mergeBufferGeometries(pierEnamelParts),
    pierPorcelainGeo: mergeBufferGeometries(pierPorcelainParts),
    pierGlassGeo: mergeBufferGeometries(pierGlassParts),
    pierLinesGeo: buildLineGeometry(pierLineSegs),
    pavilionPos: [pEndX, deckY + 0.22, pEndZ] as [number, number, number],
  };
}
