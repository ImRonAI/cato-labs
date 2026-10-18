'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, type GlassKind } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import { pointer, smooth } from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { createStageState, readStage, damp } from '../lib-a/dwell';
import { placeStage, type Placement } from '../lib-a/place';
import { buildPathLut } from '../lib-a/pathLut';

/**
 * SanBernardinoScene — "The rail".
 *
 * The Inland Empire is the corridor that moves the region's goods. A train
 * of seven glass blocks runs a curving mountain track: up out of the valley
 * floor in the foreground, through a horseshoe curve, over a trestle and
 * into the pass between hairline ridgelines. Scroll is the throttle: the
 * train's distance along the track is a pure function of the `moment`
 * dwell, so it reverses exactly. The cars bank into each curve by the
 * track's real curvature and the lead car carries a headlight.
 *
 * Pointer: the view leans a few degrees toward the cursor.
 * Reduced motion: the train held at the horseshoe curve, mid-climb.
 */

const CARS = 7;
const CAR_LEN = 0.36;
const CAR_GAP = 0.06;
const SLEEPERS = 150;
const KINDS: GlassKind[] = ['deep', 'core', 'azure', 'azure', 'crystal', 'ice', 'ice'];

const PLACE: Placement = {
  hero: { x: 1.6, y: -0.5, z: -1.2, s: 0.78 },
  center: { x: 0, y: -0.2, z: 0, s: 1 },
  compactHero: { x: 0.2, y: -1.9, z: -1.5, s: 0.36 },
  compactCenter: { x: 0.15, y: 0, z: 0, s: 0.4 },
  still: { x: 1.6, y: -0.5, z: -1.2, s: 0.78 },
  compactStill: { x: 0.15, y: 0, z: 0, s: 0.4 },
};

const _cam = new THREE.Vector3();
const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _t2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _side = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _roll = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _one = new THREE.Vector3(1, 1, 1);

function ridgePoints(seed: number, y: number, z: number, amp: number) {
  const pts: number[] = [];
  const n = 120;
  for (let i = 0; i <= n; i++) {
    const x = -5 + (i / n) * 10;
    const pass = 1 - Math.exp(-((x - 0.9) * (x - 0.9)) / 0.9) * 0.55;
    const h =
      (Math.sin(x * 0.9 + seed) * 0.5 + 0.5) * amp * 0.7 +
      Math.sin(x * 2.3 + seed * 2) * amp * 0.18 +
      Math.sin(x * 5.1 + seed * 3) * amp * 0.06;
    pts.push(x, y + h * pass, z);
  }
  return pts;
}

