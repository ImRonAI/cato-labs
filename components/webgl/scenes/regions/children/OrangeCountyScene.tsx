'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import ParticleSculpture from '../../../kit/ParticleSculpture';
import { skylinePoints } from '../../../kit/lib/skylines';
import { hashString, mulberry32 } from '../../../kit/lib/samplePath';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { useQuality } from '../../../lib/quality';
import { smooth, pointer } from '../../../scroll-store';

/**
 * OrangeCountyScene — "The Pier".
 *
 * The pier skyline (skylinePoints('orange-county') — deck, posts, hut, water
 * line) assembles out of light on mount. Beneath the drawn water line sits a
 * slow sine-displaced sheet of azure points — the water surface, shimmering
 * as two crossed swells — while three swell sets roll in from the horizon as
 * traveling crest lines, rising and dissipating as they reach the pier, and
 * a tiny deep-blue dot (the surfer) drifts and bobs on that same swell,
 * sharing its exact formula. The city group swings a slow ±10° with pointer
 * parallax; the water-cursor ripples the pier.
 *
 * Hotspot 'oc-skyline' rides an anchor on the hut at the end of the pier.
 * Reduced motion: pier assembled, the shimmer frozen mid-swell, the sets
 * parked mid-roll, surfer still.
 * Sheet, sets + shimmer run in shaders; the surfer moves on a ref — zero
 * allocations.
 */

const waterVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uIntro;
  uniform float uMotion;
  attribute float aScale;
  attribute float aSeed;
  varying float vSeed;
  varying float vFade;
  varying float vGlow;

  void main() {
    vSeed = aSeed;
    vec3 p = position;
    /* assemble: the sheet settles down onto the water line, seeded stagger */
    float stag = smoothstep(aSeed * 0.5, aSeed * 0.5 + 0.5, uIntro);
    /* two crossed swells — the same formula the surfer bobs on */
    float swell = sin(p.x * 2.7 + uTime * 0.7) * 0.05
                + cos(p.z * 3.3 + uTime * 0.55) * 0.032;
    p.y += swell * uMotion * stag;
    p.y -= (1.0 - stag) * 0.35;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    /* crest glints — brightness rides the first swell's phase */
    float glint = 0.55 + 0.45 * sin(p.x * 2.7 + uTime * 0.7 * uMotion + 1.3 + aSeed * 2.1);
    vGlow = (0.62 + 0.38 * glint) * stag;
    gl_PointSize = uSize * aScale * (0.75 + 0.25 * glint) * uPixelRatio * (14.0 / -mv.z);
    vFade = smoothstep(26.0, 8.0, -mv.z);
  }
`;

const waterFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vSeed;
  varying float vFade;
  varying float vGlow;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.42, 0.06, d);
    float halo = smoothstep(0.5, 0.3, d) * 0.22;
    float a = (core + halo) * uOpacity * vFade * vGlow;
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uColorA, uColorB, vSeed), a);
  }
`;

/* module-scope temps — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

/** the swell the sheet displaces by — mirrored by the surfer on the CPU */
const SHEET_Y = -0.56;
function swellAt(x: number, z: number, t: number): number {
  return Math.sin(x * 2.7 + t * 0.7) * 0.05 + Math.cos(z * 3.3 + t * 0.55) * 0.032;
}

/* ---- the swell sets — traveling crest lines rolling in to the pier ---- */
const SETS = 3; // sets in the water at once
const SET_Z_FAR = -1.05; // where a set stands up
const SET_Z_NEAR = 0.42; // where it fades out at the beach

const setVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uIntro;
  uniform float uMotion;
  attribute float aScale;
  attribute float aSeed;
  attribute float aPhase;
  varying float vSeed;
  varying float vFade;
  varying float vCrest;

  void main() {
    vSeed = aSeed;
    vec3 p = position;
    /* the set rolls shoreward: progress 0 (stands up) → 1 (dissipates) */
    float prog = fract(aPhase + uTime * 0.045 * uMotion);
    p.z = mix(SET_Z_FAR, SET_Z_NEAR, prog);
    /* the crest rises mid-travel, then spills and fades */
    float crest = sin(3.14159 * prog);
    p.y += crest * 0.13 * (0.7 + 0.3 * sin(p.x * 3.1 + aSeed * 12.0));
    vCrest = crest;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * (0.6 + 0.6 * crest) * uPixelRatio * (14.0 / -mv.z);
    vFade = smoothstep(26.0, 8.0, -mv.z) * uIntro;
  }
