'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../../shared/SceneLightRig';
import ParticleField from '../../../shared/ParticleField';
import { GlassMaterial } from '../../../../lib/materials';
import { useQuality } from '../../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../../scroll-store';
import { useHotspotReporter } from '../../../../kit/ProximityType';
import {
  readDwell,
  clamp01,
  lerp,
  easeInOutSine,
  rng,
  type DwellBeats,
} from './signature';

/**
 * VoiceAiScene — "Cymatics".
 *
 * A square optical-glass resonator plate clamped onto a sapphire acoustic
 * transducer, carrying thousands of fine blue grains, framed by dual harmonic
 * voice ribbons and concentric prism pressure rings. Across the 280vh
 * `signature` dwell, as the voice climbs in pitch, the grains shiver off the
 * vibrating antinodes and settle onto three successively finer Newton-projected
 * Chladni nodal modes ([1,3] → [2,5] → [3,7]).
 *
 * Continues choreographing camera + stage through `feature` (oblique inspection
 * of the settled [3,7] nodal figure), `detail` (transducer focus), `faq`, and
 * `cta`. Hotspot 'voice-core' rides the sapphire acoustic core.
 * Zero allocations in useFrame; reduced motion renders the final figure at rest.
 */

const MODES: [number, number][] = [
  [1, 3],
  [2, 5],
  [3, 7],
];
const HALF = 1.55;
const PLATE_Y = 0.04;

function chladni(n: number, m: number, x: number, y: number) {
  const X = (x + 1) * 0.5;
  const Y = (y + 1) * 0.5;
  const a = n * Math.PI;
  const b = m * Math.PI;
  const f = Math.cos(a * X) * Math.cos(b * Y) - Math.cos(b * X) * Math.cos(a * Y);
  const fx =
    0.5 * (-a * Math.sin(a * X) * Math.cos(b * Y) + b * Math.sin(b * X) * Math.cos(a * Y));
  const fy =
    0.5 * (-b * Math.cos(a * X) * Math.sin(b * Y) + a * Math.cos(b * X) * Math.sin(a * Y));
  return { f, fx, fy };
}

function project(
  n: number,
  m: number,
  x0: number,
  y0: number,
  out: Float32Array,
  o: number,
) {
  let x = x0;
  let y = y0;
  for (let k = 0; k < 24; k++) {
    const { f, fx, fy } = chladni(n, m, x, y);
    const g2 = fx * fx + fy * fy + 1e-4;
    const s = Math.min(0.12, Math.abs(f) / Math.sqrt(g2)) / Math.sqrt(g2);
    x -= Math.sign(f) * fx * s;
    y -= Math.sign(f) * fy * s;
    x = Math.max(-0.97, Math.min(0.97, x));
    y = Math.max(-0.97, Math.min(0.97, y));
  }
  out[o] = x;
  out[o + 1] = y;
}

const dustVert = /* glsl */ `
  attribute vec2 aStart;
  attribute vec2 aT1;
  attribute vec2 aT2;
  attribute vec2 aT3;
  attribute float aSeed;
  uniform float uPlay;
  uniform float uTime;
  uniform float uHalf;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uIntro;
  varying float vSettle;
  varying float vSeed;

  float stage(float a, float b, float seed) {
    float d = seed * 0.06;
    return smoothstep(a + d, b + d, uPlay);
  }

  void main() {
    vSeed = aSeed;
    float s1 = stage(0.08, 0.30, aSeed);
    float s2 = stage(0.40, 0.60, aSeed);
    float s3 = stage(0.70, 0.90, aSeed);
    vec2 p = mix(aStart, aT1, s1);
    p = mix(p, aT2, s2);
    p = mix(p, aT3, s3);

    float moving = 4.0 * (s1 * (1.0 - s1) + s2 * (1.0 - s2) + s3 * (1.0 - s3));
    float ring = smoothstep(0.03, 0.12, uPlay) * (1.0 - smoothstep(0.92, 1.0, uPlay));
    float jit = (0.004 + moving * 0.03) * ring;
    p.x += sin(uTime * 41.0 + aSeed * 91.0) * jit;
    p.y += cos(uTime * 37.0 + aSeed * 57.0) * jit;
    vSettle = 1.0 - clamp(moving, 0.0, 1.0);

    float hop = moving * ring * 0.038 * abs(sin(uTime * 23.0 + aSeed * 40.0));
    vec3 world = vec3(p.x * uHalf, hop, p.y * uHalf);
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (0.72 + aSeed * 0.62) * uIntro * (8.2 / -mv.z);
  }
`;

