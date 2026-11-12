import * as THREE from 'three';
import {
  buildLineGeometry,
  mergeBufferGeometries,
  transformedBox,
  transformedCylinder,
} from '../orange-county/geom';

export const LAKE_Y = -0.68;
export const LATTICE_COLS = 14;
export const LATTICE_ROWS = 12;
export const LATTICE_NODE_COUNT = LATTICE_COLS * LATTICE_ROWS; // 168 Silicon Slopes nodes

/**
 * Evaluates the steep glaciated Wasatch Front alpine profile:
 * - Mount Olympus twin horns on the north/left (x ~ -1.12)
 * - Twin Peaks / Hidden Peak central massif (x ~ +0.06, crest ~ LAKE_Y + 2.08 = +1.40)
 * - Lone Peak & Timpanogos cirque on the south/right (x ~ +1.18)
 */
export function wasatchHeight(lx: number, lz: number): number {
  const spineZ = -0.78 + 0.12 * Math.cos(lx * 1.4);
  const dz = lz - spineZ;
  // Asymmetric Wasatch fault scarp: sheer steep western face (+Z), gentler eastern backslope (-Z)
  const zSigma = dz > 0 ? 0.46 : 0.62;
  const cross = Math.exp(-Math.pow(dz / zSigma, 2) * 1.45);

  const olympus = 1.62 * Math.exp(-Math.pow((lx + 1.12) / 0.42, 2));
  const cottonwood = 1.18 * Math.exp(-Math.pow((lx + 0.56) / 0.28, 2));
  const twinPeaks = 2.08 * Math.exp(-Math.pow((lx - 0.06) / 0.48, 2));
  const lonePeak = 1.78 * Math.exp(-Math.pow((lx - 1.08) / 0.46, 2));
  const timpShoulder = 1.15 * Math.exp(-Math.pow((lx - 1.68) / 0.36, 2));

  const ridge = Math.max(olympus, cottonwood, twinPeaks, lonePeak, timpShoulder);

  // Sharp alpine arête creases and glacial couloirs
  const couloir =
    0.09 * Math.abs(Math.sin(lx * 6.5 + lz * 3.2)) -
    0.05 * Math.abs(Math.cos(lx * 11.0 - lz * 6.0));

  return Math.max(0, (ridge + couloir) * cross);
}

/**
 * Computes the Silicon Slopes lattice node position at (col, row), curving
 * along the Wasatch Front / Point-of-the-Mountain corridor from Downtown SLC
 * south through Draper, Lehi, and Provo.
 */
export function latticeNodeCoord(col: number, row: number, out: THREE.Vector3) {
  const u = col / (LATTICE_COLS - 1); // 0 (north/west) .. 1 (south/east Silicon Slopes)
  const v = row / (LATTICE_ROWS - 1); // 0 (near mountain bench) .. 1 (valley floor)

  // Corridor curves around Point of the Mountain
  const benchZ = -0.18 + 0.14 * Math.sin(u * Math.PI * 1.4);
  const z = THREE.MathUtils.lerp(benchZ, 1.58, v);
  const x = THREE.MathUtils.lerp(-0.55, 1.95, u) - 0.16 * v * Math.sin(u * Math.PI);

  // Slight Point-of-the-Mountain bench elevation near u=0.58, v < 0.35
  const potmLift =
    0.09 * Math.exp(-Math.pow((u - 0.58) / 0.20, 2)) * Math.exp(-Math.pow(v / 0.35, 2));

  out.set(x, LAKE_Y + 0.016 + potmLift, z);
}

