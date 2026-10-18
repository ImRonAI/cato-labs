'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { pointer } from '../scroll-store';
import { useQuality } from '../lib/quality';
import { sampleSvgPath } from './lib/samplePath';
import { SHAPES, type ShapeName } from './lib/shapes';

/**
 * ParticleSculpture — morphing logo/silhouette point clouds with a
 * "water cursor".
 *
 * Targets come from either:
 *   - `shape`  — a key of SHAPES (or of the `shapes` override map), sampled
 *                through sampleSvgPath; changing the prop retargets the
 *                cloud with a staggered spring morph (~1.2s), or
 *   - `points` — a raw Float32Array target (e.g. skylinePoints('napa', n)),
 *                which wins when both are given.
 *
 * Water cursor: the pointer ray is intersected with the sculpture plane and
 * pushes particles within `waterRadius` — displacement ∝ (1 − d/r) along the
 * push direction plus a slight z ripple; offsets spring back when the cursor
 * leaves. All per-frame math runs in place on typed arrays — zero
 * allocations inside useFrame.
 */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aScale;
  attribute float aSeed;
  varying float vSeed;
  varying float vFade;

  void main() {
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.8 + 0.2 * sin(uTime * (0.8 + aSeed) + aSeed * 40.0);
    gl_PointSize = uSize * aScale * twinkle * uPixelRatio * (14.0 / -mv.z);
    vFade = smoothstep(26.0, 8.0, -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vSeed;
  varying float vFade;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.42, 0.06, d);
    float halo = smoothstep(0.5, 0.3, d) * 0.22;
    float a = (core + halo) * uOpacity * vFade;
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uColorA, uColorB, vSeed), a);
  }
