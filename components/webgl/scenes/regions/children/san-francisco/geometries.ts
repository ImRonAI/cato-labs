import * as THREE from 'three';
import {
  buildLineGeometry,
  mergeBufferGeometries,
  transformedBox,
  transformedCylinder,
} from '../orange-county/geom';

export const BAY_Y = -0.78;
export const DECK_Y = -0.18;

/**
 * Computes the steep Russian/Nob Hill street profile y(u) and z(u), x(u)
 * for u in [0..1], climbing from the waterfront up a 24% grade and cresting
 * onto a hilltop crown plateau.
 */
export function sampleCableCarHill(
  u: number,
  outPos: THREE.Vector3,
): { pitch: number; yaw: number } {
  const t = THREE.MathUtils.clamp(u, 0, 1);
  // Street runs diagonally from lower bayfront (x=0.42, z=1.45) up to hilltop crown (x=1.22, z=-0.45)
  const x = THREE.MathUtils.lerp(0.42, 1.22, t);
  const z = THREE.MathUtils.lerp(1.45, -0.45, t);

  // Smooth steep S-curve climb that levels off into a dramatic hilltop crest at t > 0.74
  const climb = smoothHillProfile(t);
  const y = BAY_Y + 0.24 + climb * 0.96;

  // Derivative for pitch
  const eps = 0.005;
  const t1 = Math.min(1, t + eps);
  const t0 = Math.max(0, t - eps);
  const dy = (smoothHillProfile(t1) - smoothHillProfile(t0)) * 0.96;
  const dx = (t1 - t0) * (1.22 - 0.42);
  const dz = (t1 - t0) * (-0.45 - 1.45);
  const horiz = Math.hypot(dx, dz);
  const pitch = Math.atan2(dy, horiz);
  const yaw = Math.atan2(dx, dz);

  outPos.set(x, y, z);
  return { pitch, yaw };
}

function smoothHillProfile(t: number): number {
  // Rises steeply from 0.08 to 0.78, with a classic SF intersection flat step mid-hill and crown at top
  const base = THREE.MathUtils.smoothstep(t, 0.02, 0.80);
  const midIntersection = -0.025 * Math.sin(t * Math.PI * 3.0) * Math.sin(t * Math.PI);
  const crown = 0.04 * THREE.MathUtils.smoothstep(t, 0.78, 1.0);
  return THREE.MathUtils.clamp(base + midIntersection + crown, 0, 1.04);
}

/**
 * Builds one Art Deco suspension tower centered at (tx, tz) rotated by `yaw`
 * (aligned perpendicular to the bridge deck direction).
 */
