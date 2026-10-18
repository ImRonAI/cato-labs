import * as THREE from 'three';

/**
 * Arc-length lookup table over a curve: sample position + tangent at a
 * normalised distance u ∈ [0,1] without allocating (writes into out params).
 */
export interface PathLut {
  length: number;
  sample: (u: number, outPos: THREE.Vector3, outTan: THREE.Vector3) => void;
}

export function buildPathLut(curve: THREE.Curve<THREE.Vector3>, n = 800): PathLut {
  const pts = curve.getSpacedPoints(n);
  const pos = new Float32Array((n + 1) * 3);
  const tan = new Float32Array((n + 1) * 3);
  for (let i = 0; i <= n; i++) {
    pos[i * 3] = pts[i].x;
    pos[i * 3 + 1] = pts[i].y;
    pos[i * 3 + 2] = pts[i].z;
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    tan[i * 3] = dx / l;
    tan[i * 3 + 1] = dy / l;
    tan[i * 3 + 2] = dz / l;
  }
  const length = curve.getLength();
  return {
    length,
    sample(u, outPos, outTan) {
      const f = (u < 0 ? 0 : u > 1 ? 1 : u) * n;
      const i0 = Math.floor(f);
      const i1 = i0 < n ? i0 + 1 : n;
      const a = f - i0;
      const p0 = i0 * 3;
      const p1 = i1 * 3;
      outPos.set(
        pos[p0] + (pos[p1] - pos[p0]) * a,
        pos[p0 + 1] + (pos[p1 + 1] - pos[p0 + 1]) * a,
        pos[p0 + 2] + (pos[p1 + 2] - pos[p0 + 2]) * a,
      );
      outTan
        .set(
          tan[p0] + (tan[p1] - tan[p0]) * a,
          tan[p0 + 1] + (tan[p1 + 1] - tan[p0 + 1]) * a,
          tan[p0 + 2] + (tan[p1 + 2] - tan[p0 + 2]) * a,
        )
        .normalize();
    },
  };
}