export function buildWasatchAndSlopesGeometries() {
  // 1. Steep Faceted Wasatch Alpine Peaks (non-indexed for crisp crystalline flat-shaded facets)
  const segX = 40;
  const segZ = 22;
  const basePlane = new THREE.PlaneGeometry(4.4, 1.65, segX, segZ);
  basePlane.rotateX(-Math.PI / 2);
  basePlane.translate(0.05, LAKE_Y, -0.78);

  const pos = basePlane.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const pz = pos.getZ(i);
    const rx = Math.abs(px - 0.05) / 2.2;
    const rz = Math.abs(pz + 0.78) / 0.825;
    const skirt = 1 - THREE.MathUtils.smoothstep(Math.max(rx, rz), 0.82, 1.0);
    pos.setY(i, LAKE_Y + wasatchHeight(px, pz) * skirt);
  }

  const wasatchCrystalGeo = basePlane.toNonIndexed();
  wasatchCrystalGeo.computeVertexNormals();
  basePlane.dispose();

  // Slightly inset inner core shell for the custom Alpenglow Facet Shader
  const wasatchAlpenglowGeo = wasatchCrystalGeo.clone();
  wasatchAlpenglowGeo.scale(0.985, 0.985, 0.985);

  const wasatchEdgesGeo = new THREE.EdgesGeometry(wasatchCrystalGeo, 15);

  // 2. Architectural Summit Spire perched atop Twin Peaks / Hidden Peak
  const summitX = 0.06;
  const summitZ = -0.78;
  const summitBaseY = LAKE_Y + wasatchHeight(summitX, summitZ) - 0.04;

  const spireGlassParts: THREE.BufferGeometry[] = [];
  const spireEnamelParts: THREE.BufferGeometry[] = [];
  const downtownPorcelainParts: THREE.BufferGeometry[] = [];

  // Stepped octagonal mountain station plinth + dispersive tall crystal spire + beacon rings
  spireEnamelParts.push(
    transformedCylinder(0.09, 0.12, 0.06, 6, summitX, summitBaseY + 0.03, summitZ),
    transformedCylinder(0.055, 0.07, 0.04, 6, summitX, summitBaseY + 0.08, summitZ),
    transformedCylinder(0.008, 0.012, 0.14, 6, summitX, summitBaseY + 0.44, summitZ),
  );
  spireGlassParts.push(
    transformedCylinder(0.014, 0.052, 0.32, 6, summitX, summitBaseY + 0.25, summitZ),
  );

  // Downtown Salt Lake City & Capitol Rotunda + Temple Spire cluster at the northern bench
  const slcTowers: [number, number, number, number, number][] = [
    [-0.78, 0.14, 0.11, 0.34, 0.11],
    [-0.62, 0.18, 0.10, 0.28, 0.10],
    [-0.92, 0.22, 0.10, 0.24, 0.10],
    [-0.74, 0.28, 0.09, 0.20, 0.09],
  ];
  for (const [tx, tz, tw, th, td] of slcTowers) {
    downtownPorcelainParts.push(transformedBox(tw, th, td, tx, LAKE_Y + th * 0.5, tz));
  }
  // Iconic six-spire Salt Lake Temple architectural prism silhouette + Capitol dome on bench
  downtownPorcelainParts.push(
    transformedBox(0.13, 0.14, 0.09, -0.46, LAKE_Y + 0.07, 0.12),
    transformedCylinder(0.004, 0.018, 0.11, 4, -0.51, LAKE_Y + 0.19, 0.12),
    transformedCylinder(0.004, 0.020, 0.13, 4, -0.46, LAKE_Y + 0.20, 0.12),
    transformedCylinder(0.004, 0.018, 0.11, 4, -0.41, LAKE_Y + 0.19, 0.12),
    // Utah State Capitol on northern bench
    transformedBox(0.18, 0.07, 0.10, -0.68, LAKE_Y + 0.12, -0.10),
    transformedCylinder(0.036, 0.042, 0.09, 12, -0.68, LAKE_Y + 0.19, -0.10),
  );

  // Tech campus glass prisms along Point of the Mountain (Lehi / Draper)
  spireGlassParts.push(
    transformedBox(0.20, 0.09, 0.12, 0.88, LAKE_Y + 0.11, 0.26, 0, -0.24, 0),
    transformedBox(0.18, 0.08, 0.11, 1.18, LAKE_Y + 0.08, 0.42, 0, -0.18, 0),
  );

  // 3. Silicon Slopes Triangulated Optical-Fiber Light Lattice
  const latticeSegs: number[] = [];
  const p00 = new THREE.Vector3();
  const p10 = new THREE.Vector3();
  const p01 = new THREE.Vector3();
  const p11 = new THREE.Vector3();

  for (let r = 0; r < LATTICE_ROWS; r++) {
    for (let c = 0; c < LATTICE_COLS; c++) {
      latticeNodeCoord(c, r, p00);
      if (c + 1 < LATTICE_COLS) {
        latticeNodeCoord(c + 1, r, p10);
        latticeSegs.push(p00.x, p00.y, p00.z, p10.x, p10.y, p10.z);
      }
      if (r + 1 < LATTICE_ROWS) {
        latticeNodeCoord(c, r + 1, p01);
        latticeSegs.push(p00.x, p00.y, p00.z, p01.x, p01.y, p01.z);
      }
      // Diagonal geodesic cross-links on alternating cells for tech-lattice feel
      if (c + 1 < LATTICE_COLS && r + 1 < LATTICE_ROWS && (c + r) % 2 === 0) {
        latticeNodeCoord(c + 1, r + 1, p11);
        latticeSegs.push(p00.x, p00.y, p00.z, p11.x, p11.y, p11.z);
      }
    }
  }

  // Antelope Island crystalline low ridge rising inside the Great Salt Lake mirror on the west
  const islandGeo = new THREE.ConeGeometry(0.42, 0.19, 6);
  islandGeo.scale(0.85, 1, 1.65);
  islandGeo.translate(-1.58, LAKE_Y + 0.08, 0.62);
  downtownPorcelainParts.push(islandGeo);

  // Unit geometry for the 168 Silicon Slopes light lattice nodes
  const nodeGeo = new THREE.OctahedronGeometry(0.022, 0);
  nodeGeo.scale(1, 1.35, 1);

  return {
    wasatchCrystalGeo,
    wasatchAlpenglowGeo,
    wasatchEdgesGeo,
    spireGlassGeo: mergeBufferGeometries(spireGlassParts),
    spireEnamelGeo: mergeBufferGeometries(spireEnamelParts),
    downtownPorcelainGeo: mergeBufferGeometries(downtownPorcelainParts),
    slopesLatticeLinesGeo: buildLineGeometry(latticeSegs),
    nodeGeo,
    summitSpirePos: [summitX, summitBaseY + 0.48, summitZ] as [number, number, number],
  };
}
