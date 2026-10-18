'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { useQuality } from '../../../lib/quality';
import { pointer, smooth } from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { createStageState, readStage, damp } from '../lib-a/dwell';
import { placeStage, type Placement } from '../lib-a/place';

/**
 * PalmDesertScene — "Dune drift".
 *
 * A field of low wind ripples lies flat on the paper. As the `moment` dwell
 * scrolls, the wind builds: sand gathers into a single crescent dune whose
 * gentle windward back and steep slip face are sculpted in the vertex shader,
 * the crest creeps downwind, and a veil of grains streams off the crest line.
 * Every grain's position is a pure function of scroll, so scrolling up
 * flattens the dune and draws the sand back exactly.
 *
 * Pointer: the wind veers a few degrees toward the cursor.
 * Reduced motion: the finished dune with a quiet, frozen veil of sand.
 */

const DUNE_W = 7.2;
const DUNE_D = 4.6;

/* the dune — shared by surface and grains, so grains leave the true crest */
const DUNE_GLSL = /* glsl */ `
  uniform float uGrow;
  uniform float uCrest;
  uniform float uRipple;
  uniform float uVeer;

  /* crest x as a function of z — the barchan's crescent, horns downwind */
  float crestX(float z, float grow) {
    return uCrest + 0.9 * grow * (z * z) * 0.28;
  }
  float dune(vec2 p) {
    float grow = uGrow;
    float cx = crestX(p.y, grow);
    float dx = p.x - cx;
    float width = 1.0 - smoothstep(0.6, 2.1, abs(p.y));
    /* windward: long gentle back · leeward: steep slip face */
    float back = exp(-(dx * dx) / (1.7 * 1.7));
    float lee = 1.0 - smoothstep(0.0, 0.42, dx);
    float profile = dx < 0.0 ? back : lee;
    float h = 0.95 * grow * profile * width;
    /* wind ripples: fine bands across the wind, smoothed off the slip face */
    vec2 w = vec2(cos(uVeer), sin(uVeer));
    float band = sin(dot(p, w) * 18.0 + p.y * 0.8 - uRipple * 6.0);
    float rippleAmp = 0.012 * (1.0 - 0.8 * step(0.0, dx) * grow);
    h += band * rippleAmp + 0.03 * sin(p.x * 1.3 + p.y * 2.1) * (1.0 - grow);
    return h;
  }
`;

const surfaceVertex = /* glsl */ `
  ${DUNE_GLSL}
  varying vec3 vLocal;
  void main() {
    vec2 xz = vec2(position.x, -position.y);
    float h = dune(xz);
    vLocal = vec3(xz.x, h, xz.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y, h, 1.0);
  }
`;

const surfaceFragment = /* glsl */ `
  uniform vec2 uHalf;
  uniform float uOpacity;
  uniform float uGrowF;
  uniform vec2 uLight;
  varying vec3 vLocal;
  void main() {
    vec3 n = normalize(cross(dFdx(vLocal), dFdy(vLocal)));
    n *= sign(n.y + 1e-5);
    vec3 sun = normalize(vec3(-0.75, 0.55, 0.35));
    float lambert = dot(n, sun);
    float lit = smoothstep(-0.25, 0.75, lambert);

    vec3 paper = vec3(0.985, 0.988, 1.0);
    vec3 ice = vec3(0.85, 0.885, 1.0);
    vec3 azure = vec3(0.5, 0.6, 1.0);
    vec3 col = mix(azure, ice, smoothstep(-0.2, 0.25, lambert));
    col = mix(col, paper, lit * 0.9);

    /* contour hairlines climb the dune as it grows */
    float k = vLocal.y / 0.06;
    float f = abs(fract(k - 0.5) - 0.5) / fwidth(k);
    float line = (1.0 - smoothstep(0.0, 1.0, f)) * smoothstep(0.02, 0.12, vLocal.y) * uGrowF;
    col = mix(col, vec3(0.42, 0.53, 1.0), line * 0.35);

    /* cursor sun-glint across the grain */
    float glint = exp(-dot(vLocal.xz - uLight, vLocal.xz - uLight) * 0.5) * lit;
    col += vec3(0.06, 0.07, 0.1) * glint;

    vec2 e = abs(vLocal.xz) / uHalf;
    float edge = (1.0 - smoothstep(0.55, 1.0, e.x)) * (1.0 - smoothstep(0.4, 1.0, e.y));
    gl_FragColor = vec4(col, edge * uOpacity);
  }
`;

