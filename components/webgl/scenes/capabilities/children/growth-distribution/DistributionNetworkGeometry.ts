import * as THREE from 'three';
import type { ChannelId } from '@/lib/content/overhaul/cap-growth';

export interface ChannelNodeLayout {
  id: ChannelId;
  index: number;
  position: [number, number, number];
  controlMid: [number, number, number];
}

/**
 * Spatial coordinates of the 6 channel source towers in the miniature's local frame.
 * Compact left-hand radial arc feeding into the central Qualification Router at [-0.08, 0.06, 0].
 */
export const CHANNEL_NODES: readonly ChannelNodeLayout[] = [
  {
    id: 'seo',
    index: 0,
    position: [-1.46, 0.84, -0.44],
    controlMid: [-0.82, 0.60, -0.26],
  },
  {
    id: 'paid',
    index: 1,
    position: [-1.60, 0.28, 0.14],
    controlMid: [-0.88, 0.22, 0.10],
  },
  {
    id: 'social',
    index: 2,
    position: [-1.36, -0.32, 0.56],
    controlMid: [-0.76, -0.15, 0.34],
  },
  {
    id: 'partners',
    index: 3,
    position: [-0.90, 0.68, 0.40],
    controlMid: [-0.50, 0.42, 0.22],
  },
  {
    id: 'crm',
    index: 4,
    position: [-0.94, -0.58, 0.10],
    controlMid: [-0.52, -0.28, 0.06],
  },
  {
    id: 'local',
    index: 5,
    position: [-1.06, -0.10, -0.56],
    controlMid: [-0.60, -0.02, -0.32],
  },
] as const;

export const ROUTER_POS: [number, number, number] = [-0.08, 0.06, 0.0];

/**
 * 24 cohort column base positions arranged along a sweeping architectural curve
 * on the right half of the manifold (x: 0.36 -> 2.20).
 */
export interface CohortPillarBase {
  month: number;
  x: number;
  y: number;
  z: number;
  angle: number;
}

export const COHORT_PILLAR_BASES: readonly CohortPillarBase[] = Array.from(
  { length: 24 },
  (_, i) => {
    const u = i / 23; // 0..1
    const x = 0.36 + u * 1.84;
    // Subtle S-curve in Z and stepped architectural datum in Y
    const z = Math.sin(u * Math.PI * 1.15 - 0.35) * 0.38 - 0.06;
    const y = -0.68 + u * 0.24;
    const angle = Math.cos(u * Math.PI * 1.15 - 0.35) * 0.16;
    return { month: i + 1, x, y, z, angle };
  },
);

export const SAMPLES_PER_PATH = 64;

export interface DistributionNetworkBuild {
  /** Merged tube geometry for all 6 intake conduits + 3 outfeed manifolds */
  conduitTubeGeo: THREE.BufferGeometry;
  /** Merged outer halo tube geometry */
  conduitHaloGeo: THREE.BufferGeometry;
  /** Merged lineSegments for the architectural datum grid, rings, and guide rails */
  blueprintLinesGeo: THREE.BufferGeometry;
  /** Pre-sampled [6 channels][SAMPLES_PER_PATH * 3] positions from channel -> router -> monolith */
  particlePathTable: Float32Array;
  dispose: () => void;
}

function mergeBufferGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of geos) {
    const pos = g.getAttribute('position');
    totalVerts += pos.count;
    const idx = g.getIndex();
    totalIndices += idx ? idx.count : pos.count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  for (const g of geos) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const norm = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
    positions.set(pos.array as Float32Array, vOffset * 3);
    if (norm) {
      normals.set(norm.array as Float32Array, vOffset * 3);
    }
    const idx = g.getIndex();
    if (idx) {
      const arr = idx.array;
      for (let k = 0; k < idx.count; k++) {
        indices[iOffset + k] = arr[k] + vOffset;
      }
      iOffset += idx.count;
    } else {
      for (let k = 0; k < pos.count; k++) {
        indices[iOffset + k] = vOffset + k;
      }
      iOffset += pos.count;
    }
    vOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

export function buildDistributionNetworkGeometry(): DistributionNetworkBuild {
  const routerVec = new THREE.Vector3(...ROUTER_POS);
  const coreGeos: THREE.BufferGeometry[] = [];
  const haloGeos: THREE.BufferGeometry[] = [];
  const lineVerts: number[] = [];

  // Pre-sampled particle paths: 6 full paths (channel node -> router -> cohort monolith arc)
  const particlePathTable = new Float32Array(
    CHANNEL_NODES.length * SAMPLES_PER_PATH * 3,
  );

  for (let c = 0; c < CHANNEL_NODES.length; c++) {
    const node = CHANNEL_NODES[c];
    const start = new THREE.Vector3(...node.position);
    const mid = new THREE.Vector3(...node.controlMid);

    // Intake curve: Channel Tower -> Central Router
    const intakeCurve = new THREE.CatmullRomCurve3(
      [start, mid, routerVec],
      false,
      'centripetal',
      0.5,
    );

    const tCore = new THREE.TubeGeometry(intakeCurve, 36, 0.015, 7, false);
    const tHalo = new THREE.TubeGeometry(intakeCurve, 28, 0.04, 7, false);
    coreGeos.push(tCore);
    haloGeos.push(tHalo);

    // Outfeed destination along the 24-month monolith tailored to this channel
    const targetPillarIdx = Math.min(23, 3 + c * 4);
    const pillar = COHORT_PILLAR_BASES[targetPillarIdx];
    const outMid = new THREE.Vector3(
      0.24,
      -0.12 + (c - 2.5) * 0.05,
      pillar.z * 0.5,
    );
    const outEnd = new THREE.Vector3(
      pillar.x,
      pillar.y + 0.32 + c * 0.13,
      pillar.z,
    );
    const fullParticleCurve = new THREE.CatmullRomCurve3(
      [start, mid, routerVec, outMid, outEnd],
      false,
      'centripetal',
      0.5,
    );

    for (let s = 0; s < SAMPLES_PER_PATH; s++) {
      const pt = fullParticleCurve.getPointAt(s / (SAMPLES_PER_PATH - 1));
      const baseIdx = (c * SAMPLES_PER_PATH + s) * 3;
      particlePathTable[baseIdx] = pt.x;
      particlePathTable[baseIdx + 1] = pt.y;
      particlePathTable[baseIdx + 2] = pt.z;
    }

    // Fine schematic rail line slightly offset below intake curve
    const railPts = intakeCurve.getPoints(28);
    for (let i = 0; i < railPts.length - 1; i++) {
      lineVerts.push(
        railPts[i].x,
        railPts[i].y - 0.036,
        railPts[i].z,
        railPts[i + 1].x,
        railPts[i + 1].y - 0.036,
        railPts[i + 1].z,
      );
    }

    // Vertical drop stem from each channel node to the datum plane (y = -0.82)
    lineVerts.push(
      node.position[0],
      node.position[1],
      node.position[2],
      node.position[0],
      -0.82,
      node.position[2],
    );
  }

  // 3 Outfeed manifold tubes from Router to the Cohort Monolith spine
  const spineTargets = [7, 15, 23];
  for (const idx of spineTargets) {
    const p = COHORT_PILLAR_BASES[idx];
    const curve = new THREE.CatmullRomCurve3(
      [
        routerVec,
        new THREE.Vector3(0.24, -0.20, p.z * 0.45),
        new THREE.Vector3(p.x * 0.65, p.y + 0.08, p.z * 0.85),
        new THREE.Vector3(p.x, p.y + 0.05, p.z),
      ],
      false,
      'centripetal',
      0.5,
    );
    coreGeos.push(new THREE.TubeGeometry(curve, 36, 0.014, 7, false));
    haloGeos.push(new THREE.TubeGeometry(curve, 24, 0.036, 7, false));
  }

  // Architectural Datum Grid & Telemetry Rings at y = -0.82
  const datumY = -0.82;
  const ringRadii = [0.46, 0.96, 1.48, 1.98];
  for (const r of ringRadii) {
    const segs = 56;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      lineVerts.push(
        ROUTER_POS[0] + Math.cos(a0) * r,
        datumY,
        ROUTER_POS[2] + Math.sin(a0) * r * 0.58,
        ROUTER_POS[0] + Math.cos(a1) * r,
        datumY,
        ROUTER_POS[2] + Math.sin(a1) * r * 0.58,
      );
    }
  }

  // Precision baseline axis & month ticks under the 24-month Cohort Monolith
  for (let i = 0; i < COHORT_PILLAR_BASES.length; i++) {
    const b = COHORT_PILLAR_BASES[i];
    if (i < COHORT_PILLAR_BASES.length - 1) {
      const next = COHORT_PILLAR_BASES[i + 1];
      lineVerts.push(b.x, b.y, b.z, next.x, next.y, next.z);
      lineVerts.push(b.x, datumY, b.z, next.x, datumY, next.z);
    }
    lineVerts.push(b.x, datumY, b.z, b.x, b.y, b.z);
    if ((i + 1) % 3 === 0) {
      lineVerts.push(b.x, datumY, b.z - 0.12, b.x, datumY, b.z + 0.12);
    }
  }

  const conduitTubeGeo = mergeBufferGeometries(coreGeos);
  const conduitHaloGeo = mergeBufferGeometries(haloGeos);
  for (const g of coreGeos) g.dispose();
  for (const g of haloGeos) g.dispose();

  const blueprintLinesGeo = new THREE.BufferGeometry();
  blueprintLinesGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(lineVerts), 3),
  );

  return {
    conduitTubeGeo,
    conduitHaloGeo,
    blueprintLinesGeo,
    particlePathTable,
    dispose: () => {
      conduitTubeGeo.dispose();
      conduitHaloGeo.dispose();
      blueprintLinesGeo.dispose();
    },
  };
}
