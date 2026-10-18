'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GlassMaterial } from '@/components/webgl/lib/materials';
import type { DioramaProps } from './types';

const RIVER_HEIGHT = 3.6;

const riverVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uHeight;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vSeed = aSeed;
    vec3 p = position;

    /* the river rises — base y stored 0..uHeight, wrapped */
    float rise = mod(p.y + uTime * uSpeed * (0.55 + aSeed * 0.9), uHeight);
    vAlpha = smoothstep(0.0, 0.55, rise) *
      (1.0 - smoothstep(uHeight - 0.8, uHeight, rise));
    p.y = rise - uHeight * 0.5;

    /* gentle spiral sway as it climbs */
    float sway = uTime * 0.4 + aSeed * 6.28318 + rise * 1.1;
    p.x += sin(sway) * 0.14;
    p.z += cos(sway * 0.85) * 0.14;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.4 + aSeed * 0.9) * uPixelRatio * (40.0 / -mv.z);
  }
`;

const riverFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.5, 0.06, d);
    float a = core * vAlpha * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uColorA, uColorB, vSeed), a);
  }
`;

/**
 * 05 Growth & Distribution — a rising river of particles, spiraling
 * gently as it climbs, threaded by a thin ascending glass helix.
 * Acquisition that compounds while you sleep.
 */
export default function GrowthDiorama({ visible, q }: DioramaProps) {
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const count = Math.max(160, Math.floor(950 * q.particles));

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.85;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.random() * RIVER_HEIGHT;
      positions[i * 3 + 2] = Math.sin(a) * r;
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: riverVertex,
      fragmentShader: riverFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 0.55 },
        uHeight: { value: RIVER_HEIGHT },
        uSize: { value: 0.5 },
        uPixelRatio: { value: 1 },
        uOpacity: { value: 0 },
        uColorA: { value: new THREE.Color('#2e4bff') },
        uColorB: { value: new THREE.Color('#a9bcff') },
      },
    });
    return { geometry, material };
  }, [count]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  /* the ascending glass helix */
  const helixGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const turns = 2.4;
    for (let i = 0; i <= 48; i++) {
      const f = i / 48;
      const a = f * Math.PI * 2 * turns;
      pts.push(
        new THREE.Vector3(Math.cos(a) * 0.62, f * 3.1 - 1.55, Math.sin(a) * 0.62)
      );
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.02, 8, false);
  }, []);

  useEffect(() => () => helixGeo.dispose(), [helixGeo]);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const w = visible.current;

    g.visible = w > 0.01;
    g.position.y = (1 - w) * -1.6;
    g.scale.setScalar(0.82 + w * 0.18);

    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uSpeed.value = q.animate ? 0.55 : 0;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    material.uniforms.uOpacity.value = w * 0.8;

    if (spin.current && q.animate) spin.current.rotation.y += delta * 0.4 * w;
  });

  return (
    <group ref={root} visible={false}>
      <points geometry={geometry} material={material} frustumCulled={false} />
      <group ref={spin}>
        <mesh geometry={helixGeo}>
          <GlassMaterial kind="azure" />
        </mesh>
      </group>
    </group>
  );
}
