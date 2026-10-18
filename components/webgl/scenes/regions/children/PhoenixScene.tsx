'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import ParticleSculpture from '../../../kit/ParticleSculpture';
import { skylinePoints } from '../../../kit/lib/skylines';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';

/**
 * PhoenixScene — "The Valley of the Sun".
 *
 * The Phoenix skyline (seeded building bars + the Camelback double-hump)
 * assembles out of light as a ParticleSculpture point cloud with the
 * water cursor. Above the Camelback head floats a single deep-blue sun
 * disc wrapped in a faint heat-haze ring — a torus of sparse points on a
 * slow expand/fade loop. Rising off the valley floor, a sheet of
 * heat-shimmer points wobbles horizontally — a mirage whose amplitude
 * and opacity intensify the nearer a column sits to the sun, and the
 * higher the sun has climbed.
 *
 * Scroll: on the `angles` beat the sun climbs over the Valley and the
 * shimmer intensifies beneath it. Hotspot 'phx-skyline' rides the
 * Camelback head so nearby ProximityType glints.
 *
 * Camera: slow ±3° drift + pointer parallax; the skyline group sways ±10°.
 * Zero allocations in useFrame; reduced motion renders the risen
 * composition as a still with the shimmer parked faint.
 */

/* skyline placement */
const SKYLINE_COUNT = 2400;
const SKYLINE_SCALE = 2.6;
const SKYLINE_Y = -0.7;
const TILT = (10 * Math.PI) / 180;

/* the sun + its heat haze */
const SUN_X = 0.55; // hangs over the Camelback head
const SUN_Z = -0.6; // just behind the skyline plane
const SUN_LOW_Y = 1.0; // resting height above the ridge
const SUN_HIGH_Y = 2.25; // climbed height once `angles` scrolls through
const SUN_R = 0.42;
const HAZE_R = 0.72;
const HAZE_COUNT = 260;

/* hotspot anchor — the Camelback head: sculpture-local (0.2, 0.12) → world */
const ANCHOR: [number, number, number] = [
  0.2 * SKYLINE_SCALE,
  SKYLINE_Y + 0.12 * SKYLINE_SCALE,
  0,
];

/* the heat shimmer rising off the valley floor */
const SHIMMER_COUNT = 620;
const SHIMMER_HALF_W = 3.2;
const SHIMMER_Y_LO = -0.9; // just under the skyline baseline
const SHIMMER_Y_HI = 0.9;

const shimmerVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uHeat;
  uniform float uSunX;
  uniform float uSunY;
  uniform float uMotion;
  attribute float aScale;
  attribute float aSeed;
  varying float vSeed;
  varying float vFade;
  varying float vProx;

  void main() {
    vSeed = aSeed;
    vec3 p = position;
    /* proximity to the sun's column — the mirage is hottest beneath it */
    float dx = (p.x - uSunX) / 1.4;
    float dy = (p.y - uSunY) / 2.2;
    float prox = exp(-(dx * dx + dy * dy));
    vProx = prox;
    /* the wobble: high-frequency, tiny amplitude, vertical shear like air */
    float amp = (0.012 + 0.05 * prox) * uHeat;
    p.x += sin(p.y * 26.0 + uTime * 2.6 + aSeed * 43.0) * amp * uMotion;
    p.y += sin(uTime * 0.5 + aSeed * 20.0) * 0.03 * uMotion;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * uPixelRatio * (14.0 / -mv.z);
    vFade = smoothstep(26.0, 8.0, -mv.z);
  }
`;

const shimmerFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vSeed;
  varying float vFade;
  varying float vProx;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.44, 0.08, d);
    float a = core * uOpacity * vFade * (0.35 + 0.65 * vProx);
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uColorA, uColorB, vSeed), a);
  }
`;

