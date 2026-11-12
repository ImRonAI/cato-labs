'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { GlassMaterial, GradientGlassMaterial } from '../../../lib/materials';
import type { Quality } from '../../../lib/quality';
import {
  getSectionProgress,
  pointer,
  sectionRange,
  smooth,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import ShockRing, { useShockMaterial } from '../../industries/lib-b/ShockRing';
import { heroWeight, outroWeight, practiceWeight } from './util';
import { cradleBus } from './cradle-bus';

/**
 * NewtonsCradle — the /capabilities signature instrument.
 *
 * Six glass spheres, one per practice, hang bifilar from two gradient-glass
 * rails above a calibrated structural glass datum plinth. Each practice
 * section (`strategy`, `agents`, `product`, `brand`, `growth`, `operations`)
 * that enters the viewport triggers a physical strike: the raised end sphere
 * falls on a cosine pendulum arc, a shock-ring ripples across the plinth at
 * impact, momentum travels through the row as a pulse of electric light, and
 * the far sphere rises on the matching sine. Each sphere also carries a fine
 * refractive equatorial halo that awakens while its practice is read.
 * In `cap-outro`, the cradle comes to rest and all six spheres resonate as one.
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
  /** continuous active practice index 0..5 across the six sections */
  focusIdx: number;
  /** 0..1 — how strongly a practice section is currently being read */
  focusStrength: number;
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
  const halos = useRef<(THREE.Mesh | null)[]>([]);
  const cores = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const shadows = useRef<(THREE.Mesh | null)[]>([]);
  const rails = useRef<THREE.Group>(null);
  const plinth = useRef<THREE.Mesh>(null);
  const start = useRef<number | null>(null);
  const lit = useRef<number[]>(Array(N).fill(0));
  const pos = useRef({ x: 2.55, y: -0.55, z: 0, s: 0.74, yaw: -0.36 });

  const report = useHotspotReporter('cap-cradle');
  const strikeRing = useShockMaterial({
    speed: 1.35,
    width: 0.028,
    color: '#2e4bff',
    hot: '#dce4ff',
  });

  /* bifilar strings: 2 per sphere, 2 verts each — mutated in place */
  const strings = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(N * 4 * 3), 3),
    );
    return g;
  }, []);

  /* calibrated datum ticks along the plinth */
  const ticksGeo = useMemo(() => {
    const segs: number[] = [];
    const y = GROUND + 0.004;
    for (let j = 0; j < N; j++) {
      const x = pivotX(j);
      segs.push(x, y, -0.52, x, y, 0.52);
    }
    segs.push(pivotX(0) - 0.55, y, 0, pivotX(N - 1) + 0.55, y, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
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
      ticksGeo.dispose();
      shadowMat.dispose();
    },
    [strings, ticksGeo, shadowMat],
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

    /* compute weighted practice focus so camera + stage respond per-practice */
    let wSum = 0;
    let idxSum = 0;
    let maxW = 0;
    let leadIdx = 2;
    for (let j = 0; j < N; j++) {
      const w = practiceWeight(getSectionProgress(SECTION_IDS[j]));
      wSum += w;
      idxSum += w * j;
      if (w > maxW) {
        maxW = w;
        leadIdx = j;
      }
    }
    const focusIdx = wSum > 0.01 ? idxSum / wSum : 2.5;
    shared.current.hero = hero;
    shared.current.outro = outro;
    shared.current.focusIdx = focusIdx;
    shared.current.focusStrength = Math.min(1, maxW);

    const c = q.compact;
    const practicePan = (focusIdx - 2.5) * 0.08 * mid;
    const tx = c ? 0 : hero * 2.52 + mid * (2.32 - practicePan) + outro * 0.25;
    const ty = c
      ? hero * 1.2 + mid * 1.35 + outro * 1.75
      : hero * -0.5 + mid * -0.06 + outro * 1.35;
    const tz = c ? -2.6 - outro * 1 : hero * -0.35 + outro * -3.1;
    const ts = c ? 0.82 : hero * 0.74 + mid * 0.8 + outro * 0.72;
    const practiceYaw = -0.38 + (focusIdx / (N - 1)) * 0.22;
    const tyaw = (c ? -0.28 : hero * -0.36 + mid * practiceYaw) * (1 - outro) + outro * -0.1;

    const p = pos.current;
    const k = anim ? 0.05 : 1;
    p.x += (tx - p.x) * k;
    p.y += (ty - p.y) * k;
    p.z += (tz - p.z) * k;
    p.s += (ts - p.s) * k;
    p.yaw += (tyaw - p.yaw) * k;

    const g = stage.current;
    const intro = anim ? smooth(Math.min(since / 2.0, 1)) : 1;
    if (g) {
      g.position.set(p.x, p.y + (1 - intro) * 0.55, p.z);
      g.scale.setScalar(p.s * (0.9 + 0.1 * intro));
      g.rotation.y = p.yaw;
    }
    const tg = tilt.current;
    if (tg) {
      const ry = anim ? pointer.x * 0.16 : 0;
      const rx = anim ? -pointer.y * 0.055 : 0;
      tg.rotation.y += (ry - tg.rotation.y) * (anim ? 0.045 : 1);
      tg.rotation.x += (rx - tg.rotation.x) * (anim ? 0.045 : 1);
    }

    /* ---------- the strikes ---------- */
    let thetaL = -THETA0; // hero: the first sphere is drawn back
    let thetaR = 0;
    let pulse = -10; // position of the momentum pulse along the row
    let pulseAmp = 0;
    let impactTau = 0;

    if (anim) {
      let last = -1;
      let a = 0;
      for (let i = 0; i < N; i++) {
        const v = sectionRange(getSectionProgress(SECTION_IDS[i]), 0.02, 0.42);
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
        if (a >= 0.48) {
          impactTau = (a - 0.48) * 3.2;
        }
        const pt = sectionRange(a, 0.47, 0.68);
        if (pt > 0 && pt < 1) {
          pulse = fromLeft ? pt * (N - 1) : (1 - pt) * (N - 1);
          pulseAmp = Math.sin(pt * Math.PI) * 0.65 + 0.35;
        }
      }
      /* outro: the last raised sphere settles to rest */
      const settle = smooth(sectionRange(getSectionProgress('cap-outro'), 0.04, 0.42));
      thetaL *= 1 - settle;
      thetaR *= 1 - settle;
      const breath = Math.sin(t * 0.9) * 0.012;
      if (thetaL < -0.01) thetaL += breath;
      if (thetaR > 0.01) thetaR += breath;
    }

    strikeRing.uniforms.uTau.value = anim ? impactTau : 0;

    /* ---------- spheres, equatorial halos, cores, strings, shadows ---------- */
    const arr = strings.attributes.position.array as Float32Array;
    const hover = cradleBus.hover;
    for (let j = 0; j < N; j++) {
      const th = j === 0 ? thetaL : j === N - 1 ? thetaR : 0;
      const bx = pivotX(j) + L * Math.sin(th);
      const by = H - L * Math.cos(th);
      const drop = anim
        ? 1 - smooth(Math.min(Math.max((since - 0.16 - j * 0.08) / 1.05, 0), 1))
        : 0;
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

      const reading = practiceWeight(getSectionProgress(SECTION_IDS[j]));
      const pz = Math.max(0, 1 - Math.abs(pulse - j) * 1.1) * pulseAmp;
      const target = Math.min(
        1,
        Math.max(reading, pz, hover === j ? 0.85 : 0, outro * 0.85),
      );
      const l = (lit.current[j] +=
        (target - lit.current[j]) * (anim ? (pz > 0 ? 0.35 : 0.09) : 1));

      const core = cores.current[j];
      if (core) core.scale.setScalar(0.32 + l * 0.72);

      const halo = halos.current[j];
      if (halo) {
        halo.scale.setScalar(Math.max(0.0001, l * intro));
        halo.rotation.x = Math.PI / 2 + (anim ? Math.sin(t * 1.1 + j) * 0.22 : 0.12);
        halo.rotation.y = anim ? t * 0.45 + j : 0.4;
      }

      const m = mats.current[j];
      if (m) {
        m.color.copy(_c.copy(ICE).lerp(LIT, l * 0.78));
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

    const activeBall = balls.current[leadIdx];
    if (activeBall) {
      report(activeBall, state.camera, 0.45 + maxW * 0.45 + outro * 0.2);
    }

    if (rails.current) {
      const ri = anim ? smooth(Math.min(since / 1.35, 1)) : 1;
      rails.current.scale.x = Math.max(ri, 0.001);
    }
    if (plinth.current) {
      const pi = anim ? smooth(Math.min(since / 1.45, 1)) : 1;
      plinth.current.scale.set(Math.max(pi, 0.001), 1, Math.max(pi, 0.001));
    }
  });

  const railLen = (N - 1) * SPACING + 2.6;

  return (
    <group ref={stage} position={[2.55, -0.55, 0]} rotation={[0, -0.36, 0]} scale={0.74}>
      <group ref={tilt}>
        {/* two hairline gradient-glass rails */}
        <group ref={rails}>
          {[ZR, -ZR].map((z) => (
            <mesh key={z} position={[0, H, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.016, 0.016, railLen, 12]} />
              <GradientGlassMaterial opacity={0.92} />
            </mesh>
          ))}
        </group>

        <lineSegments geometry={strings}>
          <lineBasicMaterial color="#7d97ff" transparent opacity={0.58} />
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
                thickness={1.45}
                iridescence={0.38}
                iridescenceIOR={1.3}
              />
            </mesh>
            {/* refractive equatorial halo — awakens when this practice is active */}
            <mesh
              ref={(m) => {
                halos.current[j] = m;
              }}
              scale={0.0001}
            >
              <torusGeometry args={[R * 1.34, 0.012, 14, 64]} />
              <GlassMaterial kind="prism" />
            </mesh>
            {/* the electric core — refracted through the sphere */}
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

        {/* calibrated structural glass datum plinth + hairline practice ticks */}
        <RoundedBox
          ref={plinth}
          args={[railLen + 0.4, 0.055, 1.55]}
          radius={0.022}
          smoothness={3}
          position={[0, GROUND - 0.032, 0]}
        >
          <GlassMaterial kind="pane" />
        </RoundedBox>
        <lineSegments geometry={ticksGeo}>
          <lineBasicMaterial color="#6b87ff" transparent opacity={0.32} depthWrite={false} />
        </lineSegments>

        {/* strike shockwave ring across the datum plinth */}
        <ShockRing
          material={strikeRing}
          radius={2.8}
          position={[0, GROUND + 0.006, 0]}
        />

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