export default function SanBernardinoScene() {
  const q = useQuality();
  const rig = useRef<THREE.Group>(null);
  const view = useRef<THREE.Group>(null);
  const carRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lamp = useRef<THREE.Mesh>(null);
  const sleepers = useRef<THREE.InstancedMesh>(null);
  const stage = useMemo(createStageState, []);
  const live = useRef({ ry: 0, d: 0 });
  const report = useHotspotReporter('sb-skyline');

  const { lut, rails, trestle, ridges } = useMemo(() => {
    /* the track: valley floor → horseshoe → trestle → the pass */
    const curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-3.6, -1.15, 1.6),
        new THREE.Vector3(-1.6, -1.05, 1.5),
        new THREE.Vector3(0.4, -0.85, 1.2),
        new THREE.Vector3(1.9, -0.6, 0.4),
        new THREE.Vector3(1.7, -0.38, -0.5),
        new THREE.Vector3(0.4, -0.18, -0.6),
        new THREE.Vector3(-0.9, 0.02, -0.25),
        new THREE.Vector3(-1.8, 0.2, -0.6),
        new THREE.Vector3(-1.2, 0.42, -1.4),
        new THREE.Vector3(0.2, 0.58, -1.9),
        new THREE.Vector3(1.2, 0.7, -2.6),
        new THREE.Vector3(1.6, 0.8, -3.6),
      ],
      false,
      'centripetal',
    );
    const lut = buildPathLut(curve, 900);

    const rail: number[] = [];
    const tr: number[] = [];
    const n = 420;
    const gauge = 0.055;
    for (let i = 0; i < n; i++) {
      for (const side of [-1, 1]) {
        lut.sample(i / n, _p, _t);
        _side.crossVectors(_t, _up).normalize().multiplyScalar(side * gauge);
        rail.push(_p.x + _side.x, _p.y + _side.y, _p.z + _side.z);
        lut.sample((i + 1) / n, _p2, _t2);
        _side.crossVectors(_t2, _up).normalize().multiplyScalar(side * gauge);
        rail.push(_p2.x + _side.x, _p2.y + _side.y, _p2.z + _side.z);
      }
      /* trestle posts where the track rides above the floor */
      if (i % 9 === 0) {
        lut.sample(i / n, _p, _t);
        const floor = -1.2;
        if (_p.y - floor > 0.32) {
          _side.crossVectors(_t, _up).normalize().multiplyScalar(0.07);
          tr.push(_p.x - _side.x, _p.y - 0.03, _p.z - _side.z, _p.x - _side.x * 2, floor, _p.z - _side.z * 2);
          tr.push(_p.x + _side.x, _p.y - 0.03, _p.z + _side.z, _p.x + _side.x * 2, floor, _p.z + _side.z * 2);
        }
      }
    }
    const rails = new THREE.BufferGeometry();
    rails.setAttribute('position', new THREE.Float32BufferAttribute(rail, 3));
    const trestle = new THREE.BufferGeometry();
    trestle.setAttribute('position', new THREE.Float32BufferAttribute(tr, 3));

    const ridges = [
      ridgePoints(1.3, 0.25, -4.2, 1.6),
      ridgePoints(4.1, -0.25, -3.2, 1.15),
      ridgePoints(2.2, -0.75, -2.3, 0.7),
    ].map((pts) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      return g;
    });
    return { lut, rails, trestle, ridges };
  }, []);

  const mats = useMemo(
    () => ({
      rail: new THREE.LineBasicMaterial({ color: '#2e4bff', transparent: true, opacity: 0.75 }),
      trestle: new THREE.LineBasicMaterial({ color: '#93a9ff', transparent: true, opacity: 0.45 }),
      ridges: [0.22, 0.32, 0.45].map(
        (o) => new THREE.LineBasicMaterial({ color: '#6b87ff', transparent: true, opacity: o }),
      ),
      sleeper: new THREE.MeshBasicMaterial({ color: '#b9c9ff' }),
      lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(3), toneMapped: false }),
    }),
    [],
  );
  const ridgeLines = useMemo(
    () => ridges.map((g, i) => new THREE.Line(g, mats.ridges[i])),
    [ridges, mats],
  );
  useEffect(
    () => () => {
      rails.dispose();
      trestle.dispose();
      ridges.forEach((g) => g.dispose());
      mats.rail.dispose();
      mats.trestle.dispose();
      mats.ridges.forEach((m) => m.dispose());
      mats.sleeper.dispose();
      mats.lamp.dispose();
    },
    [rails, trestle, ridges, mats],
  );

  useEffect(() => {
    const s = sleepers.current;
    if (!s) return;
    for (let i = 0; i < SLEEPERS; i++) {
      lut.sample((i + 0.5) / SLEEPERS, _p, _t);
      _m.lookAt(_p, _p2.copy(_p).add(_t), _up);
      _q.setFromRotationMatrix(_m);
      _m.compose(_p.setY(_p.y - 0.012), _q, _one);
      s.setMatrixAt(i, _m);
    }
    s.instanceMatrix.needsUpdate = true;
  }, [lut]);

  useFrame((state, delta) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    readStage(stage, q);
    const intro = anim ? smooth(Math.min(el / 1.8, 1)) : 1;
    const L = live.current;
    if (rig.current) placeStage(rig.current, stage, q, PLACE, intro);

    const trainLen = CARS * (CAR_LEN + CAR_GAP);
    const span = trainLen / lut.length;
    /* the throttle: lead car travels from just entering to deep in the pass */
    const target = anim ? span + 0.02 + smooth(stage.t) * (0.97 - span) : 0.46;
    L.d = anim ? damp(L.d, target, 5, delta) : target;

    for (let i = 0; i < CARS; i++) {
      const c = carRefs.current[i];
      if (!c) continue;
      const u = L.d - (i * (CAR_LEN + CAR_GAP) + CAR_LEN * 0.5) / lut.length;
      lut.sample(u, _p, _t);
      /* curvature → bank: compare tangents a short way ahead */
      lut.sample(u + 0.012, _p2, _t2);
      _n.crossVectors(_t, _t2);
      const bank = Math.max(-0.18, Math.min(0.18, _n.y * 6));
      _m.lookAt(_p, _p2.copy(_p).add(_t), _up);
      _q.setFromRotationMatrix(_m);
      _roll.setFromAxisAngle(_zAxis, -bank);
      _q.multiply(_roll);
      c.position.set(_p.x, _p.y + 0.075, _p.z);
      c.quaternion.copy(_q);
      const vis = Math.min(Math.max((u + 0.01) * 40, 0), 1) * Math.min(Math.max((1.0 - u) * 40, 0), 1);
      c.scale.setScalar(Math.max(vis * intro, 0.001));
      if (i === 0 && lamp.current) {
        lamp.current.position.copy(c.position);
        lamp.current.quaternion.copy(c.quaternion);
        /* Matrix4.lookAt points local −z at the target: the nose */
        lamp.current.translateZ(-CAR_LEN * 0.52);
        lamp.current.scale.setScalar(Math.max(vis * intro, 0.001));
      }
    }
    if (lamp.current) report(lamp.current, state.camera, 0.45 + 0.4 * stage.focus);

    L.ry = anim ? damp(L.ry, pointer.x * 0.12, 2, delta) : 0;
    if (view.current) {
      view.current.rotation.y = L.ry - 0.12;
      view.current.rotation.x = 0.32 + (anim ? -pointer.y * 0.04 : 0);
    }

    _cam.set(anim ? pointer.x * 0.3 : 0, anim ? 0.25 + pointer.y * 0.18 : 0.25, 9);
    state.camera.position.lerp(_cam, 0.05);
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <SceneLightRig />
      <group ref={rig}>
        <group ref={view}>
          {ridgeLines.map((l, i) => (
            <primitive key={i} object={l} />
          ))}
          <lineSegments geometry={rails} material={mats.rail} />
          <lineSegments geometry={trestle} material={mats.trestle} />
          <instancedMesh ref={sleepers} args={[undefined, undefined, SLEEPERS]} material={mats.sleeper}>
            <boxGeometry args={[0.17, 0.008, 0.022]} />
          </instancedMesh>
          {Array.from({ length: CARS }, (_, i) => (
            <RoundedBox
              key={i}
              ref={(m: THREE.Mesh | null) => {
                carRefs.current[i] = m;
              }}
              args={[0.15, 0.13, CAR_LEN]}
              radius={0.03}
              smoothness={3}
            >
              <GlassMaterial
                kind={KINDS[i]}
                emissive="#2e4bff"
                emissiveIntensity={i === 0 ? 0.35 : 0.04}
              />
            </RoundedBox>
          ))}
          <mesh ref={lamp} material={mats.lamp}>
            <sphereGeometry args={[0.026, 16, 12]} />
          </mesh>
        </group>
      </group>
      <ParticleField count={Math.floor(900 * q.particles)} drift={q.animate ? 0.08 : 0} opacity={0.22} />
    </>
  );
}
