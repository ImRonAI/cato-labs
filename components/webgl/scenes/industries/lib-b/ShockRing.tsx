'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * ShockRing — a flat, additive shockwave disc. Two concentric rings expand
 * from the centre as `uTau` (seconds since impact, scroll-derived so it
 * rewinds) grows, with a hot core flash at the instant of impact.
 * Exposes its ShaderMaterial so the owner mutates uniforms in useFrame.
 */

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform float uTau;
  uniform float uSpeed;
  uniform float uWidth;
  uniform float uIntensity;
  uniform vec3 uColor;
  uniform vec3 uHot;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float d = length(p);
    if (uTau <= 0.0 || d > 1.0) discard;
    float r1 = uTau * uSpeed;
    float r2 = max(uTau - 0.16, 0.0) * uSpeed * 0.82;
    float fade = exp(-uTau * 2.1);
    float w = uWidth * (1.0 + uTau * 1.6);
    float ring1 = exp(-pow((d - r1) / w, 2.0));
    float ring2 = exp(-pow((d - r2) / (w * 1.4), 2.0)) * 0.45 * step(0.0001, r2);
    float core = exp(-d * d / 0.004) * exp(-uTau * 9.0) * 1.8;
    float edge = smoothstep(1.0, 0.82, d);
    float a = (ring1 + ring2) * fade * edge + core;
    vec3 col = mix(uColor, uHot, clamp(ring1 * fade + core, 0.0, 1.0));
    gl_FragColor = vec4(col * a * uIntensity, a * uIntensity);
  }
`;

export function useShockMaterial({
  speed = 1.3,
  width = 0.035,
  color = '#5f7dff',
  hot = '#ffffff',
}: { speed?: number; width?: number; color?: string; hot?: string } = {}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: {
          uTau: { value: 0 },
          uSpeed: { value: speed },
          uWidth: { value: width },
          uIntensity: { value: 1 },
          uColor: { value: new THREE.Color(color) },
          uHot: { value: new THREE.Color(hot) },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

export default function ShockRing({
  material,
  radius,
  position,
}: {
  material: THREE.ShaderMaterial;
  radius: number;
  position: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
