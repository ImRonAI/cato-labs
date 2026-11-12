import * as THREE from 'three';
import {
  buildLineGeometry,
  mergeBufferGeometries,
  transformedBox,
  transformedCylinder,
} from '../orange-county/geom';

export const VALLEY_Y = -0.68;
export const VINE_ROWS = 11;
export const STATIONS_PER_ROW = 16;
export const TOTAL_STATIONS = VINE_ROWS * STATIONS_PER_ROW;
export const CLUSTERS_PER_STATION = 2;
export const TOTAL_CLUSTERS = TOTAL_STATIONS * CLUSTERS_PER_STATION;

/**
 * Evaluates the Napa Valley topographic elevation at (x, z):
 * - Gently rolling alluvial valley floor in the center (|x| < 1.05)
 * - Rising stepped Mayacamas Range on the west (x < -1.05) and Vaca Range on the east (x > 1.05)
 * - Subtle northern Calistoga rise toward -Z
 */
export function valleyElevationAt(x: number, z: number): number {
  const upValleyRise = THREE.MathUtils.clamp((-z + 1.6) * 0.045, 0, 0.22);
  const floorRoll =
    Math.sin(x * 2.1 + z * 1.1) * 0.028 + Math.cos(z * 1.7 - x * 0.8) * 0.022;

  // Valley bowl walls (Mayacamas west, Vaca east)
  const absX = Math.abs(x + 0.08 * Math.sin(z * 0.9));
  const wallStart = 0.92;
  const wallT = Math.max(0, absX - wallStart);
  const rawHill = Math.pow(wallT, 1.48) * 0.56 * (1 + 0.18 * Math.sin(z * 1.5 + (x > 0 ? 1.2 : -0.7)));

  // Quantize subtly into architectural agricultural contour terraces on the benches
  const terraceStep = 0.095;
  const terracedHill =
    wallT > 0.02
      ? THREE.MathUtils.lerp(
          rawHill,
          Math.floor(rawHill / terraceStep) * terraceStep +
            terraceStep * smoothFract(rawHill / terraceStep),
          0.68,
        )
      : 0;

  return VALLEY_Y + upValleyRise + floorRoll + terracedHill;
}

function smoothFract(v: number): number {
  const f = v - Math.floor(v);
  return Math.pow(f, 0.45);
}

/**
 * Computes the 3D position and row tangent yaw of vineyard trellis station (rowIdx, stIdx).
 */
export function vineStationTransform(
  rowIdx: number,
  stIdx: number,
  outPos: THREE.Vector3,
): number {
  const rowNorm = (rowIdx / (VINE_ROWS - 1)) * 2 - 1; // -1 .. +1 across valley floor
  const s = stIdx / (STATIONS_PER_ROW - 1); // 0 (foreground +Z) .. 1 (horizon -Z)
  const z = THREE.MathUtils.lerp(1.58, -2.18, s);

  // Gentle organic S-curve following valley contours, converging slightly up-valley
  const curveShift = Math.sin(z * 0.85 + 0.4) * 0.14;
  const spread = THREE.MathUtils.lerp(1.06, 0.86, s);
  const x = rowNorm * spread + curveShift;
  const y = valleyElevationAt(x, z);

  // Tangent yaw along row
  const dz = -0.05;
  const zNext = z + dz;
  const xNext = rowNorm * THREE.MathUtils.lerp(1.06, 0.86, Math.min(1, s + 0.02)) + Math.sin(zNext * 0.85 + 0.4) * 0.14;
  const yaw = Math.atan2(xNext - x, zNext - z);

  outPos.set(x, y, z);
  return yaw;
}

/**
 * Builds the Napa Valley terrain mesh, architectural contour lines, trellis wires,
 * hilltop glass tasting estate, and instanced vine/post/cluster geometries.
 */
