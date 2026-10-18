'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import { pointer, smooth } from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { createStageState, readStage, damp } from '../lib-a/dwell';
import { placeStage, type Placement } from '../lib-a/place';

/**
 * PalmSpringsScene — "Breeze-block shadows".
 *
 * A mid-century breeze-block screen of ice-blue glass stands a hand's width
 * in front of a paper-white wall. A deep-blue sun travels an arc across the
 * sky as the `moment` dwell scrolls; its shadow pattern is computed exactly
 * from the same block function that cuts the screen, so the shadows slide,
 * stretch and rake across the wall the way the afternoon does on a desert
 * modern house. Scroll up and the sun sets back where it rose.
 *
 * Pointer: the sun leans toward the cursor and the shadows answer.
 * Reduced motion: late-afternoon light, long raking shadows, held still.
 */

const WALL_W = 5.4;
const WALL_H = 3.4;
const SCREEN_W = 3.15;
const SCREEN_H = 2.25;
const GAP = 0.55;
const CELLS_X = 7;
const CELLS_Y = 5;
const SCREEN_CX = -0.35;
const SCREEN_CY = -0.12;

/* the breeze block: a square frame, a round opening with a solid
   four-point star at its centre — the classic Palm Springs screen */
const BLOCK_GLSL = /* glsl */ `
  float block(vec2 uv) {
    vec2 c = fract(uv) - 0.5;
    float frame = step(0.43, max(abs(c.x), abs(c.y)));
    float r = length(c);
    float ring = 1.0 - step(0.38, r);
    vec2 a = abs(c);
    float star = step(a.x + a.y, 0.17) + step(max(a.x, a.y), 0.055);
    float hole = ring * (1.0 - clamp(star, 0.0, 1.0));
    return max(frame, 1.0 - hole);
  }
`;

const wallVertex = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const wallFragment = /* glsl */ `
  uniform vec3 uSun;
  uniform vec2 uScreenC;
  uniform vec2 uScreenHalf;
  uniform vec2 uCells;
  uniform float uGap;
  uniform vec2 uHalf;
  uniform float uOpacity;
  varying vec2 vPos;
  ${BLOCK_GLSL}

  float occluded(vec2 p) {
    /* march from the wall toward the sun to the screen plane */
    vec2 q = p + uSun.xy * (uGap / max(uSun.z, 0.05));
    vec2 local = (q - uScreenC) / uScreenHalf;
    if (abs(local.x) > 1.0 || abs(local.y) > 1.0) return 0.0;
    return block((local * 0.5 + 0.5) * uCells);
  }

  void main() {
    /* soft penumbra: a small disc of taps, wider the lower the sun */
    float spread = 0.012 + (1.0 - uSun.z) * 0.02;
    float s = 0.0;
    s += occluded(vPos);
    s += occluded(vPos + vec2( spread, 0.0));
    s += occluded(vPos + vec2(-spread, 0.0));
    s += occluded(vPos + vec2(0.0,  spread));
    s += occluded(vPos + vec2(0.0, -spread));
    s /= 5.0;

    float lit = clamp(uSun.z * 0.9 + 0.25, 0.0, 1.0);
    vec3 paper = vec3(0.984, 0.988, 1.0);
    vec3 shade = vec3(0.70, 0.76, 1.0);
    vec3 deep = vec3(0.36, 0.45, 1.0);
    vec3 col = mix(paper * (0.94 + 0.06 * lit), mix(shade, deep, 0.35 * (1.0 - lit)), s * 0.85);

    /* plaster grain, very fine */
    float grain = fract(sin(dot(floor(vPos * 260.0), vec2(12.9898, 78.233))) * 43758.5453);
    col -= grain * 0.012;

    /* the wall melts into the paper at its edges */
    vec2 e = abs(vPos) / uHalf;
    float edge = (1.0 - smoothstep(0.78, 1.0, e.x)) * (1.0 - smoothstep(0.7, 1.0, e.y));
    gl_FragColor = vec4(col, edge * uOpacity);
  }
`;

const screenVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const screenFragment = /* glsl */ `
  uniform vec2 uCells;
  uniform vec3 uSun;
  uniform float uShade;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  ${BLOCK_GLSL}
  void main() {
    vec2 uv = vUv * uCells;
    if (block(uv) < 0.5) discard;
    vec2 c = fract(uv) - 0.5;
    /* a bevel catches the sun on the edges of every opening */
    float r = length(c);
    float bevel = smoothstep(0.38, 0.41, r) * (1.0 - smoothstep(0.41, 0.46, r));
    float sunSide = clamp(dot(normalize(c + 1e-4), -uSun.xy) * 0.5 + 0.5, 0.0, 1.0);
    float fres = pow(1.0 - abs(dot(vN, vView)), 2.0);
    vec3 ice = vec3(0.86, 0.9, 1.0);
    vec3 azure = vec3(0.58, 0.66, 1.0);
    vec3 col = mix(ice, azure, 0.25 + fres * 0.5 + uShade * 0.35);
    col = mix(col, vec3(1.0), bevel * sunSide * 0.85);
    gl_FragColor = vec4(col, uOpacity);
  }
`;

const PLACE: Placement = {
  hero: { x: 2.35, y: -0.15, z: -1.2, s: 0.7 },
  center: { x: 0.15, y: 0.05, z: 0, s: 1 },
  compactHero: { x: 0.1, y: -2.0, z: -1.5, s: 0.4 },
  compactCenter: { x: 0, y: 0.15, z: 0, s: 0.46 },
  still: { x: 2.35, y: -0.15, z: -1.2, s: 0.7 },
  compactStill: { x: 0, y: 0.15, z: 0, s: 0.46 },
};

