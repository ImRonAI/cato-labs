'use client';

import * as THREE from 'three';

/**
 * Merge an array of BufferGeometries (positions + normals) into a single
 * indexed BufferGeometry and dispose the source parts.
 */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;

  const prepared = parts.map((g) => {
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position as THREE.BufferAttribute;
    const idx = g.getIndex();
    totalVerts += pos.count;
    totalIndices += idx ? idx.count : pos.count;
    return g;
  });

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  for (const g of prepared) {
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute;
    const idx = g.getIndex();

    for (let i = 0; i < pos.count; i++) {
      const o = (vOffset + i) * 3;
      positions[o] = pos.getX(i);
      positions[o + 1] = pos.getY(i);
      positions[o + 2] = pos.getZ(i);
      if (nor) {
        normals[o] = nor.getX(i);
        normals[o + 1] = nor.getY(i);
        normals[o + 2] = nor.getZ(i);
      }
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices[iOffset + i] = idx.getX(i) + vOffset;
      }
      iOffset += idx.count;
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices[iOffset + i] = vOffset + i;
      }
      iOffset += pos.count;
    }

    vOffset += pos.count;
    g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  return out;
}

/**
 * Helper to build a single BufferGeometry for <lineSegments> (pairs of 3D points).
 */
export class LineBuilder {
  private coords: number[] = [];

  addSegment(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    this.coords.push(x1, y1, z1, x2, y2, z2);
  }

  addPolyline(pts: [number, number, number][], closed = false) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      this.addSegment(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    if (closed && pts.length > 2) {
      const a = pts[pts.length - 1];
      const b = pts[0];
      this.addSegment(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  }

  addRectXZ(cx: number, y: number, cz: number, w: number, d: number) {
    const hw = w * 0.5;
    const hd = d * 0.5;
    this.addPolyline(
      [
        [cx - hw, y, cz - hd],
        [cx + hw, y, cz - hd],
        [cx + hw, y, cz + hd],
        [cx - hw, y, cz + hd],
      ],
      true,
    );
  }

  addCircleXZ(cx: number, y: number, cz: number, r: number, segs = 24) {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
    }
    this.addPolyline(pts, true);
  }

  addBoxFrame(
    cx: number,
    yBottom: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    floors = 0,
    mullionsX = 0,
    mullionsZ = 0,
  ) {
    const hw = w * 0.5;
    const hd = d * 0.5;
    const yTop = yBottom + h;
    this.addRectXZ(cx, yBottom, cz, w, d);
    this.addRectXZ(cx, yTop, cz, w, d);
    // 4 corner verticals
    this.addSegment(cx - hw, yBottom, cz - hd, cx - hw, yTop, cz - hd);
    this.addSegment(cx + hw, yBottom, cz - hd, cx + hw, yTop, cz - hd);
    this.addSegment(cx + hw, yBottom, cz + hd, cx + hw, yTop, cz + hd);
    this.addSegment(cx - hw, yBottom, cz + hd, cx - hw, yTop, cz + hd);

    for (let f = 1; f < floors; f++) {
      const yf = yBottom + (f / floors) * h;
      this.addRectXZ(cx, yf, cz, w, d);
    }

    for (let m = 1; m <= mullionsX; m++) {
      const x = cx - hw + (m / (mullionsX + 1)) * w;
      this.addSegment(x, yBottom, cz + hd, x, yTop, cz + hd);
      this.addSegment(x, yBottom, cz - hd, x, yTop, cz - hd);
    }

    for (let m = 1; m <= mullionsZ; m++) {
      const z = cz - hd + (m / (mullionsZ + 1)) * d;
      this.addSegment(cx + hw, yBottom, z, cx + hw, yTop, z);
      this.addSegment(cx - hw, yBottom, z, cx - hw, yTop, z);
    }
  }

  addOctagonPrismFrame(
    cx: number,
    yBottom: number,
    cz: number,
    r: number,
    h: number,
    rings = 3,
  ) {
    const yTop = yBottom + h;
    const sides = 8;
    for (let k = 0; k <= rings; k++) {
      const y = yBottom + (k / rings) * h;
      this.addCircleXZ(cx, y, cz, r, sides);
    }
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      this.addSegment(x, yBottom, z, x, yTop, z);
    }
  }

