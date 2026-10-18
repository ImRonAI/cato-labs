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
import { useBakedSimulation } from '../../../lib/physics-bake';
import {
  THETA, SLOPE_HX, SLOPE_HZ, SLAB, RUN_HX, RUN_TILT, R0, STEPS, SUBSTEPS, TRAIL, FLAKES,
  sinT, cosT, FOOT_X, FOOT_Y, START, radii, slopeSurface, setup, beforeStep,
} from '../lib-a/snowball';
import { createStageState, readStage, damp } from '../lib-a/dwell';
import { placeStage, type Placement } from '../lib-a/place';

/**
 * BigBearScene — "Snowball".
 *
 * A pale glass mountainside. As the `moment` dwell begins, snow falls and
 * settles: the slope whitens flake by flake. A small snowball forms at the
 * crest and is let go. From there it is a real Rapier simulation, baked once
 * and scrubbed by scroll: the ball rolls downhill, its collider growing with
 * every metre it travels (gathering mass, so it gathers momentum), bumps
 * over two buried moguls, ploughs a track through the fresh snow and comes
 * to rest on the run-out. Scroll up and it rolls back uphill, shrinking,
 * until it is a pinch of snow at the top again.
 *
 * Pointer: the mountain turns a few degrees toward the cursor.
 * Reduced motion: snow settled, the ball at rest at the foot, its track
 * drawn down the slope.
 */

const PLACE: Placement = {
  hero: { x: 1.4, y: -0.25, z: -1.6, s: 0.6 },
  center: { x: -0.35, y: 0.2, z: 0, s: 0.8 },
  compactHero: { x: 0.2, y: -1.9, z: -1.8, s: 0.3 },
  compactCenter: { x: 0.1, y: 0.2, z: 0, s: 0.36 },
  still: { x: 1.4, y: -0.25, z: -1.6, s: 0.6 },
  compactStill: { x: 0.1, y: 0.2, z: 0, s: 0.36 },
};

const snowVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vW;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const snowFragment = /* glsl */ `
  uniform float uSnow;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uFade;
  uniform float uSide;
  varying vec2 vUv;
  varying vec3 vW;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 glass = vec3(0.78, 0.83, 1.0);
    vec3 snow = vec3(0.992, 0.995, 1.0);
    /* snow lands patchily first, then covers */
    float n = hash(floor(vUv * vec2(90.0, 40.0)));
    float cover = smoothstep(n * 0.7, n * 0.7 + 0.3, uSnow * 1.3);
    vec3 col = mix(glass, snow, cover);
    /* glints in the settled snow */
    float g = hash(floor(vUv * vec2(260.0, 120.0)));
    float tw = step(0.996, g) * (0.6 + 0.4 * sin(uTime * 2.0 + g * 80.0));
    col = mix(col, vec3(0.18, 0.29, 1.0), tw * cover * 0.7);
    /* faint fall-line hatching on the bare glass */
    float hatch = smoothstep(0.92, 1.0, sin(vUv.y * 120.0)) * (1.0 - cover) * 0.18;
    col = mix(col, vec3(0.42, 0.53, 1.0), hatch);
    float ey = abs(vUv.y - 0.5) * 2.0;
    float ex = max((vUv.x - 0.5) * 2.0 * uSide, 0.0);
    float edge = (1.0 - smoothstep(0.5, 1.0, ey)) * (1.0 - smoothstep(uFade, 1.0, ex));
    gl_FragColor = vec4(col, edge * uOpacity);
  }
`;
const flakeVertex = /* glsl */ `
  uniform float uSnow;
  uniform float uTime;
  uniform float uPixelRatio;
  attribute vec4 aLand;
  varying float vA;
  void main() {
    /* aLand.xyz: landing point on the slope, w: seed */
    float s = aLand.w;
    float land = clamp((uSnow * 1.35 - s * 0.35) / 1.0, 0.0, 1.0);
    float fall = smoothstep(0.0, 1.0, land);
    float h = (1.0 - fall) * (1.6 + s * 1.4);
    vec3 p = aLand.xyz + vec3(sin(uTime * 0.4 + s * 40.0) * 0.12 * (1.0 - fall), h, cos(uTime * 0.3 + s * 21.0) * 0.08 * (1.0 - fall));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = (1.0 - fall * 0.85) * smoothstep(0.0, 0.08, uSnow + 0.04);
    gl_PointSize = (1.4 + s * 2.2) * uPixelRatio * (14.0 / -mv.z);
  }
`;
const flakeFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vA * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(mix(vec3(0.42, 0.53, 1.0), vec3(0.18, 0.29, 1.0), d * 2.0), a);
  }
