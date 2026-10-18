'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FLOOR_Y } from './wreck';

export const MAX_SHADOWS = 10;
export const MAX_RINGS = 12;

const vertexShader = /* glsl */ `
  varying vec2 vP;
  void main() {
    /* plane lies in group-local xz: local (x, y) → (x, -z) */
    vP = vec2(position.x, -position.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uPaper;
  uniform vec3 uInk;
  uniform vec3 uBlue;
  uniform vec3 uIce;
  uniform float uTime;
  uniform float uGrid;
  uniform vec4 uShadow[${MAX_SHADOWS}];   // x, z, radius, height above floor
  uniform vec4 uRing[${MAX_RINGS}];       // x, z, age (s), strength
  varying vec2 vP;

  void main() {
    float r = length(vP);
    float fade = smoothstep(9.5, 1.6, r);

    /* hairline architectural grid — gives the glass something to bend */
    vec2 g = vP / 0.6;
    vec2 gd = abs(fract(g - 0.5) - 0.5) / fwidth(g);
    float line = 1.0 - min(min(gd.x, gd.y), 1.0);
    vec3 col = uPaper;
    col = mix(col, uIce, smoothstep(5.0, 0.0, r) * 0.32);
    col = mix(col, uInk, line * fade * uGrid);

    /* soft contact shadows that follow every body */
    float shade = 0.0;
    for (int i = 0; i < ${MAX_SHADOWS}; i++) {
      vec4 s = uShadow[i];
      if (s.z <= 0.0) continue;
      float h = max(s.w, 0.0);
      float blur = 0.22 + h * 0.42;
      float d = length(vP - s.xy);
      float k = smoothstep(s.z + blur, s.z - blur * 0.6, d);
      shade = max(shade, k * 0.085 / (1.0 + h * 1.6));
    }
    col = mix(col, uInk, shade);

    /* impact rings — hairlines that run out across the floor */
    float ring = 0.0;
    for (int i = 0; i < ${MAX_RINGS}; i++) {
      vec4 e = uRing[i];
      if (e.z <= 0.0 || e.z > 1.8) continue;
      float rad = 0.18 + e.z * 1.7;
      float w = 0.012 + e.z * 0.022;
      float d = abs(length(vP - e.xy) - rad);
      ring += smoothstep(w, 0.0, d) * e.w * pow(1.0 - e.z / 1.8, 1.6);
    }
    col = mix(col, uBlue, clamp(ring, 0.0, 1.0) * 0.5 * fade);

    /* dissolve exactly into the paper so the floor has no edge */
    col = mix(uPaper, col, smoothstep(13.0, 6.0, r));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface StageUniforms {
  shadows: THREE.Vector4[];
  rings: THREE.Vector4[];
}

/**
 * Stage — the floor the monolith stands on. Opaque so it lands in the
 * transmission buffer: the glass refracts its grid, shadows and ripples.
 */
export default function Stage({ uniforms }: { uniforms: StageUniforms }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        toneMapped: false,
        fog: false,
        uniforms: {
          uPaper: { value: new THREE.Color('#fafbfe') },
          uInk: { value: new THREE.Color('#0a0c12') },
          uBlue: { value: new THREE.Color('#2e4bff') },
          uIce: { value: new THREE.Color('#e9eeff') },
          uTime: { value: 0 },
          uGrid: { value: 0.07 },
          uShadow: { value: uniforms.shadows },
          uRing: { value: uniforms.rings },
        },
      }),
    [uniforms],
  );
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, 0]} material={material} renderOrder={-2}>
      <planeGeometry args={[30, 30, 1, 1]} />
    </mesh>
  );
}
