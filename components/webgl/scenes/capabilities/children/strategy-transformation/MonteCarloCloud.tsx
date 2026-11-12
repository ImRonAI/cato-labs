'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { strategyBus } from './bus';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAnimate;
  uniform float uPixelRatio;
  uniform float uSelectedPath;
  uniform float uP10;
  uniform float uP50;
  uniform float uP90;
  uniform float uSpread;
  uniform float uPulseWave;
  uniform float uIntro;

  attribute float aU;
  attribute float aZ;
  attribute float aPath;
  attribute float aSeed;

  varying float vActive;
  varying float vQuantile;
  varying float vWave;
  varying float vAlpha;

  void main() {
    /* Progress along horizon 0..1 */
    float speed = 0.065 + aSeed * 0.035;
    float u = mix(aU, fract(aU + uTime * speed), uAnimate);

    /* X spans from Decision Origin (-2.18) to Horizon (+2.18) */
    float x = mix(-2.18, 2.18, u);

    /* Lateral Z branches into 3 strategic lanes (-1.05, 0.0, +1.05) */
    float laneIdx = aPath - 1.0; /* -1, 0, +1 */
    float branchCurve = smoothstep(0.0, 0.65, u);
    float laneCenterZ = laneIdx * 1.05 * branchCurve;

    /* Is this particle on the selected strategic path? */
    float isSelected = 1.0 - step(0.25, abs(aPath - uSelectedPath));
    vActive = isSelected;

    /* Lateral Gaussian dispersion within the lane */
    float fanWidth = (0.05 + 0.34 * pow(u, 0.85)) * mix(0.65, max(0.35, uSpread), isSelected);
    float zJitter = sin(u * 9.0 + aSeed * 18.0) * 0.03 * u;
    float z = laneCenterZ + aZ * fanWidth * 0.55 + zJitter;

    /* Vertical Y trajectory: J-curve dip then compounding ascent */
    float pathTargetY = uP50;
    float pathP10 = uP10;
    float pathP90 = uP90;

    if (isSelected < 0.5) {
      if (aPath < 0.5) {
        pathTargetY = uP50 * 0.82 + 0.1;
        pathP10 = uP10 * 0.85;
        pathP90 = uP90 * 0.78;
      } else if (aPath < 1.5) {
        pathTargetY = uP50 * 1.08 - 0.05;
        pathP10 = uP10 - 0.22;
        pathP90 = uP90 * 1.18;
      } else {
        pathTargetY = uP50 * 0.52;
        pathP10 = uP10 * 0.65 + 0.08;
        pathP90 = uP90 * 0.52;
      }
    }

    float dip = -0.14 * sin(u * 3.14159) * (1.0 - u * 0.65);
    float medianY = 0.34 + dip + pathTargetY * pow(u, 1.25) * 0.82;

    /* Vertical P10..P90 dispersion */
    float qNorm = clamp(aZ / 1.65, -1.0, 1.0);
    float vertOffset = qNorm >= 0.0
      ? qNorm * (pathP90 - pathTargetY) * 0.54 * pow(u, 0.95)
      : (-qNorm) * (pathP10 - pathTargetY) * 0.54 * pow(u, 0.95);

    float y = max(0.11, medianY + vertOffset);

    /* Pulse wavefront when user interacts with Decision Engine */
    float waveDist = abs(u - uPulseWave);
    float wave = smoothstep(0.22, 0.0, waveDist) * step(0.001, uPulseWave) * step(uPulseWave, 1.15);
    vWave = wave;
    y += wave * 0.09 * isSelected;

    vec3 pos = vec3(x, y * uIntro, z);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    vQuantile = abs(qNorm);
    float edgeFade = smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.92, u);
    vAlpha = edgeFade * mix(0.38, 0.96, isSelected) * (1.0 - vQuantile * 0.32);

    float baseSize = mix(2.8, 5.2, isSelected) * (1.0 - vQuantile * 0.22) + wave * 3.0;
    gl_PointSize = baseSize * uPixelRatio * (10.5 / max(2.0, -mv.z));
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColorCore;
  uniform vec3 uColorDeep;
  uniform vec3 uColorIce;
  varying float vActive;
  varying float vQuantile;
  varying float vWave;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    float disc = smoothstep(0.5, 0.08, d);
    vec3 activeCol = mix(uColorDeep, uColorCore, 1.0 - vQuantile * 0.6);
    activeCol = mix(activeCol, vec3(0.18, 0.29, 1.0), vWave * 0.65);
    vec3 col = mix(uColorIce, activeCol, vActive);

    float alpha = disc * vAlpha;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function MonteCarloCloud({
  count = 1800,
  animate = true,
}: {
  count?: number;
  animate?: boolean;
}) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const smoothed = useRef({
    p10: 0.22,
    p50: 0.68,
    p90: 1.24,
    spread: 0.58,
    selectedPath: 0,
  });

  const { geometry, material } = useMemo(() => {
    const rand = mulberry32(4192026);
    const positions = new Float32Array(count * 3);
    const aU = new Float32Array(count);
    const aZ = new Float32Array(count);
    const aPath = new Float32Array(count);
    const aSeed = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const u = rand();
      const u1 = Math.max(1e-6, rand());
      const u2 = rand();
      const z = Math.max(
        -2.0,
        Math.min(2.0, Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)),
      );
      const pathIdx = i % 3;

      aU[i] = u;
      aZ[i] = z;
      aPath[i] = pathIdx;
      aSeed[i] = rand();

      positions[i * 3] = -2.18 + u * 4.36;
      positions[i * 3 + 1] = 0.5;
      positions[i * 3 + 2] = (pathIdx - 1) * 1.05;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
    geo.setAttribute('aZ', new THREE.BufferAttribute(aZ, 1));
    geo.setAttribute('aPath', new THREE.BufferAttribute(aPath, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
        uAnimate: { value: animate ? 1.0 : 0.0 },
        uPixelRatio: { value: 1.0 },
        uSelectedPath: { value: 0.0 },
        uP10: { value: 0.22 },
        uP50: { value: 0.68 },
        uP90: { value: 1.24 },
        uSpread: { value: 0.58 },
        uPulseWave: { value: 0.0 },
        uIntro: { value: 1.0 },
        uColorCore: { value: new THREE.Color('#2e4bff') },
        uColorDeep: { value: new THREE.Color('#0a1890') },
        uColorIce: { value: new THREE.Color('#5f7dff') },
      },
    });
    return { geometry: geo, material: mat };
  }, [count, animate]);

  useEffect(() => {
    matRef.current = material;
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state) => {
    const mat = matRef.current;
    if (!mat) return;
    const S = smoothed.current;
    const lerp = animate ? 0.08 : 1.0;

    S.p10 += (strategyBus.p10Norm - S.p10) * lerp;
    S.p50 += (strategyBus.p50Norm - S.p50) * lerp;
    S.p90 += (strategyBus.p90Norm - S.p90) * lerp;
    S.spread += (strategyBus.spreadNorm - S.spread) * lerp;
    S.selectedPath += (strategyBus.selectedPathIndex - S.selectedPath) * (animate ? 0.14 : 1.0);

    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uAnimate.value = animate ? 1.0 : 0.0;
    mat.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    mat.uniforms.uP10.value = S.p10;
    mat.uniforms.uP50.value = S.p50;
    mat.uniforms.uP90.value = S.p90;
    mat.uniforms.uSpread.value = S.spread;
    mat.uniforms.uSelectedPath.value = S.selectedPath;

    const intro = animate ? Math.min(1.0, state.clock.elapsedTime / 1.4) : 1.0;
    mat.uniforms.uIntro.value = intro * intro * (3.0 - 2.0 * intro);

    if (animate && strategyBus.pulseAt > 0) {
      const elapsedSincePulse = (performance.now() - strategyBus.pulseAt) / 1000;
      mat.uniforms.uPulseWave.value = elapsedSincePulse < 1.6 ? elapsedSincePulse / 1.35 : 0.0;
    } else {
      mat.uniforms.uPulseWave.value = 0.0;
    }
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