const grainVertex = /* glsl */ `
  ${DUNE_GLSL}
  uniform float uT;
  uniform float uIdle;
  uniform float uStream;
  uniform float uPixelRatio;
  uniform float uSize;
  attribute vec3 aSeed;
  varying float vAlpha;
  varying float vTone;
  void main() {
    /* each grain: a crest station z, a phase and a lift */
    float z = (aSeed.x * 2.0 - 1.0) * 1.7;
    float age = fract(aSeed.y + uT * 3.2 + uIdle * 0.06);
    float cx = crestX(z, uGrow);
    vec2 w = vec2(cos(uVeer), sin(uVeer));
    float lift = 0.12 + aSeed.z * 0.55;
    vec3 p;
    float h0 = dune(vec2(cx - 0.02, z));
    float travel = age * (1.1 + aSeed.z * 1.6);
    p.x = cx + travel * w.x;
    p.z = z + travel * w.y + sin(age * 6.0 + aSeed.x * 30.0) * 0.05;
    /* leaves the crest on a rising arc, settles back on the lee */
    p.y = h0 + lift * sin(age * 3.14159) * (1.0 - age * 0.35) - age * age * 0.25;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float width = 1.0 - smoothstep(0.6, 1.8, abs(z));
    vAlpha = uStream * width * smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.55, 1.0, age));
    vTone = aSeed.z;
    gl_PointSize = uSize * (0.5 + aSeed.z) * uPixelRatio * (14.0 / -mv.z);
  }
`;

const grainFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying float vTone;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.1, d) * vAlpha * uOpacity;
    if (a < 0.004) discard;
    vec3 col = mix(vec3(0.18, 0.29, 1.0), vec3(0.58, 0.66, 1.0), vTone);
    gl_FragColor = vec4(col, a);
  }
