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
import Clapperboard from '../lib-b/Clapperboard';
import { fadeTree } from '../lib-b/fade';
import { driveCamera, makeStage, refreshMoment } from '../lib-b/stage';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';

/**
 * LosAngelesScene — "The Basin of Light".
 *
 * The downtown tower-cluster skyline (skylinePoints('los-angeles')) assembles
 * out of a scattered shell on mount; beneath it a sparse glowing grid of tiny
 * points — the city lights of the basin at night, in the strict blue spectrum
 * — spreads WIDER than the skyline itself and breathes gently. A tilted
 * search-beacon beam sweeps the basin in a slow premiere-night loop. As the
 * `angles` section travels the viewport, the camera pulls back and rises
 * slightly so the sprawl's scale reads against the towers. The whole city
 * group swings a slow ±10° with pointer parallax; the water-cursor ripples
 * the towers.
 *
 * Hotspot 'la-skyline' rides an anchor just under the spire tip.
 * Signature moment (`moment` dwell, lib-b/Clapperboard): the city dims, the
 * camera turns to a glass slate whose clapper snaps shut, then film runs
 * through a projector and the beam throws each frame onto a screen.
 *
 * Reduced motion: everything assembled, breathing frozen, camera settled.
 * All per-frame animation runs in shaders or on refs — zero allocations.
 */

const basinVertex = /* glsl */ `
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
    /* assemble: each light rises into the grid on a seeded stagger */
    float stag = smoothstep(aSeed * 0.55, aSeed * 0.55 + 0.45, uIntro);
    p.y -= (1.0 - stag) * (0.4 + aSeed * 0.5);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    /* gentle breathing — frozen when uMotion is 0 */
    float breath = 0.68 + 0.32 * sin(uTime * (0.4 + aSeed * 0.55) * uMotion + aSeed * 43.0);
    vGlow = breath * stag;
    gl_PointSize = uSize * aScale * (0.7 + 0.3 * breath) * uPixelRatio * (14.0 / -mv.z);
    vFade = smoothstep(26.0, 8.0, -mv.z);
  }
`;

const basinFragment = /* glsl */ `
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
    float halo = smoothstep(0.5, 0.3, d) * 0.25;
    float a = (core + halo) * uOpacity * vFade * vGlow;
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uColorA, uColorB, vSeed), a);
  }
`;

/* module-scope temps — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const STAGE = makeStage([0.75, 0.35, 9.6], [0.75, 0.15, 0.4]);

/* the search beacon — a premiere-night sweep over the basin,
   in the city group's local space (basin lights sit at y ≈ -0.68) */
const BEACON_POS: [number, number, number] = [-0.9, -0.64, 0.25];
const BEACON_TILT = 0.62;

/**
 * BasinLights — the city-lights grid. A seeded, sparsely-occupied street
 * grid on a flat plane beneath (and wider than) the skyline; breathing and
 * the assemble stagger run entirely in the vertex shader.
 */
function BasinLights({ count }: { count: number }) {
  const q = useQuality();

  const sim = useMemo(() => {
    const rand = mulberry32(hashString('la-basin-grid'));
    /* candidate cells on a jittered grid, ~54% dark lots → the sprawl reads
       as neighborhoods, not as a uniform sheet */
    const cells: number[] = [];
    const NX = 56;
    const NZ = 16;
    for (let gz = 0; gz < NZ; gz++) {
      for (let gx = 0; gx < NX; gx++) {
        if (rand() < 0.46) continue;
        const x = -1.5 + (gx / (NX - 1)) * 3.0 + (rand() - 0.5) * 0.045;
        const z = -1.05 + (gz / (NZ - 1)) * 1.65 + (rand() - 0.5) * 0.06;
        cells.push(x, z);
      }
    }
    const total = cells.length / 2;
    /* seeded shuffle so any prefix of the array is an even sprinkle */
    const order = new Uint32Array(total);
    for (let i = 0; i < total; i++) order[i] = i;
    for (let i = total - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    const n = Math.max(48, Math.min(total, count));
    const positions = new Float32Array(n * 3);
    const scales = new Float32Array(n);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const c = order[i];
      positions[i * 3] = cells[c * 2];
      positions[i * 3 + 1] = -0.68 + (rand() - 0.5) * 0.02;
      positions[i * 3 + 2] = cells[c * 2 + 1];
      scales[i] = 0.5 + rand() * 1.1;
      seeds[i] = rand();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: basinVertex,
      fragmentShader: basinFragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 3.0 },
        uPixelRatio: { value: 1 },
        uIntro: { value: 0 },
        uMotion: { value: 1 },
        uColorA: { value: new THREE.Color('#2e4bff') },
        uColorB: { value: new THREE.Color('#b9ccff') },
        uOpacity: { value: 0.6 },
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
    m.uniforms.uTime.value = q.animate ? el : 3.7; // frozen shimmer otherwise
    m.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    m.uniforms.uMotion.value = q.animate ? 1 : 0;
    m.uniforms.uIntro.value = q.animate
      ? smooth(Math.min(Math.max((el - start.current - 0.35) / 1.4, 0), 1))
      : 1;
  });

  return <points geometry={sim.geometry} material={sim.material} frustumCulled={false} />;
}

