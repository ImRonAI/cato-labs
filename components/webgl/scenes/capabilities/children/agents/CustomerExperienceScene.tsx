'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../../shared/SceneLightRig';
import ParticleField from '../../../shared/ParticleField';
import {
  GlassMaterial,
  GradientGlassMaterial,
  type GlassKind,
} from '../../../../lib/materials';
import { useQuality } from '../../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../../scroll-store';
import { useHotspotReporter } from '../../../../kit/ProximityType';
import {
  readDwell,
  clamp01,
  lerp,
  easeInOutSine,
  type DwellBeats,
} from './signature';

/**
 * CustomerExperienceScene — "The Calder Mobile".
 *
 * A suspended kinetic sculpture of gradient-glass balance arms, sapphire
 * fulcrum jewels, and five refractive touchpoint lenses encircled by prism
 * halos. Across the 280vh `signature` dwell, the five touchpoint lenses drop
 * one by one onto their hooks; each arrival tips its arm and sends a damped
 * torque wave through the entire mobile until the fifth touchpoint brings
 * every arm into exact horizontal equilibrium — many channels, one coherent
 * customer experience.
 *
 * Continues choreographing camera + stage through `feature`, `detail`, `faq`,
 * and `cta`. Hotspot 'cx-handoff' rides the central core touchpoint lens.
 * Zero allocations in useFrame; reduced motion renders the balanced mobile.
 */

interface Bar {
  parent: number;
  side: -1 | 1;
  drop: number;
  lL: number;
  lR: number;
}
interface Weight {
  bar: number;
  side: -1 | 1;
  drop: number;
  mass: number;
  kind: GlassKind;
  at: number;
}

/* arm lengths chosen so the fully weighted mobile hangs dead-level */
const BARS: Bar[] = [
  { parent: -1, side: 1, drop: 0.6, lL: (3.0 * 1.9) / 3.4, lR: (3.0 * 1.5) / 3.4 },
  { parent: 0, side: -1, drop: 0.78, lL: 0.8, lR: 0.7 },
  { parent: 0, side: 1, drop: 0.6, lL: (1.8 * 1.0) / 1.9, lR: (1.8 * 0.9) / 1.9 },
  { parent: 2, side: 1, drop: 0.55, lL: 0.4, lR: 0.6 },
];

const WEIGHTS: Weight[] = [
  { bar: 1, side: -1, drop: 0.5, mass: 0.7, kind: 'azure', at: 0.1 },
  { bar: 2, side: -1, drop: 0.66, mass: 0.9, kind: 'crystal', at: 0.27 },
  { bar: 1, side: 1, drop: 0.72, mass: 0.8, kind: 'core', at: 0.44 },
  { bar: 3, side: -1, drop: 0.46, mass: 0.6, kind: 'ice', at: 0.61 },
  { bar: 3, side: 1, drop: 0.6, mass: 0.4, kind: 'deep', at: 0.78 },
];

const H = 0.32;
const MAX_TILT = 0.42;
const CEIL_Y = 2.15;
const TOP_Y = CEIL_Y - BARS[0].drop;

function equilibrium(k: number): number[] {
  const mass = new Array(BARS.length).fill(0) as number[];
  const left = new Array(BARS.length).fill(0) as number[];
  const right = new Array(BARS.length).fill(0) as number[];
  for (let w = 0; w < k; w++) {
    const W = WEIGHTS[w];
    if (W.side < 0) left[W.bar] += W.mass;
    else right[W.bar] += W.mass;
  }
  for (let b = BARS.length - 1; b >= 0; b--) {
    mass[b] = left[b] + right[b];
    const B = BARS[b];
    if (B.parent >= 0) {
      if (B.side < 0) left[B.parent] += mass[b];
      else right[B.parent] += mass[b];
    }
  }
  return BARS.map((B, b) => {
    const M = left[b] + right[b];
    const tau = left[b] * B.lL - right[b] * B.lR;
    return Math.max(-MAX_TILT, Math.min(MAX_TILT, Math.atan2(tau, M * H + 0.08)));
  });
}

