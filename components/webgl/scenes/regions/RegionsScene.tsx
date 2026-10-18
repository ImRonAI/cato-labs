'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { GlassMaterial } from '../../lib/materials';
import { useQuality } from '../../lib/quality';
import { pointer, smooth } from '../../scroll-store';
import { useHotspotReporter } from '../../kit/ProximityType';
import { createStageState, readStage, damp } from './lib-a/dwell';

/**
 * RegionsScene — "Pin drop".
 *
 * A paper-white relief map drawn only in blue contour lines lies beneath
 * eleven glass pins, one per market, in the deck's order. In the hero the
 * pins hang high over a grazing map like a constellation. As the `moment`
 * dwell is pinned, the map tilts up toward the viewer and the pins fall one
 * by one (Palm Springs first, the beachhead), strike their true geographic
 * position, bounce, and send a ripple through the contours. Scrolling up
 * lifts every pin back out of the map.
 *
 * Pointer: the map leans toward the cursor and a soft light follows it
 * across the contours. Reduced motion: the map at rest, every pin planted.
 */

/* the deck's order, true lon/lat (scene data, not copy) */
const PLACES: readonly [number, number][] = [
  [-116.55, 33.83], // palm springs
  [-116.37, 33.72], // palm desert
  [-116.22, 33.72], // indio
  [-117.29, 34.11], // san bernardino
  [-116.91, 34.24], // big bear
  [-118.24, 34.05], // los angeles
  [-117.83, 33.68], // orange county
  [-122.42, 37.77], // san francisco
  [-122.29, 38.3], // napa
  [-112.07, 33.45], // phoenix
  [-111.89, 40.76], // salt lake city
];
const N = PLACES.length;
const MAP_W = 9.2;
const MAP_D = 6.6;
const DEG = 0.56;
const LON0 = -117.15;
const LAT0 = 37.1;
const NEEDLE = 0.36;
const HEAD_R = 0.062;

/* ---------- relief — identical in JS and GLSL so pins land on the surface ---------- */
const RELIEF_GLSL = /* glsl */ `
  float ridge(vec2 p, vec2 a, vec2 b, float w) {
    vec2 ab = b - a;
    float h = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    float d = length(p - a - ab * h);
    return exp(-d * d / (w * w));
  }
  float relief(vec2 p) {
    float h = 0.0;
    h += 0.34 * ridge(p, vec2(-3.2, -2.4), vec2(-1.2, 0.2), 0.55);
    h += 0.22 * ridge(p, vec2(-1.4, 0.9), vec2(0.6, 1.1), 0.42);
    h += 0.26 * ridge(p, vec2(2.4, -3.0), vec2(3.6, -0.9), 0.7);
    h += 0.16 * ridge(p, vec2(1.2, 0.2), vec2(2.6, 1.6), 0.6);
    h += 0.05 * sin(p.x * 3.1 + p.y * 1.7) * sin(p.y * 2.3 - p.x * 0.9);
    h += 0.025 * sin(p.x * 7.3 - p.y * 5.1);
    return h;
  }
`;

