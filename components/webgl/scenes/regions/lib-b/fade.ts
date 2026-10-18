'use client';

import * as THREE from 'three';

/**
 * fadeTree — multiply every material opacity under `root` by `k`, without
 * fighting code that also animates those opacities.
 *
 * Each material remembers the value it last received from us (`__w`). If the
 * live value differs next frame, someone else wrote it this frame, so it
 * becomes the new base. Otherwise the stored base is reused. That way the
 * skyline's own per-frame choreography keeps working underneath the dim.
 * Call it at the END of the scene's useFrame (after child writers ran).
 * Zero allocation: the traverse callback is module scoped.
 */

type Fadeable = (THREE.Material & { opacity: number }) | THREE.ShaderMaterial;

let _k = 1;

function fadeMaterial(m: Fadeable) {
  const sm = m as THREE.ShaderMaterial;
  const u = sm.uniforms?.uOpacity as { value: number } | undefined;
  const cur = u ? u.value : m.opacity;
  const ud = m.userData as { __w?: number; __b?: number };
  if (ud.__w === undefined || cur !== ud.__w) ud.__b = cur;
  const v = (ud.__b ?? cur) * _k;
  if (u) u.value = v;
  else m.opacity = v;
  ud.__w = v;
}

function visit(o: THREE.Object3D) {
  const mat = (o as THREE.Mesh).material as Fadeable | Fadeable[] | undefined;
  if (!mat) return;
  if (Array.isArray(mat)) {
    for (let i = 0; i < mat.length; i++) fadeMaterial(mat[i]);
  } else {
    fadeMaterial(mat);
  }
}

export function fadeTree(root: THREE.Object3D | null, k: number) {
  if (!root) return;
  _k = k;
  root.traverse(visit);
}
