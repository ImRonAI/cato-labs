'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useQuality } from '../../lib/quality';
import { useBakedSimulation, type BakedSimulation } from '../../lib/physics-bake';
import { getSectionProgress, sectionRange, smooth, pointer } from '../../scroll-store';
import {
  ANCHOR,
  BAKE,
  BALL_HANG,
  BALL_RADIUS,
  BALL_START,
  BLOCKS,
  BLOCK_RADIUS,
  CABLE_LENGTH,
  FLOOR_Y,
  REST,
  analyseWreck,
  setupWreck,
  type WreckTimeline,
} from './wreck';
import { WRECK, SCRUB_DAMP, range, simTime } from './timeline';
import { createHomeGlass } from './glass';
import Stage, { MAX_RINGS, MAX_SHADOWS, type StageUniforms } from './Stage';
import ImpactDust, { createDustMaterial } from './ImpactDust';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* stage anchors — group-local transforms per act */
const HERO = { x: 2.35, y: 0.05, z: 0, s: 1 };
const WRECK_STAGE = { x: 2.2, y: -0.1, z: -0.8, s: 1 };
const WRECK_COMPACT = { x: 0.35, y: 0.55, z: -2.4, s: 0.7 };
const HERO_COMPACT = { x: 0, y: 0.65, z: -1.4, s: 0.78 };
const CTA = { x: 0, y: -0.15, z: -2.2, s: 0.92 };

/* scratch — never allocate in useFrame */
const tP = new THREE.Vector3();
const tQ = new THREE.Quaternion();
const rP = new THREE.Vector3();
const rQ = new THREE.Quaternion();
const tA = new THREE.Vector3();
const tB = new THREE.Vector3();
const tDir = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Monolith — "The boundaries were never real. So we removed them."
 *
 * A calm tower of refractive glass blocks holds stage right through the
 * hero. In the manifesto dwell, a glass wrecking ball on a hairline cable
 * resolves out of the sky, swings, and strikes the core block exactly as
 * the punch line lands. The topple is a real Rapier simulation baked once
 * and scrubbed by scroll, so scrolling up rewinds it frame-perfectly.
 * Dust and floor ripples are driven by the recording's own impacts. In
 * the closing CTA the debris re-assembles into a calm monolith.
 */