/* module-scope temps — zero allocation per frame */
const _cam = new THREE.Vector3();
const _sun = new THREE.Vector3();

export default function PalmSpringsScene() {
  const q = useQuality();
  const rig = useRef<THREE.Group>(null);
  const sunRef = useRef<THREE.Mesh>(null);
  const stage = useMemo(createStageState, []);
  const live = useRef({ px: 0, py: 0 });
  const report = useHotspotReporter('ps-skyline');

  const { wallMat, screenMat, screenBackMat } = useMemo(() => {
    const cells = new THREE.Vector2(CELLS_X, CELLS_Y);
    const sun = new THREE.Vector3(0.4, 0.3, 0.86);
    const wallMat = new THREE.ShaderMaterial({
      vertexShader: wallVertex,
      fragmentShader: wallFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSun: { value: sun },
        uScreenC: { value: new THREE.Vector2(SCREEN_CX, SCREEN_CY) },
        uScreenHalf: { value: new THREE.Vector2(SCREEN_W / 2, SCREEN_H / 2) },
        uCells: { value: cells },
        uGap: { value: GAP },
        uHalf: { value: new THREE.Vector2(WALL_W / 2, WALL_H / 2) },
        uOpacity: { value: 1 },
      },
    });
    const mk = (shade: number) =>
      new THREE.ShaderMaterial({
        vertexShader: screenVertex,
        fragmentShader: screenFragment,
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
          uCells: { value: cells },
          uSun: { value: sun },
          uShade: { value: shade },
          uOpacity: { value: 1 },
        },
      });
    return { wallMat, screenMat: mk(0), screenBackMat: mk(0.6) };
  }, []);
  useEffect(
    () => () => {
      wallMat.dispose();
      screenMat.dispose();
      screenBackMat.dispose();
    },
    [wallMat, screenMat, screenBackMat],
  );

  useFrame((state, delta) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    readStage(stage, q);
    const intro = anim ? smooth(Math.min(el / 1.8, 1)) : 1;
    const L = live.current;

    if (rig.current) placeStage(rig.current, stage, q, PLACE, intro);

    /* the sun's arc: rises low on the left, crosses high, sets on the right.
       Before the dwell it waits at sunrise; reduced motion holds late afternoon. */
    const t = anim ? stage.t : 0.78;
    L.px = anim ? damp(L.px, pointer.x * 0.12, 2.5, delta) : 0;
    L.py = anim ? damp(L.py, pointer.y * 0.08, 2.5, delta) : 0;
    const az = -1.05 + 2.1 * smooth(t) + L.px; // radians across the sky
    const el0 = 0.32 + 0.62 * Math.sin(Math.PI * t) + L.py; // elevation
    const cosE = Math.cos(el0);
    /* direction from the wall toward the sun (x right, y up, z toward viewer) */
    _sun.set(Math.sin(az) * cosE * 0.92, Math.sin(el0) * 0.7 - 0.05, Math.cos(az) * cosE * 0.55 + 0.35);
    _sun.normalize();
    (wallMat.uniforms.uSun.value as THREE.Vector3).copy(_sun);

    wallMat.uniforms.uOpacity.value = intro;
    screenMat.uniforms.uOpacity.value = intro;
    screenBackMat.uniforms.uOpacity.value = intro;

    const s = sunRef.current;
    if (s) {
      s.position.set(Math.sin(az) * 2.5, 1.3 + Math.sin(el0) * 0.65, 1.3);
      const m = s.material as THREE.MeshPhysicalMaterial;
      m.emissiveIntensity = 0.35 + 0.55 * Math.sin(Math.PI * t);
      s.scale.setScalar(Math.max(intro, 0.001));
    }
    if (s) report(s, state.camera, 0.5 + 0.4 * stage.focus);

    _cam.set(anim ? pointer.x * 0.3 : 0, anim ? 0.15 + pointer.y * 0.18 : 0.15, 9);
    state.camera.position.lerp(_cam, 0.05);
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <SceneLightRig />
      <group ref={rig}>
        {/* the wall */}
        <mesh material={wallMat} renderOrder={-1}>
          <planeGeometry args={[WALL_W, WALL_H, 1, 1]} />
        </mesh>
        {/* the breeze-block screen — two faces give the glass its depth */}
        <mesh material={screenBackMat} position={[SCREEN_CX, SCREEN_CY, GAP - 0.07]}>
          <planeGeometry args={[SCREEN_W, SCREEN_H, 1, 1]} />
        </mesh>
        <mesh material={screenMat} position={[SCREEN_CX, SCREEN_CY, GAP]}>
          <planeGeometry args={[SCREEN_W, SCREEN_H, 1, 1]} />
        </mesh>
        {/* a thin glass coping along the top of the wall */}
        <mesh position={[0, WALL_H / 2 - 0.2, 0.06]}>
          <boxGeometry args={[WALL_W * 0.72, 0.035, 0.12]} />
          <GlassMaterial kind="ice" />
        </mesh>
        {/* the sun */}
        <mesh ref={sunRef} position={[-2.3, 1.4, -0.4]}>
          <sphereGeometry args={[0.2, 40, 28]} />
          <GlassMaterial kind="deep" emissive="#2e4bff" emissiveIntensity={0.4} />
        </mesh>
      </group>
      <ParticleField count={Math.floor(900 * q.particles)} drift={q.animate ? 0.08 : 0} opacity={0.24} />
    </>
  );
}