  addDomeRibs(
    cx: number,
    yBase: number,
    cz: number,
    r: number,
    meridians = 8,
    parallels = 3,
  ) {
    // parallel rings
    for (let p = 0; p < parallels; p++) {
      const phi = (p / parallels) * (Math.PI * 0.45);
      const rp = Math.cos(phi) * r;
      const yp = yBase + Math.sin(phi) * r;
      this.addCircleXZ(cx, yp, cz, rp, 24);
    }
    // meridian arcs
    for (let m = 0; m < meridians; m++) {
      const theta = (m / meridians) * Math.PI * 2;
      const pts: [number, number, number][] = [];
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const phi = (s / steps) * (Math.PI * 0.5);
        const rp = Math.cos(phi) * r;
        const yp = yBase + Math.sin(phi) * r;
        pts.push([cx + Math.cos(theta) * rp, yp, cz + Math.sin(theta) * rp]);
      }
      this.addPolyline(pts, false);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.coords), 3));
    return g;
  }
}

export interface LosAngelesModelGeometries {
  porcelainGeo: THREE.BufferGeometry;
  crystalGlassGeo: THREE.BufferGeometry;
  coreGlassGeo: THREE.BufferGeometry;
  paneGlassGeo: THREE.BufferGeometry;
  enamelGeo: THREE.BufferGeometry;
  liquidGeo: THREE.BufferGeometry;
  lineGeo: THREE.BufferGeometry;
}

/**
 * Builds the complete Los Angeles architectural miniature geometry set:
 * 1. The Hollywood Hills stepped topographic ridge + Griffith-like three-dome Observatory + Astronomers Obelisk
 * 2. Downtown Los Angeles (DTLA) skyline: U.S. Bank Tower, Wilshire Grand Center (with curved sail crown + spire),
 *    Los Angeles City Hall (stepped pyramid beacon), 777 Tower, Aon Center, Gas Company Tower
 * 3. Sixth Street Viaduct ("Ribbon of Light") canted arches spanning the LA River channel
 * 4. The Basin Vitrine Plinth, Sunset/Wilshire Palm Boulevard sidewalks, and Santa Monica Pier Deck over a Pacific cove
 * 5. Foreground Film Set / Soundstage Director's Rig: 3D Cinema Camera on Tripod + Dolly Track + Studio Fresnel Key Light
 */
