'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../../shared/SceneLightRig';
import ParticleField from '../../../shared/ParticleField';
import { GlassMaterial } from '../../../../lib/materials';
import { useQuality } from '../../../../lib/quality';
import { pointer } from '../../../../scroll-store';
import { useHotspotReporter } from '../../../../kit/ProximityType';
import { readDwell, clamp01, lerp, easeInOutSine, rng, type DwellBeats } from './signature';

/**
 * VoiceAiScene — "Cymatics".
 *
 * A square glass plate, clamped at its centre, carries a fine layer of blue
 * dust. A voice waveform hovers behind it. In the signature dwell the voice
 * rises: the plate rings, the dust shivers off the vibrating antinodes and
 * gathers on the still nodal lines, drawing a Chladni figure. As the voice
 * climbs in pitch the figure re-forms twice into finer, more intricate modes.
 * Noise becomes structure: an agent that listens and resolves.
 *
 * Targets are real Chladni nodal lines of f = cos(nπX)cos(mπY) − cos(mπX)cos(nπY)
 * (each grain Newton-projected onto f = 0 at mount). The whole event is a
 * pure function of scroll progress, so it rewinds exactly. Reduced motion:
 * the final figure, at rest.
 */

const MODES: [number, number][] = [
  [1, 3],
  [2, 5],
  [3, 7],
];
const HALF = 1.55; // plate half-size (world)
const PLATE_Y = 0.04;

function chladni(n: number, m: number, x: number, y: number) {
  const X = (x + 1) * 0.5;
  const Y = (y + 1) * 0.5;
  const a = n * Math.PI;
  const b = m * Math.PI;
  const f = Math.cos(a * X) * Math.cos(b * Y) - Math.cos(b * X) * Math.cos(a * Y);
  const fx = 0.5 * (-a * Math.sin(a * X) * Math.cos(b * Y) + b * Math.sin(b * X) * Math.cos(a * Y));
  const fy = 0.5 * (-b * Math.cos(a * X) * Math.sin(b * Y) + a * Math.cos(b * X) * Math.sin(a * Y));
  return { f, fx, fy };
}

/** Newton-project (x,y) onto the nodal set f = 0, staying on the plate */
function project(n: number, m: number, x0: number, y0: number, out: Float32Array, o: number) {
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

    /* grains still travelling shiver; grains on a nodal line rest */
    float moving = 4.0 * (s1 * (1.0 - s1) + s2 * (1.0 - s2) + s3 * (1.0 - s3));
    float ring = smoothstep(0.03, 0.12, uPlay) * (1.0 - smoothstep(0.92, 1.0, uPlay));
    float jit = (0.004 + moving * 0.03) * ring;
    p.x += sin(uTime * 41.0 + aSeed * 91.0) * jit;
    p.y += cos(uTime * 37.0 + aSeed * 57.0) * jit;
    vSettle = 1.0 - clamp(moving, 0.0, 1.0);

    float hop = moving * ring * 0.035 * abs(sin(uTime * 23.0 + aSeed * 40.0));
    vec3 world = vec3(p.x * uHalf, hop, p.y * uHalf);
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (0.7 + aSeed * 0.6) * uIntro * (8.0 / -mv.z);
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
    float a = smoothstep(0.5, 0.18, d);
    vec3 col = mix(uLight, uDeep, 0.55 + vSettle * 0.45 * (0.6 + vSeed * 0.4));
    gl_FragColor = vec4(col, a * (0.55 + vSettle * 0.4));
  }
