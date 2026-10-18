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
 * SaltLakeCityScene — "The Ridge".
 *
 * The Salt Lake skyline (seeded building bars + the jagged Wasatch ridge
 * line) assembles out of light as a ParticleSculpture point cloud with
 * the water cursor. Behind the ridge hangs a soft band of alpenglow
 * points — an ice→azure gradient that warms (brightens) as the `angles`
 * section scrolls — while a bright crest of light sweeps slowly along
 * the ridge profile itself, the alpenglow chasing the skyline. A single
 * small deep-blue temple-square-ish spire marker stands at the ridge
 * base. Hotspot 'slc-skyline' rides the ridge crest so nearby
 * ProximityType glints.
 *
 * Camera: slow ±3° drift + pointer parallax; the skyline group sways ±10°.
 * Zero allocations in useFrame; reduced motion renders the warmed
 * composition as a still with the sweep parked at center-ridge.
 */

/* skyline placement */
const SKYLINE_COUNT = 2400;
const SKYLINE_SCALE = 2.6;
const SKYLINE_Y = -0.7;
const TILT = (10 * Math.PI) / 180;

/* the alpenglow band behind the ridge */
const GLOW_COUNT = 720;
const GLOW_Y = 0.35; // band center, world units
const GLOW_Z = -1.3; // behind the ridge plane
const GLOW_SPREAD_X = 3.4;
const ICE = new THREE.Color('#e9efff');
const AZURE = new THREE.Color('#93a9ff');

/* the spire marker at the ridge base */
const SPIRE_X = -0.75;
const RIDGE_BASE_Y = SKYLINE_Y - 0.56 * SKYLINE_SCALE; // ≈ -2.16

/* the alpenglow sweep — a bright crest traveling the ridge line */
const SWEEP_COUNT = 420;
const SWEEP_HALF_W = 2.6; // matches the scaled skyline's x reach
const SWEEP_Z = -0.55; // just behind the ridge plane

const sweepVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aScale;
  attribute float aSeed;
  attribute float aWorldX;
  varying float vSeed;
  varying float vFade;
  varying float vWorldX;

  void main() {
    vSeed = aSeed;
    vWorldX = aWorldX;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.85 + 0.15 * sin(uTime * (0.4 + aSeed * 0.5) + aSeed * 40.0);
    gl_PointSize = uSize * aScale * twinkle * uPixelRatio * (14.0 / -mv.z);
    vFade = smoothstep(26.0, 8.0, -mv.z);
  }
`;

const sweepFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform float uSweepX;
  uniform float uWarm;
  varying float vSeed;
  varying float vFade;
  varying float vWorldX;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.42, 0.05, d);
    /* the sweep: a gaussian window of light centered on uSweepX */
    float dx = (vWorldX - uSweepX) / 0.85;
    float glow = exp(-dx * dx);
    float a = core * uOpacity * vFade * (0.12 + glow * (0.25 + 0.75 * uWarm));
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uColorA, uColorB, vSeed), a);
  }
`;

/**
 * RidgeSweep — points strung along the Wasatch ridge profile; a gaussian
 * crest of light sweeps along them (uSweepX), brightening as the
 * `angles` beat warms the scene. Self-contained: reads the beat itself.
 */
function RidgeSweep({ animate }: { animate: boolean }) {
  const q = useQuality();
  const sim = useMemo(() => {
    const n = Math.max(64, Math.round(SWEEP_COUNT * q.particles));
    const pos = new Float32Array(n * 3);
    const worldX = new Float32Array(n);
    const scales = new Float32Array(n);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = -SWEEP_HALF_W + t * SWEEP_HALF_W * 2 + (Math.random() - 0.5) * 0.04;
      /* jagged crest — nine soft peaks like the landmark silhouette */
      const seg = t * 9;
      const jag = Math.abs(Math.sin(seg * Math.PI * 0.5 + Math.sin(seg * 2.1) * 0.6));
      pos[i * 3] = x;
      pos[i * 3 + 1] = -0.18 + jag * 0.55 + (Math.random() - 0.5) * 0.05;
      pos[i * 3 + 2] = SWEEP_Z + (Math.random() - 0.5) * 0.14;
      worldX[i] = x;
      scales[i] = 0.6 + Math.random() * 1.2;
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('aWorldX', new THREE.BufferAttribute(worldX, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: sweepVertex,
      fragmentShader: sweepFragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 3.0 },
        uPixelRatio: { value: 1 },
        uOpacity: { value: 0 },
        uSweepX: { value: 0 },
        uWarm: { value: 0 },
        uColorA: { value: new THREE.Color('#e9efff') },
        uColorB: { value: new THREE.Color('#7f96ff') },
      },
    });
    return { geometry, material };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.particles]);

  useEffect(() => {
    return () => {
      sim.geometry.dispose();
      sim.material.dispose();
    };
  }, [sim]);

  useFrame((state) => {
    const m = sim.material;
    const el = state.clock.elapsedTime;
    const warm = animate
      ? smooth(sectionRange(getSectionProgress('angles'), 0.05, 0.85))
      : 1;
    const intro = animate ? smooth(Math.min(el / 1.6, 1)) : 1;
    m.uniforms.uTime.value = el;
    m.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    m.uniforms.uWarm.value = warm;
    /* the crest of light travels the ridge, east to west and back */
    m.uniforms.uSweepX.value = animate
      ? Math.sin(el * 0.11) * SWEEP_HALF_W
      : 0;
    m.uniforms.uOpacity.value = (0.4 + warm * 0.4) * intro;
  });

  return (
    <points geometry={sim.geometry} material={sim.material} frustumCulled={false} />
  );
}