const dustFrag = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uLight;
  varying float vSettle;
  varying float vSeed;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.16, d);
    vec3 col = mix(uLight, uDeep, 0.52 + vSettle * 0.48 * (0.6 + vSeed * 0.4));
    gl_FragColor = vec4(col, a * (0.58 + vSettle * 0.42));
  }
`;

/* module temps — zero allocations in useFrame */
const _look = new THREE.Vector3();
const _cam = new THREE.Vector3();
const beats: DwellBeats = { arrive: 0, play: 0, leave: 0 };
const WAVE_N = 220;

export default function VoiceAiScene() {
  const q = useQuality();
  const stage = useRef<THREE.Group>(null);
  const plate = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);
  const report = useHotspotReporter('voice-core');
  const born = useRef<number | null>(null);
  const count = Math.max(2600, Math.floor(9000 * q.particles));

  const dust = useMemo(() => {
    const r = rng(7031);
    const start = new Float32Array(count * 2);
    const t1 = new Float32Array(count * 2);
    const t2 = new Float32Array(count * 2);
    const t3 = new Float32Array(count * 2);
    const seed = new Float32Array(count);
    const pos = new Float32Array(count * 3);
    const targets = [t1, t2, t3];
    for (let i = 0; i < count; i++) {
      const x = r() * 1.94 - 0.97;
      const y = r() * 1.94 - 0.97;
      start[i * 2] = x;
      start[i * 2 + 1] = y;
      seed[i] = r();
      for (let k = 0; k < 3; k++) {
        project(MODES[k][0], MODES[k][1], x, y, targets[k], i * 2);
        targets[k][i * 2] += (r() - 0.5) * 0.018;
        targets[k][i * 2 + 1] += (r() - 0.5) * 0.018;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aStart', new THREE.BufferAttribute(start, 2));
    g.setAttribute('aT1', new THREE.BufferAttribute(t1, 2));
    g.setAttribute('aT2', new THREE.BufferAttribute(t2, 2));
    g.setAttribute('aT3', new THREE.BufferAttribute(t3, 2));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), HALF * 2);
    const m = new THREE.ShaderMaterial({
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uPlay: { value: 0 },
        uTime: { value: 0 },
        uHalf: { value: HALF },
        uSize: { value: 2.35 },
        uPixelRatio: { value: 1 },
        uIntro: { value: 0 },
        uDeep: { value: new THREE.Color('#1f38e0') },
        uLight: { value: new THREE.Color('#93a9ff') },
      },
    });
    return { g, m };
  }, [count]);

  const waves = useMemo(() => {
    const buildLine = (color: string) => {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(WAVE_N * 3);
      g.setAttribute(
        'position',
        new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage),
      );
      const m = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        toneMapped: false,
      });
      const line = new THREE.Line(g, m);
      line.frustumCulled = false;
      return { g, m, pos, line };
    };
    return { a: buildLine('#2e4bff'), b: buildLine('#93a9ff') };
  }, []);

  useEffect(
    () => () => {
      dust.g.dispose();
      dust.m.dispose();
      waves.a.g.dispose();
      waves.a.m.dispose();
      waves.b.g.dispose();
      waves.b.m.dispose();
    },
    [dust, waves],
  );

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (born.current === null) born.current = now;
    const el = now - born.current;
    const animate = q.animate;
    const intro = animate ? easeInOutSine(clamp01(el / 1.7)) : 1;

    readDwell('signature', beats);
    const feat = smooth(sectionRange(getSectionProgress('feature'), 0.04, 0.92));
    const det = smooth(sectionRange(getSectionProgress('detail'), 0.08, 0.88));
    const faq = smooth(sectionRange(getSectionProgress('faq'), 0.06, 0.9));
    const cta = smooth(sectionRange(getSectionProgress('cta'), 0.06, 0.85));

    /* retain the resolved [3,7] Chladni figure once the signature dwell finishes */
    const play = animate ? Math.max(beats.play, beats.leave > 0 ? 1 : 0) : 1;
    const arrive = animate ? easeInOutSine(beats.arrive) : 1;
    const leave = animate ? easeInOutSine(beats.leave) : 0;
    const tt = animate ? el : 0;

    const u = dust.m.uniforms;
    u.uPlay.value = play;
    u.uTime.value = tt;
    u.uIntro.value = intro;
    u.uPixelRatio.value = state.gl.getPixelRatio();

    /* voice amplitude: active across the dwell, calm conversational hum below */
    const dwellVoice =
      clamp01(beats.play * 6) * (1 - clamp01((beats.play - 0.94) * 16));
    const voice = animate ? Math.max(dwellVoice, leave * 0.28) : 0.35;
    const pitch =
      3 +
      clamp01(play / 0.4) * 2 +
      clamp01((play - 0.4) / 0.3) * 3 +
      clamp01((play - 0.7) / 0.2) * 3;

    for (let i = 0; i < WAVE_N; i++) {
      const s = i / (WAVE_N - 1);
      const x = (s * 2 - 1) * HALF * 1.06;
      const env = Math.sin(Math.PI * s) ** 1.6;
      const speech =
        0.55 +
        0.45 * Math.sin(tt * 1.7 + s * 3.1) * Math.sin(tt * 0.63 + 1.3 + s * 1.7);
      const amp = (0.025 + voice * 0.32 * speech) * env;
      const yA =
        Math.sin(s * pitch * Math.PI * 2 - tt * 5.5) * amp +
        Math.sin(s * pitch * 5.3 - tt * 8.1) * amp * 0.25;
      const yB =
        Math.cos(s * (pitch * 0.85) * Math.PI * 2 - tt * 4.2 + 0.9) * amp * 0.68;

      waves.a.pos[i * 3] = x;
      waves.a.pos[i * 3 + 1] = yA;
      waves.a.pos[i * 3 + 2] = 0;

      waves.b.pos[i * 3] = x;
      waves.b.pos[i * 3 + 1] = yB;
      waves.b.pos[i * 3 + 2] = -0.08;
    }
    (waves.a.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (waves.b.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    waves.a.m.opacity = (0.38 + voice * 0.54) * intro;
    waves.b.m.opacity = (0.22 + voice * 0.36) * intro;

    if (plate.current) {
      plate.current.position.y = animate ? Math.sin(el * 60) * 0.004 * dwellVoice : 0;
    }

    if (core.current) {
      const swell = 1 + voice * 0.14 * (0.5 + 0.5 * Math.sin(tt * 9)) + det * 0.12;
      core.current.scale.setScalar(swell * Math.max(intro, 0.001));
      report(core.current, state.camera, 0.52 + voice * 0.42 + det * 0.12);
    }
    if (coreMat.current) {
      coreMat.current.emissiveIntensity = 0.38 + voice * 0.85 + det * 0.35;
    }

    /* concentric acoustic pressure rings around the transducer */
    if (ringARef.current) {
      ringARef.current.scale.setScalar(
        Math.max(intro * (0.95 + voice * 0.22), 0.001),
      );
      ringARef.current.rotation.x = Math.PI / 2 + (animate ? Math.sin(el * 1.4) * 0.12 : 0);
    }
    if (ringBRef.current) {
      ringBRef.current.scale.setScalar(
        Math.max(intro * (0.92 + voice * 0.32), 0.001),
      );
      ringBRef.current.rotation.x = Math.PI / 2 - (animate ? Math.cos(el * 1.1) * 0.14 : 0);
    }

    /* stage choreography: hero right → dwell centre → feature/detail oblique inspection */
    const g = stage.current;
    if (g) {
      const hx = q.compact ? 0 : 2.3;
      const hy = q.compact ? -1.4 : -0.52;
      const postX = q.compact ? 0 : 1.95 - det * 0.45 + cta * 0.3;
      const postY = -0.35 + det * 0.28 - faq * 0.15;
      const postZ = -1.6 + feat * 0.45 + det * 0.65 - cta * 0.7;

      g.position.set(
        lerp(lerp(hx, 0.35, arrive), postX, leave),
        lerp(lerp(hy, -0.52, arrive), postY, leave) - (1 - intro) * 0.5,
        lerp(lerp(-1.35, 0, arrive), postZ, leave),
      );
      g.scale.setScalar(
        (q.compact ? 0.64 : 1) * lerp(0.75, 1, arrive) * (0.88 + 0.12 * intro),
      );
      const px = animate ? pointer.x : 0;
      const py = animate ? pointer.y : 0;
      const targetRY =
        lerp(-0.58, -0.24, arrive) +
        leave * (-0.18 + feat * 0.22 - det * 0.15) +
        px * 0.14 +
        (animate ? Math.sin(el * 0.1) * 0.05 : 0);
      const targetRX = -py * 0.06 + leave * (0.22 * feat - 0.18 * det);
      if (animate) {
        g.rotation.y += (targetRY - g.rotation.y) * 0.05;
        g.rotation.x += (targetRX - g.rotation.x) * 0.05;
      } else {
        g.rotation.set(0, -0.24, 0);
      }
    }

    /* camera choreography across hero → signature → feature → detail → faq/cta */
    const cam = state.camera;
    const postCy = 2.65 - det * 1.45 + faq * 0.85 + cta * 0.9;
    const cy = lerp(lerp(1.5, 4.4, arrive), postCy, leave);
    const postCz = 8.4 - feat * 0.45 - det * 0.75 + cta * 0.85;
    const cz =
      lerp(lerp(9.0, 7.5, arrive), postCz, leave) +
      (q.compact ? 3.4 : 0) +
      (1 - intro) * 1.3;

    _cam.set(
      (animate ? pointer.x * 0.26 : 0) - det * 0.22,
      cy + (animate ? pointer.y * 0.16 : 0),
      cz,
    );
    const lookX =
      lerp(q.compact ? 0 : 1.2, 0.35, arrive) * (1 - leave) +
      (q.compact ? 0 : 1.05 - det * 0.25) * leave;
    const lookY = -0.45 - det * 0.12 * leave;

    if (animate) {
      cam.position.lerp(_cam, 0.05);
      _look.x += (lookX - _look.x) * 0.055;
      _look.y += (lookY - _look.y) * 0.055;
      _look.z = 0;
    } else {
      cam.position.set(0, 4.4, 7.5 + (q.compact ? 3.4 : 0));
      _look.set(q.compact ? 0 : 0.35, -0.45, 0);
    }
    cam.lookAt(_look);
  });

  return (
    <group>
      <SceneLightRig />
      <ParticleField
        count={Math.floor(1100 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.28}
      />
      <group ref={stage} position={[2.3, -0.52, -1.35]}>
        <group ref={plate}>
          {/* optical resonator plate + bevelled crystal rim */}
          <RoundedBox
            args={[HALF * 2, 0.052, HALF * 2]}
            radius={0.024}
            smoothness={4}
            position={[0, PLATE_Y - 0.03, 0]}
          >
            <GlassMaterial kind="ice" thickness={0.38} />
          </RoundedBox>
          <RoundedBox
            args={[HALF * 2 + 0.12, 0.024, HALF * 2 + 0.12]}
            radius={0.012}
            smoothness={3}
            position={[0, PLATE_Y - 0.045, 0]}
          >
            <GlassMaterial kind="pane" />
          </RoundedBox>
          {/* central clamping jewel */}
          <mesh position={[0, PLATE_Y + 0.008, 0]}>
            <cylinderGeometry args={[0.085, 0.095, 0.028, 32]} />
            <GlassMaterial kind="prism" />
          </mesh>
          <points
            geometry={dust.g}
            material={dust.m}
            position={[0, PLATE_Y, 0]}
            frustumCulled={false}
          />
        </group>

        {/* acoustic transducer stem + sapphire core + concentric pressure rings */}
        <mesh position={[0, -0.32, 0]}>
          <cylinderGeometry args={[0.038, 0.055, 0.62, 24]} />
          <GlassMaterial kind="azure" />
        </mesh>
        <mesh ref={core} position={[0, -0.68, 0]}>
          <sphereGeometry args={[0.12, 32, 32]} />
          <GlassMaterial
            ref={coreMat}
            kind="deep"
            emissive="#2e4bff"
            emissiveIntensity={0.45}
          />
        </mesh>
        <mesh ref={ringARef} position={[0, -0.48, 0]}>
          <torusGeometry args={[0.36, 0.011, 14, 64]} />
          <GlassMaterial kind="prism" />
        </mesh>
        <mesh ref={ringBRef} position={[0, -0.68, 0]}>
          <torusGeometry args={[0.56, 0.009, 14, 64]} />
          <GlassMaterial kind="azure" />
        </mesh>

        {/* dual harmonic voice ribbons hovering behind the resonator */}
        <primitive object={waves.a.line} position={[0, 0.78, -HALF - 0.25]} />
        <primitive object={waves.b.line} position={[0, 0.78, -HALF - 0.25]} />
      </group>
    </group>
  );
}