/* module-scope temp — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();

export default function PhoenixScene() {
  const q = useQuality();
  const tiltRef = useRef<THREE.Group>(null);
  const sunRef = useRef<THREE.Group>(null);
  const hazeRef = useRef<THREE.Group>(null);
  const hazeMatRef = useRef<THREE.PointsMaterial>(null);
  const shimmerRef = useRef<THREE.Points>(null);
  const anchorRef = useRef<THREE.Group>(null);
  const report = useHotspotReporter('phx-skyline');

  /* Camelback silhouette target — deterministic per slug, cached by the kit */
  const skyline = useMemo(
    () =>
      skylinePoints(
        'phoenix',
        Math.max(64, Math.round(SKYLINE_COUNT * q.particles)),
      ),
    [q.particles],
  );

  /* heat-haze ring — sparse points scattered on a loose circle */
  const hazeGeometry = useMemo(() => {
    const n = Math.max(48, Math.round(HAZE_COUNT * q.particles));
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const r = HAZE_R + (Math.random() - 0.5) * 0.18;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [q.particles]);

  /* free the imperatively-created geometry on unmount / quality change */
  useEffect(() => () => hazeGeometry.dispose(), [hazeGeometry]);

  /* heat shimmer — a sheet of points across the valley floor that wobbles
     in the vertex shader, hottest in the column beneath the sun */
  const shimmer = useMemo(() => {
    const n = Math.max(96, Math.round(SHIMMER_COUNT * q.particles));
    const pos = new Float32Array(n * 3);
    const scales = new Float32Array(n);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * SHIMMER_HALF_W;
      pos[i * 3 + 1] =
        SHIMMER_Y_LO + Math.random() * (SHIMMER_Y_HI - SHIMMER_Y_LO);
      pos[i * 3 + 2] = -0.35 + (Math.random() - 0.5) * 0.5;
      scales[i] = 0.6 + Math.random() * 1.1;
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: shimmerVertex,
      fragmentShader: shimmerFragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 2.6 },
        uPixelRatio: { value: 1 },
        uHeat: { value: 0 },
        uSunX: { value: SUN_X },
        uSunY: { value: SUN_LOW_Y },
        uMotion: { value: 1 },
        uColorA: { value: new THREE.Color('#93a9ff') },
        uColorB: { value: new THREE.Color('#dbe4ff') },
        uOpacity: { value: 0 },
      },
    });
    return { geometry, material };
  }, [q.particles]);

  /* free the shimmer GPU resources on unmount / quality change */
  useEffect(
    () => () => {
      shimmer.geometry.dispose();
      shimmer.material.dispose();
    },
    [shimmer],
  );

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const angles = anim ? getSectionProgress('angles') : 1;
    const rise = smooth(sectionRange(angles, 0.05, 0.85));
    const sunIntro = anim
      ? smooth(Math.min(Math.max((el - 0.8) / 1.1, 0), 1))
      : 1;

    /* skyline — slow ±10° sway + pointer tilt (assemble handled by the kit) */
    const tilt = tiltRef.current;
    if (tilt) {
      tilt.rotation.y = anim
        ? Math.sin(el * 0.05) * TILT + pointer.x * 0.04
        : 0;
      tilt.rotation.x = anim ? pointer.y * -0.02 : 0;
    }

    /* the sun climbs as `angles` scrolls; the haze calms with the climb */
    const sun = sunRef.current;
    if (sun) {
      const y = SUN_LOW_Y + (SUN_HIGH_Y - SUN_LOW_Y) * rise;
      sun.position.y = y - (1 - sunIntro) * 0.5;
      const breathe = anim ? 1 + Math.sin(el * 0.9) * 0.012 : 1;
      sun.scale.setScalar(Math.max(sunIntro, 0.001) * breathe);

      const haze = hazeRef.current;
      const hazeMat = hazeMatRef.current;
      if (haze && hazeMat) {
        const calm = 1 - rise * 0.75;
        const phase = anim ? (el * 0.22) % 1 : 0.4;
        haze.scale.setScalar(1 + phase * 0.55);
        haze.rotation.z = anim ? el * 0.06 : 0;
        hazeMat.opacity = (1 - phase) * 0.5 * calm * sunIntro;
      }
    }

    /* the heat shimmer intensifies as the sun climbs — hottest near it */
    const sm = shimmerRef.current?.material as THREE.ShaderMaterial | undefined;
    if (sm?.uniforms?.uHeat) {
      sm.uniforms.uTime.value = el;
      sm.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
      sm.uniforms.uHeat.value = anim ? 0.35 + 0.65 * rise : 0.6;
      sm.uniforms.uSunY.value = sunRef.current?.position.y ?? SUN_LOW_Y;
      sm.uniforms.uMotion.value = anim ? 1 : 0;
      sm.uniforms.uOpacity.value = (anim ? 0.1 + 0.3 * rise : 0.22) * sunIntro;
    }

    /* hotspot rides the Camelback head */
    const anchor = anchorRef.current;
    if (anchor) report(anchor, state.camera, 0.5 + 0.35 * rise);

    /* camera — slow ±3° drift + pointer parallax, eased */
    const drift = anim ? Math.sin(el * 0.045) * 0.055 : 0;
    const radius = 8.6;
    _camTarget.set(
      Math.sin(drift) * radius + (anim ? pointer.x * 0.4 : 0),
      0.35 + (anim ? pointer.y * 0.25 : 0),
      Math.cos(drift) * radius,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    state.camera.lookAt(0, 0.1, 0);
  });

  return (
    <group>
      <SceneLightRig />

      {/* skyline tilt group — sculpture + hotspot anchor sway together */}
      <group ref={tiltRef}>
        <ParticleSculpture
          points={skyline}
          count={SKYLINE_COUNT}
          size={0.032}
          color="#2e4bff"
          colorB="#93a9ff"
          opacity={0.8}
          position={[0, SKYLINE_Y, 0]}
          scale={SKYLINE_SCALE}
          waterRadius={0.32}
          waterStrength={0.16}
        />
        <group ref={anchorRef} position={ANCHOR} />
      </group>

      {/* the Valley sun — one deep-blue disc + its heat-haze ring */}
      <group ref={sunRef} position={[SUN_X, SUN_LOW_Y, SUN_Z]}>
        <mesh>
          <circleGeometry args={[SUN_R, 64]} />
          <meshBasicMaterial color="#2e4bff" transparent opacity={0.92} />
        </mesh>
        <group ref={hazeRef}>
          <points geometry={hazeGeometry} frustumCulled={false}>
            <pointsMaterial
              ref={hazeMatRef}
              size={0.05}
              color="#93a9ff"
              transparent
              opacity={0}
              depthWrite={false}
              sizeAttenuation
            />
          </points>
        </group>
      </group>

      {/* the heat shimmer — a mirage sheet over the valley floor,
          intensifying toward the sun's column */}
      <points
        ref={shimmerRef}
        geometry={shimmer.geometry}
        material={shimmer.material}
        frustumCulled={false}
      />

      <ParticleField
        count={Math.floor(1100 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.28}
      />
    </group>
  );
}