`;

/* module-scope temps — reused every frame, never allocated per-frame */
const _rayDir = new THREE.Vector3();
const _planePt = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _hit = new THREE.Vector3();

export interface ParticleSculptureProps {
  /** key of SHAPES (or of the `shapes` override map) — the morph target */
  shape?: ShapeName | (string & {});
  /** merge-over-SHAPES path data overrides (same 0 0 100 100 convention) */
  shapes?: Record<string, string>;
  /** raw target points (x,y,z triplets in [-1,1]) — e.g. skylinePoints(); wins over `shape` */
  points?: Float32Array;
  count?: number;
  /** base point size, world-ish units (0.035 ≈ fine dust, 0.06 ≈ chunky) */
  size?: number;
  color?: string;
  colorB?: string;
  opacity?: number;
  position?: [number, number, number];
  scale?: number;
  /** water cursor radius in sculpture-local units (the cloud spans [-1,1]) */
  waterRadius?: number;
  /** water push strength in sculpture-local units */
  waterStrength?: number;
}

/** Copy `src` triplets into `out`, wrapping with jitter when out is longer. */
function fitTargets(src: Float32Array, out: Float32Array) {
  const n = Math.floor(src.length / 3);
  const count = out.length / 3;
  if (n === 0) return;
  for (let i = 0; i < count; i++) {
    const j = i % n;
    const wrap = i >= n;
    out[i * 3] = src[j * 3] + (wrap ? (Math.random() - 0.5) * 0.02 : 0);
    out[i * 3 + 1] = src[j * 3 + 1] + (wrap ? (Math.random() - 0.5) * 0.02 : 0);
    out[i * 3 + 2] = src[j * 3 + 2] + (wrap ? (Math.random() - 0.5) * 0.02 : 0);
  }
}

export default function ParticleSculpture({
  shape = 'cato',
  shapes,
  points,
  count = 2200,
  size = 0.035,
  color = '#2e4bff',
  colorB = '#93a9ff',
  opacity = 0.75,
  position = [0, 0, 0],
  scale = 1,
  waterRadius = 0.35,
  waterStrength = 0.2,
}: ParticleSculptureProps) {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const effCount = Math.max(64, Math.round(count * q.particles));

  /* ---- geometry + material + CPU-side particle state (typed arrays) ---- */
  const sim = useMemo(() => {
    const positions = new Float32Array(effCount * 3);
    const scales = new Float32Array(effCount);
    const seeds = new Float32Array(effCount);
    const base = new Float32Array(effCount * 3); // spring-integrated position
    const target = new Float32Array(effCount * 3); // current morph target
    const offset = new Float32Array(effCount * 3); // smoothed water displacement
    const rate = new Float32Array(effCount); // per-particle spring rate
    const delay = new Float32Array(effCount); // per-particle morph stagger
    for (let i = 0; i < effCount; i++) {
      // scattered shell start → the first morph "assembles out of light"
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r = 1.4 + Math.random() * 1.2;
      positions[i * 3] = base[i * 3] = r * Math.sin(ph) * Math.cos(th);
      positions[i * 3 + 1] = base[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      positions[i * 3 + 2] = base[i * 3 + 2] = r * Math.cos(ph);
      scales[i] = 0.5 + Math.random() * 1.2;
      seeds[i] = Math.random();
      rate[i] = 3.4 + seeds[i] * 2.6; // settles over ~1.2s
      delay[i] = seeds[i] * 0.45; // stagger window
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: size * 100 },
        uPixelRatio: { value: 1 },
        uColorA: { value: new THREE.Color(color) },
        uColorB: { value: new THREE.Color(colorB) },
        uOpacity: { value: opacity },
      },
    });
    return {
      geometry,
      material,
      positions,
      base,
      target,
      offset,
      rate,
      delay,
      seeds,
      morphStart: -1,
      pendingMorph: true,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effCount]);

  /* free imperative GPU resources on unmount / rebuild */
  useEffect(() => {
    return () => {
      sim.geometry.dispose();
      sim.material.dispose();
    };
  }, [sim]);

  /* live uniform updates when visual props change */
  useEffect(() => {
    sim.material.uniforms.uSize.value = size * 100;
    sim.material.uniforms.uOpacity.value = opacity;
    (sim.material.uniforms.uColorA.value as THREE.Color).set(color);
    (sim.material.uniforms.uColorB.value as THREE.Color).set(colorB);
  }, [sim, size, opacity, color, colorB]);

  const shapeLib = useMemo<Record<string, string>>(
    () => ({ ...SHAPES, ...shapes }),
    [shapes],
  );

  /* ---- retarget: sample the new shape and kick off a morph ---- */
  useEffect(() => {
    let src: Float32Array | null = null;
    if (points) {
      src = points;
    } else {
      const pathData = shapeLib[shape] ?? shapeLib.cato;
      src = sampleSvgPath(pathData, effCount);
    }
    if (points) fitTargets(src, sim.target);
    else sim.target.set(src.subarray(0, effCount * 3));

    if (!q.animate) {
      // reduced motion: snap straight to the shape, no morph
      sim.base.set(sim.target);
      sim.positions.set(sim.target);
      sim.offset.fill(0);
      sim.geometry.getAttribute('position').needsUpdate = true;
      sim.pendingMorph = false;
      sim.morphStart = -1;
    } else {
      sim.pendingMorph = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim, shape, shapeLib, points, effCount, q.animate]);

  useFrame((state, delta) => {
    const { material, geometry } = sim;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    if (!q.animate) return; // static composition for reduced motion

    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05); // clamp tab-switch spikes
    const n = effCount;
    const { positions: pos, base, target, offset, rate, delay, seeds } = sim;

    if (sim.pendingMorph) {
      sim.morphStart = t;
      sim.pendingMorph = false;
    }

    /* -- water cursor: pointer ray → sculpture-local plane point -- */
    const g = group.current;
    let water = false;
    let cx = 0;
    let cy = 0;
    if (g && pointer.active) {
      g.updateWorldMatrix(true, false);
      g.getWorldPosition(_planePt);
      state.camera.getWorldDirection(_normal);
      _rayDir.set(pointer.x, pointer.y, 0.5).unproject(state.camera).sub(state.camera.position).normalize();
      const denom = _rayDir.dot(_normal);
      if (Math.abs(denom) > 1e-4) {
        _hit.copy(_planePt).sub(state.camera.position);
        const s = _hit.dot(_normal) / denom;
        if (s > 0) {
          _hit.copy(state.camera.position).addScaledVector(_rayDir, s);
          g.worldToLocal(_hit);
          cx = _hit.x;
          cy = _hit.y;
          water = true;
        }
      }
    }

    const r = waterRadius;
    const r2 = r * r;
    const strength = waterStrength;
    const kOff = 1 - Math.exp(-9 * dt);
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const sd = seeds[i];
      let bx = base[i3];
      let by = base[i3 + 1];
      let bz = base[i3 + 2];

      /* staggered damped spring toward the morph target */
      const mt = t - sim.morphStart - delay[i];
      if (mt > 0) {
        const k = 1 - Math.exp(-rate[i] * dt);
        bx += (target[i3] - bx) * k;
        by += (target[i3 + 1] - by) * k;
        bz += (target[i3 + 2] - bz) * k;
        base[i3] = bx;
        base[i3 + 1] = by;
        base[i3 + 2] = bz;
      }

      /* idle breathing wobble, faded in as each particle settles */
      const settle = mt <= 0 ? 0 : mt > 1 ? 1 : mt;
      const wt = t * (0.6 + sd * 0.7) + sd * 39.7;
      const wx = Math.sin(wt) * 0.009 * settle;
      const wy = Math.cos(wt * 0.83) * 0.009 * settle;
      const wz = Math.sin(wt * 0.61) * 0.006 * settle;

      /* water displacement — desired offset, smoothed by `offset` */
      let dx = 0;
      let dy = 0;
      let dz = 0;
      if (water) {
        const rx = bx - cx;
        const ry = by - cy;
        const d2 = rx * rx + ry * ry;
        if (d2 < r2) {
          const d = Math.sqrt(d2) || 1e-4;
          const f = 1 - d / r;
          const inv = 1 / d;
          dx = rx * inv * f * strength;
          dy = ry * inv * f * strength;
          dz = f * (0.12 + 0.08 * Math.sin(d * 9 - t * 5)) * strength * 4;
        }
      }
      offset[i3] += (dx - offset[i3]) * kOff;
      offset[i3 + 1] += (dy - offset[i3 + 1]) * kOff;
      offset[i3 + 2] += (dz - offset[i3 + 2]) * kOff;

      pos[i3] = bx + wx + offset[i3];
      pos[i3 + 1] = by + wy + offset[i3 + 1];
      pos[i3 + 2] = bz + wz + offset[i3 + 2];
    }
    attr.needsUpdate = true;
  });

  return (
    <group ref={group} position={position} scale={scale}>
      <points
        geometry={sim.geometry}
        material={sim.material}
        frustumCulled={false}
      />
    </group>
  );
}