`;

const setFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vSeed;
  varying float vFade;
  varying float vCrest;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.42, 0.06, d);
    float a = core * uOpacity * vFade * (0.25 + 0.75 * vCrest);
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uColorA, uColorB, vSeed), a);
  }
`;

/**
 * SwellSets — three traveling crest lines rolling in under the pier.
 * Each set stands up at the horizon, peaks mid-travel and spills out at
 * the beach — the whole loop runs in the vertex shader.
 */
function SwellSets({ perSet, animate }: { perSet: number; animate: boolean }) {
  const sim = useMemo(() => {
    const total = perSet * SETS;
    const positions = new Float32Array(total * 3);
    const scales = new Float32Array(total);
    const seeds = new Float32Array(total);
    const phases = new Float32Array(total);
    let p = 0;
    for (let s = 0; s < SETS; s++) {
      const phase = s / SETS; // stagger the sets down the travel path
      for (let i = 0; i < perSet; i++) {
        const t = i / (perSet - 1);
        positions[p * 3] = -1.2 + t * 2.4 + (Math.random() - 0.5) * 0.05;
        positions[p * 3 + 1] = SHEET_Y + 0.02;
        positions[p * 3 + 2] = SET_Z_FAR; // z is driven by the shader
        scales[p] = 0.5 + Math.random() * 0.9;
        seeds[p] = Math.random();
        phases[p] = phase + (Math.random() - 0.5) * 0.06;
        p++;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: setVertex,
      fragmentShader: setFragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      defines: {
        SET_Z_FAR: SET_Z_FAR.toFixed(3),
        SET_Z_NEAR: SET_Z_NEAR.toFixed(3),
      },
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 3.4 },
        uPixelRatio: { value: 1 },
        uIntro: { value: 0 },
        uMotion: { value: 1 },
        uColorA: { value: new THREE.Color('#2e4bff') },
        uColorB: { value: new THREE.Color('#aec2ff') },
        uOpacity: { value: 0.55 },
      },
    });
    return { geometry, material };
  }, [perSet]);

  useEffect(() => {
    return () => {
      sim.geometry.dispose();
      sim.material.dispose();
    };
  }, [sim]);

  const start = useRef(-1);
  useFrame((state) => {
    const m = sim.material;
    const el = state.clock.elapsedTime;
    if (start.current < 0) start.current = el;
    m.uniforms.uTime.value = animate ? el : 6.8; // parked mid-roll otherwise
    m.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    m.uniforms.uMotion.value = animate ? 1 : 0;
    m.uniforms.uIntro.value = animate
      ? smooth(Math.min(Math.max((el - start.current - 0.6) / 1.4, 0), 1))
      : 1;
  });

  return <points geometry={sim.geometry} material={sim.material} frustumCulled={false} />;
}

/**
 * WaterSheet — the azure water surface beneath the pier's water line.
 * Displacement and glint run entirely in the vertex shader.
 */
function WaterSheet({ count }: { count: number }) {
  const q = useQuality();

  const sim = useMemo(() => {
    const rand = mulberry32(hashString('oc-water-sheet'));
    /* a near-full grid — a sheet, not a sprinkle — with a ragged organic edge */
    const cells: number[] = [];
    const NX = 48;
    const NZ = 18;
    for (let gz = 0; gz < NZ; gz++) {
      for (let gx = 0; gx < NX; gx++) {
        const edge = gx === 0 || gz === 0 || gx === NX - 1 || gz === NZ - 1;
        if (edge && rand() < 0.35) continue;
        const x = -1.25 + (gx / (NX - 1)) * 2.5 + (rand() - 0.5) * 0.035;
        const z = -1.15 + (gz / (NZ - 1)) * 1.7 + (rand() - 0.5) * 0.04;
        cells.push(x, z);
      }
    }
    const total = cells.length / 2;
    /* seeded shuffle so any prefix still covers the whole sheet evenly */
    const order = new Uint32Array(total);
    for (let i = 0; i < total; i++) order[i] = i;
    for (let i = total - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    const n = Math.max(64, Math.min(total, count));
    const positions = new Float32Array(n * 3);
    const scales = new Float32Array(n);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const c = order[i];
      positions[i * 3] = cells[c * 2];
      positions[i * 3 + 1] = SHEET_Y + (rand() - 0.5) * 0.015;
      positions[i * 3 + 2] = cells[c * 2 + 1];
      scales[i] = 0.45 + rand() * 1.0;
      seeds[i] = rand();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: waterVertex,
      fragmentShader: waterFragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 2.8 },
        uPixelRatio: { value: 1 },
        uIntro: { value: 0 },
        uMotion: { value: 1 },
        uColorA: { value: new THREE.Color('#5f8cff') },
        uColorB: { value: new THREE.Color('#c9d8ff') },
        uOpacity: { value: 0.52 },
      },
    });
    return { geometry, material };
  }, [count]);

  /* free GPU resources on unmount / rebuild */
  useEffect(() => {
    return () => {
      sim.geometry.dispose();
      sim.material.dispose();
    };
  }, [sim]);

  const start = useRef(-1);
  useFrame((state) => {
    const m = sim.material;
    const el = state.clock.elapsedTime;
    if (start.current < 0) start.current = el;
    m.uniforms.uTime.value = q.animate ? el : 4.2; // frozen mid-swell otherwise
    m.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    m.uniforms.uMotion.value = q.animate ? 1 : 0;
    m.uniforms.uIntro.value = q.animate
      ? smooth(Math.min(Math.max((el - start.current - 0.3) / 1.4, 0), 1))
      : 1;
  });

  return <points geometry={sim.geometry} material={sim.material} frustumCulled={false} />;
}