export default function Monolith() {
  const q = useQuality();
  const sim = useBakedSimulation({
    ...BAKE,
    setup: setupWreck,
  });

  const group = useRef<THREE.Group>(null);
  const blockRefs = useRef<Array<THREE.Mesh | null>>([]);
  const ball = useRef<THREE.Mesh>(null);
  const cable = useRef<THREE.Mesh>(null);
  const hub = useRef<THREE.Mesh>(null);
  const startAt = useRef<number | null>(null);
  const drv = useRef({ m: 0, c: 0, h: 0 });

  /* timeline analysis (impact emitters) is derived once the bake lands */
  const [timeline, setTimeline] = useState<{ tl: WreckTimeline; duration: number } | null>(null);
  const seen = useRef<BakedSimulation | null>(null);

  const geos = useMemo(
    () => BLOCKS.map((b) => new RoundedBoxGeometry(b.size[0], b.size[1], b.size[2], 4, BLOCK_RADIUS)),
    [],
  );
  const mats = useMemo(
    () => ({
      clear: createHomeGlass('clear'),
      ice: createHomeGlass('ice'),
      core: createHomeGlass('core'),
      ball: createHomeGlass('ball'),
      cable: new THREE.MeshBasicMaterial({ color: '#0a0c12', transparent: true, opacity: 0, depthWrite: false }),
      hub: new THREE.MeshPhysicalMaterial({ color: '#c9d2e6', metalness: 1, roughness: 0.22, envMapIntensity: 1.3 }),
    }),
    [],
  );
  const dust = useMemo(createDustMaterial, []);
  const stageU = useMemo<StageUniforms>(
    () => ({
      shadows: Array.from({ length: MAX_SHADOWS }, () => new THREE.Vector4()),
      rings: Array.from({ length: MAX_RINGS }, () => new THREE.Vector4()),
    }),
    [],
  );

  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
      dust.dispose();
    },
    [geos, mats, dust],
  );

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const baked = sim.current;
    if (baked && seen.current !== baked) {
      seen.current = baked;
      setTimeline({ tl: analyseWreck(baked.positions, baked.frames, baked.count, BAKE.dt), duration: baked.duration });
    }

    const t = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = t;
    const intro = q.animate ? smooth(clamp01((t - startAt.current) / 1.6)) : 1;
    const d = drv.current;

    /* scroll drivers, damped identically to the DOM manifesto */
    const mRaw = q.animate ? getSectionProgress('manifesto') : 0;
    const cRaw = q.animate ? smooth(sectionRange(getSectionProgress('cta'), 0.05, 0.62)) : 0;
    const hRaw = q.animate ? smooth(sectionRange(getSectionProgress('hero'), 0.5, 1)) : 0;
    d.m += (mRaw - d.m) * SCRUB_DAMP;
    d.c += (cRaw - d.c) * 0.06;
    d.h += (hRaw - d.h) * 0.08;
    const m = d.m;
    const c = d.c;
    const tl = timeline?.tl;
    const hit = tl?.hit ?? 0.23;
    const st = simTime(m, hit);
    const simSec = st * (baked?.duration ?? 1);

    /* act staging: hero (right) → wreck (centred stage) → leaves → cta (calm centre) */
    const hero = q.compact ? HERO_COMPACT : HERO;
    const wreckIn = smooth(range(m, 0.08, 0.27));
    const exitF = smooth(range(m, WRECK.exit[0], WRECK.exit[1]));
    /* for the cta the reassembled tower glides in from below; between acts it rests offstage */
    const away = exitF * (1 - c);
    const wk = q.compact ? WRECK_COMPACT : WRECK_STAGE;
    const sx = lerp(lerp(hero.x, wk.x, wreckIn), CTA.x, c);
    const sy = lerp(lerp(hero.y, wk.y, wreckIn), CTA.y, c) + away * 7.5;
    const sz = lerp(lerp(hero.z, wk.z, wreckIn), CTA.z, c);
    const ss = lerp(lerp(hero.s, wk.s, wreckIn), CTA.s, c);
    g.position.x += (sx - g.position.x) * 0.08;
    g.position.y += (sy - g.position.y) * 0.08;
    g.position.z += (sz - g.position.z) * 0.08;
    g.scale.setScalar(g.scale.x + (ss - g.scale.x) * 0.08);
    g.visible = away < 0.98;

    /* pointer: a slow turntable before the strike, a held breath after */
    const calm = 1 - smooth(range(m, WRECK.swingFrom - 0.04, WRECK.swingFrom)) * (1 - c);
    const yaw = (pointer.x * 0.16 + Math.sin(t * 0.18) * 0.06) * calm + d.h * 0.12 - c * 0.18;
    g.rotation.y += (yaw - g.rotation.y) * 0.05;
    g.rotation.x += (-pointer.y * 0.04 * calm - g.rotation.x) * 0.05;

    /* ---- blocks: rest → baked wreck → reassembly ---- */
    const reassemble = c;
    for (let i = 0; i < BLOCKS.length; i++) {
      const mesh = blockRefs.current[i];
      if (!mesh) continue;
      const r = REST[i];
      rP.set(r.p[0], r.p[1], r.p[2]);
      rQ.set(r.q[0], r.q[1], r.q[2], r.q[3]);
      if (baked && st > 0) {
        baked.sample(i, st, tP, tQ);
      } else {
        tP.copy(rP);
        tQ.copy(rQ);
      }
      /* staggered reassembly: base first, each block lifts and settles home */
      const k = smooth(clamp01((reassemble - i * 0.055) / 0.6));
      if (k > 0) {
        tP.lerp(rP, k);
        tP.y += Math.sin(k * Math.PI) * (0.35 + i * 0.05);
        tQ.slerp(rQ, k);
      }
      /* mount: blocks condense out of light, settling down the stack */
      const a = smooth(clamp01((intro - i * 0.06) / 0.55));
      tP.y += (1 - a) * (0.9 + i * 0.12);
      mesh.position.copy(tP);
      mesh.quaternion.copy(tQ);
      /* breathing hairline of air between rest blocks; collapses when struck */
      const breathe = q.animate ? Math.sin(t * 0.6 + i * 0.7) * 0.012 * (1 - smooth(range(m, 0.2, 0.3))) * (1 - c) : 0;
      mesh.position.y += breathe * i;
      mesh.scale.setScalar(Math.max(a, 0.001));

      if (i < MAX_SHADOWS) {
        const half = BLOCKS[i].size[1] / 2;
        stageU.shadows[i].set(tP.x, tP.z, Math.max(BLOCKS[i].size[0], BLOCKS[i].size[2]) * 0.52 * a, tP.y - half - FLOOR_Y);
      }
    }

    /* ---- the ball and cable ---- */
    const b = ball.current;
    const cb = cable.current;
    const hb = hub.current;
    const cableVis = smooth(range(m, WRECK.cableIn[0], WRECK.cableIn[1])) * (1 - c);
    if (b && cb && hb) {
      const bi = BLOCKS.length;
      if (baked && st > 0) baked.sample(bi, st, tP, tQ);
      else tP.set(BALL_START[0], BALL_START[1], BALL_START[2]);
      /* before release it descends into the pulled-back pose out of the sky */
      const lower = 1 - cableVis;
      tP.y += lower * 4.2;
      /* by the cta it has hung plumb and withdrawn */
      if (c > 0) {
        tA.set(BALL_HANG[0], BALL_HANG[1], BALL_HANG[2]);
        tP.lerp(tA, Math.min(c * 1.4, 1));
        tP.y += c * 6;
      }
      b.position.copy(tP);
      b.quaternion.copy(tQ);
      b.visible = cableVis > 0.002;
      stageU.shadows[BLOCKS.length].set(tP.x, tP.z, b.visible ? BALL_RADIUS * 0.85 : 0, tP.y - BALL_RADIUS - FLOOR_Y);
      hb.visible = b.visible;
      cb.visible = b.visible;

      /* cable: a hairline cylinder from the anchor to the ball's crown */
      tA.set(ANCHOR[0], ANCHOR[1] + lower * 4.2 + c * 6, ANCHOR[2]);
      tDir.copy(tA).sub(tP);
      const len = tDir.length();
      tDir.normalize();
      tB.copy(tP).addScaledVector(tDir, BALL_RADIUS * 0.98);
      hb.position.copy(tB);
      hb.quaternion.setFromUnitVectors(UP, tDir);
      cb.position.copy(tB).add(tA).multiplyScalar(0.5);
      cb.quaternion.setFromUnitVectors(UP, tDir);
      cb.scale.set(1, Math.max(len - BALL_RADIUS, 0.01) / CABLE_LENGTH, 1);
      mats.cable.opacity = 0.62 * cableVis;
    }

    /* ---- dust + floor ripples, both functions of simulated time ---- */
    dust.uniforms.uT.value = st > 0 ? simSec : -1;
    dust.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    dust.uniforms.uOpacity.value = 0.85 * (1 - c);
    if (tl) {
      const strikeT = tl.hit * (baked?.duration ?? 1);
      stageU.rings[0].set(tl.hitPos[0], tl.hitPos[2], st > 0 ? simSec - strikeT : 0, 0.3 * (1 - c));
      let ri = 1;
      for (let e = 0; e < tl.events.length && ri < MAX_RINGS; e++) {
        const ev = tl.events[e];
        if (!ev.floor) continue;
        stageU.rings[ri++].set(ev.pos[0], ev.pos[2], st > 0 ? simSec - ev.t : 0, ev.strength * (1 - c));
      }
    }
  });

  const tone = (i: number) => mats[BLOCKS[i].tone];

  return (
    <group ref={group} position={[HERO.x, HERO.y, HERO.z]}>
      {BLOCKS.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            blockRefs.current[i] = el;
          }}
          geometry={geos[i]}
          material={tone(i)}
          position={REST[i].p}
          quaternion={REST[i].q}
        />
      ))}
      <mesh ref={ball} material={mats.ball} position={BALL_START} visible={false}>
        <sphereGeometry args={[BALL_RADIUS, 64, 48]} />
      </mesh>
      <mesh ref={hub} material={mats.hub} visible={false}>
        <cylinderGeometry args={[0.035, 0.07, 0.12, 24]} />
      </mesh>
      <mesh ref={cable} material={mats.cable} visible={false}>
        <cylinderGeometry args={[0.0075, 0.0075, CABLE_LENGTH, 6, 1]} />
      </mesh>
      <Stage uniforms={stageU} />
      {timeline && (
        <ImpactDust
          timeline={timeline.tl}
          duration={timeline.duration}
          budget={Math.round(1400 * q.particles)}
          material={dust}
        />
      )}
    </group>
  );
}