const TARGETS = Array.from({ length: WEIGHTS.length + 1 }, (_, k) =>
  equilibrium(k),
);

function step(tau: number) {
  if (tau <= 0) return 0;
  return 1 - Math.exp(-tau / 0.03) * Math.cos((tau * Math.PI * 2) / 0.055);
}
const DROP_SPAN = 0.07;

/* module temps — zero allocations in useFrame */
const pivX = new Float32Array(BARS.length);
const pivY = new Float32Array(BARS.length);
const ang = new Float32Array(BARS.length);
const _look = new THREE.Vector3();
const _cam = new THREE.Vector3();
const beats: DwellBeats = { arrive: 0, play: 0, leave: 0 };

export default function CustomerExperienceScene() {
  const q = useQuality();
  const stage = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const crownRef = useRef<THREE.Mesh>(null);
  const rods = useRef<(THREE.Mesh | null)[]>([]);
  const beads = useRef<(THREE.Mesh | null)[]>([]);
  const discs = useRef<(THREE.Group | null)[]>([]);
  const discHalos = useRef<(THREE.Mesh | null)[]>([]);
  const discMats = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const report = useHotspotReporter('cx-handoff');
  const born = useRef<number | null>(null);

  const rodGeo = useMemo(
    () => new THREE.CylinderGeometry(0.016, 0.016, 1, 14).rotateZ(Math.PI / 2),
    [],
  );
  const threads = useMemo(() => {
    const segs = BARS.length + WEIGHTS.length;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(segs * 6);
    const col = new Float32Array(segs * 8);
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage),
    );
    g.setAttribute(
      'color',
      new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage),
    );
    const m = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const obj = new THREE.LineSegments(g, m);
    obj.frustumCulled = false;
    return { g, m, obj, pos, col };
  }, []);

  useEffect(
    () => () => {
      rodGeo.dispose();
      threads.g.dispose();
      threads.m.dispose();
    },
    [rodGeo, threads],
  );

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (born.current === null) born.current = now;
    const el = now - born.current;
    const animate = q.animate;
    const intro = animate ? easeInOutSine(clamp01(el / 1.7)) : 1;

    readDwell('signature', beats);
    const feat = smooth(sectionRange(getSectionProgress('feature'), 0.04, 0.92));
    const det = smooth(sectionRange(getSectionProgress('detail'), 0.08, 0.88));
    const faq = smooth(sectionRange(getSectionProgress('faq'), 0.06, 0.9));
    const cta = smooth(sectionRange(getSectionProgress('cta'), 0.06, 0.85));

    const play = animate ? Math.max(beats.play, beats.leave > 0 ? 1 : 0) : 1;
    const arrive = animate ? easeInOutSine(beats.arrive) : 1;
    const leave = animate ? easeInOutSine(beats.leave) : 0;

    /* ---- rod angles: initial + damped step responses to each touchpoint ---- */
    for (let b = 0; b < BARS.length; b++) {
      let a = TARGETS[0][b];
      for (let k = 0; k < WEIGHTS.length; k++) {
        a +=
          (TARGETS[k + 1][b] - TARGETS[k][b]) *
          (animate ? step(play - WEIGHTS[k].at) : 1);
      }
      if (animate) a += Math.sin(el * 0.65 + b * 1.9) * 0.012;
      ang[b] = a;
    }

    /* ---- forward kinematics in the mobile's plane ---- */
    const pos = threads.pos;
    const col = threads.col;
    let seg = 0;
    const writeSeg = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      alpha: number,
    ) => {
      const o = seg * 6;
      pos[o] = x0;
      pos[o + 1] = y0;
      pos[o + 2] = 0;
      pos[o + 3] = x1;
      pos[o + 4] = y1;
      pos[o + 5] = 0;
      const c = seg * 8;
      col[c] = 0.24;
      col[c + 1] = 0.38;
      col[c + 2] = 1;
      col[c + 3] = alpha;
      col[c + 4] = 0.24;
      col[c + 5] = 0.38;
      col[c + 6] = 1;
      col[c + 7] = alpha;
      seg++;
    };

    for (let b = 0; b < BARS.length; b++) {
      const B = BARS[b];
      let hx = 0;
      let hy = CEIL_Y;
      if (B.parent >= 0) {
        const p = B.parent;
        const arm = B.side < 0 ? -BARS[p].lL : BARS[p].lR;
        hx = pivX[p] + Math.cos(ang[p]) * arm;
        hy = pivY[p] + Math.sin(ang[p]) * arm;
      }
      pivX[b] = hx;
      pivY[b] = hy - B.drop;
      writeSeg(hx, B.parent < 0 ? CEIL_Y + 2.6 : hy, hx, pivY[b], 0.48 * intro);

      const rod = rods.current[b];
      if (rod) {
        const off = (B.lR - B.lL) / 2;
        rod.position.set(
          pivX[b] + Math.cos(ang[b]) * off,
          pivY[b] + Math.sin(ang[b]) * off,
          0,
        );
        rod.rotation.z = ang[b];
        rod.scale.set((B.lL + B.lR) * intro + 1e-4, 1, 1);
      }
      const bead = beads.current[b];
      if (bead) {
        bead.position.set(pivX[b], pivY[b], 0);
        bead.scale.setScalar(Math.max(intro, 0.001));
      }
    }

    if (crownRef.current) {
      crownRef.current.position.set(0, TOP_Y, 0);
      crownRef.current.rotation.x = Math.PI / 2;
      crownRef.current.rotation.z = animate ? el * 0.25 : 0;
      crownRef.current.scale.setScalar(Math.max(intro, 0.001));
    }

    let landed = 0;
    for (let w = 0; w < WEIGHTS.length; w++) {
      const W = WEIGHTS[w];
      const B = BARS[W.bar];
      const arm = W.side < 0 ? -B.lL : B.lR;
      const ex = pivX[W.bar] + Math.cos(ang[W.bar]) * arm;
      const ey = pivY[W.bar] + Math.sin(ang[W.bar]) * arm;
      const f = animate ? clamp01((play - (W.at - DROP_SPAN)) / DROP_SPAN) : 1;
      const r = 0.16 + Math.sqrt(W.mass) * 0.16;
      const restY = ey - W.drop - r;
      const fall = (1 - f * f) * 2.5;
      const dg = discs.current[w];
      if (dg) {
        dg.position.set(ex, restY + fall, 0);
        dg.scale.setScalar(Math.max(1e-4, (f > 0 ? Math.min(1, f * 3) : 0) * intro));
        if (animate) {
          dg.rotation.y = Math.sin(el * 0.55 + w * 1.1) * 0.52 + det * 0.35;
        }
      }
      const halo = discHalos.current[w];
      if (halo) {
        const lockGlow = f >= 1 ? 1 : 0;
        halo.scale.setScalar(Math.max(1e-4, lockGlow * (0.95 + det * 0.15)));
        if (animate) halo.rotation.z = el * 0.4 + w;
      }
      const dMat = discMats.current[w];
      if (dMat) {
        /* brief contact flash on landing + warm harmonic resonance in `detail` */
        const postLand = play - W.at;
        const landFlash =
          animate && postLand > 0 && postLand < 0.12
            ? Math.sin((postLand / 0.12) * Math.PI)
            : 0;
        dMat.emissiveIntensity =
          landFlash * 0.85 + (landed === WEIGHTS.length ? 0.16 + det * 0.25 : 0);
      }
      if (f >= 1) landed++;
      writeSeg(ex, ey, ex, restY + r, f >= 1 ? 0.48 * intro : 0);
    }
    (threads.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (threads.g.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    /* ---- gentle kinetic spin + post-dwell feature/detail inspection ---- */
    if (spin.current) {
      const target =
        (animate ? Math.sin(el * 0.08) * 0.48 : 0.22) +
        (animate ? pointer.x * 0.26 : 0) +
        feat * 0.28 -
        det * 0.2;
      if (animate) spin.current.rotation.y += (target - spin.current.rotation.y) * 0.035;
      else spin.current.rotation.y = 0.22;
    }

    const g = stage.current;
    if (g) {
      const hx = q.compact ? 0 : 2.45;
      const hy = q.compact ? -0.85 : -0.18;
      const postX = q.compact ? 0 : 2.15 - det * 0.45 + cta * 0.3;
      const postZ = -1.65 + feat * 0.55 + det * 0.65 - faq * 0.8;
      g.position.set(
        lerp(lerp(hx, 0.45, arrive), postX, leave),
        lerp(lerp(hy, -0.22, arrive), -0.05 + cta * 0.25, leave) - (1 - intro) * 0.55,
        lerp(lerp(-1.4, 0, arrive), postZ, leave),
      );
      g.scale.setScalar(
        (q.compact ? 0.64 : 1) * lerp(0.8, 1, arrive) * (0.9 + 0.1 * intro),
      );
    }

    const coreDisc = discs.current[2];
    if (coreDisc) {
      report(
        coreDisc,
        state.camera,
        0.42 + (landed / WEIGHTS.length) * 0.48 + det * 0.1,
      );
    }

    const cam = state.camera;
    const baseZ = (q.compact ? 12.2 : 8.8) - feat * 0.45 - det * 0.55 + cta * 0.7;
    _cam.set(
      (animate ? pointer.x * 0.3 : 0) - det * 0.25,
      0.22 + (animate ? pointer.y * 0.2 : 0) + det * -0.18 + cta * 0.32,
      baseZ + (1 - intro) * 1.3,
    );
    const lookX =
      lerp(q.compact ? 0 : 1.25, 0.45, arrive) * (1 - leave) +
      (q.compact ? 0 : 1.15 - det * 0.25) * leave;

    if (animate) {
      cam.position.lerp(_cam, 0.05);
      _look.x += (lookX - _look.x) * 0.055;
      _look.y += (-0.08 * det - _look.y) * 0.055;
      _look.z = 0;
    } else {
      cam.position.set(0, 0.22, 8.8 + (q.compact ? 3.4 : 0));
      _look.set(q.compact ? 0 : 0.45, 0, 0);
    }
    cam.lookAt(_look);
  });

  return (
    <group>
      <SceneLightRig />
      <ParticleField
        count={Math.floor(1300 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.3}
      />
      <group ref={stage} position={[2.45, -0.18, -1.4]}>
        <group ref={spin}>
          <primitive object={threads.obj} />
          {/* top fulcrum halo crown */}
          <mesh ref={crownRef} position={[0, TOP_Y, 0]}>
            <torusGeometry args={[0.16, 0.012, 14, 48]} />
            <GlassMaterial kind="prism" />
          </mesh>
          {BARS.map((_, b) => (
            <React.Fragment key={b}>
              <mesh
                ref={(el) => {
                  rods.current[b] = el;
                }}
                geometry={rodGeo}
              >
                <GradientGlassMaterial opacity={0.94} />
              </mesh>
              <mesh
                ref={(el) => {
                  beads.current[b] = el;
                }}
              >
                <sphereGeometry args={[0.036, 18, 18]} />
                <GlassMaterial kind="deep" emissive="#2e4bff" emissiveIntensity={0.3} />
              </mesh>
            </React.Fragment>
          ))}
          {WEIGHTS.map((w, i) => {
            const r = 0.16 + Math.sqrt(w.mass) * 0.16;
            return (
              <group
                key={i}
                ref={(el) => {
                  discs.current[i] = el;
                }}
                scale={0.0001}
              >
                <mesh rotation-x={Math.PI / 2}>
                  <cylinderGeometry args={[r, r, 0.058, 48]} />
                  <GlassMaterial
                    ref={(m) => {
                      discMats.current[i] = m;
                    }}
                    kind={w.kind}
                    thickness={0.65}
                    emissive="#2e4bff"
                    emissiveIntensity={0}
                  />
                </mesh>
                {/* fine dispersive prism collar around each landed touchpoint */}
                <mesh
                  ref={(m) => {
                    discHalos.current[i] = m;
                  }}
                >
                  <torusGeometry args={[r + 0.048, 0.009, 12, 56]} />
                  <GlassMaterial kind="prism" />
                </mesh>
              </group>
            );
          })}
        </group>
      </group>
    </group>
  );
}

export { TOP_Y as CX_TOP_Y };
