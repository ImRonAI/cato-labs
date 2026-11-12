'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, type GlassKind } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import {
  beat,
  damp,
  introAt,
  newMoment,
  readMoment,
  useLensShift,
} from '../lib-b/stage';
import ShockRing, { useShockMaterial } from '../lib-b/ShockRing';

/**
 * RealEstateScene — "The Authority Skyline".
 *
 * Nine bevelled glass towers on a parcel-grid city plinth, anchored by a
 * deep-sapphire flagship tower crowned with a dispersive prism collar and a
 * luminous authority beacon.
 *
 * Across the 280vh `moment` dwell (t: 0 → 1):
 *   • 0.00 → 0.24: Blueprint parcel boundaries illuminate across the plinth.
 *   • 0.12 → 0.72: Towers extrude floor-by-floor in a left-to-right wave,
 *     culminating in the deep-sapphire flagship tower.
 *   • 0.64 → 0.96: Rooftop comparables & radial authority arcs wire every
 *     parcel to the flagship beacon as an authority shockwave crosses the block.
 *
 * Continues choreographing across `market-truth`, `feature`, `detail`, and
 * `cta`. Hotspot 'realestate-beacon' rides the flagship beacon.
 */

interface TowerSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  kind: GlassKind;
  deep?: boolean;
}

const BASE_TOP = -1.64;
const STUB = 0.14;
const BEACON_AT = 0.72;
const TAU_RATE = 5.2;

const TOWERS: readonly TowerSpec[] = [
  { x: -2.4, z: -0.52, w: 0.58, d: 0.66, h: 1.18, kind: 'ice' },
  { x: -1.68, z: 0.42, w: 0.66, d: 0.6, h: 1.72, kind: 'azure' },
  { x: -0.95, z: -0.38, w: 0.56, d: 0.64, h: 1.48, kind: 'crystal' },
  { x: -0.22, z: 0.58, w: 0.62, d: 0.58, h: 1.92, kind: 'ice' },
  { x: 0.12, z: -0.15, w: 0.68, d: 0.68, h: 2.24, kind: 'azure' },
  { x: 0.96, z: -0.26, w: 0.78, d: 0.78, h: 3.05, kind: 'deep', deep: true },
  { x: 1.12, z: 0.68, w: 0.56, d: 0.56, h: 1.64, kind: 'crystal' },
  { x: 1.86, z: 0.22, w: 0.62, d: 0.62, h: 1.82, kind: 'ice' },
  { x: 2.52, z: -0.42, w: 0.52, d: 0.58, h: 1.15, kind: 'azure' },
];

const DEEP_INDEX = 5;

const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

