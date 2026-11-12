import * as THREE from 'three';
import {
  buildLineGeometry,
  buildTriGeometry,
  createLineBuilder,
  createTriBuilder,
  pushExtrudedPolygon,
  pushLine,
  pushPolyline,
  pushQuad,
  pushTri,
} from './geomUtils';

/**
 * The San Bernardino Mountains, the Cajon Pass saddle, and the natural
 * Arrowhead landmark on the south-facing slope of Arrowhead Peak.
 */

export interface MountainArrowheadData {
  mountainGeo: THREE.BufferGeometry;
  contourLinesGeo: THREE.BufferGeometry;
  arrowheadCrystalGeo: THREE.BufferGeometry;
  arrowheadCoreGeo: THREE.BufferGeometry;
  arrowheadRimLinesGeo: THREE.BufferGeometry;
  dispose: () => void;
}

/** Elevation function for the continuous San Bernardino Mountains + Cajon Pass saddle. */
function mountainHeight(x: number, z: number): number {
  const baseFloor = -0.68;
  const zCenter = -1.76 - 0.10 * Math.sin(x * 0.65);
  const dz = z - zCenter;
  const ridgeEnvelope = Math.exp(-(dz * dz) / (dz > 0 ? 0.42 : 0.30));

  // Continuous base mountain ridge across the northern horizon
  const continuousRidge = 0.82 * Math.exp(-(x * x) / 4.8);
  // Main Arrowhead Peak on the right (x ~ 0.85)
  const arrowheadPeak = 1.48 * Math.exp(-((x - 0.86) * (x - 0.86)) / 0.82);
  // Secondary San Bernardino eastern shoulder (x ~ 1.85)
  const eastShoulder = 0.72 * Math.exp(-((x - 1.85) * (x - 1.85)) / 0.52);
  // Western Cajon / San Gabriel peak on the left (x ~ -1.68)
  const westPeak = 0.86 * Math.exp(-((x + 1.65) * (x + 1.65)) / 0.58);
  // Cajon Pass saddle notch around x ~ -0.68 (dips to ~0.48 above baseFloor so the train enters the pass)
  const cajonPassDip = 1 - 0.42 * Math.exp(-((x + 0.68) * (x + 0.68)) / 0.28);

  // Subtle architectural facetting
  const facet =
    0.045 * Math.cos(x * 3.1 + z * 2.0) +
    0.025 * Math.sin(x * 5.4 - z * 3.2);

  const rawH =
    ((continuousRidge + arrowheadPeak + eastShoulder + westPeak) * cajonPassDip + facet) *
    ridgeEnvelope;
  return baseFloor + Math.max(0, rawH);
}