`;

const _cam = new THREE.Vector3();
const _land = { x: 0, y: 0 };
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _sc = new THREE.Vector3();
const _flat = new THREE.Quaternion();
const _hide = new THREE.Matrix4().makeScale(0, 0, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _layFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

export default function BigBearScene() {
  const q = useQuality();
  const rig = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  const ballShadow = useRef<THREE.Mesh>(null);
  const trail = useRef<THREE.InstancedMesh>(null);
  const stage = useMemo(createStageState, []);
  const live = useRef({ ry: 0, ready: false });
  const report = useHotspotReporter('bb-skyline');

  /* trail samples, filled once when the bake lands */
  const trailData = useMemo(() => new Float32Array(TRAIL * 5), []);

  const sim = useBakedSimulation({
    key: 'regions-big-bear-snowball-v1',
    steps: STEPS,
    dt: 1 / 60,
    substeps: SUBSTEPS,
    solverIterations: 12,
    setup,
    beforeStep,
  });

  const flakeCount = Math.floor((q.compact ? 420 : FLAKES) * q.particles);
  const { snowMat, runMat, flakeMat, flakeGeo } = useMemo(() => {
    const mk = (fade: number, side: number) =>
      new THREE.ShaderMaterial({
        vertexShader: snowVertex,
        fragmentShader: snowFragment,
        transparent: true,
        depthWrite: true,
        side: THREE.DoubleSide,
        uniforms: {
          uSnow: { value: 0 },
          uOpacity: { value: 1 },
          uTime: { value: 0 },
          uFade: { value: fade },
          uSide: { value: side },
        },
      });
    const flakeMat = new THREE.ShaderMaterial({
      vertexShader: flakeVertex,
      fragmentShader: flakeFragment,
      transparent: true,
      depthWrite: false,
      uniforms: { uSnow: { value: 0 }, uTime: { value: 0 }, uPixelRatio: { value: 1 }, uOpacity: { value: 1 } },
    });
    const flakeGeo = new THREE.BufferGeometry();
    const land = new Float32Array(flakeCount * 4);
    let s = 11;
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < flakeCount; i++) {
      const lx = (r() * 2 - 1) * SLOPE_HX * 0.95;
      slopeSurface(lx, _land);
      land[i * 4] = _land.x;
      land[i * 4 + 1] = _land.y + 0.01;
      land[i * 4 + 2] = (r() * 2 - 1) * SLOPE_HZ * 0.8;
      land[i * 4 + 3] = r();
    }
    flakeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(flakeCount * 3), 3));
    flakeGeo.setAttribute('aLand', new THREE.BufferAttribute(land, 4));
    flakeGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
    return { snowMat: mk(0.9, -1), runMat: mk(0.78, 1), flakeMat, flakeGeo };
  }, [flakeCount]);
  const trailMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#6b87ff', transparent: true, opacity: 0.06, depthWrite: false }),
    [],
  );
  const shadowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#2e4bff', transparent: true, opacity: 0.16, depthWrite: false }),
    [],
  );
  useEffect(
    () => () => {
      snowMat.dispose();
      runMat.dispose();
      flakeMat.dispose();
      flakeGeo.dispose();
      trailMat.dispose();
      shadowMat.dispose();
    },
    [snowMat, runMat, flakeMat, flakeGeo, trailMat, shadowMat],
  );

  useFrame((state, delta) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    readStage(stage, q);
    const intro = anim ? smooth(Math.min(el / 1.8, 1)) : 1;
    const t = stage.t;
    const L = live.current;
    if (rig.current) placeStage(rig.current, stage, q, PLACE, intro);

    L.ry = anim ? damp(L.ry, pointer.x * 0.14, 2, delta) : 0;
    if (turn.current) {
      turn.current.rotation.y = (q.compact ? -1.0 : -0.5) + L.ry;
      turn.current.rotation.x = 0.18 + (anim ? -pointer.y * 0.04 : 0);
    }

    /* beat 1 — snow settles (0 → 0.3) */
    const snow = anim ? smooth(Math.min(t / 0.3, 1)) : 1;
    snowMat.uniforms.uSnow.value = snow;
    runMat.uniforms.uSnow.value = snow;
    snowMat.uniforms.uTime.value = el;
    runMat.uniforms.uTime.value = el;
    snowMat.uniforms.uOpacity.value = intro;
    runMat.uniforms.uOpacity.value = intro;
    flakeMat.uniforms.uSnow.value = anim ? Math.min(t / 0.3, 1) : 1;
    flakeMat.uniforms.uTime.value = anim ? el : 0;
    flakeMat.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    flakeMat.uniforms.uOpacity.value = intro;

    /* beat 2 — the snowball forms at the crest (0.24 → 0.34) · beat 3 — it rolls (0.34 → 1) */
    const form = anim ? smooth(Math.min(Math.max((t - 0.24) / 0.1, 0), 1)) : 1;
    const roll = anim ? Math.min(Math.max((t - 0.34) / 0.66, 0), 1) : 1;
    const baked = sim.current;

    const tr = trail.current;
    if (baked && tr && !L.ready) {
      /* sample the recorded path once into the trail buffer */
      for (let k = 0; k < TRAIL; k++) {
        const u = k / (TRAIL - 1);
        baked.sample(0, u, _pos, _quat);
        const f = Math.min(STEPS, Math.round(u * STEPS));
        trailData[k * 5] = _pos.x;
        trailData[k * 5 + 1] = _pos.y;
        trailData[k * 5 + 2] = _pos.z;
        trailData[k * 5 + 3] = radii[f] || R0;
        trailData[k * 5 + 4] = u;
      }
      L.ready = true;
    }

    const b = ball.current;
    if (b) {
      let r = R0;
      if (baked) {
        baked.sample(0, roll, _pos, _quat);
        /* radii live in the snowball module; after a dev hot-reload they can be
           empty while the bake cache survives — fall back to the seed radius */
        r = radii[Math.min(STEPS, Math.round(roll * STEPS))] || R0;
      } else {
        _pos.set(START.x + sinT * R0, START.y + cosT * R0, 0.06);
        _quat.identity();
      }
      b.position.copy(_pos);
      b.quaternion.copy(_quat);
      b.scale.setScalar(Math.max(r * form * intro, 0.0001));
      const sh = ballShadow.current;
      if (sh) {
        /* contact shadow on whichever surface is under the ball */
        const onRun = _pos.x > FOOT_X;
        const a = onRun ? RUN_TILT : -THETA;
        const sx = onRun ? FOOT_X : 0;
        const sy = onRun ? FOOT_Y : SLAB / cosT;
        const groundY = sy + (_pos.x - sx) * Math.tan(a);
        sh.position.set(_pos.x, groundY + 0.004, _pos.z);
        sh.quaternion.setFromAxisAngle(_zAxis, a).multiply(_layFlat);
        const lift = Math.max(_pos.y - r - groundY, 0);
        sh.scale.setScalar(Math.max(r * form * 2.2 * (1 + lift * 2), 0.0001));
        (sh.material as THREE.MeshBasicMaterial).opacity = 0.16 * form * Math.max(0.2, 1 - lift * 3);
      }
      report(b, state.camera, 0.45 + 0.4 * stage.focus);
    }

    /* the ploughed track, drawn up to the ball */
    if (tr && L.ready) {
      for (let k = 0; k < TRAIL; k++) {
        const u = trailData[k * 5 + 4];
        if (u > roll || form < 1) {
          tr.setMatrixAt(k, _hide);
          continue;
        }
        const r = trailData[k * 5 + 3];
        const px = trailData[k * 5];
        const onRun = px > FOOT_X;
        const a = onRun ? RUN_TILT : -THETA;
        const sx = onRun ? FOOT_X : 0;
        const sy = onRun ? FOOT_Y : SLAB / cosT;
        _pos.set(px, sy + (px - sx) * Math.tan(a) + 0.003, trailData[k * 5 + 2]);
        _flat.setFromAxisAngle(_zAxis, a).multiply(_layFlat);
        _sc.set(r * 1.1, r * 0.9, 1);
        _m.compose(_pos, _flat, _sc);
        tr.setMatrixAt(k, _m);
      }
      tr.instanceMatrix.needsUpdate = true;
    }

    _cam.set(anim ? pointer.x * 0.3 : 0, anim ? 0.2 + pointer.y * 0.18 : 0.2, 9);
    state.camera.position.lerp(_cam, 0.05);
    state.camera.lookAt(0, 0, 0);
  });

  const runCx = FOOT_X + RUN_HX * Math.cos(RUN_TILT);
  const runCy = FOOT_Y + RUN_HX * Math.sin(RUN_TILT);

  return (
    <>
      <SceneLightRig />
      <group ref={rig}>
        <group ref={turn}>
         <group position={[-1.85, 0, 0]}>
          {/* the slope */}
          <group rotation={[0, 0, -THETA]}>
            <mesh material={snowMat} position={[0, SLAB, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[SLOPE_HX * 2, SLOPE_HZ * 2, 1, 1]} />
            </mesh>
          </group>
          {/* the run-out */}
          <group position={[runCx, runCy, 0]} rotation={[0, 0, RUN_TILT]}>
            <mesh material={runMat} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[RUN_HX * 2, SLOPE_HZ * 2, 1, 1]} />
            </mesh>
          </group>
          <points geometry={flakeGeo} material={flakeMat} frustumCulled={false} />
          <instancedMesh ref={trail} args={[undefined, undefined, TRAIL]} material={trailMat} frustumCulled={false}>
            <circleGeometry args={[1, 20]} />
          </instancedMesh>
          <mesh ref={ballShadow} material={shadowMat}>
            <circleGeometry args={[1, 32]} />
          </mesh>
          <mesh ref={ball}>
            <icosahedronGeometry args={[1, 5]} />
            <GlassMaterial kind="ice" roughness={0.32} color="#eef2ff" emissive="#2e4bff" emissiveIntensity={0.03} />
          </mesh>
         </group>
        </group>
      </group>
      <ParticleField count={Math.floor(700 * q.particles)} drift={q.animate ? 0.08 : 0} opacity={0.2} />
    </>
  );
}