`;

/* module temps */
const _look = new THREE.Vector3();
const beats: DwellBeats = { arrive: 0, play: 0, leave: 0 };
const WAVE_N = 220;

export default function VoiceAiScene() {
  const q = useQuality();
  const stage = useRef<THREE.Group>(null);
  const plate = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const report = useHotspotReporter('voice-core');
  const born = useRef(-1);
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
        /* hairline scatter so the figure has a soft, sanded edge */
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
        uSize: { value: 2.3 },
        uPixelRatio: { value: 1 },
        uIntro: { value: 0 },
        uDeep: { value: new THREE.Color('#1f38e0') },
        uLight: { value: new THREE.Color('#93a9ff') },
      },
    });
    return { g, m };
  }, [count]);

  const wave = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(WAVE_N * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.LineBasicMaterial({ color: '#2e4bff', transparent: true, opacity: 0.8, toneMapped: false });
    const line = new THREE.Line(g, m);
    line.frustumCulled = false;
    return { g, m, pos, line };
  }, []);

  useEffect(
    () => () => {
      dust.g.dispose();
      dust.m.dispose();
      wave.g.dispose();
      wave.m.dispose();
    },
    [dust, wave],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (born.current < 0) born.current = t;
    const animate = q.animate;
    const intro = animate ? easeInOutSine(clamp01((t - born.current) / 1.8)) : 1;
    readDwell('signature', beats);
    const play = animate ? beats.play : 1;
    const arrive = animate ? easeInOutSine(beats.arrive) : 1;
    const leave = animate ? easeInOutSine(beats.leave) : 0;
    const tt = animate ? t : 0;

    const u = dust.m.uniforms;
    u.uPlay.value = play;
    u.uTime.value = tt;
    u.uIntro.value = intro;
    u.uPixelRatio.value = state.gl.getPixelRatio();

    /* voice: amplitude rises with the dwell, pitch climbs with each mode */
    const voice = animate ? clamp01(play * 6) * (1 - clamp01((play - 0.94) * 16)) : 0.35;
    const pitch = 3 + clamp01(play / 0.4) * 2 + clamp01((play - 0.4) / 0.3) * 3 + clamp01((play - 0.7) / 0.2) * 3;
    for (let i = 0; i < WAVE_N; i++) {
      const s = i / (WAVE_N - 1);
      const x = (s * 2 - 1) * HALF * 1.05;
      const env = Math.sin(Math.PI * s) ** 1.6;
      const speech =
        0.55 + 0.45 * Math.sin(tt * 1.7 + s * 3.1) * Math.sin(tt * 0.63 + 1.3 + s * 1.7);
      const amp = (0.025 + voice * 0.32 * speech) * env;
      const y = Math.sin(s * pitch * Math.PI * 2 - tt * 5.5) * amp + Math.sin(s * pitch * 5.3 - tt * 8.1) * amp * 0.25;
      wave.pos[i * 3] = x;
      wave.pos[i * 3 + 1] = y;
      wave.pos[i * 3 + 2] = 0;
    }
    (wave.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    wave.m.opacity = (0.35 + voice * 0.55) * intro;

    /* plate rings: a hair of vertical buzz while the voice is loud */
    if (plate.current) {
      plate.current.position.y = animate ? Math.sin(t * 60) * 0.004 * voice : 0;
    }
    if (core.current) core.current.scale.setScalar(1 + voice * 0.12 * (0.5 + 0.5 * Math.sin(tt * 9)));

    /* placement: hero right → centre stage → retire right/back */
    const g = stage.current;
    if (g) {
      const hx = q.compact ? 0 : 2.35;
      const hy = q.compact ? -1.5 : -0.55;
      g.position.set(
        lerp(lerp(hx, 0.35, arrive), q.compact ? 0 : 2.6, leave),
        lerp(lerp(hy, -0.55, arrive), -0.4, leave),
        lerp(lerp(-1.4, 0, arrive), -3, leave),
      );
      g.scale.setScalar((q.compact ? 0.62 : 1) * lerp(0.72, 1, arrive) * intro);
      const px = animate ? pointer.x : 0;
      const py = animate ? pointer.y : 0;
      g.rotation.y += (lerp(-0.62, -0.25, arrive) + px * 0.14 + (animate ? Math.sin(t * 0.1) * 0.05 : 0) - g.rotation.y) * 0.05;
      g.rotation.x += (-py * 0.06 - g.rotation.x) * 0.05;
    }

    if (core.current) report(core.current, state.camera, 0.5 + voice * 0.45);

    /* camera: look down onto the plate so the figure reads */
    const cam = state.camera;
    const cy = lerp(lerp(1.4, 4.4, arrive), 1.4, leave);
    const cz = lerp(lerp(9, 7.6, arrive), 9, leave) + (q.compact ? 3.4 : 0);
    if (animate) {
      cam.position.x += (pointer.x * 0.25 - cam.position.x) * 0.05;
      cam.position.y += (cy + pointer.y * 0.15 - cam.position.y) * 0.05;
      cam.position.z += (cz - cam.position.z) * 0.05;
    } else {
      cam.position.set(0, 4.4, 7.6 + (q.compact ? 3.4 : 0));
    }
    _look.set(lerp(q.compact ? 0 : 1.2, 0.35, arrive) * (1 - leave) + (q.compact ? 0 : 1.3) * leave, -0.45, 0);
    cam.lookAt(_look);
  });

  return (
    <group>
      <SceneLightRig />
      <ParticleField count={Math.floor(1100 * q.particles)} drift={q.animate ? 0.1 : 0} opacity={0.28} />
      <group ref={stage} position={[2.35, -0.55, -1.4]}>
        <group ref={plate}>
          <RoundedBox args={[HALF * 2, 0.05, HALF * 2]} radius={0.02} smoothness={3} position={[0, PLATE_Y - 0.03, 0]}>
            <GlassMaterial kind="ice" thickness={0.3} />
          </RoundedBox>
          <points geometry={dust.g} material={dust.m} position={[0, PLATE_Y, 0]} frustumCulled={false} />
        </group>
        {/* the clamp at the plate's centre */}
        <mesh position={[0, -0.32, 0]}>
          <cylinderGeometry args={[0.035, 0.05, 0.6, 24]} />
          <GlassMaterial kind="azure" />
        </mesh>
        <mesh ref={core} position={[0, -0.66, 0]}>
          <sphereGeometry args={[0.1, 32, 32]} />
          <GlassMaterial kind="deep" />
        </mesh>
        {/* the voice, hovering behind the plate */}
        <primitive object={wave.line} position={[0, 0.75, -HALF - 0.25]} />
      </group>
    </group>
  );
}