function appendDecoTower(
  tx: number,
  tz: number,
  yaw: number,
  scaleH: number,
  enamelParts: THREE.BufferGeometry[],
  porcelainParts: THREE.BufferGeometry[],
  crystalParts: THREE.BufferGeometry[],
  lineSegs: number[],
) {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const legHalfSpan = 0.21;

  // Concrete/porcelain elliptical fender pier at water level
  porcelainParts.push(
    transformedCylinder(0.34, 0.38, 0.14, 16, tx, BAY_Y + 0.06, tz, 0, yaw, 0),
    transformedBox(0.56, 0.12, 0.22, tx, BAY_Y + 0.14, tz, 0, yaw, 0),
  );

  // 4 stepped Art Deco setback tiers per leg
  const tiers = [
    { y0: BAY_Y + 0.18, h: 0.56 * scaleH, w: 0.088, d: 0.095 },
    { y0: BAY_Y + 0.18 + 0.56 * scaleH, h: 0.54 * scaleH, w: 0.074, d: 0.080 },
    { y0: BAY_Y + 0.18 + 1.10 * scaleH, h: 0.50 * scaleH, w: 0.060, d: 0.066 },
    { y0: BAY_Y + 0.18 + 1.60 * scaleH, h: 0.44 * scaleH, w: 0.048, d: 0.054 },
  ];

  for (const side of [-1, 1]) {
    const lx = tx + cosY * legHalfSpan * side;
    const lz = tz - sinY * legHalfSpan * side;

    for (const tier of tiers) {
      const cy = tier.y0 + tier.h * 0.5;
      enamelParts.push(transformedBox(tier.w, tier.h, tier.d, lx, cy, lz, 0, yaw, 0));
      // Deco vertical side fin setback
      enamelParts.push(
        transformedBox(tier.w * 1.28, tier.h * 0.92, tier.d * 0.52, lx, cy, lz, 0, yaw, 0),
      );
    }

    // Crystal saddle & beacon finial at summit
    const topY = BAY_Y + 0.18 + 2.04 * scaleH;
    crystalParts.push(
      transformedBox(0.075, 0.09, 0.085, lx, topY + 0.04, lz, 0, yaw, 0),
      transformedCylinder(0.012, 0.028, 0.12, 6, lx, topY + 0.14, lz),
    );
  }

  // Horizontal Art Deco portal struts above and below the roadway
  const strutHeights = [
    DECK_Y - 0.22,
    DECK_Y + 0.34 * scaleH,
    DECK_Y + 0.78 * scaleH,
    DECK_Y + 1.18 * scaleH,
    DECK_Y + 1.54 * scaleH,
  ];

  for (let i = 0; i < strutHeights.length; i++) {
    const sy = strutHeights[i];
    const sh = i === 0 ? 0.055 : 0.078 - i * 0.006;
    enamelParts.push(
      transformedBox(legHalfSpan * 2.0, sh, 0.058, tx, sy, tz, 0, yaw, 0),
    );
    // Art Deco vertical portal louvers inside each cross-strut
    for (const k of [-0.11, -0.055, 0, 0.055, 0.11]) {
      const kx = tx + cosY * k;
      const kz = tz - sinY * k;
      lineSegs.push(kx, sy - sh * 0.65, kz, kx, sy + sh * 0.65, kz);
    }
  }
}

/**
 * Builds the Golden Gate twin Art Deco suspension towers, catenary main cables,
 * vertical suspender cables, and stiffening truss deck.
 */
