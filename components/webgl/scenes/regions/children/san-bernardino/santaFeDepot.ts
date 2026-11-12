import * as THREE from 'three';
import {
  buildLineGeometry,
  buildTriGeometry,
  createLineBuilder,
  createTriBuilder,
  pushArchOutline,
  pushBox,
  pushBoxEdges,
  pushDome,
  pushExtrudedPolygon,
  pushFrustum,
  pushHippedRoof,
  pushLine,
  pushPolyline,
  pushTri,
  type LineBuilder,
  type TriBuilder,
} from './geomUtils';

/**
 * Architectural miniature of San Bernardino's historic 1918 Santa Fe Depot
 * (Mission Revival twin domed bell towers, curved espadaña gable, arched
 * trackside colonnade), the adjacent BNSF West Yard intermodal gantry +
 * container stacks, and the Historic U.S. Route 66 highway shield monument.
 */

export interface SantaFeDepotData {
  depotWallsGeo: THREE.BufferGeometry;
  depotRoofsGeo: THREE.BufferGeometry;
  depotAccentGeo: THREE.BufferGeometry;
  depotGlowGeo: THREE.BufferGeometry;
  depotLinesGeo: THREE.BufferGeometry;
  dispose: () => void;
}

/**
 * Extrude a smooth, typographically accurate '6' numeral with counter hole,
 * transformed into the Route 66 shield's coordinate frame.
 */
function pushSmoothDigitSix(
  accentTri: TriBuilder,
  lines: LineBuilder,
  cx: number,
  cy: number,
  s: number,
  shieldTf: (lx: number, ly: number, lz: number) => [number, number, number],
) {
  // Smooth outer contour of '6' (CCW)
  const outerPts: [number, number][] = [
    [0.055, 0.145],
    [0.015, 0.148],
    [-0.032, 0.128],
    [-0.068, 0.082],
    [-0.086, 0.018],
    [-0.088, -0.045],
    [-0.072, -0.098],
    [-0.038, -0.128],
    [0.004, -0.136],
    [0.048, -0.126],
    [0.078, -0.092],
    [0.088, -0.045],
    [0.076, 0.002],
    [0.044, 0.032],
    [0.002, 0.040],
    [-0.034, 0.028],
    [-0.020, 0.068],
    [0.012, 0.102],
    [0.052, 0.112],
  ].map(([x, y]) => [cx + x * s, cy + y * s]);

  // Smooth circular counter hole inside the lower bowl of '6' (CW)
  const holePts: [number, number][] = [];
  const holeSegs = 14;
  const hRx = 0.042 * s;
  const hRy = 0.046 * s;
  const hCy = cy - 0.048 * s;
  for (let i = 0; i < holeSegs; i++) {
    const a = -(i / holeSegs) * Math.PI * 2;
    holePts.push([cx + Math.cos(a) * hRx, hCy + Math.sin(a) * hRy]);
  }

  const shape = new THREE.Shape();
  outerPts.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  const hole = new THREE.Path();
  holePts.forEach(([x, y], i) => {
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  });
  hole.closePath();
  shape.holes.push(hole);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: false,
  });
  geom.translate(0, 0, 0.024);

  const posAttr = geom.getAttribute('position');
  const idxAttr = geom.getIndex();
  if (idxAttr) {
    for (let i = 0; i < idxAttr.count; i += 3) {
      const ia = idxAttr.getX(i);
      const ib = idxAttr.getX(i + 1);
      const ic = idxAttr.getX(i + 2);
      const a = shieldTf(posAttr.getX(ia), posAttr.getY(ia), posAttr.getZ(ia));
      const b = shieldTf(posAttr.getX(ib), posAttr.getY(ib), posAttr.getZ(ib));
      const c = shieldTf(posAttr.getX(ic), posAttr.getY(ic), posAttr.getZ(ic));
      pushTri(accentTri, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    }
  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      const a = shieldTf(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      const b = shieldTf(posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1));
      const c = shieldTf(posAttr.getX(i + 2), posAttr.getY(i + 2), posAttr.getZ(i + 2));
      pushTri(accentTri, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    }
  }
  geom.dispose();

  pushPolyline(
    lines,
    outerPts.map(([x, y]) => shieldTf(x, y, 0.048)),
    true,
  );
  pushPolyline(
    lines,
    holePts.map(([x, y]) => shieldTf(x, y, 0.048)),
    true,
  );
}

