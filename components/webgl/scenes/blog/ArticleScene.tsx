'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { GlassMaterial, GradientGlassMaterial } from '../../lib/materials';
import { useQuality } from '../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../scroll-store';
import { useHotspotReporter } from '../../kit/ProximityType';

/**
 * ArticleScene — "Harmonograph".
 *
 * In the right margin, a pendulum-driven prism pen traces a lateral
 * harmonograph figure across an ice-glass platen framed by a gradient-glass
 * bezel as the essay is read. Reading progress through `feature` is the
 * pendulums' clock, so the figure completes as you reach the end of the
 * article, and scrolling back erases it in reverse. Across `cta` the finished
 * harmonograph tilts serenely into view.
 *
 * Zero allocations in useFrame; mount-relative intro; reduced motion renders
 * the finished figure immediately.
 */

const SAMPLES = 7000;
const T_MAX = 92;
const PX: readonly (readonly [number, number, number, number])[] = [
  [0.78, 3.001, 0.0, 0.013],
  [0.62, 2.0, Math.PI / 2, 0.009],
];
const PY: readonly (readonly [number, number, number, number])[] = [
  [0.78, 2.0, Math.PI / 3, 0.011],
  [0.62, 3.003, 0.25, 0.015],
];

function harmonograph(t: number, axis: typeof PX): number {
  let v = 0;
  for (let i = 0; i < axis.length; i++) {
    const [a, f, p, d] = axis[i];
    v += a * Math.sin(f * t + p) * Math.exp(-d * t);
  }
  return v;
}

const lineVertex = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lineFragment = /* glsl */ `
  uniform float uProg;
  uniform float uOpacity;
  uniform vec3 uIce;
  uniform vec3 uBlue;
  uniform vec3 uDeep;
  varying float vT;
  void main() {
    if (vT > uProg) discard;
    float age = uProg - vT;
    float fresh = exp(-age * 9.0);
    vec3 col = mix(uIce, uBlue, 0.35 + 0.65 * fresh);
    col = mix(col, uDeep, exp(-age * 60.0) * 0.6);
    float a = (0.36 + 0.64 * fresh) * uOpacity;
    gl_FragColor = vec4(col, a);
  }
`;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* module-scope temps */
const _cam = new THREE.Vector3();

