'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GlassMaterial, GradientGlassMaterial } from '../../../lib/materials';
import type { Quality } from '../../../lib/quality';
import {
  getSectionProgress,
  pointer,
  sectionRange,
  smooth,
} from '../../../scroll-store';
import { heroWeight, outroWeight, practiceWeight } from './util';
import { cradleBus } from './cradle-bus';

/**
 * NewtonsCradle — the /capabilities signature moment.
 *
 * Six glass spheres, one per practice, hang bifilar from two hairline rails.
 * Each practice section that enters the viewport is one strike: the raised
 * end sphere falls on a true pendulum quarter-period (cosine), momentum
 * travels through the row as a pulse of electric light, and the far sphere
 * rises on the matching sine. Strikes alternate ends, exactly as a real
 * cradle does, and every value derives from section progress, so scrolling
 * up rewinds the motion exactly. The sphere of the practice you are reading
 * holds the light; in the outro the cradle settles and all six glow as one.
 */

export const SECTION_IDS = [
  'strategy',
  'agents',
  'product',
  'brand',
  'growth',
  'operations',
] as const;

const N = 6;
const R = 0.3; // sphere radius
const L = 1.9; // effective pendulum length
const H = 1.3; // rail height
const ZR = 0.46; // rail half-separation (bifilar suspension)
const THETA0 = 0.56; // strike amplitude (rad)
const SPACING = R * 2 + 0.004;
const GROUND = H - L - R - 0.62;

const ICE = new THREE.Color('#dfe7ff');
const LIT = new THREE.Color('#4a66ff');
const ATT_ICE = new THREE.Color('#aebdff');
const ATT_LIT = new THREE.Color('#2e4bff');

/* module temps — no allocation inside useFrame */
const _c = new THREE.Color();

const pivotX = (j: number) => (j - (N - 1) / 2) * SPACING;

const shadowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const shadowFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    gl_FragColor = vec4(0.07, 0.1, 0.32, a * a * uOpacity);
  }