/**
 * SurferDot — a tiny deep-blue point bobbing on the swell, drifting lazily.
 * Shares the sheet's exact swell formula so it rides the same water.
 */function SurferDot() {
  const q = useQuality();
  const dot = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const m = dot.current;
    if (!m) return;
    const t = q.animate ? state.clock.elapsedTime : 4.2;
    const x = 0.35 + Math.sin(t * 0.1) * 0.3;
    const z = 0.12 + Math.cos(t * 0.083) * 0.18;
    m.position.set(x, SHEET_Y + swellAt(x, z, t) + 0.035, z);
  });

  return (
    <mesh ref={dot} position={[0.35, SHEET_Y + 0.035, 0.12]}>
      <sphereGeometry args={[0.035, 16, 12]} />
      <meshBasicMaterial color="#1226c8" toneMapped={false} />
    </mesh>
  );
}

export default function OrangeCountyScene() {
  const q = useQuality();
  const city = useRef<THREE.Group>(null);
  const anchor = useRef<THREE.Group>(null);
  const report = useHotspotReporter('oc-skyline');

  /* skyline target, scaled by quality (≈2600 at full) */
  const target = Math.max(256, Math.round(2600 * q.particles));
  const skyline = useMemo(() => skylinePoints('orange-county', target), [target]);
  const waterCount = Math.round(860 * q.particles);

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const intro = anim ? smooth(Math.min(el / 1.7, 1)) : 1;

    /* the pier swings a slow ±10° with a whisper of pointer parallax */
    const g = city.current;
    if (g) {
      g.rotation.y =
        (anim ? Math.sin(el * 0.045) * (Math.PI / 18) : Math.PI / 18) +
        (anim ? pointer.x * 0.045 : 0);
      g.position.y = -0.2 - (1 - intro) * 0.45;
    }

    /* hotspot: the hut at the end of the pier */
    if (anchor.current) {
      report(
        anchor.current,
        state.camera,
        anim ? 0.56 + 0.18 * Math.sin(el * 0.65) : 0.6,
      );
    }

    /* camera — slow drift over the water, eased in on mount */
    const radius = 9.2 + (1 - intro) * 1.2;
    const orbit = anim ? Math.sin(el * 0.04) * 0.09 : 0.05;
    _camTarget.set(
      Math.sin(orbit) * radius + (anim ? pointer.x * 0.35 : 0),
      1.9 + (anim ? pointer.y * 0.2 : 0),
      Math.cos(orbit) * radius,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    _lookTarget.set(0.25, -0.7, -0.4);
    state.camera.lookAt(_lookTarget);
  });

  return (
    <group>
      <SceneLightRig />

      {/* the coast — pier sculpture + water sheet + surfer, one local space */}
      <group ref={city} position={[0.35, -0.2, -0.6]} scale={2.3}>
        <ParticleSculpture
          points={skyline}
          count={Math.round(target / q.particles)}
          size={0.031}
          color="#2e4bff"
          colorB="#9db2ff"
          opacity={0.82}
          waterRadius={0.3}
          waterStrength={0.16}
        />
        <WaterSheet count={waterCount} />
        {/* the sets — three crest lines rolling in from the horizon */}
        <SwellSets perSet={Math.max(40, Math.round(120 * q.particles))} animate={q.animate} />
        <SurferDot />
        {/* hotspot anchor — the hut at the end of the pier */}
        <group ref={anchor} position={[0.85, -0.18, 0]} />
      </group>

      {/* ambient blue dust */}
      <ParticleField
        count={Math.floor(1100 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.3}
        position={[0, 0.4, -2]}
      />
    </group>
  );
}