export function buildSantaFeDepotAndLandmarks(): SantaFeDepotData {
  const wallsTri = createTriBuilder();
  const roofsTri = createTriBuilder();
  const accentTri = createTriBuilder();
  const glowTri = createTriBuilder();
  const lines = createLineBuilder();

  // Base elevation of the depot terrace
  const dx = 0.12;
  const dy = -0.68;
  const dz = -0.22;

  // 1. Stepped passenger platform & depot terrace plinth
  pushBox(wallsTri, dx, dy + 0.03, dz + 0.06, 2.48, 0.06, 0.78);
  pushBoxEdges(lines, dx, dy + 0.03, dz + 0.06, 2.48, 0.06, 0.78);
  pushBox(wallsTri, dx, dy + 0.07, dz, 2.26, 0.025, 0.58);
  pushBoxEdges(lines, dx, dy + 0.07, dz, 2.26, 0.025, 0.58);

  const pY = dy + 0.082; // Top of station platform

  // 2. Central Mission Revival Grand Waiting Hall
  const hallW = 0.72;
  const hallH = 0.44;
  const hallD = 0.42;
  pushBox(wallsTri, dx, pY + hallH * 0.5, dz, hallW, hallH, hallD);
  pushBoxEdges(lines, dx, pY + hallH * 0.5, dz, hallW, hallH, hallD);

  // Curved Mission Revival espadaña parapet gable above the central hall front
  const gable2D: [number, number][] = [
    [-0.34, 0],
    [0.34, 0],
    [0.34, 0.08],
    [0.25, 0.10],
    [0.18, 0.17],
    [0.09, 0.22],
    [0.0, 0.25],
    [-0.09, 0.22],
    [-0.18, 0.17],
    [-0.25, 0.10],
    [-0.34, 0.08],
  ];
  const gableZ = dz + hallD * 0.5 - 0.03;
  pushExtrudedPolygon(
    wallsTri,
    gable2D,
    gableZ,
    gableZ + 0.055,
    0.008,
    0.008,
    (x, y, z) => [dx + x, pY + hallH + y, z],
  );
  pushPolyline(
    lines,
    gable2D.map(([x, y]) => [dx + x, pY + hallH + y, gableZ + 0.062]),
    true,
  );

  // Central Rose Window Oculus in the Mission gable + glowing triple entry arches
  pushBox(glowTri, dx, pY + hallH + 0.11, gableZ + 0.062, 0.09, 0.09, 0.015);
  pushArchOutline(lines, dx, pY + hallH + 0.065, gableZ + 0.066, 0.11, pY + hallH + 0.11, 0.055, 12);

  for (const ox of [-0.19, 0, 0.19]) {
    pushBox(glowTri, dx + ox, pY + 0.14, dz + hallD * 0.5 + 0.004, 0.11, 0.24, 0.01);
    pushArchOutline(lines, dx + ox, pY, dz + hallD * 0.5 + 0.012, 0.13, pY + 0.19, 0.065, 10);
  }

  // Hipped Mission tile roof behind the central parapet
  pushHippedRoof(roofsTri, dx, pY + hallH, dz - 0.02, hallW + 0.04, hallD - 0.02, 0.15, 0.14, 0.14);

  // 3. Twin Mission Revival Domed Bell Towers (the signature icon of the 1918 Depot)
  for (const side of [-1, 1]) {
    const tx = dx + side * 0.48;
    const tz = dz + 0.02;
    const shaftW = 0.26;
    const shaftH = 0.62;

    // Lower tower shaft + molded belt courses
    pushBox(wallsTri, tx, pY + shaftH * 0.5, tz, shaftW, shaftH, shaftW);
    pushBoxEdges(lines, tx, pY + shaftH * 0.5, tz, shaftW, shaftH, shaftW);

    // Cornice moldings
    pushBox(accentTri, tx, pY + 0.38, tz, shaftW + 0.03, 0.022, shaftW + 0.03);
    pushBox(accentTri, tx, pY + shaftH, tz, shaftW + 0.04, 0.028, shaftW + 0.04);

    // Upper belfry stage
    const belfryY = pY + shaftH + 0.014;
    const belfryW = 0.215;
    const belfryH = 0.21;
    pushBox(wallsTri, tx, belfryY + belfryH * 0.5, tz, belfryW, belfryH, belfryW);
    pushBoxEdges(lines, tx, belfryY + belfryH * 0.5, tz, belfryW, belfryH, belfryW);

    // Glowing belfry arch openings on front & back + arch outlines
    pushBox(glowTri, tx, belfryY + belfryH * 0.48, tz + belfryW * 0.5 + 0.004, 0.085, 0.13, 0.01);
    pushArchOutline(lines, tx, belfryY + 0.02, tz + belfryW * 0.5 + 0.01, 0.095, belfryY + 0.12, 0.048, 8);

    // Corner pinnacles at top of belfry
    const drumBaseY = belfryY + belfryH;
    pushBox(accentTri, tx, drumBaseY + 0.012, tz, belfryW + 0.032, 0.024, belfryW + 0.032);
    for (const cxOff of [-1, 1]) {
      for (const czOff of [-1, 1]) {
        pushBox(
          wallsTri,
          tx + cxOff * (belfryW * 0.46),
          drumBaseY + 0.042,
          tz + czOff * (belfryW * 0.46),
          0.028,
          0.045,
          0.028,
        );
      }
    }

    // Octagonal drum + Hemispherical Azure Glass Mission Dome + Lantern Finial
    const domeY = drumBaseY + 0.024;
    pushFrustum(wallsTri, tx, domeY + 0.022, tz, 0.105, 0.105, 0.044, 12, true, false);
    pushDome(roofsTri, tx, domeY + 0.044, tz, 0.104, 0.115, 16, 7);
    // Dome finial spire (glowing)
    pushFrustum(glowTri, tx, domeY + 0.185, tz, 0.018, 0.004, 0.065, 8, true, true);
    pushLine(lines, tx, domeY + 0.155, tz, tx, domeY + 0.24, tz);
  }

  // 4. East & West Arched Mission Colonnade Loggia Wings
  for (const side of [-1, 1]) {
    const wingW = 0.64;
    const wingH = 0.31;
    const wingD = 0.33;
    const wx = dx + side * (0.48 + 0.13 + wingW * 0.5);
    const wz = dz;

    // Recessed inner hall wall
    pushBox(wallsTri, wx, pY + wingH * 0.5, wz - 0.02, wingW, wingH, wingD - 0.05);
    // Front colonnade frieze beam
    pushBox(wallsTri, wx, pY + wingH - 0.04, wz + wingD * 0.5 - 0.02, wingW, 0.08, 0.045);
    pushBoxEdges(lines, wx, pY + wingH * 0.5, wz, wingW, wingH, wingD);

    // 4 rhythmic Mission arcade piers & 3 arched bays per wing
    const bays = 4;
    const baySpan = wingW / bays;
    const frontZ = wz + wingD * 0.5 + 0.004;
    for (let i = 0; i <= bays; i++) {
      const px = wx - wingW * 0.5 + i * baySpan;
      pushBox(wallsTri, px, pY + (wingH - 0.08) * 0.5, wz + wingD * 0.5 - 0.02, 0.032, wingH - 0.08, 0.048);
      if (i < bays) {
        const archCx = px + baySpan * 0.5;
        pushArchOutline(lines, archCx, pY, frontZ, baySpan - 0.036, pY + 0.16, 0.052, 8);
        pushBox(glowTri, archCx, pY + 0.11, wz + wingD * 0.5 - 0.038, baySpan * 0.52, 0.14, 0.01);
      }
    }

    // Hipped tile roof over each wing + roof ribs
    pushHippedRoof(roofsTri, wx, pY + wingH, wz, wingW + 0.04, wingD + 0.04, 0.115, 0.08, 0.12);
    pushLine(
      lines,
      wx - wingW * 0.5 + 0.06,
      pY + wingH + 0.116,
      wz,
      wx + wingW * 0.5 - 0.06,
      pY + wingH + 0.116,
      wz,
    );
  }

  // ---------------------------------------------------------------------------
  // 5. BNSF WEST YARD INTERMODAL GANTRY CRANE & CONTAINER STACKS
  // ---------------------------------------------------------------------------
  const yx = -1.48;
  const yz = -0.12;
  pushBox(wallsTri, yx, dy + 0.02, yz, 0.88, 0.04, 0.64);
  pushBoxEdges(lines, yx, dy + 0.02, yz, 0.88, 0.04, 0.64);

  const contY0 = dy + 0.04;
  for (const rowZ of [-0.14, 0.08]) {
    pushBox(roofsTri, yx - 0.06, contY0 + 0.05, yz + rowZ, 0.42, 0.095, 0.11);
    pushBoxEdges(lines, yx - 0.06, contY0 + 0.05, yz + rowZ, 0.42, 0.095, 0.11);
    pushBox(accentTri, yx - 0.02, contY0 + 0.148, yz + rowZ, 0.46, 0.095, 0.11);
    pushBoxEdges(lines, yx - 0.02, contY0 + 0.148, yz + rowZ, 0.46, 0.095, 0.11);
  }

  const gSpanZ = 0.48;
  const gHeight = 0.42;
  for (const gxOff of [-0.28, 0.22]) {
    const gx = yx + gxOff;
    pushBox(accentTri, gx, contY0 + gHeight * 0.5, yz - gSpanZ * 0.5, 0.024, gHeight, 0.024);
    pushBox(accentTri, gx, contY0 + gHeight * 0.5, yz + gSpanZ * 0.5, 0.024, gHeight, 0.024);
    pushBox(accentTri, gx, contY0 + gHeight, yz, 0.03, 0.032, gSpanZ + 0.08);
    pushBoxEdges(lines, gx, contY0 + gHeight, yz, 0.03, 0.032, gSpanZ + 0.08);
  }
  pushBox(accentTri, yx - 0.03, contY0 + gHeight + 0.02, yz - gSpanZ * 0.35, 0.56, 0.02, 0.022);
  pushBox(accentTri, yx - 0.03, contY0 + gHeight + 0.02, yz + gSpanZ * 0.35, 0.56, 0.02, 0.022);
  pushBox(glowTri, yx - 0.03, contY0 + gHeight + 0.038, yz, 0.08, 0.018, 0.12);

  // ---------------------------------------------------------------------------
  // 6. HISTORIC U.S. ROUTE 66 HIGHWAY SHIELD MONUMENT
  // ---------------------------------------------------------------------------
  const sx = 1.48;
  const sy = -0.68;
  const sz = 1.02;
  const sRotY = -0.28;
  const cosR = Math.cos(sRotY);
  const sinR = Math.sin(sRotY);

  const shieldTf = (lx: number, ly: number, lz: number): [number, number, number] => {
    const rx = lx * cosR + lz * sinR;
    const rz = -lx * sinR + lz * cosR;
    return [sx + rx, sy + ly, sz + rz];
  };

  const basePts: [number, number][] = [
    [-0.28, -0.10],
    [0.28, -0.10],
    [0.28, 0.10],
    [-0.28, 0.10],
  ];
  pushExtrudedPolygon(
    wallsTri,
    basePts,
    0,
    0.045,
    0,
    0,
    (x, z, y) => shieldTf(x, y, z),
  );
  for (const postX of [-0.14, 0.14]) {
    const [px, py, pz] = shieldTf(postX, 0.22, 0);
    pushBox(accentTri, px, py, pz, 0.028, 0.42, 0.028);
  }

  const shieldCenterY = 0.46;
  const shield2D: [number, number][] = [
    [0.0, -0.24],
    [0.12, -0.20],
    [0.22, -0.11],
    [0.24, -0.01],
    [0.20, 0.08],
    [0.24, 0.16],
    [0.18, 0.23],
    [0.08, 0.21],
    [0.0, 0.24],
    [-0.08, 0.21],
    [-0.18, 0.23],
    [-0.24, 0.16],
    [-0.20, 0.08],
    [-0.24, -0.01],
    [-0.22, -0.11],
    [-0.12, -0.20],
  ];

  pushExtrudedPolygon(
    wallsTri,
    shield2D,
    -0.026,
    0.026,
    0.01,
    0.01,
    (x, y, z) => shieldTf(x, shieldCenterY + y, z),
  );

  const shieldBorder3D = shield2D.map(([x, y]) => shieldTf(x * 0.92, shieldCenterY + y * 0.92, 0.038));
  const shieldOuter3D = shield2D.map(([x, y]) => shieldTf(x * 1.02, shieldCenterY + y * 1.02, 0.036));
  pushPolyline(lines, shieldBorder3D, true);
  pushPolyline(lines, shieldOuter3D, true);
  pushLine(
    lines,
    ...shieldTf(-0.18, shieldCenterY + 0.105, 0.038),
    ...shieldTf(0.18, shieldCenterY + 0.105, 0.038),
  );

  const headerBar2D: [number, number][] = [
    [-0.16, 0.115],
    [0.16, 0.115],
    [0.18, 0.175],
    [0.0, 0.195],
    [-0.18, 0.175],
  ];
  pushExtrudedPolygon(
    accentTri,
    headerBar2D,
    0.022,
    0.042,
    0,
    0,
    (x, y, z) => shieldTf(x, shieldCenterY + y, z),
  );

  // Smooth extruded '66' numerals on the shield face
  pushSmoothDigitSix(accentTri, lines, -0.092, shieldCenterY - 0.042, 0.88, shieldTf);
  pushSmoothDigitSix(accentTri, lines, 0.092, shieldCenterY - 0.042, 0.88, shieldTf);

  // 7. Wayside Railroad Crossing Signal Cantilever where Route 66 meets the yard
  const sigX = -0.78;
  const sigZ = 0.72;
  pushBox(accentTri, sigX, dy + 0.24, sigZ, 0.022, 0.48, 0.022);
  pushBox(accentTri, sigX + 0.11, dy + 0.44, sigZ, 0.24, 0.02, 0.02);
  pushLine(lines, sigX - 0.05, dy + 0.28, sigZ + 0.016, sigX + 0.05, dy + 0.36, sigZ + 0.016);
  pushLine(lines, sigX - 0.05, dy + 0.36, sigZ + 0.016, sigX + 0.05, dy + 0.28, sigZ + 0.016);
  pushBox(glowTri, sigX + 0.14, dy + 0.41, sigZ + 0.012, 0.026, 0.026, 0.026);
  pushBox(glowTri, sigX + 0.20, dy + 0.41, sigZ + 0.012, 0.026, 0.026, 0.026);

  const depotWallsGeo = buildTriGeometry(wallsTri);
  const depotRoofsGeo = buildTriGeometry(roofsTri);
  const depotAccentGeo = buildTriGeometry(accentTri);
  const depotGlowGeo = buildTriGeometry(glowTri);
  const depotLinesGeo = buildLineGeometry(lines);

  return {
    depotWallsGeo,
    depotRoofsGeo,
    depotAccentGeo,
    depotGlowGeo,
    depotLinesGeo,
    dispose() {
      depotWallsGeo.dispose();
      depotRoofsGeo.dispose();
      depotAccentGeo.dispose();
      depotGlowGeo.dispose();
      depotLinesGeo.dispose();
    },
  };
}