`;

export interface CradleState {
  /** 0..1 — how much of the hero / outro staging is active (for the camera) */
  hero: number;
  outro: number;
}

export default function NewtonsCradle({
  q,
  state: shared,
}: {
  q: Quality;
  state: React.MutableRefObject<CradleState>;
}) {
  const stage = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const balls = useRef<(THREE.Group | null)[]>([]);
  const cores = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const shadows = useRef<(THREE.Mesh | null)[]>([]);
  const rails = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const lit = useRef<number[]>(Array(N).fill(0));
  const pos = useRef({ x: 2.55, y: -0.55, z: 0, s: 0.74, yaw: -0.36 });

  /* bifilar strings: 2 per sphere, 2 verts each — mutated in place */
  const strings = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(N * 4 * 3), 3),
    );
    return g;
  }, []);
  const shadowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: shadowVertex,
        fragmentShader: shadowFragment,
        transparent: true,
        depthWrite: false,
        uniforms: { uOpacity: { value: 0.22 } },
      }),
    [],
  );
  useEffect(
    () => () => {
      strings.dispose();
      shadowMat.dispose();
    },
    [strings, shadowMat],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (start.current === null) start.current = t;
    const since = t - start.current;
    const anim = q.animate;

    /* ---------- staging: hero → practices → outro ---------- */
    const hero = heroWeight(getSectionProgress('cap-hero'));
    const outro = outroWeight(getSectionProgress('cap-outro'));
    const mid = Math.max(0, 1 - hero - outro);
    shared.current.hero = hero;
    shared.current.outro = outro;

    const c = q.compact;
    const tx = c ? 0 : hero * 2.55 + mid * 2.35;
    const ty = c
      ? hero * 1.2 + mid * 1.35 + outro * 1.75
      : hero * -0.55 + mid * -0.1 + outro * 1.45;
    const tz = c ? -2.6 - outro * 1 : outro * -3.4;
    const ts = c ? 0.82 : hero * 0.74 + mid * 0.76 + outro * 0.7;
    const tyaw = (c ? -0.3 : -0.36) * (1 - outro) + outro * -0.12;
    const p = pos.current;
    const k = anim ? 0.05 : 1;
    p.x += (tx - p.x) * k;
    p.y += (ty - p.y) * k;
    p.z += (tz - p.z) * k;
    p.s += (ts - p.s) * k;
    p.yaw += (tyaw - p.yaw) * k;

    const g = stage.current;
    if (g) {
      const intro = anim ? smooth(Math.min(since / 2.2, 1)) : 1;
      g.position.set(p.x, p.y + (1 - intro) * 0.5, p.z);
      g.scale.setScalar(p.s * (0.92 + 0.08 * intro));
      g.rotation.y = p.yaw;
    }
    const tg = tilt.current;
    if (tg) {
      const ry = anim ? pointer.x * 0.16 : 0;
      const rx = anim ? -pointer.y * 0.05 : 0;
      tg.rotation.y += (ry - tg.rotation.y) * (anim ? 0.04 : 1);
      tg.rotation.x += (rx - tg.rotation.x) * (anim ? 0.04 : 1);
    }

    /* ---------- the strikes ---------- */
    let thetaL = -THETA0; // hero: the first sphere is drawn back
    let thetaR = 0;
    let pulse = -10; // position of the momentum pulse along the row
    let pulseAmp = 0;
    if (anim) {
      let last = -1;
      let a = 0;
      for (let i = 0; i < N; i++) {
        const v = sectionRange(getSectionProgress(SECTION_IDS[i]), 0.02, 0.4);
        if (v > 0) {
          last = i;
          a = v;
        }
      }
      if (last >= 0) {
        const fromLeft = last % 2 === 0;
        const fall = a < 0.5 ? THETA0 * Math.cos((Math.PI / 2) * (a / 0.5)) : 0;
        const rise = a >= 0.5 ? THETA0 * Math.sin((Math.PI / 2) * ((a - 0.5) / 0.5)) : 0;
        if (fromLeft) {
          thetaL = -fall;
          thetaR = rise;
        } else {
          thetaR = fall;
          thetaL = -rise;
        }
        const pt = sectionRange(a, 0.47, 0.66);
        if (pt > 0 && pt < 1) {
          pulse = fromLeft ? pt * (N - 1) : (1 - pt) * (N - 1);
          pulseAmp = Math.sin(pt * Math.PI) * 0.6 + 0.4;
        }
      }
      /* outro: the last raised sphere settles to rest */
      const settle = smooth(sectionRange(getSectionProgress('cap-outro'), 0.04, 0.42));
      thetaL *= 1 - settle;
      thetaR *= 1 - settle;
      /* the barest breath while a sphere is held at its apex */
      const breath = Math.sin(t * 0.9) * 0.012;
      if (thetaL < -0.01) thetaL += breath;
      if (thetaR > 0.01) thetaR += breath;
    }

    /* ---------- spheres, cores, strings, shadows ---------- */
    const arr = strings.attributes.position.array as Float32Array;
    const hover = cradleBus.hover;
    for (let j = 0; j < N; j++) {
      const th = j === 0 ? thetaL : j === N - 1 ? thetaR : 0;
      const bx = pivotX(j) + L * Math.sin(th);
      const by = H - L * Math.cos(th);
      const drop = anim ? 1 - smooth(Math.min(Math.max((since - 0.2 - j * 0.09) / 1.1, 0), 1)) : 0;
      const b = balls.current[j];
      if (b) b.position.set(bx, by + drop * 0.9, 0);

      const o = j * 12;
      arr[o] = bx;
      arr[o + 1] = by + drop * 0.9;
      arr[o + 2] = 0;
      arr[o + 3] = pivotX(j);
      arr[o + 4] = H;
      arr[o + 5] = ZR;
      arr[o + 6] = bx;
      arr[o + 7] = by + drop * 0.9;
      arr[o + 8] = 0;
      arr[o + 9] = pivotX(j);
      arr[o + 10] = H;
      arr[o + 11] = -ZR;

      /* light: practice in view, the passing pulse, hover, the outro chord */
      const reading = practiceWeight(getSectionProgress(SECTION_IDS[j]));
      const pz = Math.max(0, 1 - Math.abs(pulse - j) * 1.1) * pulseAmp;
      const target = Math.min(
        1,
        Math.max(reading, pz, hover === j ? 0.85 : 0, outro * 0.8),
      );
      const l = (lit.current[j] += (target - lit.current[j]) * (anim ? (pz > 0 ? 0.35 : 0.08) : 1));

      const core = cores.current[j];
      if (core) core.scale.setScalar(0.32 + l * 0.68);
      const m = mats.current[j];
      if (m) {
        m.color.copy(_c.copy(ICE).lerp(LIT, l * 0.75));
        m.attenuationColor.copy(_c.copy(ATT_ICE).lerp(ATT_LIT, l));
      }
      const sh = shadows.current[j];
      if (sh) {
        const lift = by - (H - L);
        sh.position.set(bx, GROUND, 0);
        sh.scale.setScalar(0.95 + lift * 0.9);
      }
    }
    strings.attributes.position.needsUpdate = true;

    if (rails.current) {
      const ri = anim ? smooth(Math.min(since / 1.4, 1)) : 1;
      rails.current.scale.x = Math.max(ri, 0.001);
    }
  });

  const railLen = (N - 1) * SPACING + 2.6;

  return (
    <group ref={stage} position={[2.55, -0.55, 0]} rotation={[0, -0.36, 0]} scale={0.74}>
      <group ref={tilt}>
        {/* two hairline glass rails — the cradle floats, no frame */}
        <group ref={rails}>
          {[ZR, -ZR].map((z) => (
            <mesh key={z} position={[0, H, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.016, 0.016, railLen, 10]} />
              <GradientGlassMaterial opacity={0.9} />
            </mesh>
          ))}
        </group>

        <lineSegments geometry={strings}>
          <lineBasicMaterial color="#7d97ff" transparent opacity={0.55} />
        </lineSegments>

        {Array.from({ length: N }, (_, j) => (
          <group
            key={j}
            ref={(el) => {
              balls.current[j] = el;
            }}
            position={[pivotX(j), H - L, 0]}
          >
            <mesh>
              <sphereGeometry args={[R, 48, 32]} />
              <GlassMaterial
                ref={(m) => {
                  mats.current[j] = m;
                }}
                kind="crystal"
                thickness={1.4}
                iridescence={0.35}
                iridescenceIOR={1.3}
              />
            </mesh>
            {/* the electric core — refracted through the sphere, it carries the light */}
            <mesh
              ref={(m) => {
                cores.current[j] = m;
              }}
              scale={0.32}
            >
              <sphereGeometry args={[0.12, 20, 14]} />
              <meshBasicMaterial color="#2e4bff" toneMapped={false} />
            </mesh>
          </group>
        ))}

        {Array.from({ length: N }, (_, j) => (
          <mesh
            key={j}
            ref={(m) => {
              shadows.current[j] = m;
            }}
            material={shadowMat}
            position={[pivotX(j), GROUND, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={-1}
          >
            <planeGeometry args={[0.9, 0.9]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
