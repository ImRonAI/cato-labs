'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import { pointer, smooth } from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { createStageState, readStage, damp } from '../lib-a/dwell';
import { placeStage, type Placement } from '../lib-a/place';

/**
 * IndioScene — "Ferris wheel".
 *
 * A glass festival wheel stands dark against pale dusk dust. The `moment`
 * dwell turns it through one slow revolution; the rim bulbs light one by
 * one as they pass the top, until the whole wheel glows. The wheel's angle
 * follows scroll through a damped spring, so the gondolas, hung on pivots,
 * swing with the wheel's real angular acceleration and settle when you stop.
 * Scrolling up turns it back and the lights go out in reverse.
 *
 * Pointer: the wheel turns a few degrees toward the cursor in 3D.
 * Reduced motion: the wheel fully lit, at rest, gondolas hanging plumb.
 */

const R = 1.55;
const SPOKES = 16;
const CARS = 8;
const BULBS = 64;
const HUB_Y = 0.25;

const PLACE: Placement = {
  hero: { x: 2.2, y: -0.1, z: -1.4, s: 0.82 },
  center: { x: 0, y: 0, z: 0, s: 1 },
  compactHero: { x: 0.35, y: -1.6, z: -1.6, s: 0.5 },
  compactCenter: { x: 0, y: 0.1, z: 0, s: 0.62 },
  still: { x: 2.2, y: -0.1, z: -1.4, s: 0.82 },
  compactStill: { x: 0, y: 0.1, z: 0, s: 0.62 },
};

const _cam = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();
const _dim = new THREE.Color('#c9d4ff');
const _lit = new THREE.Color('#5d7bff').multiplyScalar(2.6);
const _hot = new THREE.Color('#ffffff').multiplyScalar(3.2);