export default function ArticleScene() {
  const q = useQuality();
  const startAt = useRef<number | null>(null);
  const group = useRef<THREE.Group>(null);
  const platen = useRef<THREE.Group>(null);
  const pen = useRef<THREE.Group>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const report = useHotspotReporter('article-dot');

  const { geometry, material, line } = useMemo(() => {
    const pos = new Float32Array(SAMPLES * 3);
    const ts = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) {
      const u = i / (SAMPLES - 1);
      const t = u * T_MAX;
      pos[i * 3] = harmonograph(t, PX);
      pos[i * 3 + 1] = harmonograph(t, PY);
      pos[i * 3 + 2] = 0;
      ts[i] = u;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('aT', new THREE.BufferAttribute(ts, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: lineVertex,
      fragmentShader: lineFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uProg: { value: 0 },
        uOpacity: { value: 0 },
        uIce: { value: new THREE.Color('#b3c3ff') },
        uBlue: { value: new THREE.Color('#2e4bff') },
        uDeep: { value: new THREE.Color('#1226c8') },
      },
    });
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    return { geometry, material, line };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    if (startAt.current === null) startAt.current = state.clock.elapsedTime;
    const el = state.clock.elapsedTime - startAt.current;
    const anim = q.animate;
    const g = group.current;
    if (!g) return;
    const compact = q.compact;

    const hero = anim ? getSectionProgress('hero') : 1;
    const feature = anim ? getSectionProgress('feature') : 1;
    const cta = anim ? getSectionProgress('cta') : 0;
    const ctaSettle = smooth(sectionRange(cta, 0.15, 0.72));

    /* a first breath of ink while the header is read; the rest is the body */
    const prog = anim
      ? clamp01(
          0.03 * smooth(sectionRange(hero, 0.25, 1)) +
            0.97 * sectionRange(feature, 0.05, 0.9),
        )
      : 1;
    const intro = anim ? smooth(Math.min(el / 1.75, 1)) : 1;

    /* right margin framing; gentle rise and centre-ward poise on cta */
    const tx = (compact ? 0.95 : 2.55) - ctaSettle * (compact ? 0.2 : 0.35);
    if (anim) g.position.x += (tx - g.position.x) * 0.05;
    else g.position.x = tx;
    g.position.y =
      (compact ? 1.25 : 0.05) - (1 - intro) * 0.6 + ctaSettle * 0.55;
    g.scale.setScalar((compact ? 0.55 : 1.1) * (0.94 + 0.06 * intro));

    const p = platen.current;
    if (p) {
      const targetRx =
        -0.18 + ctaSettle * 0.08 - (anim ? pointer.y * 0.12 : 0);
      const targetRy =
        -0.22 + ctaSettle * 0.1 + (anim ? pointer.x * 0.16 : 0);
      if (anim) {
        p.rotation.x += (targetRx - p.rotation.x) * 0.05;
        p.rotation.y += (targetRy - p.rotation.y) * 0.05;
      } else {
        p.rotation.set(targetRx, targetRy, 0);
      }
    }

    material.uniforms.uProg.value = prog;
    material.uniforms.uOpacity.value = intro * (compact ? 0.45 : 1);

    /* the prism-and-sapphire pen rides the leading point of the curve */
    const pm = pen.current;
    if (pm) {
      const t = prog * T_MAX;
      pm.position.set(harmonograph(t, PX), harmonograph(t, PY), 0.025);
      const breath = anim ? Math.sin(el * 1.4) : 0;
      pm.scale.setScalar(Math.max(intro * (1 + breath * 0.06), 0.001));
      if (haloMat.current) {
        haloMat.current.opacity = 0.2 * intro * (compact ? 0.5 : 1);
      }
      report(pm, state.camera, (0.45 + 0.1 * breath) * intro);
    }

    _cam.set(
      anim ? pointer.x * 0.25 : 0,
      0.05 + (anim ? pointer.y * 0.15 : 0),
      9.4 - ctaSettle * 0.25,
    );
    if (anim) state.camera.position.lerp(_cam, 0.05);
    else state.camera.position.copy(_cam);

    state.camera.lookAt(compact ? 0.4 : 0.65, 0, 0);
  });

  return (
    <group>
      <SceneLightRig intensity={0.9} />
      <group ref={group}>
        <group ref={platen}>
          {/* ice-glass platen disc facing the reader in the XY plane */}
          <mesh position={[0, 0, -0.045]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.62, 1.62, 0.04, 96]} />
            <GlassMaterial kind="ice" />
          </mesh>

          {/* calibrated gradient-glass bezel framing the platen */}
          <mesh position={[0, 0, -0.022]}>
            <torusGeometry args={[1.635, 0.015, 16, 112]} />
            <GradientGlassMaterial opacity={0.9} />
          </mesh>

          <primitive object={line} />

          {/* prism bead pen with sapphire nib & soft halo */}
          <group ref={pen}>
            <mesh>
              <sphereGeometry args={[0.072, 24, 24]} />
              <GlassMaterial kind="prism" />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.036, 20, 20]} />
              <meshBasicMaterial color="#1226c8" toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, -0.012]}>
              <circleGeometry args={[0.16, 32]} />
              <meshBasicMaterial
                ref={haloMat}
                color="#93a9ff"
                transparent
                opacity={0}
                depthWrite={false}
              />
            </mesh>
          </group>
        </group>
      </group>
      <ParticleField
        count={Math.floor(520 * q.particles)}
        drift={q.animate ? 0.07 : 0}
        opacity={0.22}
        size={0.026}
      />
    </group>
  );
}