export function buildMountainAndArrowhead(): MountainArrowheadData {
  const mountainTri = createTriBuilder();
  const contourLines = createLineBuilder();

  const nx = 48;
  const nz = 22;
  const xMin = -2.55;
  const xMax = 2.55;
  const zMin = -2.48;
  const zMax = -0.78;
  const baseFloor = -0.68;

  const grid: [number, number, number][][] = [];
  for (let iz = 0; iz <= nz; iz++) {
    const row: [number, number, number][] = [];
    const v = iz / nz;
    const z = zMin + v * (zMax - zMin);
    const vSin = Math.sin(v * Math.PI);
    const edgeZ = Math.min(1, vSin * vSin * 2.6);
    for (let ix = 0; ix <= nx; ix++) {
      const u = ix / nx;
      const x = xMin + u * (xMax - xMin);
      const uSin = Math.sin(u * Math.PI);
      const edgeX = Math.min(1, uSin * uSin * 3.0);
      const h = baseFloor + (mountainHeight(x, z) - baseFloor) * edgeZ * edgeX;
      row.push([x, h, z]);
    }
    grid.push(row);
  }

  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const p00 = grid[iz][ix];
      const p10 = grid[iz][ix + 1];
      const p11 = grid[iz + 1][ix + 1];
      const p01 = grid[iz + 1][ix];
      if (
        p00[1] > baseFloor + 0.012 ||
        p10[1] > baseFloor + 0.012 ||
        p11[1] > baseFloor + 0.012 ||
        p01[1] > baseFloor + 0.012
      ) {
        pushQuad(mountainTri, ...p00, ...p01, ...p11, ...p10);
      }
    }
  }

  // Architectural contour lines across the mountain face + ridge spine
  for (let iz = 2; iz <= nz - 2; iz += 2) {
    const pts: [number, number, number][] = [];
    for (let ix = 0; ix <= nx; ix++) {
      const p = grid[iz][ix];
      if (p[1] > baseFloor + 0.035) {
        pts.push([p[0], p[1] + 0.006, p[2] + 0.005]);
      }
    }
    if (pts.length > 2) pushPolyline(contourLines, pts, false);
  }

  // Vertical ridge ribs on key spurs
  for (let ix = 4; ix <= nx - 4; ix += 4) {
    const pts: [number, number, number][] = [];
    for (let iz = 1; iz <= nz - 1; iz++) {
      const p = grid[iz][ix];
      if (p[1] > baseFloor + 0.04) {
        pts.push([p[0], p[1] + 0.006, p[2] + 0.005]);
      }
    }
    if (pts.length > 2) pushPolyline(contourLines, pts, false);
  }

  // ---------------------------------------------------------------------------
  // THE ARROWHEAD LANDMARK on the south-facing slope of Arrowhead Peak
  // Authentic proportions: 1,375 ft tall × 449 ft wide downward-pointing
  // arrowhead with upper stem/tang, broad angled shoulders, and long tapered
  // quartz/feldspar blade pointing down toward San Bernardino Valley.
  // ---------------------------------------------------------------------------
  const arrowOutline2D: [number, number][] = [
    [0.0, -0.54],     // Sharp bottom tip pointing down toward the city
    [0.14, -0.22],    // Lower right blade edge
    [0.25, 0.04],     // Mid right blade edge
    [0.34, 0.25],     // Right shoulder barb
    [0.24, 0.31],     // Right shoulder notch
    [0.10, 0.35],     // Right neck base
    [0.085, 0.50],    // Top right tang
    [0.0, 0.53],      // Top crest of tang
    [-0.085, 0.50],   // Top left tang
    [-0.10, 0.35],    // Left neck base
    [-0.24, 0.31],    // Left shoulder notch
    [-0.34, 0.25],    // Left shoulder barb
    [-0.25, 0.04],    // Mid left blade edge
    [-0.14, -0.22],   // Lower left blade edge
  ];

  const arrowInner2D: [number, number][] = arrowOutline2D.map(([x, y]) => [x * 0.76, y * 0.84 + 0.01]);

  const cx = 0.86;
  const cy = 0.76;
  const cz = -1.28;
  const tiltX = -0.42;
  const cosX = Math.cos(tiltX);
  const sinX = Math.sin(tiltX);

  const placeOnSlope = (lx: number, ly: number, lz: number): [number, number, number] => {
    const ry = ly * cosX - lz * sinX;
    const rz = ly * sinX + lz * cosX;
    return [cx + lx, cy + ry, cz + rz];
  };

  const arrowCrystalTri = createTriBuilder();
  const arrowCoreTri = createTriBuilder();
  const arrowRimLines = createLineBuilder();

  pushExtrudedPolygon(arrowCrystalTri, arrowOutline2D, -0.04, 0.065, 0.018, 0.018, placeOnSlope);

  // Raised central geological facet on the Arrowhead face for dramatic light catch
  const ridgeTop = placeOnSlope(0, 0.44, 0.095);
  const ridgeMid = placeOnSlope(0, 0.12, 0.115);
  const ridgeBot = placeOnSlope(0, -0.46, 0.085);
  const shR = placeOnSlope(0.27, 0.23, 0.085);
  const shL = placeOnSlope(-0.27, 0.23, 0.085);
  const midR = placeOnSlope(0.18, -0.05, 0.085);
  const midL = placeOnSlope(-0.18, -0.05, 0.085);

  pushTri(arrowCoreTri, ...ridgeTop, ...shL, ...ridgeMid);
  pushTri(arrowCoreTri, ...ridgeTop, ...ridgeMid, ...shR);
  pushTri(arrowCoreTri, ...ridgeMid, ...shL, ...midL);
  pushTri(arrowCoreTri, ...ridgeMid, ...midR, ...shR);
  pushTri(arrowCoreTri, ...ridgeMid, ...midL, ...ridgeBot);
  pushTri(arrowCoreTri, ...ridgeMid, ...ridgeBot, ...midR);

  // Crisp glowing perimeter & inner chevron lines on the Arrowhead
  const outerPts3D = arrowOutline2D.map(([x, y]) => placeOnSlope(x * 1.03, y * 1.02, 0.088));
  const innerPts3D = arrowInner2D.map(([x, y]) => placeOnSlope(x, y, 0.098));
  pushPolyline(arrowRimLines, outerPts3D, true);
  pushPolyline(arrowRimLines, innerPts3D, true);

  // Spine & geological chevron ribs inside the Arrowhead
  pushLine(arrowRimLines, ...placeOnSlope(0, 0.49, 0.102), ...placeOnSlope(0, -0.50, 0.095));
  pushLine(arrowRimLines, ...placeOnSlope(-0.31, 0.24, 0.095), ...placeOnSlope(0, 0.08, 0.118));
  pushLine(arrowRimLines, ...placeOnSlope(0.31, 0.24, 0.095), ...placeOnSlope(0, 0.08, 0.118));
  pushLine(arrowRimLines, ...placeOnSlope(-0.21, -0.04, 0.095), ...placeOnSlope(0, -0.18, 0.108));
  pushLine(arrowRimLines, ...placeOnSlope(0.21, -0.04, 0.095), ...placeOnSlope(0, -0.18, 0.108));

  const mountainGeo = buildTriGeometry(mountainTri);
  const contourLinesGeo = buildLineGeometry(contourLines);
  const arrowheadCrystalGeo = buildTriGeometry(arrowCrystalTri);
  const arrowheadCoreGeo = buildTriGeometry(arrowCoreTri);
  const arrowheadRimLinesGeo = buildLineGeometry(arrowRimLines);

  return {
    mountainGeo,
    contourLinesGeo,
    arrowheadCrystalGeo,
    arrowheadCoreGeo,
    arrowheadRimLinesGeo,
    dispose() {
      mountainGeo.dispose();
      contourLinesGeo.dispose();
      arrowheadCrystalGeo.dispose();
      arrowheadCoreGeo.dispose();
      arrowheadRimLinesGeo.dispose();
    },
  };
}