/* hotspot anchor — the ridge crest: sculpture-local (0.1, 0.3) → world */
const ANCHOR: [number, number, number] = [
  0.1 * SKYLINE_SCALE,
  SKYLINE_Y + 0.3 * SKYLINE_SCALE,
  0,
];

/* module-scope temp — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();

export default function SaltLakeCityScene() {
  const q = useQuality();
  const tiltRef = useRef<THREE.Group>(null);
  const glowMatRef = useRef<THREE.PointsMaterial>(null);
  const spireRef = useRef<THREE.Group>(null);
  const anchorRef = useRef<THREE.Group>(null);
  const report = useHotspotReporter('slc-skyline');

  /* Wasatch silhouette target — deterministic per slug, cached by the kit */
  const skyline = useMemo(
    () =>
      skylinePoints(
        'salt-lake-city',
        Math.max(64, Math.round(SKYLINE_COUNT * q.particles)),
      ),
    [q.particles],
  );

  /* alpenglow band — a soft horizontal drift of ice→azure points */
  const glowGeometry = useMemo(() => {
    const n = Math.max(96, Math.round(GLOW_COUNT * q.particles));
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const x = (Math.random() * 2 - 1) * GLOW_SPREAD_X;
      /* soft vertical falloff — average of three uniforms ≈ gaussian */
      const g =
        (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
      const y = GLOW_Y + g * 1.35;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = GLOW_Z + (Math.random() - 0.5) * 0.7;
      /* ice at the top of the band → azure toward the ridge */
      const t = THREE.MathUtils.clamp(0.5 - g * 1.15, 0, 1);
      c.lerpColors(AZURE, ICE, t);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }, [q.particles]);

  /* free the imperatively-created geometry on unmount / quality change */
  useEffect(() => () => glowGeometry.dispose(), [glowGeometry]);

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const angles = anim ? getSectionProgress('angles') : 1;
    const warm = smooth(sectionRange(angles, 0.05, 0.85));
    const intro = anim ? smooth(Math.min(el / 1.6, 1)) : 1;

    /* skyline — slow ±10° sway + pointer tilt (assemble handled by the kit) */
    const tilt = tiltRef.current;
    if (tilt) {
      tilt.rotation.y = anim
        ? Math.sin(el * 0.05) * TILT + pointer.x * 0.04
        : 0;
      tilt.rotation.x = anim ? pointer.y * -0.02 : 0;
    }

    /* the alpenglow warms with `angles` — brightness, never hue */
    const glowMat = glowMatRef.current;
    if (glowMat) {
      const shimmer = anim ? Math.sin(el * 0.7) * 0.04 : 0;
      glowMat.opacity = (0.16 + warm * 0.5 + shimmer) * intro;
    }

    /* the spire marker pops in once the ridge has assembled */
    const spire = spireRef.current;
    if (spire) {
      const pop = anim
        ? smooth(Math.min(Math.max((el - 1.0) / 0.9, 0), 1))
        : 1;
      spire.scale.setScalar(Math.max(pop, 0.001));
    }

    /* hotspot rides the ridge crest */
    const anchor = anchorRef.current;
    if (anchor) report(anchor, state.camera, 0.55 + 0.3 * warm);

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

      {/* the alpenglow — a soft ice→azure band warming behind the ridge */}
      <points geometry={glowGeometry} frustumCulled={false}>
        <pointsMaterial
          ref={glowMatRef}
          size={0.065}
          vertexColors
          transparent
          opacity={0}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* the sweep — a bright crest of alpenglow traveling the ridge line */}
      <RidgeSweep animate={q.animate} />

      {/* the temple-square-ish spire marker at the ridge base */}
      <group ref={spireRef} position={[SPIRE_X, RIDGE_BASE_Y, -0.2]}>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.06, 0.6, 0.06]} />
          <meshBasicMaterial color="#2e4bff" transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, 0.68, 0]}>
          <coneGeometry args={[0.055, 0.16, 4]} />
          <meshBasicMaterial color="#2e4bff" transparent opacity={0.9} />
        </mesh>
      </group>

      <ParticleField
        count={Math.floor(1100 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.28}
      />
    </group>
  );
}
