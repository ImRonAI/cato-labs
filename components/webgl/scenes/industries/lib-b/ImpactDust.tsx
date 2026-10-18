'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * ImpactDust — a burst of fine blue dust thrown off an impact point.
 * Fully analytic in the vertex shader: every mote's position is a pure
 * function of `uTau` (seconds since impact, scroll-derived), so the burst
 * plays forward and rewinds exactly. Ballistic with drag, settles to rest.
 */

const vert = /* glsl */ `
  uniform float uTau;
  uniform float uPixelRatio;
  uniform float uSize;
  attribute vec3 aVel;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    float t = max(uTau, 0.0);
    float drag = 2.6;
    float k = (1.0 - exp(-drag * t)) / drag;
    vec3 p = position + aVel * k;
    p.y += -0.9 * (t - k) * 0.35;           /* gentle gravity after the drag */
    p.y = max(p.y, position.y - 0.02);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float life = step(0.0001, uTau) * exp(-t * (1.1 + aSeed * 1.4));
    vAlpha = life;
    gl_PointSize = uSize * (0.6 + aSeed) * uPixelRatio * (12.0 / -mv.z);
  }
`;

const frag = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * 0.85);
  }
`;

export function useDust({
  count,
  origin,
  spread = 1.6,
  lift = 0.9,
  color = '#2e4bff',
  size = 3.2,
  seed = 7,
}: {
  count: number;
  origin: [number, number, number];
  spread?: number;
  lift?: number;
  color?: string;
  size?: number;
  seed?: number;
}) {
  const { geometry, material } = useMemo(() => {
    let s = seed * 7919;
    const r = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const sp = spread * (0.35 + r() * 0.9);
      pos[i * 3] = origin[0] + Math.cos(a) * 0.06;
      pos[i * 3 + 1] = origin[1];
      pos[i * 3 + 2] = origin[2] + Math.sin(a) * 0.06;
      vel[i * 3] = Math.cos(a) * sp;
      vel[i * 3 + 1] = lift * (0.2 + r() * r() * 1.4);
      vel[i * 3 + 2] = Math.sin(a) * sp;
      seeds[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(...origin), spread * 2 + 2);
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTau: { value: 0 },
        uPixelRatio: { value: typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio, 1.75) },
        uSize: { value: size },
        uColor: { value: new THREE.Color(color) },
      },
    });
    return { geometry: g, material: m };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const node = <points geometry={geometry} material={material} frustumCulled={false} />;
  return { node, material };
}
