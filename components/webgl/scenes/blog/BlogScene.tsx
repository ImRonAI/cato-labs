'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { GlassMaterial } from '../../lib/materials';
import { useQuality } from '../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../scroll-store';
import { useHotspotReporter } from '../../kit/ProximityType';
import { COVER_WINDOW, PAGE_DUR, pageStart } from './pages';

/**
 * BlogScene — "Pages Turning".
 *
 * A glass-bound journal lies open on the light. Through `hero` the front board
 * breathes slightly ajar; through the pinned `pages` dwell its deep-glass
 * cover swings open and the leaves turn one after another — each lifting at
 * the corner first, curling analytically through the turn and settling flat on
 * the growing left-hand stack. Across `feature` the open journal recedes softly
 * behind the index, then re-poises as a calm open volume across `cta`.
 *
 * Zero allocations in useFrame; mount-relative intro; reduced motion renders
 * the open mid-volume immediately.
 */

const PW = 1.32;
const PH = 1.82;
const R_REST = 0.2;
const L_REST = Math.PI - 0.2;
const FAN = 0.011;

const PIN_FROM = 0.25;
const PIN_TO = 0.75;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const leafVertex = /* glsl */ `
  uniform float uTheta;
  uniform float uBend;
  uniform float uLead;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vS;
  void main() {
    vUv = uv;
    float s = position.x;
    float y = position.y;
    float th = uTheta + uLead * (y / ${PH.toFixed(3)} + 0.5) * (s / ${PW.toFixed(3)});
    float c = uBend;
    float phi = th - c * s;
    vec3 p;
    if (abs(c) < 1e-4) {
      p = vec3(cos(th) * s, y, sin(th) * s);
    } else {
      p = vec3((sin(th) - sin(phi)) / c, y, (cos(phi) - cos(th)) / c);
    }
    vec3 n = vec3(-sin(phi), 0.0, cos(phi));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewPos = mv.xyz;
    vNormalV = normalize(normalMatrix * n);
    vS = s / ${PW.toFixed(3)};
    gl_Position = projectionMatrix * mv;
  }
`;

const leafFragment = /* glsl */ `
  uniform float uSeed;
  uniform vec3 uPaper;
  uniform vec3 uInk;
  uniform vec3 uRim;
  uniform vec2 uLight;
  uniform float uFade;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vS;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float print(vec2 uv, float seed) {
    vec2 m = vec2(0.16, 0.12);
    if (uv.x < m.x || uv.x > 1.0 - m.x * 0.8 || uv.y < m.y || uv.y > 1.0 - m.y) return 0.0;
    vec2 q = vec2((uv.x - m.x) / (1.0 - m.x * 1.8), (uv.y - m.y) / (1.0 - m.y * 2.0));
    float rows = 22.0;
    float r = floor((1.0 - q.y) * rows);
    float f = fract((1.0 - q.y) * rows);
    float headed = step(0.55, hash(vec2(seed, 7.0)));
    float bar = 0.18;
    float len = mix(0.72, 1.0, hash(vec2(seed, r)));
    if (headed > 0.5 && r < 2.0) { bar = 0.46; len = r < 1.0 ? 0.82 : 0.5; }
    if (headed > 0.5 && r == 2.0) return 0.0;
    if (mod(r + floor(seed * 3.0), 9.0) == 8.0) len *= 0.42;
    if (mod(r + floor(seed * 3.0), 9.0) == 0.0 && r > 2.0) return 0.0;
    float line = step(abs(f - 0.5), bar * 0.5) * step(q.x, len);
    return line * (headed > 0.5 && r < 2.0 ? 1.0 : 0.55);
  }

  void main() {
    vec3 N = normalize(vNormalV);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(-vViewPos);
    vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
    float seed = uSeed + (gl_FrontFacing ? 0.0 : 0.5);

    float ink = print(uv, seed);
    vec3 col = mix(uPaper, uInk, ink * 0.9);

    vec3 L = normalize(vec3(uLight * 0.8, 1.0));
    float diff = 0.82 + 0.18 * max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 48.0) * 0.22;
    col = col * diff + vec3(0.92, 0.95, 1.0) * spec;

    col *= mix(0.86, 1.0, smoothstep(0.0, 0.16, vS));
    float fres = pow(1.0 - abs(dot(N, V)), 2.4);
    col = mix(col, uRim, fres * 0.55);

    float edge = 1.0 - smoothstep(0.0, 0.008, min(min(uv.y, 1.0 - uv.y), 1.0 - uv.x));
    col = mix(col, uRim, edge * 0.7);

    gl_FragColor = vec4(col * uFade + vec3(0.98, 0.985, 1.0) * (1.0 - uFade), 1.0);
  }
`;