export default function IndioScene() {
  const q = useQuality();
  const rig = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const carRefs = useRef<(THREE.Group | null)[]>([]);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const hub = useRef<THREE.Mesh>(null);
  const stage = useMemo(createStageState, []);
  const live = useRef({ angle: 0, vel: 0, prevVel: 0, swing: 0, swingV: 0, ry: 0 });
  const report = useHotspotReporter('indio-skyline');

  /* rim + spokes as one line geometry — one draw call, hairline glass */
  const frame = useMemo(() => {
    const pts: number[] = [];
    const ring = (r: number, z: number) => {
      const n = 128;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        pts.push(Math.cos(a0) * r, Math.sin(a0) * r, z, Math.cos(a1) * r, Math.sin(a1) * r, z);
      }
    };
    ring(R, 0.12);
    ring(R, -0.12);
    ring(R * 0.92, 0.12);
    ring(R * 0.92, -0.12);
    for (let i = 0; i < SPOKES; i++) {
      const a = (i / SPOKES) * Math.PI * 2;
      const z = i % 2 ? 0.12 : -0.12;
      pts.push(0, 0, z * 0.5, Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92, z);
      /* rim lattice */
      const b = ((i + 1) / SPOKES) * Math.PI * 2;
      pts.push(Math.cos(a) * R, Math.sin(a) * R, 0.12, Math.cos(b) * R * 0.92, Math.sin(b) * R * 0.92, -0.12);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#6b87ff', transparent: true, opacity: 0.7 }),
    [],
  );
  /* the A-frame legs */
  const legs = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const y0 = -HUB_Y - R - 0.55;
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0, 0, 0.2, -1.05, y0, 0.45, 0, 0, 0.2, 1.05, y0, 0.45,
          0, 0, -0.2, -1.05, y0, -0.45, 0, 0, -0.2, 1.05, y0, -0.45,
          -0.6, y0 * 0.58, 0.32, 0.6, y0 * 0.58, 0.32,
          -0.6, y0 * 0.58, -0.32, 0.6, y0 * 0.58, -0.32,
          -2.4, y0, 0, 2.4, y0, 0,
        ],
        3,
      ),
    );
    return g;
  }, []);
  const legMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#2e4bff', transparent: true, opacity: 0.55 }),
    [],
  );
  const bulbMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  useEffect(
    () => () => {
      frame.dispose();
      lineMat.dispose();
      legs.dispose();
      legMat.dispose();
      bulbMat.dispose();
    },
    [frame, lineMat, legs, legMat, bulbMat],
  );

  /* bulbs — instanced around the outer rim, both faces */
  useEffect(() => {
    const b = bulbs.current;
    if (!b) return;
    for (let i = 0; i < BULBS; i++) {
      const a = (i / (BULBS / 2)) * Math.PI * 2;
      const z = i < BULBS / 2 ? 0.12 : -0.12;
      _m.makeTranslation(Math.cos(a) * R, Math.sin(a) * R, z);
      b.setMatrixAt(i, _m);
      b.setColorAt(i, _dim);
    }
    b.instanceMatrix.needsUpdate = true;
    if (b.instanceColor) b.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state, delta) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const dt = Math.min(delta, 1 / 30);
    readStage(stage, q);
    const intro = anim ? smooth(Math.min(el / 1.8, 1)) : 1;
    const t = stage.t;
    const L = live.current;

    if (rig.current) placeStage(rig.current, stage, q, PLACE, intro);

    /* one revolution across the dwell (clockwise), via a critically-damped follow */
    const target = anim ? -smooth(t) * Math.PI * 2 - t * 0.4 : 0;
    const prevAngle = L.angle;
    L.angle = anim ? damp(L.angle, target, 3.2, dt) : target;
    const vel = dt > 0 ? (L.angle - prevAngle) / dt : 0;
    const acc = dt > 0 ? (vel - L.prevVel) / dt : 0;
    L.prevVel = vel;
    if (wheel.current) wheel.current.rotation.z = L.angle;

    /* gondola pendulum: driven by tangential acceleration, lightly damped */
    if (anim) {
      const force = -acc * 0.06 - L.swing * 9 - L.swingV * 2.2;
      L.swingV += force * dt;
      L.swing += L.swingV * dt;
      L.swing = Math.max(-0.5, Math.min(0.5, L.swing));
    } else {
      L.swing = 0;
    }
    for (let i = 0; i < CARS; i++) {
      const c = carRefs.current[i];
      if (!c) continue;
      /* counter-rotate to hang plumb, plus the swing */
      c.rotation.z = -L.angle + L.swing * (0.8 + 0.4 * Math.sin(i * 1.7));
    }

    /* lights: each bulb comes on as it first crosses the top of the wheel */
    const b = bulbs.current;
    if (b) {
      const turned = -L.angle; // radians travelled
      for (let i = 0; i < BULBS; i++) {
        const k = i % (BULBS / 2);
        const a0 = (k / (BULBS / 2)) * Math.PI * 2; // bulb angle at rest
        /* clockwise travel needed for this bulb to reach the top (π/2) */
        let need = a0 - Math.PI / 2;
        need = ((need % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const on = anim ? Math.min(Math.max((turned - need) / 0.35, 0), 1) : 1;
        const fresh = anim ? Math.exp(-Math.max(turned - need, 0) * 3) * on : 0;
        _c.copy(_dim).lerp(_lit, on).lerp(_hot, fresh * 0.6);
        b.setColorAt(i, _c);
      }
      if (b.instanceColor) b.instanceColor.needsUpdate = true;
    }

    if (hub.current) {
      const m = hub.current.material as THREE.MeshPhysicalMaterial;
      m.emissiveIntensity = 0.2 + (anim ? smooth(t) : 1) * 0.9;
      report(hub.current, state.camera, 0.45 + 0.4 * stage.focus);
    }

    L.ry = anim ? damp(L.ry, pointer.x * 0.22 - 0.12, 2, delta) : -0.18;
    if (tilt.current) {
      tilt.current.rotation.y = L.ry;
      tilt.current.rotation.x = anim ? pointer.y * -0.05 : 0;
    }

    _cam.set(anim ? pointer.x * 0.3 : 0, anim ? pointer.y * 0.18 : 0, 9);
    state.camera.position.lerp(_cam, 0.05);
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <SceneLightRig />
      <group ref={rig}>
        <group ref={tilt} position={[0, HUB_Y, 0]}>
          <lineSegments geometry={legs} material={legMat} />
          <group ref={wheel}>
            <lineSegments geometry={frame} material={lineMat} />
            {/* glass rim — the wheel's body catches the rig light */}
            <mesh>
              <torusGeometry args={[R, 0.028, 12, 160]} />
              <GlassMaterial kind="azure" />
            </mesh>
            <instancedMesh ref={bulbs} args={[undefined, undefined, BULBS]} material={bulbMat}>
              <sphereGeometry args={[0.03, 10, 8]} />
            </instancedMesh>
            {Array.from({ length: CARS }, (_, i) => {
              const a = (i / CARS) * Math.PI * 2 + Math.PI / CARS;
              return (
                <group
                  key={i}
                  position={[Math.cos(a) * R, Math.sin(a) * R, 0]}
                  ref={(g) => {
                    carRefs.current[i] = g;
                  }}
                >
                  <mesh position={[0, -0.13, 0]}>
                    <cylinderGeometry args={[0.004, 0.004, 0.16, 6]} />
                    <meshBasicMaterial color="#6b87ff" />
                  </mesh>
                  <mesh position={[0, -0.27, 0]}>
                    <capsuleGeometry args={[0.085, 0.07, 6, 16]} />
                    <GlassMaterial kind={i % 2 ? 'ice' : 'crystal'} />
                  </mesh>
                </group>
              );
            })}
          </group>
          <mesh ref={hub}>
            <sphereGeometry args={[0.11, 32, 24]} />
            <GlassMaterial kind="deep" emissive="#2e4bff" emissiveIntensity={0.2} />
          </mesh>
        </group>
      </group>
      {/* dusk dust — a warmer, denser drift low in the frame */}
      <ParticleField
        count={Math.floor(1500 * q.particles)}
        spread={[10, 3, 5]}
        position={[0, -2.2, -1]}
        drift={q.animate ? 0.12 : 0}
        opacity={0.3}
        colorB="#c9d4ff"
      />
      <ParticleField count={Math.floor(600 * q.particles)} drift={q.animate ? 0.08 : 0} opacity={0.2} />
    </>
  );
}