export function buildSuspensionBridgeGeometries() {
  const enamelParts: THREE.BufferGeometry[] = [];
  const porcelainParts: THREE.BufferGeometry[] = [];
  const crystalParts: THREE.BufferGeometry[] = [];
  const suspenderSegs: number[] = [];

  // Bridge centerline runs diagonally from SF anchorage (-0.32, 1.75) through
  // South Tower (-0.78, 0.35) and North Tower (-1.56, -2.05) to Marin (-1.95, -3.25)
  const p0 = new THREE.Vector2(-0.32, 1.75);
  const pSouth = new THREE.Vector2(-0.78, 0.35);
  const pNorth = new THREE.Vector2(-1.56, -2.05);
  const pEnd = new THREE.Vector2(-1.95, -3.25);

  const bridgeDir = new THREE.Vector2().subVectors(pEnd, p0).normalize();
  // Normal perpendicular to bridge axis in XZ
  const perp = new THREE.Vector2(-bridgeDir.y, bridgeDir.x);
  // Yaw so tower X-axis (leg span) aligns with `perp`
  const towerYaw = -Math.atan2(-perp.y, perp.x);

  const southScaleH = 1.0;
  const northScaleH = 0.98;
  const southTopY = BAY_Y + 0.18 + 2.04 * southScaleH + 0.06;
  const northTopY = BAY_Y + 0.18 + 2.04 * northScaleH + 0.06;

  appendDecoTower(
    pSouth.x,
    pSouth.y,
    towerYaw,
    southScaleH,
    enamelParts,
    porcelainParts,
    crystalParts,
    suspenderSegs,
  );
  appendDecoTower(
    pNorth.x,
    pNorth.y,
    towerYaw,
    northScaleH,
    enamelParts,
    porcelainParts,
    crystalParts,
    suspenderSegs,
  );

  // Stiffening truss roadway deck
  const totalLen = p0.distanceTo(pEnd);
  const midX = (p0.x + pEnd.x) * 0.5;
  const midZ = (p0.y + pEnd.y) * 0.5;
  const deckYaw = Math.atan2(bridgeDir.x, bridgeDir.y);

  enamelParts.push(
    transformedBox(0.36, 0.048, totalLen, midX, DECK_Y, midZ, 0, deckYaw, 0),
  );
  porcelainParts.push(
    transformedBox(0.30, 0.018, totalLen, midX, DECK_Y + 0.03, midZ, 0, deckYaw, 0),
  );

  // Anchorage piers at both shores
  porcelainParts.push(
    transformedBox(0.48, 0.28, 0.32, p0.x, BAY_Y + 0.46, p0.y, 0, deckYaw, 0),
    transformedBox(0.48, 0.28, 0.32, pEnd.x, BAY_Y + 0.46, pEnd.y, 0, deckYaw, 0),
  );

  // Helper to evaluate catenary height along normalized bridge coordinate s in [0..1]
  const sSouth = p0.distanceTo(pSouth) / totalLen;
  const sNorth = p0.distanceTo(pNorth) / totalLen;

  function cableHeightAt(s: number): number {
    if (s <= sSouth) {
      const u = s / sSouth;
      // Side span parabolic curve from anchorage (DECK_Y + 0.04) up to South Tower saddle
      return THREE.MathUtils.lerp(DECK_Y + 0.04, southTopY, u * u * 0.65 + u * 0.35);
    }
    if (s <= sNorth) {
      const u = (s - sSouth) / (sNorth - sSouth);
      // Main span catenary sag down to DECK_Y + 0.12 at midpoint
      const ends = THREE.MathUtils.lerp(southTopY, northTopY, u);
      const sag = (southTopY - (DECK_Y + 0.13)) * 4 * u * (1 - u);
      return ends - sag;
    }
    const u = (s - sNorth) / (1 - sNorth);
    const inv = 1 - u;
    return THREE.MathUtils.lerp(DECK_Y + 0.04, northTopY, inv * inv * 0.65 + inv * 0.35);
  }

  // Build 2 smooth catenary main cables (TubeGeometry) + vertical suspender lines
  const legHalfSpan = 0.21;
  for (const side of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    const cableSegs = 64;
    for (let i = 0; i <= cableSegs; i++) {
      const s = i / cableSegs;
      const cx = THREE.MathUtils.lerp(p0.x, pEnd.x, s) + perp.x * legHalfSpan * side;
      const cz = THREE.MathUtils.lerp(p0.y, pEnd.y, s) + perp.y * legHalfSpan * side;
      const cy = cableHeightAt(s);
      pts.push(new THREE.Vector3(cx, cy, cz));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 64, 0.015, 7, false);
    enamelParts.push(tube);

    // Vertical suspender ropes every ~1/44 of span
    const hangers = 46;
    for (let i = 1; i < hangers; i++) {
      const s = i / hangers;
      if (Math.abs(s - sSouth) < 0.018 || Math.abs(s - sNorth) < 0.018) continue;
      const cx = THREE.MathUtils.lerp(p0.x, pEnd.x, s) + perp.x * legHalfSpan * side;
      const cz = THREE.MathUtils.lerp(p0.y, pEnd.y, s) + perp.y * legHalfSpan * side;
      const cy = cableHeightAt(s);
      suspenderSegs.push(cx, DECK_Y + 0.025, cz, cx, cy, cz);
    }
  }

  // Marin Headlands silhouette beyond the North Tower
  const marinParts: THREE.BufferGeometry[] = [];
  const headlands = [
    { x: -2.25, z: -3.45, r: 1.25, h: 1.15 },
    { x: -1.35, z: -3.65, r: 1.05, h: 0.88 },
    { x: -2.85, z: -2.95, r: 0.95, h: 0.82 },
  ];
  for (const m of headlands) {
    const cone = new THREE.ConeGeometry(m.r, m.h, 7);
    cone.scale(1.35, 1, 0.82);
    cone.translate(m.x, BAY_Y + m.h * 0.48, m.z);
    marinParts.push(cone);
  }

  return {
    bridgeEnamelGeo: mergeBufferGeometries(enamelParts),
    bridgePorcelainGeo: mergeBufferGeometries(porcelainParts),
    bridgeCrystalGeo: mergeBufferGeometries(crystalParts),
    marinHeadlandsGeo: mergeBufferGeometries(marinParts),
    suspenderLinesGeo: buildLineGeometry(suspenderSegs),
  };
}