/* module-scope temps */
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();

export default function BlogScene() {
  const q = useQuality();
  const leaves = q.compact ? 7 : 9;
  const startAt = useRef<number | null>(null);
  const book = useRef<THREE.Group>(null);
  const coverPivot = useRef<THREE.Group>(null);
  const report = useHotspotReporter('blog-cards');

  const { geometry, materials } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(PW, PH, 36, 6);
    geometry.translate(PW / 2, 0, 0);
    const materials = Array.from(
      { length: leaves },
      (_, i) =>
        new THREE.ShaderMaterial({
          vertexShader: leafVertex,
          fragmentShader: leafFragment,
          side: THREE.DoubleSide,
          uniforms: {
            uTheta: { value: R_REST },
            uBend: { value: 0 },
            uLead: { value: 0 },
            uSeed: { value: 0.137 + i * 0.731 },
            uPaper: { value: new THREE.Color('#f3f6ff') },
            uInk: { value: new THREE.Color(i === 0 ? '#2e4bff' : '#8fa5ff') },
            uRim: { value: new THREE.Color('#a9bbff') },
            uLight: { value: new THREE.Vector2() },
            uFade: { value: 1 },
          },
        }),
    );
    return { geometry, materials };
  }, [leaves]);
  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((m) => m.dispose());
    },
    [geometry, materials],
  );

  useFrame((state) => {
    if (startAt.current === null) startAt.current = state.clock.elapsedTime;
    const el = state.clock.elapsedTime - startAt.current;
    const anim = q.animate;
    const g = book.current;
    if (!g) return;

    const hero = anim ? getSectionProgress('hero') : 1;
    const p = anim
      ? sectionRange(getSectionProgress('pages'), PIN_FROM, PIN_TO)
      : 0.55;
    const feature = anim ? getSectionProgress('feature') : 0;
    const cta = anim ? getSectionProgress('cta') : 0;

    const heroLead = smooth(sectionRange(hero, 0.45, 0.98));
    const recedeIn = smooth(sectionRange(feature, 0.02, 0.42));
    const ctaReturn = smooth(sectionRange(cta, 0.08, 0.75));
    const recede = anim ? recedeIn * (1 - ctaReturn * 0.55) : 0;

    const intro = anim ? smooth(Math.min(el / 1.9, 1)) : 1;
    const compact = q.compact;

    const open = smooth(
      clamp01((p - COVER_WINDOW[0]) / (COVER_WINDOW[1] - COVER_WINDOW[0])),
    );
    const tx = compact
      ? -0.66 * open + 0.1
      : 2.05 - open * 1.05 + recede * 0.6 + ctaReturn * 0.2;
    const tiltX = -1.02 + ctaReturn * 0.08 + (anim ? pointer.y * 0.06 : 0);
    const tiltZ = 0.07 - ctaReturn * 0.03 + (anim ? -pointer.x * 0.05 : 0);

    if (anim) {
      g.position.x += (tx - g.position.x) * 0.06;
      g.rotation.x += (tiltX - g.rotation.x) * 0.05;
      g.rotation.z += (tiltZ - g.rotation.z) * 0.05;
    } else {
      g.position.x = tx;
      g.rotation.x = tiltX;
      g.rotation.z = tiltZ;
    }
    g.position.y =
      (compact ? -1.0 : -0.25) + recede * 1.2 - (1 - intro) * 0.95;
    g.position.z = -recede * 4;
    g.scale.setScalar(compact ? 0.62 : 1);

    /* the front cover */
    const cover = coverPivot.current;
    if (cover) {
      const closed = R_REST + FAN * (leaves + 1.5);
      const u = easeInOut(
        clamp01((p - COVER_WINDOW[0]) / (COVER_WINDOW[1] - COVER_WINDOW[0])),
      );
      const heroCrack = heroLead * 0.07 * (1 - u);
      const phi = closed + heroCrack + (L_REST + 0.03 - closed) * u;
      cover.rotation.y = -phi;
      cover.scale.setScalar(Math.max(intro, 0.001));
    }

    /* the leaves */
    const lx = anim ? pointer.x : 0;
    const ly = anim ? pointer.y : 0.3;
    for (let i = 0; i < leaves; i++) {
      const m = materials[i];
      const s0 = pageStart(i, leaves);
      const u = clamp01((p - s0) / PAGE_DUR);
      const e = easeInOut(u);
      const arc = Math.sin(Math.PI * u);
      const right = R_REST + FAN * (leaves - i);
      const left = L_REST - FAN * (i + 1);
      m.uniforms.uTheta.value = right + (left - right) * e;
      m.uniforms.uBend.value = (arc * 0.85) / PW;
      m.uniforms.uLead.value = arc * 0.32;
      m.uniforms.uLight.value.set(lx, ly);
      m.uniforms.uFade.value = intro;
    }

    if (cover) {
      report(
        cover,
        state.camera,
        (0.45 + 0.35 * open) * intro * (1 - recede * 0.7),
      );
    }

    /* camera: quiet push as the book opens, gentle poise on cta */
    _cam.set(
      anim ? pointer.x * 0.35 : 0,
      0.35 + ctaReturn * 0.1 + (anim ? pointer.y * 0.2 : 0),
      (compact ? 11 : 9.3) - open * 0.5 + ctaReturn * 0.35 - intro * 0.3,
    );
    if (anim) state.camera.position.lerp(_cam, 0.05);
    else state.camera.position.copy(_cam);

    _look.set(compact ? 0 : 0.75, compact ? -0.7 : -0.15, 0);
    state.camera.lookAt(_look);
  });

  const coverW = PW + 0.05;
  const coverH = PH + 0.08;

  return (
    <group>
      <SceneLightRig />
      <group ref={book}>
        {/* spine */}
        <mesh position={[0, 0, -0.012]}>
          <cylinderGeometry args={[0.03, 0.03, coverH, 20]} />
          <GlassMaterial kind="deep" />
        </mesh>
        {/* back board, under the right-hand stack */}
        <group rotation-y={-(R_REST - 0.03)}>
          <RoundedBox
            args={[coverW, coverH, 0.028]}
            radius={0.012}
            smoothness={3}
            position={[coverW / 2, 0, -0.018]}
          >
            <GlassMaterial kind="azure" />
          </RoundedBox>
        </group>
        {/* front board — swings open */}
        <group ref={coverPivot}>
          <RoundedBox
            args={[coverW, coverH, 0.028]}
            radius={0.012}
            smoothness={3}
            position={[coverW / 2, 0, 0.018]}
          >
            <GlassMaterial kind="deep" />
          </RoundedBox>
        </group>
        {materials.map((m, i) => (
          <mesh
            key={i}
            geometry={geometry}
            material={m}
            frustumCulled={false}
          />
        ))}
      </group>
      <ParticleField
        count={Math.floor(1300 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.3}
      />
    </group>
  );
}