export function buildNapaValleyGeometries() {
  // 1. Sculpted topographic valley bowl mesh
  const segX = 76;
  const segZ = 68;
  const width = 5.8;
  const depth = 4.9;
  const terrainGeo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(0, 0, -0.32);

  const pos = terrainGeo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const pz = pos.getZ(i);
    // Feather outer perimeter down softly so silhouette sits like a museum plinth
    const rx = Math.abs(px) / (width * 0.5);
    const rz = Math.abs(pz + 0.32) / (depth * 0.5);
    const edge = 1 - THREE.MathUtils.smoothstep(Math.max(rx, rz), 0.84, 1.0);
    const py = THREE.MathUtils.lerp(VALLEY_Y - 0.10, valleyElevationAt(px, pz), edge);
    pos.setY(i, py);
  }
  terrainGeo.computeVertexNormals();

  // 2. Topographic contour rings across the Mayacamas & Vaca terraces + trellis wires
  const contourSegs: number[] = [];
  const wireSegs: number[] = [];

  // Sample longitudinal & cross topographic contour lines on the flanking hillsides
  const contourStripsX = [-2.35, -2.05, -1.75, -1.45, -1.18, 1.18, 1.45, 1.75, 2.05, 2.35];
  for (const cx of contourStripsX) {
    const steps = 44;
    for (let i = 0; i < steps; i++) {
      const z0 = THREE.MathUtils.lerp(1.75, -2.45, i / steps);
      const z1 = THREE.MathUtils.lerp(1.75, -2.45, (i + 1) / steps);
      const x0 = cx + Math.sin(z0 * 1.2) * 0.06;
      const x1 = cx + Math.sin(z1 * 1.2) * 0.06;
      contourSegs.push(
        x0,
        valleyElevationAt(x0, z0) + 0.012,
        z0,
        x1,
        valleyElevationAt(x1, z1) + 0.012,
        z1,
      );
    }
  }

  // Continuous taut fruiting & catch wires along all 11 vineyard rows
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  for (let r = 0; r < VINE_ROWS; r++) {
    for (let s = 0; s < STATIONS_PER_ROW - 1; s++) {
      vineStationTransform(r, s, pA);
      vineStationTransform(r, s + 1, pB);
      // Lower fruiting cordon wire + upper catch wire
      wireSegs.push(
        pA.x,
        pA.y + 0.085,
        pA.z,
        pB.x,
        pB.y + 0.085,
        pB.z,
        pA.x,
        pA.y + 0.135,
        pA.z,
        pB.x,
        pB.y + 0.135,
        pB.z,
      );
    }
  }

  // 3. Modern Architectural Napa Tasting Estate on the eastern Rutherford bench
  const estateX = 1.56;
  const estateZ = -1.08;
  const estateY = valleyElevationAt(estateX, estateZ);
  const estatePorcelainParts: THREE.BufferGeometry[] = [];
  const estateGlassParts: THREE.BufferGeometry[] = [];
  const estateEnamelParts: THREE.BufferGeometry[] = [];

  // Stone/porcelain cellar plinth & cantilevered roof plane
  estatePorcelainParts.push(
    transformedBox(0.56, 0.08, 0.38, estateX, estateY + 0.03, estateZ, 0, -0.26, 0),
    transformedBox(0.62, 0.026, 0.42, estateX - 0.02, estateY + 0.21, estateZ, 0, -0.26, 0),
  );
  // Refractive crystal tasting room gallery
  estateGlassParts.push(
    transformedBox(0.46, 0.13, 0.28, estateX, estateY + 0.135, estateZ, 0, -0.26, 0),
  );
  // Barrel cave portal & slender estate cypresses
  estateEnamelParts.push(
    transformedBox(0.12, 0.09, 0.06, estateX - 0.22, estateY + 0.05, estateZ + 0.08, 0, -0.26, 0),
  );
  const cypressOffsets: [number, number, number][] = [
    [-0.32, 0.18, 0.24],
    [-0.36, 0.04, 0.27],
    [0.28, -0.18, 0.26],
    [0.32, -0.02, 0.22],
  ];
  for (const [ox, oz, ch] of cypressOffsets) {
    const cx = estateX + ox;
    const cz = estateZ + oz;
    const cy = valleyElevationAt(cx, cz);
    estateEnamelParts.push(
      transformedCylinder(0.008, 0.032, ch, 7, cx, cy + ch * 0.5, cz),
    );
  }

  // 4. Unit geometries for InstancedMeshes:
  // (a) Trellis Post + T-crossarm
  const postGeo = mergeBufferGeometries([
    transformedCylinder(0.007, 0.009, 0.155, 6, 0, 0.077, 0),
    transformedBox(0.055, 0.008, 0.008, 0, 0.135, 0),
  ]);

  // (b) Sculpted Refractive Crystal Vine Canopy (faceted cordon + foliage prism along row Z)
  const canopyParts: THREE.BufferGeometry[] = [
    transformedBox(0.058, 0.048, 0.185, 0, 0.135, 0, 0.04, 0, 0.08),
    transformedBox(0.046, 0.042, 0.145, 0.012, 0.156, 0.01, -0.05, 0.08, -0.12),
  ];
  const canopyGeo = mergeBufferGeometries(canopyParts);

  // (c) Luminous Grape Cluster Node (tapered faceted botanical cluster)
  const clusterGeo = new THREE.OctahedronGeometry(0.022, 1);
  clusterGeo.scale(0.82, 1.28, 0.82);

  return {
    terrainGeo,
    contourLinesGeo: buildLineGeometry(contourSegs),
    trellisWiresGeo: buildLineGeometry(wireSegs),
    estatePorcelainGeo: mergeBufferGeometries(estatePorcelainParts),
    estateGlassGeo: mergeBufferGeometries(estateGlassParts),
    estateEnamelGeo: mergeBufferGeometries(estateEnamelParts),
    postGeo,
    canopyGeo,
    clusterGeo,
    estateCrestPos: [estateX, estateY + 0.30, estateZ] as [number, number, number],
  };
}