function ridge(px: number, pz: number, ax: number, az: number, bx: number, bz: number, w: number) {
  const abx = bx - ax;
  const abz = bz - az;
  let h = ((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz);
  h = h < 0 ? 0 : h > 1 ? 1 : h;
  const dx = px - ax - abx * h;
  const dz = pz - az - abz * h;
  return Math.exp(-(dx * dx + dz * dz) / (w * w));
}
function relief(x: number, z: number) {
  let h = 0;
  h += 0.34 * ridge(x, z, -3.2, -2.4, -1.2, 0.2, 0.55);
  h += 0.22 * ridge(x, z, -1.4, 0.9, 0.6, 1.1, 0.42);
  h += 0.26 * ridge(x, z, 2.4, -3.0, 3.6, -0.9, 0.7);
  h += 0.16 * ridge(x, z, 1.2, 0.2, 2.6, 1.6, 0.6);
  h += 0.05 * Math.sin(x * 3.1 + z * 1.7) * Math.sin(z * 2.3 - x * 0.9);
  h += 0.025 * Math.sin(x * 7.3 - z * 5.1);
  return h;
}

const mapVertex = /* glsl */ `
  uniform vec4 uPins[${N}];
  uniform float uRipple;
  varying vec3 vLocal;
  varying float vRing;
  ${RELIEF_GLSL}
  void main() {
    vec3 p = position;
    vec2 xz = vec2(p.x, -p.y);
    float h = relief(xz);
    float ring = 0.0;
    for (int i = 0; i < ${N}; i++) {
      vec4 pin = uPins[i];
      float age = pin.z;
      if (age <= 0.0 || age > 1.0) continue;
      float d = distance(xz, pin.xy);
      float front = age * 2.4;
      float env = exp(-age * 3.2) * smoothstep(front + 0.05, front - 0.25, d) * exp(-d * 1.3);
      float w = sin((d - front) * 16.0);
      h += 0.05 * uRipple * env * w;
      ring += env * smoothstep(0.6, 1.0, w);
    }
    vRing = ring;
    vLocal = vec3(xz.x, h, xz.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, p.y, h, 1.0);
  }
`;

const mapFragment = /* glsl */ `
  uniform vec4 uPins[${N}];
  uniform vec2 uLight;
  uniform float uOpacity;
  uniform vec2 uHalf;
  varying vec3 vLocal;
  varying float vRing;
  void main() {
    vec3 n = normalize(cross(dFdx(vLocal), dFdy(vLocal)));
    n *= sign(n.y + 1e-5);
    float lambert = clamp(dot(n, normalize(vec3(-0.5, 0.9, 0.4))) * 0.5 + 0.5, 0.0, 1.0);

    /* contours — every 0.03 of relief, a heavier line every fifth */
    float k = vLocal.y / 0.03;
    float f = abs(fract(k - 0.5) - 0.5) / fwidth(k);
    float line = 1.0 - smoothstep(0.0, 1.1, f);
    float k5 = vLocal.y / 0.15;
    float f5 = abs(fract(k5 - 0.5) - 0.5) / fwidth(k5);
    float major = 1.0 - smoothstep(0.0, 1.4, f5);

    /* survey graticule, very faint */
    vec2 g = vLocal.xz / 0.7;
    vec2 gf = abs(fract(g - 0.5) - 0.5) / fwidth(g);
    float grid = 1.0 - smoothstep(0.0, 1.0, min(gf.x, gf.y));

    /* contact shadows under falling pins: tighter and darker as they near */
    float shadow = 0.0;
    for (int i = 0; i < ${N}; i++) {
      vec4 pin = uPins[i];
      float d = distance(vLocal.xz, pin.xy);
      float r = 0.05 + pin.w * 0.22;
      shadow += exp(-d * d / (r * r)) * (0.5 / (1.0 + pin.w * 5.0));
    }

    float light = exp(-dot(vLocal.xz - uLight, vLocal.xz - uLight) * 0.35);

    vec3 paper = vec3(0.98, 0.984, 0.996);
    vec3 ice = vec3(0.86, 0.894, 1.0);
    vec3 blue = vec3(0.18, 0.294, 1.0);
    vec3 col = mix(ice, paper, lambert * 0.85 + 0.15);
    col = mix(col, vec3(0.576, 0.663, 1.0), line * (0.42 + light * 0.4));
    col = mix(col, blue, major * (0.32 + light * 0.4));
    col = mix(col, vec3(0.725, 0.788, 1.0), grid * 0.25);
    col = mix(col, blue, clamp(vRing, 0.0, 1.0) * 0.8);
    col = mix(col, vec3(0.07, 0.15, 0.78), clamp(shadow, 0.0, 0.6));

    /* melt the map edges into the paper */
    vec2 e = abs(vLocal.xz) / uHalf;
    float edge = 1.0 - smoothstep(0.62, 1.0, max(e.x * 0.92, e.y));
    edge *= 1.0 - smoothstep(0.85, 1.15, length(e));
    gl_FragColor = vec4(col, edge * uOpacity);
  }
`;

/* module-scope temps — zero allocation per frame */
const _cam = new THREE.Vector3();

interface PinSpec {
  x: number;
  z: number;
  ground: number;
  hover: number;
  start: number;
  seed: number;
}

export default function RegionsScene() {
  const q = useQuality();
  const rig = useRef<THREE.Group>(null);
  const map = useRef<THREE.Group>(null);
  const pinRefs = useRef<(THREE.Group | null)[]>([]);
  const headMats = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const headRef0 = useRef<THREE.Mesh>(null);
  const stage = useMemo(createStageState, []);
  const live = useRef({ tilt: 0.22, lean: 0, leanY: 0, lx: 0, lz: 0 });
  const report = useHotspotReporter('regions-map');

  const pins = useMemo<PinSpec[]>(
    () =>
      PLACES.map(([lon, lat], i) => {
        const x = (lon - LON0) * DEG;
        const z = -(lat - LAT0) * DEG;
        return {
          x,
          z,
          ground: relief(x, z),
          hover: 2.2 + ((i * 0.618) % 1) * 1.1,
          start: 0.05 + i * 0.062,
          seed: (i * 0.37) % 1,
        };
      }),
    [],
  );

  const seg = q.compact ? [110, 80] : [190, 136];
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(MAP_W, MAP_D, seg[0], seg[1]),
    [seg[0], seg[1]],
  );
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: mapVertex,
        fragmentShader: mapFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uPins: { value: Array.from({ length: N }, () => new THREE.Vector4(0, 0, 0, 9)) },
          uRipple: { value: 1 },
          uLight: { value: new THREE.Vector2(0, 0) },
          uOpacity: { value: 1 },
          uHalf: { value: new THREE.Vector2(MAP_W / 2, MAP_D / 2) },
        },
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state, delta) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    readStage(stage, q);
    const intro = anim ? smooth(Math.min(el / 1.8, 1)) : 1;
    const t = stage.t;
    const L = live.current;

    /* the map rises from grazing to facing the viewer as the dwell pins */
    const tiltTarget = anim ? 0.16 + 0.56 * stage.into : 0.66;
    L.tilt = anim ? damp(L.tilt, tiltTarget, 6, delta) : tiltTarget;
    L.lean = anim ? damp(L.lean, pointer.y * 0.05, 2.5, delta) : 0;
    L.leanY = anim ? damp(L.leanY, pointer.x * 0.08, 2.5, delta) : 0;

    const g = map.current;
    if (g) {
      g.rotation.x = L.tilt + L.lean;
      g.rotation.y = L.leanY;
    }
    const r = rig.current;
    if (r) {
      const s = q.compact ? 0.34 + 0.03 * stage.into : 0.9 + 0.12 * stage.into;
      const baseY = q.compact ? -1.75 : -2.05;
      const midY = q.compact ? -0.25 : -0.35;
      const y = anim ? baseY + (midY - baseY) * stage.into + stage.out * 7 : q.compact ? -0.4 : -0.5;
      r.position.set(0, y - (1 - intro) * 0.8, 0);
      r.scale.setScalar(s * (0.94 + 0.06 * intro));
    }

    /* light follows the cursor across the contours */
    L.lx = anim ? damp(L.lx, pointer.x * MAP_W * 0.42, 3, delta) : -1.2;
    L.lz = anim ? damp(L.lz, -pointer.y * MAP_D * 0.4, 3, delta) : 0.4;
    material.uniforms.uLight.value.set(L.lx, L.lz);
    material.uniforms.uOpacity.value = intro;

    const uPins = material.uniforms.uPins.value as THREE.Vector4[];
    for (let i = 0; i < N; i++) {
      const s = pins[i];
      const grp = pinRefs.current[i];
      const impact = s.start + 0.1;
      let h: number;
      let age = -1;
      if (!anim) {
        h = 0;
        age = 0.55 + s.seed * 0.3;
      } else if (t < s.start) {
        h = s.hover + Math.sin(el * 0.7 + s.seed * 6.28) * 0.06;
      } else if (t < impact) {
        const u = (t - s.start) / 0.1;
        h = s.hover * (1 - u * u);
      } else {
        const b = (t - impact) / 0.09;
        h = b < 1 ? 0.16 * Math.exp(-3 * b) * Math.abs(Math.sin(Math.PI * 2.5 * b)) : 0;
        age = (t - impact) / 0.3;
      }
      uPins[i].set(s.x, s.z, age, h);

      if (grp) {
        grp.position.set(s.x, s.ground + h, s.z);
        const pop = anim ? smooth(Math.min(Math.max((el - 0.2 - i * 0.06) / 0.7, 0), 1)) : 1;
        grp.scale.setScalar(Math.max(pop, 0.001));
        /* a falling pin leans into its drop, then stands */
        grp.rotation.z = h > 0.02 && t >= s.start ? Math.sin(s.seed * 6.28) * 0.08 * Math.min(h, 1) : 0;
      }
      const m = headMats.current[i];
      if (m) {
        const flash = age >= 0 && age <= 1 ? Math.exp(-age * 6) * 1.6 : 0;
        const settled = age >= 0 ? 0.3 : 0.04;
        m.emissiveIntensity = settled + flash;
      }
    }

    if (headRef0.current) report(headRef0.current, state.camera, 0.55 + 0.35 * stage.focus);

    /* camera — still, a breath of parallax */
    _cam.set(anim ? pointer.x * 0.35 : 0, anim ? pointer.y * 0.2 : 0, 9);
    state.camera.position.lerp(_cam, 0.05);
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <SceneLightRig />
      <group ref={rig}>
        <group ref={map}>
          <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1} />
          {pins.map((s, i) => (
            <group
              key={i}
              ref={(el) => {
                pinRefs.current[i] = el;
              }}
              position={[s.x, s.ground + s.hover, s.z]}
            >
              <mesh position={[0, NEEDLE * 0.5, 0]}>
                <cylinderGeometry args={[0.006, 0.0015, NEEDLE, 8]} />
                <GlassMaterial kind="azure" />
              </mesh>
              <mesh ref={i === 0 ? headRef0 : undefined} position={[0, NEEDLE + HEAD_R * 0.7, 0]}>
                <sphereGeometry args={[HEAD_R, 28, 20]} />
                <GlassMaterial
                  ref={(m) => {
                    headMats.current[i] = m;
                  }}
                  kind={i < 3 ? 'deep' : i % 2 ? 'core' : 'azure'}
                  emissive="#2e4bff"
                  emissiveIntensity={0.04}
                />
              </mesh>
            </group>
          ))}
        </group>
      </group>
      <ParticleField count={Math.floor(1100 * q.particles)} drift={q.animate ? 0.09 : 0} opacity={0.26} />
    </>
  );
}
