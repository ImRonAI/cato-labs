'use client';

import * as THREE from 'three';

/**
 * ribbonGeometry — a flat strip swept along a curve.
 * uv.x = arc length in world units (so shaders can tile at a fixed pitch),
 * uv.y = 0..1 across the width. The strip's face points along `facing`
 * (its width runs along tangent × facing), so a strip drawn in the xy plane
 * with facing = +z faces the camera.
 */
export function ribbonGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  segments: number,
  width: number,
  facing: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
): { geometry: THREE.BufferGeometry; length: number } {
  const n = segments + 1;
  const pos = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  const nor = new Float32Array(n * 2 * 3);
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const normal = new THREE.Vector3();
  let len = 0;
  for (let i = 0; i < n; i++) {
    const s = i / segments;
    curve.getPointAt(s, p);
    curve.getTangentAt(s, tan);
    if (i > 0) len += p.distanceTo(prev);
    prev.copy(p);
    side.crossVectors(tan, facing).normalize();
    normal.crossVectors(side, tan).normalize();
    for (let k = 0; k < 2; k++) {
      const o = (i * 2 + k) * 3;
      const sgn = k === 0 ? -0.5 : 0.5;
      pos[o] = p.x + side.x * width * sgn;
      pos[o + 1] = p.y + side.y * width * sgn;
      pos[o + 2] = p.z + side.z * width * sgn;
      nor[o] = normal.x;
      nor[o + 1] = normal.y;
      nor[o + 2] = normal.z;
      uv[(i * 2 + k) * 2] = len;
      uv[(i * 2 + k) * 2 + 1] = k;
    }
    if (i < segments) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(idx);
  return { geometry, length: len };
}