export default function LosAngelesScene() {
  const q = useQuality();
  const city = useRef<THREE.Group>(null);
  const anchor = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Group>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const report = useHotspotReporter('la-skyline');

  /* skyline target, scaled by quality (≈2600 at full) */
  const target = Math.max(256, Math.round(2600 * q.particles));
  const skyline = useMemo(() => skylinePoints('los-angeles', target), [target]);
  const basinCount = Math.round(880 * q.particles);

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    /* angles progress → the pull-back that reveals the basin's scale */
    const angles = anim
      ? smooth(sectionRange(getSectionProgress('angles'), 0.12, 0.9))
      : 0.4;
    const intro = anim ? smooth(Math.min(el / 1.7, 1)) : 1;

    /* the whole city swings a slow ±10° with a whisper of pointer parallax */
    const g = city.current;
    if (g) {
      g.rotation.y =
        (anim ? Math.sin(el * 0.05) * (Math.PI / 18) : Math.PI / 18) +
        (anim ? pointer.x * 0.045 : 0);
      g.position.y = -0.35 - (1 - intro) * 0.5;
    }

    /* the search beacon — a premiere-night sweep across the basin */
    const bc = beacon.current;
    if (bc) {
      bc.rotation.y = anim ? el * 0.42 : 0.9;
      const bm = beamMat.current;
      if (bm) bm.opacity = anim ? 0.13 + 0.05 * Math.sin(el * 0.9) : 0.15;
    }

    /* hotspot: the anchor just under the spire tip */
    if (anchor.current) {
      report(
        anchor.current,
        state.camera,
        anim ? 0.58 + 0.18 * Math.sin(el * 0.7) : 0.6,
      );
    }

    /* camera — slow drift, eased pull-back + rise on `angles` */
    const radius = 9.3 + angles * 1.7 + (1 - intro) * 1.3;
    const camY = 2.25 + angles * 0.8;
    const orbit = anim ? Math.sin(el * 0.042) * 0.1 : 0.06;
    _camTarget.set(
      Math.sin(orbit) * radius + (anim ? pointer.x * 0.35 : 0),
      camY + (anim ? pointer.y * 0.22 : 0),
      Math.cos(orbit) * radius,
    );
    _lookTarget.set(0.35, -0.55 - angles * 0.3, -0.4);
    /* the moment dwell takes the camera to the set piece, then hands it back */
    const m = refreshMoment();
    const w = m.w;
    driveCamera(state.camera, _camTarget, _lookTarget, STAGE, w, q.compact ? 1.9 : 1, anim ? pointer.x : 0, anim ? pointer.y : 0);
    fadeTree(city.current, 1 - w * 0.88);
  });

  return (
    <group>
      <SceneLightRig />

      {/* the city — skyline sculpture + the basin sprawl, one local space */}
      <group ref={city} position={[0.55, -0.35, -0.6]} scale={2.35}>
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
        <BasinLights count={basinCount} />

        {/* the search beacon — a tilted beam sweeping the basin */}
        <group ref={beacon} position={BEACON_POS}>
          <group rotation={[0, 0, BEACON_TILT]}>
            <mesh position={[0, 1.65, 0]}>
              <planeGeometry args={[0.34, 3.3]} />
              <meshBasicMaterial
                ref={beamMat}
                color="#b9ccff"
                transparent
                opacity={0.15}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
          <mesh>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshBasicMaterial
              color="#eef2ff"
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </mesh>
        </group>
        {/* hotspot anchor — just under the spire tip of the tallest tower */}
        <group ref={anchor} position={[0.06, 0.72, 0]} />
      </group>

      {/* signature moment — the slate, the projector, the picture */}
      <Clapperboard position={[-0.4, 0, 0.6]} />

      {/* ambient blue dust */}
      <ParticleField
        count={Math.floor(1100 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.3}
        position={[0, 0.5, -2]}
      />
    </group>
  );
}