/**
 * Builds the steep SF hillside grid (Russian / Nob Hill), the Financial District
 * skyline with the Transamerica Pyramid, and the luminous glass Cable-Car prism.
 */
export function buildHillSkylineAndCableCarGeometries() {
  const hillParts: THREE.BufferGeometry[] = [];
  const skylineGlassParts: THREE.BufferGeometry[] = [];
  const skylinePorcelainParts: THREE.BufferGeometry[] = [];
  const gridSegs: number[] = [];

  // 1. Sculpted SF hillside mesh aligned under sampleCableCarHill(u)
  const segU = 28; // along climb
  const segV = 20; // cross-hill width
  const hillGeo = new THREE.PlaneGeometry(1.55, 2.35, segV, segU);
  const posAttr = hillGeo.getAttribute('position');
  const tmp = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i++) {
    const localX = posAttr.getX(i); // -0.775 .. +0.775
    const localY = posAttr.getY(i); // -1.175 .. +1.175
    const u = (localY + 1.175) / 2.35; // 0 .. 1 climb
    const v = localX / 0.775; // -1 .. +1 cross-street

    sampleCableCarHill(u, tmp);
    // Cross-slope falls away gently on left toward bay and rises slightly on right
    const crossDrop = -0.14 * v * v + 0.06 * v;
    const edgeSkirt = smoothstepEdge(Math.abs(v));
    const worldX = tmp.x + v * 0.78;
    const worldZ = tmp.z + v * 0.30;
    const worldY = THREE.MathUtils.lerp(BAY_Y + 0.02, tmp.y + crossDrop - 0.04, edgeSkirt);

    posAttr.setXYZ(i, worldX, worldY, worldZ);
  }
  hillGeo.computeVertexNormals();
  hillParts.push(hillGeo);

  // Etch steep orthogonal SF street grid + twin cable-car slot tracks over the hill
  const streetLanes = [-0.62, -0.34, -0.035, 0.0, 0.035, 0.34, 0.62];
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();

  for (const laneV of streetLanes) {
    const isTrack = Math.abs(laneV) < 0.06;
    const steps = 32;
    for (let s = 0; s < steps; s++) {
      const u0 = s / steps;
      const u1 = (s + 1) / steps;
      sampleCableCarHill(u0, pA);
      sampleCableCarHill(u1, pB);
      const drop = isTrack ? 0.008 : -0.14 * laneV * laneV + 0.06 * laneV - 0.022;
      gridSegs.push(
        pA.x + laneV * 0.78,
        pA.y + drop,
        pA.z + laneV * 0.30,
        pB.x + laneV * 0.78,
        pB.y + drop,
        pB.z + laneV * 0.30,
      );
    }
  }

  // Cross streets every block up the hill
  for (let b = 1; b <= 7; b++) {
    const u = b / 8;
    sampleCableCarHill(u, pA);
    const crossSteps = 14;
    for (let c = 0; c < crossSteps; c++) {
      const v0 = -0.72 + (c / crossSteps) * 1.44;
      const v1 = -0.72 + ((c + 1) / crossSteps) * 1.44;
      const y0 = pA.y - 0.14 * v0 * v0 + 0.06 * v0 - 0.02;
      const y1 = pA.y - 0.14 * v1 * v1 + 0.06 * v1 - 0.02;
      gridSegs.push(
        pA.x + v0 * 0.78,
        y0,
        pA.z + v0 * 0.30,
        pA.x + v1 * 0.78,
        y1,
        pA.z + v1 * 0.30,
      );
    }
  }

  // Architectural Victorian / Modernist rowhouse prisms lining the steep street
  const blockUs = [0.18, 0.34, 0.50, 0.66];
  for (const bu of blockUs) {
    sampleCableCarHill(bu, pA);
    for (const side of [-1, 1]) {
      const v = side * 0.22;
      const bx = pA.x + v * 0.78;
      const bz = pA.z + v * 0.30;
      const by = pA.y - 0.14 * v * v + 0.06 * v;
      const h = 0.13 + (bu * 0.07);
      skylinePorcelainParts.push(
        transformedBox(0.11, h, 0.13, bx, by + h * 0.45, bz, 0, 0.38, 0),
      );
    }
  }

  // 2. Downtown Skyline — Transamerica Pyramid + Salesforce Obelisk + Stepped Towers
  const pyrX = 1.56;
  const pyrZ = -1.35;
  const pyrBaseY = BAY_Y + 0.34;
  const pyrH = 1.42;
  // Transamerica main 4-sided crystal pyramid + twin elevator wing shafts
  skylineGlassParts.push(
    transformedCylinder(0.012, 0.24, pyrH, 4, pyrX, pyrBaseY + pyrH * 0.5, pyrZ, 0, Math.PI * 0.25, 0),
    transformedBox(0.065, pyrH * 0.58, 0.08, pyrX + 0.11, pyrBaseY + pyrH * 0.34, pyrZ, 0, 0, 0.04),
    transformedBox(0.065, pyrH * 0.58, 0.08, pyrX - 0.11, pyrBaseY + pyrH * 0.34, pyrZ, 0, 0, -0.04),
  );

  // Tapered Salesforce-inspired tower & cluster
  const towers = [
    { x: 2.02, z: -1.68, w: 0.20, d: 0.20, h: 1.52, glass: true },
    { x: 1.18, z: -1.58, w: 0.22, d: 0.18, h: 0.96, glass: false },
    { x: 1.82, z: -1.12, w: 0.18, d: 0.18, h: 0.88, glass: false },
    { x: 1.36, z: -1.88, w: 0.19, d: 0.19, h: 1.08, glass: true },
    { x: 2.24, z: -1.36, w: 0.17, d: 0.17, h: 0.78, glass: false },
  ];
  for (const t of towers) {
    const geom = transformedBox(t.w, t.h, t.d, t.x, BAY_Y + 0.28 + t.h * 0.5, t.z, 0, 0.22, 0);
    if (t.glass) skylineGlassParts.push(geom);
    else skylinePorcelainParts.push(geom);
  }

  // Coit Tower cylinder atop Telegraph Hill shoulder
  skylinePorcelainParts.push(
    transformedCylinder(0.052, 0.062, 0.34, 12, 0.92, BAY_Y + 0.98, -0.92),
    transformedCylinder(0.036, 0.044, 0.08, 12, 0.92, BAY_Y + 1.18, -0.92),
  );

  // 3. Luminous Refractive Glass Cable-Car Prism
  const carGlassParts: THREE.BufferGeometry[] = [];
  const carEnamelParts: THREE.BufferGeometry[] = [];
  // Main prism glass cabin + open-air California-style end platforms + clerestory roof monitor
  carGlassParts.push(
    transformedBox(0.115, 0.095, 0.27, 0, 0.068, 0),
    transformedBox(0.072, 0.036, 0.19, 0, 0.132, 0),
  );
  // Chassis bogie, roof trim, grip lever post & brass-blue cowcatcher
  carEnamelParts.push(
    transformedBox(0.122, 0.024, 0.295, 0, 0.016, 0),
    transformedBox(0.120, 0.012, 0.28, 0, 0.116, 0),
    transformedCylinder(0.016, 0.016, 0.11, 8, 0, 0.014, 0.085, 0, 0, Math.PI / 2),
    transformedCylinder(0.016, 0.016, 0.11, 8, 0, 0.014, -0.085, 0, 0, Math.PI / 2),
  );

  return {
    hillGeo: mergeBufferGeometries(hillParts),
    skylineGlassGeo: mergeBufferGeometries(skylineGlassParts),
    skylinePorcelainGeo: mergeBufferGeometries(skylinePorcelainParts),
    streetGridGeo: buildLineGeometry(gridSegs),
    carGlassGeo: mergeBufferGeometries(carGlassParts),
    carEnamelGeo: mergeBufferGeometries(carEnamelParts),
    pyramidApexPos: [pyrX, pyrBaseY + pyrH + 0.04, pyrZ] as [number, number, number],
  };
}

function smoothstepEdge(v: number): number {
  const t = THREE.MathUtils.clamp((1.0 - v) / 0.18, 0, 1);
  return t * t * (3 - 2 * t);
}