`;

const PLACE: Placement = {
  hero: { x: 1.5, y: -1.05, z: -0.6, s: 0.78 },
  center: { x: 0, y: -0.55, z: 0.4, s: 1 },
  compactHero: { x: 0.1, y: -2.1, z: -1, s: 0.4 },
  compactCenter: { x: 0, y: -0.25, z: 0, s: 0.44 },
  still: { x: 1.5, y: -1.05, z: -0.6, s: 0.78 },
  compactStill: { x: 0, y: -0.25, z: 0, s: 0.44 },
};

const _cam = new THREE.Vector3();

export default function PalmDesertScene() {
  const q = useQuality();
  const rig = useRef<THREE.Group>(null);
  const anchor = useRef<THREE.Group>(null);
  const stage = useMemo(createStageState, []);
  const live = useRef({ veer: 0, lx: 0, lz: 0 });
  const report = useHotspotReporter('pd-skyline');

  const grains = Math.floor((q.compact ? 1400 : 3200) * q.particles);
  const seg = q.compact ? [150, 96] : [240, 150];

  const { surface, surfaceGeo, grainMat, grainGeo, shared } = useMemo(() => {
    const shared = {
      uGrow: { value: 0.0 },
      uCrest: { value: -0.9 },
      uRipple: { value: 0 },
      uVeer: { value: 0 },
    };
    const surface = new THREE.ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: surfaceFragment,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      uniforms: {
        ...shared,
        uHalf: { value: new THREE.Vector2(DUNE_W / 2, DUNE_D / 2) },
        uOpacity: { value: 1 },
        uGrowF: { value: 0 },
        uLight: { value: new THREE.Vector2() },
      },
    });
    const surfaceGeo = new THREE.PlaneGeometry(DUNE_W, DUNE_D, seg[0], seg[1]);
    const grainMat = new THREE.ShaderMaterial({
      vertexShader: grainVertex,
      fragmentShader: grainFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...shared,
        uT: { value: 0 },
        uIdle: { value: 0 },
        uStream: { value: 0 },
        uPixelRatio: { value: 1 },
        uSize: { value: 2.2 },
        uOpacity: { value: 1 },
      },
    });
    const grainGeo = new THREE.BufferGeometry();
    const seeds = new Float32Array(grains * 3);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < grains * 3; i++) seeds[i] = r();
    grainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(grains * 3), 3));
    grainGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    grainGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6);
    return { surface, surfaceGeo, grainMat, grainGeo, shared };
  }, [grains, seg[0], seg[1]]);
  useEffect(
    () => () => {
      surface.dispose();
      surfaceGeo.dispose();
      grainMat.dispose();
      grainGeo.dispose();
    },
    [surface, surfaceGeo, grainMat, grainGeo],
  );

  useFrame((state, delta) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    readStage(stage, q);
    const intro = anim ? smooth(Math.min(el / 1.8, 1)) : 1;
    const t = stage.t;
    const L = live.current;

    if (rig.current) {
      placeStage(rig.current, stage, q, PLACE, intro);
      rig.current.rotation.x = anim ? 0.32 + 0.12 * stage.into : 0.4;
      rig.current.rotation.y = anim ? -0.28 + pointer.x * 0.05 : -0.28;
    }

    /* the wind builds, sculpts, and eases */
    const grow = 0.12 + 0.88 * smooth(Math.min(t / 0.7, 1));
    const crest = -0.9 + 1.4 * smooth(t);
    L.veer = anim ? damp(L.veer, -pointer.y * 0.18, 2, delta) : 0.05;
    shared.uGrow.value = grow;
    shared.uCrest.value = crest;
    shared.uRipple.value = t * 3 + (anim ? el * 0.015 : 0);
    shared.uVeer.value = L.veer;

    /* the stream: picks up once the crest stands, quiets at the end */
    const stream = smooth(Math.min(Math.max((t - 0.12) / 0.25, 0), 1)) * (1 - 0.55 * smooth(Math.max((t - 0.8) / 0.2, 0)));
    grainMat.uniforms.uStream.value = anim ? stream : 0.55;
    grainMat.uniforms.uT.value = t;
    grainMat.uniforms.uIdle.value = anim ? el : 0;
    grainMat.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    grainMat.uniforms.uOpacity.value = intro;

    L.lx = anim ? damp(L.lx, pointer.x * 3, 3, delta) : -1;
    L.lz = anim ? damp(L.lz, -pointer.y * 2, 3, delta) : 0;
    (surface.uniforms.uLight.value as THREE.Vector2).set(L.lx, L.lz);
    surface.uniforms.uOpacity.value = intro;
    surface.uniforms.uGrowF.value = grow;

    if (anchor.current) {
      anchor.current.position.set(crest, 0.95 * grow, 0);
      report(anchor.current, state.camera, 0.45 + 0.35 * stage.focus);
    }

    _cam.set(anim ? pointer.x * 0.3 : 0, anim ? 0.2 + pointer.y * 0.18 : 0.2, 9);
    state.camera.position.lerp(_cam, 0.05);
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <SceneLightRig />
      <group ref={rig}>
        <mesh geometry={surfaceGeo} material={surface} rotation={[-Math.PI / 2, 0, 0]} />
        <points geometry={grainGeo} material={grainMat} frustumCulled={false} />
        <group ref={anchor} />
      </group>
      <ParticleField count={Math.floor(800 * q.particles)} drift={q.animate ? 0.08 : 0} opacity={0.22} />
    </>
  );
}
