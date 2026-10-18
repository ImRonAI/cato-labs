'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { GlassMaterial } from '../../lib/materials';
import { useQuality } from '../../lib/quality';
import { getSectionProgress, sectionRange, smooth, pointer } from '../../scroll-store';
import { useHotspotReporter } from '../../kit/ProximityType';

/**
 * ArticleScene — "Harmonograph".
 *
 * In the right margin, a pendulum-driven pen traces a figure on a faint
 * glass platen as the article is read. The figure is a true lateral
 * harmonograph: two damped pendulums per axis, tuned a hair off a 3:2 ratio
 * so the loops precess, and the swing decays toward the centre. Reading
 * progress through the body (`feature`) is the pendulums' clock, so the
 * figure completes as you reach the end of the essay, and scrolling back
 * erases it in reverse. The pen is a small glass bead with a halo; the
 * newest stroke is electric blue, the older strokes cool to ice. The
 * platen tilts slightly toward the cursor.
 *
 * One line draw call, one bead, one platen. The curve is computed once;
 * the reveal is a uniform. Reduced motion shows the finished figure.
 */

const SAMPLES = 7000;
const T_MAX = 92;
/* pendulums: [amplitude, frequency, phase, damping] — x pair, y pair */
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
    float age = uProg - vT;                       // 0 at the pen
    float fresh = exp(-age * 9.0);
    vec3 col = mix(uIce, uBlue, 0.35 + 0.65 * fresh);
    col = mix(col, uDeep, exp(-age * 60.0) * 0.6);
    float a = (0.34 + 0.66 * fresh) * uOpacity;
    gl_FragColor = vec4(col, a);
  }
`;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* module-scope temps */
const _cam = new THREE.Vector3();

export default function ArticleScene() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const platen = useRef<THREE.Group>(null);
  const pen = useRef<THREE.Mesh>(null);
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
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const g = group.current;
    if (!g) return;
    const compact = q.compact;

    const hero = anim ? getSectionProgress('hero') : 1;
    const feature = anim ? getSectionProgress('feature') : 1;
    const cta = anim ? getSectionProgress('cta') : 0;
    /* a first breath of ink while the header is read; the rest is the body */
    const prog = anim
      ? clamp01(0.02 * smooth(sectionRange(hero, 0.3, 1)) + 0.98 * sectionRange(feature, 0.06, 0.9))
      : 1;
    const intro = anim ? smooth(Math.min(el / 1.8, 1)) : 1;

    /* the margin: right of the column; small and faint behind text on mobile */
    const tx = compact ? 0.95 : 2.55;
    g.position.x += (tx - g.position.x) * 0.05;
    g.position.y = (compact ? 1.25 : 0.05) - (1 - intro) * 0.6 + smooth(sectionRange(cta, 0.2, 0.7)) * 0.6;
    g.scale.setScalar(compact ? 0.55 : 1.1);

    const p = platen.current;
    if (p) {
      p.rotation.x += ((anim ? -0.18 - pointer.y * 0.12 : -0.18) - p.rotation.x) * 0.05;
      p.rotation.y += ((anim ? -0.22 + pointer.x * 0.16 : -0.22) - p.rotation.y) * 0.05;
    }

    material.uniforms.uProg.value = prog;
    material.uniforms.uOpacity.value = intro * (compact ? 0.42 : 1);

    /* the pen rides the leading point of the curve */
    const pm = pen.current;
    if (pm) {
      const t = prog * T_MAX;
      pm.position.set(harmonograph(t, PX), harmonograph(t, PY), 0.02);
      const pulse = anim ? 1 + Math.sin(el * 1.4) * 0.06 : 1;
      pm.scale.setScalar(Math.max(intro * pulse, 0.001));
      if (haloMat.current) haloMat.current.opacity = 0.18 * intro * (compact ? 0.5 : 1);
      report(pm, state.camera, (0.4 + 0.1 * Math.sin(el * 1.4)) * intro);
    }

    _cam.set(anim ? pointer.x * 0.25 : 0, 0.05 + (anim ? pointer.y * 0.15 : 0), 9.4);
    state.camera.position.lerp(_cam, 0.05);
    state.camera.lookAt(compact ? 0.4 : 0.65, 0, 0);
  });

  return (
    <group>
      <SceneLightRig intensity={0.9} />
      <group ref={group}>
        <group ref={platen}>
          {/* the platen: a faint glass disc the pen draws on */}
          <mesh position={[0, 0, -0.06]}>
            <cylinderGeometry args={[1.62, 1.62, 0.04, 96]} />
            <GlassMaterial kind="ice" transparent opacity={0.55} />
          </mesh>
          <primitive object={line} />
          <mesh ref={pen}>
            <sphereGeometry args={[0.045, 24, 24]} />
            <meshBasicMaterial color="#1226c8" toneMapped={false} />
            <mesh position={[0, 0, -0.005]}>
              <circleGeometry args={[0.15, 32]} />
              <meshBasicMaterial
                ref={haloMat}
                color="#93a9ff"
                transparent
                opacity={0}
                depthWrite={false}
              />
            </mesh>
          </mesh>
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