export function buildLosAngelesArchitecture(): LosAngelesModelGeometries {
  const porcelainParts: THREE.BufferGeometry[] = [];
  const crystalParts: THREE.BufferGeometry[] = [];
  const coreParts: THREE.BufferGeometry[] = [];
  const paneParts: THREE.BufferGeometry[] = [];
  const enamelParts: THREE.BufferGeometry[] = [];
  const liquidParts: THREE.BufferGeometry[] = [];
  const lines = new LineBuilder();

  const box = (w: number, h: number, d: number, x: number, yBottom: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, yBottom + h * 0.5, z);
    return g;
  };

  const cyl = (
    rt: number,
    rb: number,
    h: number,
    segs: number,
    x: number,
    yBottom: number,
    z: number,
    rotY = 0,
  ) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, segs);
    if (rotY !== 0) g.rotateY(rotY);
    g.translate(x, yBottom + h * 0.5, z);
    return g;
  };

  const dome = (r: number, segs: number, x: number, yBase: number, z: number) => {
    const g = new THREE.SphereGeometry(r, segs, Math.max(8, Math.floor(segs * 0.5)), 0, Math.PI * 2, 0, Math.PI * 0.5);
    g.translate(x, yBase, z);
    return g;
  };

  /* =======================================================================
   * 0. ARCHITECTURAL VITRINE BASE PLINTH & PACIFIC COASTAL INLET
   * ======================================================================= */
  // Main porcelain model slab (x: -2.45..+2.35, z: -1.75..+1.55)
  porcelainParts.push(box(4.8, 0.14, 3.3, -0.05, -0.14, -0.1));
  // Frosted glass sub-plinth bevel
  paneParts.push(box(4.92, 0.06, 3.42, -0.05, -0.2, -0.1));
  lines.addRectXZ(-0.05, 0.002, -0.1, 4.78, 3.28);
  lines.addRectXZ(-0.05, -0.14, -0.1, 4.92, 3.42);

  // Pacific Ocean coastal water shelf on the Westside (x: -2.45..-1.25, z: +0.05..+1.52)
  liquidParts.push(box(1.22, 0.045, 1.44, -1.84, -0.015, 0.77));
  // Subtle shoreline breakwater step
  porcelainParts.push(box(0.08, 0.04, 1.44, -1.21, 0.0, 0.77));

  // Santa Monica Pier Deck extending out over the water (x: -1.20..-2.22, z: +0.58)
  const pierX = -1.72;
  const pierZ = 0.58;
  porcelainParts.push(box(1.06, 0.035, 0.36, pierX, 0.08, pierZ));
  lines.addRectXZ(pierX, 0.116, pierZ, 1.06, 0.36);
  // Pier trestle pilings into the water
  for (let px = -1.3; px >= -2.18; px -= 0.175) {
    enamelParts.push(cyl(0.012, 0.012, 0.11, 8, px, 0.0, pierZ - 0.13));
    enamelParts.push(cyl(0.012, 0.012, 0.11, 8, px, 0.0, pierZ + 0.13));
  }
  // Pier entrance arch ("Santa Monica Pier" generic coastal arch) at x = -1.23
  enamelParts.push(cyl(0.012, 0.012, 0.22, 8, -1.23, 0.115, pierZ - 0.14));
  enamelParts.push(cyl(0.012, 0.012, 0.22, 8, -1.23, 0.115, pierZ + 0.14));
  coreParts.push(box(0.025, 0.04, 0.32, -1.23, 0.31, pierZ));

  /* =======================================================================
   * 1. THE HOLLYWOOD HILLS & GRIFFITH-LIKE OBSERVATORY (NORTH-WEST RIDGE)
   *    NO Hollywood Sign letters — pure topographic ridge + iconic Observatory
   * ======================================================================= */
  const obsX = -0.78;
  const obsZ = -1.02;
  const hillTiers = [
    { w: 2.25, d: 1.18, h: 0.16, x: -0.78, z: -1.06, y: 0.0 },
    { w: 1.98, d: 1.02, h: 0.16, x: -0.78, z: -1.05, y: 0.16 },
    { w: 1.72, d: 0.88, h: 0.16, x: -0.78, z: -1.04, y: 0.32 },
    { w: 1.48, d: 0.74, h: 0.16, x: -0.78, z: -1.03, y: 0.48 },
    { w: 1.28, d: 0.62, h: 0.15, x: -0.78, z: -1.02, y: 0.64 },
  ];

  hillTiers.forEach((t, idx) => {
    // Rounded-corner contour slab via cylinder-beveled box look
    if (idx % 2 === 1) {
      paneParts.push(box(t.w, t.h, t.d, t.x, t.y, t.z));
    } else {
      porcelainParts.push(box(t.w, t.h, t.d, t.x, t.y, t.z));
    }
    lines.addRectXZ(t.x, t.y + t.h + 0.002, t.z, t.w, t.d);
  });

  // Secondary eastern hillside ridge behind DTLA / Silver Lake (Echo Park hills)
  porcelainParts.push(box(1.35, 0.14, 0.72, 0.65, 0.0, -1.28));
  paneParts.push(box(1.05, 0.14, 0.54, 0.65, 0.14, -1.3));
  lines.addRectXZ(0.65, 0.142, -1.28, 1.35, 0.72);
  lines.addRectXZ(0.65, 0.282, -1.3, 1.05, 0.54);

  // Observatory Promenade Terrace at y = 0.79
  const obsY = 0.79;
  porcelainParts.push(box(1.16, 0.06, 0.52, obsX, obsY, obsZ));
  lines.addRectXZ(obsX, obsY + 0.062, obsZ, 1.16, 0.52);

  const deckY = obsY + 0.06; // 0.85

  // Main Beaux-Arts symmetrical wings (East-West axis)
  porcelainParts.push(box(0.86, 0.18, 0.22, obsX, deckY, obsZ - 0.04));
  lines.addBoxFrame(obsX, deckY, obsZ - 0.04, 0.86, 0.18, 0.22, 1, 8, 2);

  // Central Rotunda Drum + Large Planetarium Dome
  porcelainParts.push(cyl(0.24, 0.25, 0.26, 24, obsX, deckY, obsZ - 0.08));
  crystalParts.push(cyl(0.245, 0.245, 0.09, 24, obsX, deckY + 0.11, obsZ - 0.08));
  coreParts.push(dome(0.235, 28, obsX, deckY + 0.26, obsZ - 0.08));
  lines.addCircleXZ(obsX, deckY + 0.26, obsZ - 0.08, 0.242, 24);
  lines.addDomeRibs(obsX, deckY + 0.26, obsZ - 0.08, 0.238, 10, 3);

  // Planetarium dome astronomical viewing slit arch
  enamelParts.push(box(0.042, 0.19, 0.24, obsX, deckY + 0.32, obsZ - 0.08));

  // East & West Telescope Wing Drums + Coelostat / Zeiss Domes
  for (const side of [-1, 1]) {
    const wx = obsX + side * 0.41;
    const wz = obsZ + 0.01;
    // Octagonal/cylindrical drum
    porcelainParts.push(cyl(0.135, 0.142, 0.22, 20, wx, deckY, wz));
    // Upper copper/blue glass telescope dome
    coreParts.push(dome(0.132, 20, wx, deckY + 0.22, wz));
    lines.addCircleXZ(wx, deckY + 0.22, wz, 0.138, 16);
    lines.addDomeRibs(wx, deckY + 0.22, wz, 0.134, 6, 2);
    // Telescope tube peeking out of the dome slit toward the stars
    const tele = new THREE.CylinderGeometry(0.018, 0.022, 0.16, 10);
    tele.rotateX(-Math.PI * 0.28);
    tele.rotateY(side * 0.25);
    tele.translate(wx + side * 0.02, deckY + 0.33, wz + 0.05);
    enamelParts.push(tele);
  }

  // Front Portico Colonnade & Entrance Vestibule
  porcelainParts.push(box(0.28, 0.19, 0.12, obsX, deckY, obsZ + 0.09));
  for (let c = -2; c <= 2; c++) {
    enamelParts.push(cyl(0.012, 0.014, 0.18, 8, obsX + c * 0.055, deckY, obsZ + 0.155));
  }

  // Astronomers Monument (Iconic six-sided obelisk + sundial ring on front lawn)
  const monZ = obsZ + 0.21;
  porcelainParts.push(cyl(0.045, 0.055, 0.03, 12, obsX, deckY, monZ));
  porcelainParts.push(cyl(0.016, 0.034, 0.21, 6, obsX, deckY + 0.03, monZ));
  coreParts.push(new THREE.SphereGeometry(0.024, 12, 12).translate(obsX, deckY + 0.255, monZ));

  // Scenic Hillside Switchback Road leading up to the Observatory
  lines.addPolyline([
    [-0.15, 0.01, -0.35],
    [-0.32, 0.17, -0.45],
    [-0.58, 0.33, -0.52],
    [-0.45, 0.49, -0.62],
    [-0.68, 0.65, -0.71],
    [obsX, deckY + 0.005, obsZ + 0.25],
  ]);

  /* =======================================================================
   * 2. DOWNTOWN LOS ANGELES (DTLA) SKYLINE CLUSTER (EAST / CENTER-RIGHT)
   * ======================================================================= */
  // Bunker Hill stepped civic/financial podium
  const dtlaX = 0.72;
  const dtlaZ = -0.38;
  porcelainParts.push(box(1.92, 0.09, 1.32, dtlaX, 0.0, dtlaZ));
  paneParts.push(box(1.52, 0.07, 1.02, dtlaX - 0.05, 0.09, dtlaZ));
  lines.addRectXZ(dtlaX, 0.092, dtlaZ, 1.92, 1.32);
  lines.addRectXZ(dtlaX - 0.05, 0.162, dtlaZ, 1.52, 1.02);

  const podY = 0.16;

  // --- Landmark A: U.S. Bank Tower (Library Tower) at (0.78, -0.34) ---
  // Iconic 1,018 ft stepped octagonal/cylindrical skyscraper with illuminated crown pad
  const usbX = 0.78;
  const usbZ = -0.34;
  // Lower octagonal shaft
  crystalParts.push(cyl(0.21, 0.22, 1.28, 8, usbX, podY, usbZ, Math.PI / 8));
  lines.addOctagonPrismFrame(usbX, podY, usbZ, 0.215, 1.28, 5);
  // First setback tier
  crystalParts.push(cyl(0.175, 0.185, 0.42, 8, usbX, podY + 1.28, usbZ, Math.PI / 8));
  lines.addOctagonPrismFrame(usbX, podY + 1.28, usbZ, 0.18, 0.42, 2);
  // Second setback tier
  crystalParts.push(cyl(0.145, 0.15, 0.28, 8, usbX, podY + 1.7, usbZ, Math.PI / 8));
  lines.addOctagonPrismFrame(usbX, podY + 1.7, usbZ, 0.148, 0.28, 2);
  // Iconic Glass Crown Ring + Helipad
  coreParts.push(cyl(0.125, 0.125, 0.11, 16, usbX, podY + 1.98, usbZ));
  porcelainParts.push(cyl(0.105, 0.105, 0.02, 16, usbX, podY + 2.09, usbZ));
  lines.addCircleXZ(usbX, podY + 1.98, usbZ, 0.13, 16);
  lines.addCircleXZ(usbX, podY + 2.09, usbZ, 0.13, 16);

  // --- Landmark B: Wilshire Grand Center at (0.28, -0.22) ---
  // Iconic 1,100 ft tower with curved diagonal sail-top crown & spire
  const wgX = 0.28;
  const wgZ = -0.22;
  const wgW = 0.34;
  const wgD = 0.15;
  const wgH = 1.72;
  crystalParts.push(box(wgW, wgH, wgD, wgX, podY, wgZ));
  lines.addBoxFrame(wgX, podY, wgZ, wgW, wgH, wgD, 7, 3, 1);

  // Curved diagonal sail crown (stepped slices rising from left to right)
  const sailSlices = 8;
  for (let i = 0; i < sailSlices; i++) {
    const u = i / (sailSlices - 1);
    const sw = wgW / sailSlices;
    const sx = wgX - wgW * 0.5 + (i + 0.5) * sw;
    const sh = 0.06 + Math.pow(u, 1.35) * 0.32;
    coreParts.push(box(sw * 0.96, sh, wgD * 0.92, sx, podY + wgH, wgZ));
  }
  // Diagonal sail roofline
  lines.addSegment(
    wgX - wgW * 0.5,
    podY + wgH + 0.06,
    wgZ + wgD * 0.5,
    wgX + wgW * 0.5,
    podY + wgH + 0.38,
    wgZ + wgD * 0.5,
  );
  lines.addSegment(
    wgX - wgW * 0.5,
    podY + wgH + 0.06,
    wgZ - wgD * 0.5,
    wgX + wgW * 0.5,
    podY + wgH + 0.38,
    wgZ - wgD * 0.5,
  );
  // Architectural Spire on the high side of the sail crown (rises to y ≈ 2.62)
  const spireX = wgX + wgW * 0.38;
  enamelParts.push(cyl(0.005, 0.014, 0.38, 8, spireX, podY + wgH + 0.36, wgZ));
  coreParts.push(new THREE.SphereGeometry(0.022, 10, 10).translate(spireX, podY + wgH + 0.74, wgZ));

  // --- Landmark C: Los Angeles City Hall at (1.36, -0.46) ---
  // Iconic 1928 Civic Center tower with columned gallery & stepped ziggurat pyramid
  const chX = 1.36;
  const chZ = -0.46;
  // Civic podium base + cross wings
  porcelainParts.push(box(0.46, 0.18, 0.34, chX, 0.09, chZ));
  porcelainParts.push(box(0.32, 0.14, 0.24, chX, 0.27, chZ));
  // Main square shaft
  porcelainParts.push(box(0.19, 0.78, 0.19, chX, 0.41, chZ));
  lines.addBoxFrame(chX, 0.41, chZ, 0.19, 0.78, 0.19, 4, 2, 2);
  // Observation colonnade gallery
  crystalParts.push(box(0.21, 0.11, 0.21, chX, 1.19, chZ));
  // Stepped pyramid roof (4 ziggurat tiers)
  for (let s = 0; s < 4; s++) {
    const w = 0.18 - s * 0.036;
    porcelainParts.push(box(w, 0.042, w, chX, 1.3 + s * 0.042, chZ));
  }
  // Lindbergh Beacon apex
  coreParts.push(cyl(0.008, 0.022, 0.09, 8, chX, 1.468, chZ));
  coreParts.push(new THREE.SphereGeometry(0.02, 10, 10).translate(chX, 1.57, chZ));

  // --- Landmark D: 777 Tower (Pelli sculpted shaft) at (0.52, -0.68) ---
  crystalParts.push(box(0.26, 1.38, 0.24, 0.52, podY, -0.68));
  porcelainParts.push(box(0.22, 0.14, 0.2, 0.52, podY + 1.38, -0.68));
  lines.addBoxFrame(0.52, podY, -0.68, 0.26, 1.38, 0.24, 5, 2, 2);

  // --- Landmark E: Aon Center (Clean modernist monolith) at (0.04, -0.58) ---
  crystalParts.push(box(0.28, 1.48, 0.18, 0.04, podY, -0.58));
  coreParts.push(box(0.284, 0.06, 0.184, 0.04, podY + 1.42, -0.58));
  lines.addBoxFrame(0.04, podY, -0.58, 0.28, 1.48, 0.18, 6, 3, 1);

  // --- Landmark F: Gas Company Tower (Boat-prow crown) at (1.06, -0.16) ---
  crystalParts.push(box(0.25, 1.24, 0.2, 1.06, podY, -0.16));
  coreParts.push(cyl(0.02, 0.11, 0.22, 4, 1.06, podY + 1.24, -0.16, Math.PI / 4));
  lines.addBoxFrame(1.06, podY, -0.16, 0.25, 1.24, 0.2, 5, 2, 1);

  // --- Supporting DTLA Mid-rises & Walt Disney Concert Hall inspired curved sails at (1.02, -0.56) ---
  // Sculpted metallic/glass curving shells (Frank Gehry / Grand Ave cultural corridor nod)
  for (let s = 0; s < 3; s++) {
    const shell = new THREE.CylinderGeometry(0.11, 0.14, 0.24, 16, 1, true, 0, Math.PI * 0.75);
    shell.rotateZ((s - 1) * 0.22);
    shell.rotateY(s * 0.8 + 0.4);
    shell.translate(1.02 + (s - 1) * 0.08, podY + 0.12, -0.54 + (s % 2) * 0.05);
    coreParts.push(shell);
  }

  // Secondary towers framing the cluster
  paneParts.push(box(0.22, 0.92, 0.22, 0.48, podY, 0.04));
  lines.addBoxFrame(0.48, podY, 0.04, 0.22, 0.92, 0.22, 4, 1, 1);

  paneParts.push(box(0.24, 0.78, 0.2, 1.34, 0.09, -0.06));
  lines.addBoxFrame(1.34, 0.09, -0.06, 0.24, 0.78, 0.2, 3, 1, 1);

  crystalParts.push(box(0.2, 0.86, 0.2, -0.18, 0.09, -0.25));
  lines.addBoxFrame(-0.18, 0.09, -0.25, 0.2, 0.86, 0.2, 4, 1, 1);

  /* =======================================================================
   * 3. THE SIXTH STREET VIADUCT ("RIBBON OF LIGHT" ARCHES) (EASTERN EDGE)
   *    5 pairs of canted parabolic arches spanning the LA River channel
   * ======================================================================= */
  const viaY = 0.08;
  const viaZ = 0.22;
  // Viaduct roadway deck from x = 1.25 to x = 2.22
  porcelainParts.push(box(1.02, 0.028, 0.15, 1.74, viaY, viaZ));
  for (let a = 0; a < 5; a++) {
    const ax = 1.34 + a * 0.2;
    const span = 0.18;
    const archH = 0.16 + (a === 2 ? 0.04 : 0);
    // Support pier
    porcelainParts.push(box(0.025, viaY, 0.16, ax - span * 0.5, 0.0, viaZ));
    // Parabolic arch segments on north and south edges (canted outward 12°)
    for (const side of [-1, 1]) {
      const zEdge = viaZ + side * 0.072;
      const pts: [number, number, number][] = [];
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const x = ax - span * 0.5 + u * span;
        const h = Math.sin(u * Math.PI) * archH;
        const zCant = zEdge + side * h * 0.22;
        pts.push([x, viaY + h, zCant]);
        if (s > 0 && s < steps && s % 2 === 0) {
          // Diagonal hanger cable line
          lines.addSegment(x, viaY + h, zCant, x, viaY + 0.014, zEdge);
        }
      }
      lines.addPolyline(pts, false);
      // Solid arch crown rib
      const archTorus = new THREE.TorusGeometry(span * 0.5, 0.009, 6, 14, Math.PI);
      archTorus.scale(1, archH / (span * 0.5), 1);
      archTorus.rotateX(side * -0.22);
      archTorus.translate(ax, viaY + 0.01, zEdge);
      coreParts.push(archTorus);
    }
  }

  /* =======================================================================
   * 4. THE GRAND PALM BOULEVARD & BASIN GRID + STADIUM RUNWAY ARCH
   * ======================================================================= */
  // Raised Boulevard promenade running from the Coast (x = -1.2) across to DTLA (x = +1.65) at z = +0.58
  const blvdZ = 0.58;
  porcelainParts.push(box(2.95, 0.022, 0.42, 0.24, 0.0, blvdZ));
  // Center landscaped median strip
  paneParts.push(box(2.85, 0.032, 0.045, 0.24, 0.0, blvdZ));
  // Crisp boulevard lane lines
  lines.addSegment(-1.2, 0.026, blvdZ - 0.18, 1.7, 0.026, blvdZ - 0.18);
  lines.addSegment(-1.2, 0.026, blvdZ + 0.18, 1.7, 0.026, blvdZ + 0.18);
  lines.addSegment(-1.2, 0.035, blvdZ, 1.7, 0.035, blvdZ);

  // Cross avenues & basin neighborhood grid lines
  for (let gx = -1.1; gx <= 1.6; gx += 0.45) {
    lines.addSegment(gx, 0.005, -0.8, gx, 0.005, 1.38);
  }
  for (let gz = -0.4; gz <= 1.35; gz += 0.35) {
    if (Math.abs(gz - blvdZ) < 0.15) continue;
    lines.addSegment(-1.18, 0.005, gz, 2.05, 0.005, gz);
  }

  // Iconic LA Events Runway / Stadium Arch (referencing the 2026-2028 global mega-events runway)
  // Positioned at the southern basin edge (x = -0.35, z = +1.18)
  const stadX = -0.38;
  const stadZ = 1.16;
  porcelainParts.push(cyl(0.24, 0.28, 0.05, 24, stadX, 0.0, stadZ));
  const canopyRing = new THREE.RingGeometry(0.14, 0.25, 28);
  canopyRing.rotateX(-Math.PI / 2);
  canopyRing.translate(stadX, 0.054, stadZ);
  paneParts.push(canopyRing);
  const stadArch = new THREE.TorusGeometry(0.27, 0.011, 8, 24, Math.PI);
  stadArch.rotateZ(0);
  stadArch.translate(stadX, 0.01, stadZ);
  coreParts.push(stadArch);
  lines.addCircleXZ(stadX, 0.056, stadZ, 0.25, 24);

  /* =======================================================================
   * 5. FOREGROUND DIRECTOR'S SOUNDSTAGE TERRACE & 3D CINEMA CAMERA RIG
   *    (Where Cato stands directing the shot / walking the boulevard!)
   * ======================================================================= */
  const stageX = 0.68;
  const stageZ = 1.06;
  const stageY = 0.04;
  // Circular + stepped porcelain studio stage platform
  porcelainParts.push(cyl(0.62, 0.66, stageY, 32, stageX, 0.0, stageZ));
  paneParts.push(cyl(0.56, 0.58, 0.018, 32, stageX, stageY, stageZ));
  lines.addCircleXZ(stageX, stageY + 0.02, stageZ, 0.57, 32);
  lines.addCircleXZ(stageX, 0.004, stageZ, 0.65, 32);

  // --- Miniature 3D Cinema Camera on Tripod & Dolly Track at (stageX - 0.34, stageZ + 0.06) ---
  const camX = stageX - 0.34;
  const camY = stageY + 0.018;
  const camZ = stageZ + 0.06;

  // Dolly track rails on the terrace
  enamelParts.push(box(0.46, 0.012, 0.014, camX - 0.04, camY, camZ - 0.06));
  enamelParts.push(box(0.46, 0.012, 0.014, camX - 0.04, camY, camZ + 0.06));
  for (let tie = -0.22; tie <= 0.16; tie += 0.075) {
    porcelainParts.push(box(0.016, 0.008, 0.14, camX + tie, camY, camZ));
  }

  // Tripod legs (3 angled legs meeting at y = camY + 0.24)
  const headY = camY + 0.24;
  for (let leg = 0; leg < 3; leg++) {
    const a = (leg / 3) * Math.PI * 2 + 0.3;
    const lGeo = new THREE.CylinderGeometry(0.008, 0.006, 0.26, 6);
    lGeo.rotateZ(0.28);
    lGeo.rotateY(a);
    lGeo.translate(camX + Math.cos(a) * 0.035, camY + 0.12, camZ + Math.sin(a) * 0.035);
    enamelParts.push(lGeo);
  }

  // Cinema Camera Body + Dual Coaxial 35mm Film Magazines + Matte Box Lens aimed at Cato / DTLA
  const camBody = box(0.11, 0.085, 0.065, camX, headY, camZ);
  enamelParts.push(camBody);
  // Dual top film reels on the cinema camera
  const mag1 = new THREE.CylinderGeometry(0.042, 0.042, 0.028, 16);
  mag1.rotateX(Math.PI / 2);
  mag1.translate(camX - 0.028, headY + 0.11, camZ);
  coreParts.push(mag1);
  const mag2 = new THREE.CylinderGeometry(0.042, 0.042, 0.028, 16);
  mag2.rotateX(Math.PI / 2);
  mag2.translate(camX + 0.032, headY + 0.11, camZ);
  coreParts.push(mag2);
  // Matte box & telephoto lens pointing toward +x / -z
  const lens = new THREE.CylinderGeometry(0.028, 0.02, 0.07, 12);
  lens.rotateZ(-Math.PI / 2);
  lens.translate(camX + 0.085, headY + 0.042, camZ);
  coreParts.push(lens);

  // --- Studio Fresnel Key Light on C-Stand at (stageX + 0.42, stageZ + 0.12) ---
  const lightX = stageX + 0.42;
  const lightZ = stageZ + 0.12;
  enamelParts.push(cyl(0.008, 0.01, 0.34, 8, lightX, camY, lightZ));
  enamelParts.push(cyl(0.06, 0.07, 0.014, 12, lightX, camY, lightZ));
  const lampHead = new THREE.CylinderGeometry(0.038, 0.028, 0.065, 12);
  lampHead.rotateZ(Math.PI * 0.38);
  lampHead.rotateY(-0.4);
  lampHead.translate(lightX, camY + 0.34, lightZ);
  coreParts.push(lampHead);

  // --- Premiere Searchlight Pedestals (at (-0.28, 0.36) and (+1.22, 0.34)) ---
  for (const [sx, sz] of [
    [-0.28, 0.36],
    [1.22, 0.34],
  ]) {
    porcelainParts.push(cyl(0.055, 0.068, 0.045, 12, sx, 0.0, sz));
    enamelParts.push(cyl(0.038, 0.038, 0.06, 12, sx, 0.045, sz));
  }

  return {
    porcelainGeo: mergeParts(porcelainParts),
    crystalGlassGeo: mergeParts(crystalParts),
    coreGlassGeo: mergeParts(coreParts),
    paneGlassGeo: mergeParts(paneParts),
    enamelGeo: mergeParts(enamelParts),
    liquidGeo: mergeParts(liquidParts),
    lineGeo: lines.build(),
  };
}
