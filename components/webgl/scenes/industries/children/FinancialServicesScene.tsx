'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import { pointer } from '../../../scroll-store';
import { useBakedSimulation } from '../../../lib/physics-bake';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { beat, damp, introAt, newMoment, readMoment, useLensShift } from '../lib-b/stage';
import {
  COINS,
  COIN_HH,
  COIN_PITCH,
  COIN_R,
  COIN_STEPS,
  COIN_SUBSTEPS,
  COLUMN_HEIGHTS,
  DROP,
  FLOOR_Y,
  coinRestY,
  coinsBeforeStep,
  columnX,
  setupCoins,
} from '../lib-b/coinBake';

/**
 * FinancialServicesScene — "Coin Stacks".
 *
 * A clean glass ledger with a single row of coins. Through the `moment` dwell
 * coins condense out of the light above each column and rain down — a real,
 * baked Rapier simulation, so every coin lands, rocks and settles — and the
 * columns compound left to right. Once the last coin settles, a line draws
 * itself across the column tops and the stacks read as what they are: a
 * rising chart. Plain, trustworthy, compounding. Scroll up and the coins fly
 * back into the air in exact reverse.
 *
 * Reduced motion: the finished chart with the trend line drawn.
 */

const COLS = COLUMN_HEIGHTS.length;
const N = COINS.length;
/** moment → recording time */
const SIM_FROM = 0.03;
const SIM_TO = 0.74;
const LINE_FROM = 0.72;
const LINE_TO = 0.93;
const CURVE_POINTS = 96;

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _col = new THREE.Color();
const _hot = new THREE.Color('#e9eeff');

function topY(col: number) {
  return coinRestY(COLUMN_HEIGHTS[col] - 1) + COIN_HH;
}