export default function RealEstateScene() {
  const q = useQuality();
  const lens = useLensShift();
  const moment = useRef(newMoment());
  const startAt = useRef<number | null>(null);

  const groupRef = useRef<THREE.Group>(null);
  const rigRef = useRef<THREE.Group>(null);
  const baseRef = useRef<THREE.Mesh>(null);
  const parcelMatRef = useRef<THREE.LineBasicMaterial>(null);
  const towerRefs = useRef<(THREE.Mesh | null)[]>([]);
  const nodesRef = useRef<THREE.InstancedMesh>(null);
  const crownHaloRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const tilt = useRef({ x: 0, y: 0 });

  const report = useHotspotReporter('realestate-beacon');
  const towers = useMemo(() => TOWERS, []);

  /* static blueprint parcel grid + dynamic rooftop authority graph */
  const { parcelGeo, graphGeo, graphAttr, graphPos } = useMemo(() => {
    const pSegs: number[] = [];
    const py = BASE_TOP + 0.004;
    for (let i = -3; i <= 3; i++) {
      pSegs.push(i * 0.92, py, -1.55, i * 0.92, py, 1.55);
    }
    for (let j = -2; j <= 2; j++) {
      pSegs.push(-2.85, py, j * 0.75, 2.85, py, j * 0.75);
    }
    const parcelGeo = new THREE.BufferGeometry();
    parcelGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(pSegs), 3),
    );

    /* chain segments (N-1) + radial spokes to DEEP_INDEX (N-1) = 16 segments */
    const segCount = (TOWERS.length - 1) * 2;
    const graphPos = new Float32Array(segCount * 6);
    const graphAttr = new THREE.BufferAttribute(graphPos, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    const graphGeo = new THREE.BufferGeometry();
    graphGeo.setAttribute('position', graphAttr);
    return { parcelGeo, graphGeo, graphAttr, graphPos };
  }, []);

  const graphMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#6b87ff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );

  const shockMat = useShockMaterial({
    speed: 1.2,
    width: 0.028,
    color: '#2e4bff',
    hot: '#eaf1ff',
  });

  useEffect(
    () => () => {
      parcelGeo.dispose();
      graphGeo.dispose();
      graphMat.dispose();
    },
    [parcelGeo, graphGeo, graphMat],
  );

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = now;
    const el = now - startAt.current;
    const anim = q.animate;
    const dt = Math.min(delta, 0.05);

    const mo = readMoment(moment.current, anim);
    const t = mo.t;
    const settled = anim ? Math.max(t, mo.leave > 0 ? 1 : 0) : 1;

    const truth = smooth(sectionRange(getSectionProgress('market-truth'), 0.05, 0.9));
    const feat = smooth(sectionRange(getSectionProgress('feature'), 0.05, 0.9));
    const det = smooth(sectionRange(getSectionProgress('detail'), 0.08, 0.88));
    const cta = smooth(sectionRange(getSectionProgress('cta'), 0.05, 0.85));

    const intro = anim ? introAt(el, 0, 1.55) : 1;
    if (groupRef.current) {
      groupRef.current.position.y = -0.85 * (1 - intro);
    }

    if (baseRef.current) {
      const pop = anim ? introAt(el, 0, 0.7) : 1;
      baseRef.current.scale.set(Math.max(pop, 0.001), 1, Math.max(pop, 0.001));
    }

    const parcelWake = anim ? Math.max(0.25, beat(settled, 0.0, 0.26)) : 1;
    if (parcelMatRef.current) {
      parcelMatRef.current.opacity = intro * (0.14 + 0.18 * parcelWake);
    }

    /* rooftop authority network wakes as the skyline completes */
    const graphWake = anim ? beat(settled, 0.6, 0.94) : 1;
    graphMat.opacity = intro * (0.1 + 0.56 * graphWake + 0.14 * det);

    /* compute rooftop heights across the 9 towers */
    const nInst = nodesRef.current;
    _q.identity();
    let deepTop = BASE_TOP + TOWERS[DEEP_INDEX].h * STUB;

    for (let i = 0; i < towers.length; i++) {
      const s = towers[i];
      const rise = anim
        ? beat(settled, 0.08 + i * 0.055, 0.42 + i * 0.055)
        : 1;
      const pop = anim ? introAt(el, 0.14 + i * 0.06, 0.75) : 1;
      const frac = (STUB + (1 - STUB) * rise) * pop;
      const hCur = Math.max(s.h * frac, 0.001);
      const top = BASE_TOP + hCur;

      const m = towerRefs.current[i];
      if (m) {
        m.scale.set(Math.max(pop, 0.001), hCur, Math.max(pop, 0.001));
        m.position.y = BASE_TOP + hCur / 2;
      }

      if (nInst) {
        _p.set(s.x, top + 0.032, s.z);
        _s.setScalar(Math.max(pop * (0.6 + 0.55 * graphWake), 0.0001));
        _m.compose(_p, _q, _s);
        nInst.setMatrixAt(i, _m);
      }

      if (s.deep) {
        deepTop = top;
      }
    }
    if (nInst) nInst.instanceMatrix.needsUpdate = true;

    /* write chain segments + radial authority spokes to the deep flagship roof */
    const dx = towers[DEEP_INDEX].x;
    const dy = deepTop + 0.032;
    const dz = towers[DEEP_INDEX].z;
    let o = 0;
    for (let i = 0; i < towers.length - 1; i++) {
      const a = towers[i];
      const b = towers[i + 1];
      const ya = (towerRefs.current[i]?.scale.y ?? a.h * STUB) + BASE_TOP + 0.032;
      const yb =
        (towerRefs.current[i + 1]?.scale.y ?? b.h * STUB) + BASE_TOP + 0.032;
      graphPos[o++] = a.x;
      graphPos[o++] = ya;
      graphPos[o++] = a.z;
      graphPos[o++] = b.x;
      graphPos[o++] = yb;
      graphPos[o++] = b.z;
    }
    for (let i = 0; i < towers.length; i++) {
      if (i === DEEP_INDEX) continue;
      const a = towers[i];
      const ya = (towerRefs.current[i]?.scale.y ?? a.h * STUB) + BASE_TOP + 0.032;
      graphPos[o++] = a.x;
      graphPos[o++] = ya;
      graphPos[o++] = a.z;
      graphPos[o++] = dx;
      graphPos[o++] = dy;
      graphPos[o++] = dz;
    }
    graphAttr.needsUpdate = true;

    /* flagship prism halo + authority beacon */
    if (crownHaloRef.current) {
      crownHaloRef.current.position.set(dx, deepTop + 0.04, dz);
      crownHaloRef.current.rotation.x = Math.PI / 2;
      crownHaloRef.current.rotation.z = anim ? el * 0.4 : 0;
      crownHaloRef.current.scale.setScalar(
        Math.max(0.0001, intro * (0.4 + 0.6 * graphWake)),
      );
    }
    if (beaconRef.current) {
      const pulse = anim
        ? 1 + Math.sin(el * 2.2) * (0.1 + 0.22 * graphWake)
        : 1;
      beaconRef.current.position.set(dx, deepTop + 0.1, dz);
      beaconRef.current.scale.setScalar(Math.max(intro, 0.001) * pulse);
      report(
        beaconRef.current,
        state.camera,
        0.54 + 0.38 * graphWake + 0.08 * truth,
      );
    }

    const tau = settled > BEACON_AT ? (settled - BEACON_AT) * TAU_RATE : 0;
    shockMat.uniforms.uTau.value = anim && mo.leave < 0.8 ? tau : 0;

    if (rigRef.current) {
      tilt.current.x = damp(tilt.current.x, anim ? -pointer.y * 0.05 : 0, 3.2, dt);
      tilt.current.y = damp(
        tilt.current.y,
        -0.24 +
          settled * 0.32 +
          feat * 0.22 -
          det * 0.16 +
          (anim ? pointer.x * 0.11 : 0),
        3.2,
        dt,
      );
      rigRef.current.rotation.x = tilt.current.x;
      rigRef.current.rotation.y = tilt.current.y;
    }

    const inMoment = anim ? mo.enter * (1 - mo.leave) : 0;
    const orbit = anim ? Math.sin(el * 0.045) * 0.07 : 0.12;
    const radius =
      (q.compact ? 12.2 : 9.3) -
      intro * 0.55 -
      inMoment * 0.8 -
      det * 0.4 +
      cta * 0.75;

    _cam.set(
      Math.sin(orbit) * radius + (anim ? pointer.x * 0.38 : 0),
      3.9 - inMoment * 0.65 - det * 0.3 + cta * 0.45 + (anim ? pointer.y * 0.24 : 0),
      Math.cos(orbit) * radius,
    );
    if (anim) state.camera.position.lerp(_cam, 0.05);
    else state.camera.position.copy(_cam);

    _look.set(0.15 * graphWake, -0.22 + graphWake * 0.2, 0);
    state.camera.lookAt(_look);

    if (q.compact) lens(0, -0.08 + inMoment * 0.08);
    else lens(0.22 * (1 - inMoment), -0.03 * (1 - inMoment));
  });

  return (
    <group ref={groupRef}>
      <SceneLightRig />

      <group ref={rigRef}>
        {/* frosted city-block plinth + blueprint parcel grid */}
        <RoundedBox
          ref={baseRef}
          args={[6.1, 0.12, 3.5]}
          radius={0.04}
          smoothness={4}
          position={[0, -1.7, 0]}
        >
          <GlassMaterial kind="pane" />
        </RoundedBox>
        <lineSegments geometry={parcelGeo}>
          <lineBasicMaterial
            ref={parcelMatRef}
            color="#6b87ff"
            transparent
            opacity={0.18}
            depthWrite={false}
          />
        </lineSegments>

        {/* 9 bevelled glass towers */}
        {towers.map((s, i) => (
          <RoundedBox
            key={i}
            ref={(m) => {
              towerRefs.current[i] = m;
            }}
            args={[s.w, 1, s.d]}
            radius={0.035}
            smoothness={4}
            position={[s.x, BASE_TOP + (s.h * STUB) / 2, s.z]}
            scale={[1, s.h * STUB, 1]}
          >
            <GlassMaterial
              kind={s.kind}
              emissive={s.deep ? '#1226c8' : '#000000'}
              emissiveIntensity={s.deep ? 0.28 : 0}
            />
          </RoundedBox>
        ))}

        {/* rooftop comparables & authority network */}
        <lineSegments
          geometry={graphGeo}
          material={graphMat}
          frustumCulled={false}
        />
        <instancedMesh
          ref={nodesRef}
          args={[undefined, undefined, TOWERS.length]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.032, 12, 10]} />
          <meshBasicMaterial color="#9db2ff" toneMapped={false} />
        </instancedMesh>

        {/* flagship penthouse prism halo + authority beacon */}
        <mesh ref={crownHaloRef}>
          <torusGeometry args={[0.34, 0.012, 14, 56]} />
          <GlassMaterial kind="prism" />
        </mesh>
        <mesh
          ref={beaconRef}
          position={[
            TOWERS[DEEP_INDEX].x,
            BASE_TOP + TOWERS[DEEP_INDEX].h * STUB + 0.1,
            TOWERS[DEEP_INDEX].z,
          ]}
        >
          <sphereGeometry args={[0.06, 18, 14]} />
          <meshBasicMaterial color="#eaf1ff" toneMapped={false} />
        </mesh>

        {/* authority shockwave radiating from the flagship parcel */}
        <ShockRing
          material={shockMat}
          radius={3.4}
          position={[
            TOWERS[DEEP_INDEX].x,
            BASE_TOP + 0.008,
            TOWERS[DEEP_INDEX].z,
          ]}
        />
      </group>

      <ParticleField
        count={Math.floor(1300 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.3}
        position={[0, 0.4, 0]}
      />
    </group>
  );
}
