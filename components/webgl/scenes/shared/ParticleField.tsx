'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { pointer, useScrollStore } from '../../scroll-store';
import { useQuality } from '../../lib/quality';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uDrift;
  uniform vec2 uPointer;
  uniform float uPixelRatio;
  uniform float uVelocity;
  attribute float aScale;
  attribute float aSeed;
  varying float vSeed;
  varying float vFade;

  void main() {
    vSeed = aSeed;
    vec3 p = position;

    /* slow laminar drift — three layered sine fields */
    float t = uTime * uDrift;
    p.x += sin(t * 0.7 + aSeed * 12.0 + p.y * 0.35) * 0.55;
    p.y += cos(t * 0.5 + aSeed * 17.0 + p.z * 0.3) * 0.45;
    p.z += sin(t * 0.6 + aSeed * 23.0 + p.x * 0.25) * 0.5;

    /* scroll velocity — the air streams with the page. Positions bend
       along y, per-particle phase keeps it organic, clamped ±1 upstream */
    float vStream = uVelocity * (0.5 + aScale * 0.4);
    p.y += vStream * (0.85 + 0.5 * sin(aSeed * 26.0 + uTime * 0.35));

    /* gentle pointer parallax, deeper particles move less */
    float depth = smoothstep(-8.0, 4.0, p.z);
    p.xy += uPointer * (0.35 + depth * 0.65) * 0.6;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    /* size attenuation + twinkle — fine dust, not blobs.
       velocity adds a slight swell (≤ +35%), never shrinks */
    float twinkle = 0.75 + 0.25 * sin(uTime * (0.6 + aSeed) + aSeed * 40.0);
    float vBoost = 1.0 + min(abs(uVelocity), 1.0) * 0.35;
    gl_PointSize = uSize * aScale * twinkle * vBoost * uPixelRatio * (14.0 / -mv.z);
    vFade = smoothstep(26.0, 10.0, -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vSeed;
  varying float vFade;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.42, 0.06, d);
    float halo = smoothstep(0.5, 0.3, d) * 0.22;
    float a = (core + halo) * uOpacity * vFade;
    if (a < 0.003) discard;
    vec3 col = mix(uColorA, uColorB, vSeed);
    gl_FragColor = vec4(col, a);
  }
`;

export interface ParticleFieldProps {
  count?: number;
  /** half-extents of the volume the particles fill [x, y, z] */
  spread?: [number, number, number];
  /** base point size in px-ish world units */
  size?: number;
  colorA?: string;
  colorB?: string;
  opacity?: number;
  /** drift speed multiplier (0 = frozen) */
  drift?: number;
  /** offset of the whole field */
  position?: [number, number, number];
  /** parallax strength 0..1 (default 1) */
  parallax?: number;
}

/**
 * ParticleField — the signature Cato dust: fine blue-white points
 * drifting in luminous space. Shader-driven, zero per-frame allocation,
 * fully quality-scalable. Compose freely inside any scene.
 */
export default function ParticleField({
  count = 2600,
  spread = [16, 9, 8],
  size = 0.03,
  colorA = '#2e4bff',
  colorB = '#9db2ff',
  opacity = 0.42,
  drift = 0.14,
  position = [0, 0, 0],
  parallax = 1,
}: ParticleFieldProps) {
  const points = useRef<THREE.Points>(null);
  const { viewport } = useThree();
  const q = useQuality();
  /* velocity state — refs only, mutated in useFrame, never re-rendered.
     prevY/smoothed persist across frames; zero allocation. */
  const velRef = useRef({ prevY: 0, smoothed: 0 });

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * spread[0];
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * spread[1];
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * spread[2];
      scales[i] = 0.4 + Math.random() * 1.4;
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: size * 100 },
        uDrift: { value: drift },
        uPointer: { value: new THREE.Vector2() },
        uPixelRatio: { value: 1 },
        uVelocity: { value: 0 },
        uColorA: { value: new THREE.Color(colorA) },
        uColorB: { value: new THREE.Color(colorB) },
        uOpacity: { value: opacity },
      },
    });
    return { geometry, material };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, spread[0], spread[1], spread[2], size, colorA, colorB, opacity, drift]);

  /* imperatively-created GPU resources must be freed on unmount/route-hop */
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state, delta) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    const p = material.uniforms.uPointer.value as THREE.Vector2;
    p.x += (pointer.x * parallax - p.x) * 0.04;
    p.y += (pointer.y * parallax - p.y) * 0.04;

    /* velocity-reactive dust: derive instantaneous speed from store
       scrollY deltas (self-decaying — a held store.velocity could go
       stale on abrupt stops, scrollY deltas cannot), normalize to ±1,
       damp toward it, land at rest. Reduced motion pins it to 0. */
    const v = velRef.current;
    const d = Math.min(Math.max(delta, 1e-4), 0.1); // clamp tab-switch spikes
    const y = useScrollStore.getState().scrollY;
    const inst = (y - v.prevY) / d; // px/s
    v.prevY = y;
    const target = q.animate ? Math.max(-1, Math.min(1, inst / 2600)) : 0;
    v.smoothed += (target - v.smoothed) * Math.min(1, d * 7);
    material.uniforms.uVelocity.value = v.smoothed;
  });

  return (
    <points
      ref={points}
      geometry={geometry}
      material={material}
      position={position}
      frustumCulled={false}
      renderOrder={-1}
    />
  );
}