export default function FinancialServicesScene() {
  const q = useQuality();
  const lens = useLensShift();
  const moment = useRef(newMoment());
  const group = useRef<THREE.Group>(null);
  const rig = useRef<THREE.Group>(null);
  const coins = useRef<THREE.InstancedMesh>(null);
  const ledger = useRef<THREE.Mesh>(null);
  const peak = useRef<THREE.Mesh>(null);
  const peakMat = useRef<THREE.MeshBasicMaterial>(null);
  const tilt = useRef({ x: 0, y: 0 });
  const report = useHotspotReporter('fin-peak');

  const sim = useBakedSimulation({
    key: 'industries-financial-coin-stacks',
    steps: COIN_STEPS,
    substeps: COIN_SUBSTEPS,
    solverIterations: 12,
    setup: setupCoins,
    beforeStep: coinsBeforeStep,
  });

  /* the chart line through the column tops — drawn in one call */
  const line = useMemo(() => {
    const tops = Array.from({ length: COLS }, (_, c) => new THREE.Vector3(columnX(c), topY(c) + 0.1, 0));
    const curve = new THREE.CatmullRomCurve3(tops, false, 'catmullrom', 0.4);
    const pts = curve.getPoints(CURVE_POINTS);
    const geom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), CURVE_POINTS * 2, 0.012, 6, false);
    geom.setDrawRange(0, 0);
    return geom;
  }, []);
  useEffect(() => () => line.dispose(), [line]);
  const lineIndexCount = line.index ? line.index.count : 0;

  /* per-instance tint: the right-most column is the deep accent */
  useEffect(() => {
    const m = coins.current;
    if (!m) return;
    for (let i = 0; i < N; i++) {
      const c = COINS[i];
      _col.set(c.col === COLS - 1 ? '#7f97ff' : c.col >= COLS - 3 ? '#c5d3ff' : '#ffffff');
      m.setColorAt(i, _col);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state, delta) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const dt = Math.min(delta, 0.05);
    const mo = readMoment(moment.current, anim);
    const t = mo.t;
    const simT = anim ? Math.min(Math.max((t - SIM_FROM) / (SIM_TO - SIM_FROM), 0), 1) : 1;
    const intro = anim ? introAt(el, 0, 1.6) : 1;
    if (group.current) group.current.position.y = -0.7 * (1 - intro);

    const baked = sim.current;
    const m = coins.current;
    if (m) {
      for (let i = 0; i < N; i++) {
        const c = COINS[i];
        /* condense out of the light just before release */
        const appear = c.level === 0 ? 1 : Math.min(Math.max((simT - c.releaseT + 0.035) / 0.035, 0), 1);
        if (baked) {
          baked.sample(i, simT, _pos, _quat);
        } else {
          /* still baking: analytic stand-in (drop with ease, no rocking) */
          const fall = c.level === 0 ? 1 : beat(simT, c.releaseT, c.releaseT + 0.05);
          _pos.set(c.x, coinRestY(c.level) + DROP * (1 - fall), 0);
          _quat.identity();
        }
        const pop = anim ? introAt(el, 0.25 + c.col * 0.06, 0.7) : 1;
        const s = Math.max(appear * (c.level === 0 ? pop : 1), 0.0001);
        _scale.set(s, s, s);
        _m.compose(_pos, _quat, _scale);
        m.setMatrixAt(i, _m);
      }
      m.instanceMatrix.needsUpdate = true;
    }

    if (ledger.current) {
      const pop = anim ? introAt(el, 0, 0.7) : 1;
      ledger.current.scale.set(Math.max(pop, 0.001), 1, 1);
    }

    /* the chart line */
    const draw = anim ? beat(t, LINE_FROM, LINE_TO) : 1;
    const segs = Math.floor(draw * CURVE_POINTS * 2);
    line.setDrawRange(0, Math.floor((segs / (CURVE_POINTS * 2)) * lineIndexCount / 6) * 6);

    /* the peak marker lands with the line */
    const pk = peak.current;
    if (pk) {
      const arrive = beat(draw, 0.86, 1);
      pk.position.set(columnX(COLS - 1), topY(COLS - 1) + 0.1, 0);
      pk.scale.setScalar(Math.max(arrive, 0.0001) * (1 + (anim ? Math.sin(el * 2.2) * 0.08 : 0)));
      if (peakMat.current) peakMat.current.opacity = arrive;
      report(pk, state.camera, 0.4 + 0.5 * arrive);
    }

    /* pointer tilt */
    const r = rig.current;
    if (r) {
      tilt.current.x = damp(tilt.current.x, anim ? pointer.y * 0.04 : 0, 3, dt);
      tilt.current.y = damp(tilt.current.y, anim ? pointer.x * 0.1 : 0, 3, dt);
      r.rotation.x = tilt.current.x;
      r.rotation.y = tilt.current.y - 0.22;
    }

    /* camera: low three-quarter, rising with the chart */
    const focus = anim ? beat(t, 0.0, 0.25) * (1 - mo.leave) : 0;
    const rise = anim ? simT : 1;
    const radius = (q.compact ? 14.5 : 9.6) - focus * 0.9;
    const orbit = (anim ? Math.sin(el * 0.05) * 0.05 : 0) + 0.06;
    _cam.set(
      Math.sin(orbit) * radius + (anim ? pointer.x * 0.3 : 0),
      1.8 - focus * 0.5 + rise * 0.35 + (anim ? pointer.y * 0.2 : 0),
      Math.cos(orbit) * radius,
    );
    state.camera.position.lerp(_cam, 0.05);
    _look.set(0, FLOOR_Y + 0.55 + rise * 0.12, 0);
    state.camera.lookAt(_look);

    const centre = anim ? mo.enter * (1 - mo.leave) : 0;
    if (q.compact) lens(0, -0.08 + centre * 0.08);
    else lens(0.22 * (1 - centre), -0.04 * (1 - centre));
  });

  return (
    <group ref={group}>
      <SceneLightRig />
      <group ref={rig}>
        {/* the ledger */}
        <RoundedBox ref={ledger} args={[6.6, 0.06, 1.5]} radius={0.025} smoothness={4} position={[0, FLOOR_Y - 0.03, 0]}>
          <GlassMaterial kind="pane" />
        </RoundedBox>

        {/* coins — one instanced draw call */}
        <instancedMesh ref={coins} args={[undefined, undefined, N]} frustumCulled={false}>
          <cylinderGeometry args={[COIN_R, COIN_R, COIN_PITCH * 0.96, 48, 1]} />
          <GlassMaterial kind="azure" />
        </instancedMesh>

        {/* the chart line */}
        <mesh geometry={line} frustumCulled={false}>
          <meshBasicMaterial color="#2e4bff" toneMapped={false} />
        </mesh>

        {/* peak marker */}
        <mesh ref={peak}>
          <sphereGeometry args={[0.05, 20, 20]} />
          <meshBasicMaterial ref={peakMat} color={_hot} transparent toneMapped={false} />
        </mesh>
      </group>

      <ParticleField count={Math.floor(1000 * q.particles)} drift={q.animate ? 0.1 : 0} opacity={0.26} />
    </group>
  );
}

