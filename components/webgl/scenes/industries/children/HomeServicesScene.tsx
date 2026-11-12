'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import {
  GlassMaterial,
  GradientGlassMaterial,
  type GlassKind,
} from '../../../lib/materials';
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
 * HomeServicesScene — "The Precision Dispatch Escapement".
 *
 * In the trades, the job goes to whoever answers first. A horological glass
 * gear train (azure 12T → deep-sapphire 16T master → ice 10T) is mounted
 * before a frosted chassis plate and calibrated gradient-glass dial bezel,
 * pinned by prism-glass jewel arbors above a plinth rail.
 *
 * Across the 280vh `moment` dwell (t: 0 → 1):
 *   • 0.04 → 0.54: Out-of-sync gears slipping past one another phase-lock
 *     into exact tooth-for-tooth horological ratios.
 *   • 0.36 → 0.78: A fourth crystal-glass 7T dispatch gear arcs in from off-
 *     axis and seats cleanly into mesh off the ice gear.
 *   • 0.75 → 0.98: Instant-response engagement — a sapphire pulse flashes
 *     sequentially down the four-gear train and a shockwave ring ripples
 *     across the base rail as the entire dispatch movement runs on rails.
 *
 * Continues choreographing across `market-truth`, `feature`, `detail`, and
 * `cta`. Hotspot 'ind-home-deep-gear' rides the deep master gear.
 */

interface GearSpec {
  teeth: number;
  pitchR: number;
  thickness: number;
  kind: GlassKind;
  pos: readonly [number, number, number];
  ratio: number;
  phase: number;
  slip: number;
}

/** trapezoid-tooth cog, extruded with bevel; module-matched teeth */
function buildGearGeometry(
  teeth: number,
  pitchR: number,
  toothDepth: number,
  thickness: number,
): THREE.ExtrudeGeometry {
  const rootR = pitchR - toothDepth / 2;
  const tipR = pitchR + toothDepth / 2;
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  let started = false;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const seg: ReadonlyArray<readonly [number, number]> = [
      [a, rootR],
      [a + step * 0.3, rootR],
      [a + step * 0.38, tipR],
      [a + step * 0.62, tipR],
      [a + step * 0.7, rootR],
    ];
    for (const [ang, r] of seg) {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (!started) {
        shape.moveTo(x, y);
        started = true;
      } else {
        shape.lineTo(x, y);
      }
    }
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, Math.max(rootR * 0.3, 0.12), 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.center();
  return geo;
}

const TOOTH_DEPTH = 0.22;
const ENGAGE_AT = 0.75;
const TAU_RATE = 5.4;
const RAIL_Y = -2.02;

const GEARS: readonly GearSpec[] = [
  {
    teeth: 12,
    pitchR: 0.95,
    thickness: 0.3,
    kind: 'azure',
    pos: [-1.8, 1.19, -0.12],
    ratio: -16 / 12,
    phase: 0.13,
    slip: 0.12,
  },
  {
    teeth: 16,
    pitchR: 1.27,
    thickness: 0.38,
    kind: 'deep',
    pos: [0.1, 0.1, 0],
    ratio: 1,
    phase: 0,
    slip: 0,
  },
  {
    teeth: 10,
    pitchR: 0.79,
    thickness: 0.3,
    kind: 'ice',
    pos: [1.76, -1.06, 0.1],
    ratio: -16 / 10,
    phase: 0.21,
    slip: -0.14,
  },
];

const JOINER: GearSpec = {
  teeth: 7,
  pitchR: 0.56,
  thickness: 0.26,
  kind: 'crystal',
  pos: [2.52, 0.03, 0.2],
  ratio: (16 / 10) * (10 / 7),
  phase: 0.4,
  slip: 0.18,
};
const JOINER_AWAY: readonly [number, number, number] = [4.05, -1.65, 1.05];

/* module-scope scratch objects — zero per-frame allocations */
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _aPos = new THREE.Vector3();
const _aQuat = new THREE.Quaternion();
const _aScale = new THREE.Vector3();
const _aMat = new THREE.Matrix4();
const _xRotQuat = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(Math.PI / 2, 0, 0),
);
const _emissive = new THREE.Color('#2e4bff');

export default function HomeServicesScene() {
  const q = useQuality();
  const lens = useLensShift();
  const moment = useRef(newMoment());
  const startAt = useRef<number | null>(null);

  const groupRef = useRef<THREE.Group>(null);
  const rigRef = useRef<THREE.Group>(null);
  const gearRefs = useRef<(THREE.Mesh | null)[]>([]);
  const gearMatRefs = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const joinerRef = useRef<THREE.Mesh>(null);
  const joinerMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const arborsRef = useRef<THREE.InstancedMesh>(null);
  const bezelRef = useRef<THREE.Mesh>(null);
  const chassisRef = useRef<THREE.Mesh>(null);
  const railRef = useRef<THREE.Mesh>(null);
  const master = useRef(0);
  const tilt = useRef({ x: 0, y: 0 });

  const report = useHotspotReporter('ind-home-deep-gear');

  const geometries = useMemo(
    () =>
      GEARS.map((g) =>
        buildGearGeometry(g.teeth, g.pitchR, TOOTH_DEPTH, g.thickness),
      ),
    [],
  );
  const joinerGeo = useMemo(
    () =>
      buildGearGeometry(
        JOINER.teeth,
        JOINER.pitchR,
        TOOTH_DEPTH,
        JOINER.thickness,
      ),
    [],
  );
  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose());
      joinerGeo.dispose();
    },
    [geometries, joinerGeo],
  );

  const shockMat = useShockMaterial({
    speed: 1.15,
    width: 0.028,
    color: '#2e4bff',
    hot: '#dce4ff',
  });

  useFrame((state, delta) => {
    if (startAt.current === null) startAt.current = state.clock.elapsedTime;
    const el = state.clock.elapsedTime - startAt.current;
    const anim = q.animate;
    const dt = Math.min(delta, 0.05);

    const mo = readMoment(moment.current, anim);
    const settled = anim ? Math.max(mo.t, mo.leave > 0 ? 1 : 0) : 1;
    const truth = anim ? getSectionProgress('market-truth') : 0;
    const feature = anim ? getSectionProgress('feature') : 0;
    const detail = anim ? getSectionProgress('detail') : 0;
    const cta = anim ? getSectionProgress('cta') : 0;

    const intro = anim ? introAt(el, 0, 1.65) : 1;
    if (groupRef.current) {
      groupRef.current.position.y = -0.95 * (1 - intro);
    }

    /* moment beats */
    const lock = beat(settled, 0.06, 0.56);
    const join = beat(settled, 0.36, 0.78);
    const engaged = beat(settled, 0.75, 0.96);
    const tau = settled > ENGAGE_AT ? (settled - ENGAGE_AT) * TAU_RATE : 0;

    /* master angle accumulates steadily once animating, brisker once engaged */
    if (anim) {
      master.current += dt * (0.2 + 0.14 * engaged) * intro;
    } else {
      master.current = 0.42;
    }

    const detailOpen = smooth(sectionRange(detail, 0.1, 0.78));
    const ctaCalm = smooth(sectionRange(cta, 0.1, 0.8));

    /* 1. Standing 3-gear train */
    for (let i = 0; i < GEARS.length; i++) {
      const m = gearRefs.current[i];
      if (!m) continue;
      const s = GEARS[i];
      m.position.set(
        s.pos[0],
        s.pos[1],
        s.pos[2] + (i - 1) * detailOpen * 0.18,
      );
      m.rotation.z =
        master.current * s.ratio +
        s.phase +
        (anim ? s.slip * el * (1 - lock) : 0);
      const pop = anim ? introAt(el, 0.08 + i * 0.12, 0.75) : 1;
      m.scale.setScalar(Math.max(pop, 0.001));

      const mat = gearMatRefs.current[i];
      if (mat) {
        const waveHit = Math.max(tau - i * 0.14, 0);
        const flash =
          waveHit > 0 ? Math.exp(-waveHit * 3.8) * (1 - Math.exp(-waveHit * 28)) : 0;
        const playGlow =
          feature > 0
            ? smooth(sectionRange(feature, i * 0.24, i * 0.24 + 0.32)) *
              (1 - smooth(sectionRange(feature, i * 0.24 + 0.38, i * 0.24 + 0.62)))
            : 0;
        mat.emissiveIntensity =
          flash * 0.95 + (i === 1 ? engaged * 0.22 : engaged * 0.08) + playGlow * 0.32;
      }
    }

    /* 2. Fourth crystal dispatch gear — arcs in and seats into mesh */
    const j = joinerRef.current;
    let jx = JOINER.pos[0];
    let jy = JOINER.pos[1];
    let jz = JOINER.pos[2];
    let jScale = 1;
    if (j) {
      const arc = Math.sin(join * Math.PI) * 0.58;
      jx = JOINER_AWAY[0] + (JOINER.pos[0] - JOINER_AWAY[0]) * join;
      jy = JOINER_AWAY[1] + (JOINER.pos[1] - JOINER_AWAY[1]) * join + arc;
      jz =
        JOINER_AWAY[2] +
        (JOINER.pos[2] - JOINER_AWAY[2]) * join +
        detailOpen * 0.26;
      j.position.set(jx, jy, jz);
      j.rotation.z =
        master.current * JOINER.ratio +
        JOINER.phase +
        (anim
          ? (JOINER.slip * 2.1 * (1 - join) + JOINER.slip * (1 - lock)) * el
          : 0);
      const pop = anim ? introAt(el, 0.42, 0.8) : 1;
      jScale = Math.max(pop, 0.001) * (0.58 + 0.42 * join);
      j.scale.setScalar(jScale);
    }
    if (joinerMatRef.current) {
      const jWave = Math.max(tau - 0.38, 0);
      const jFlash =
        jWave > 0 ? Math.exp(-jWave * 3.6) * (1 - Math.exp(-jWave * 28)) : 0;
      joinerMatRef.current.emissiveIntensity = jFlash * 1.05 + engaged * 0.18;
    }

    /* 3. Prism jewel arbor pins (1 instanced draw call for all 4 gears) */
    const arb = arborsRef.current;
    if (arb) {
      for (let i = 0; i < 4; i++) {
        if (i < 3) {
          const s = GEARS[i];
          const pop = anim ? introAt(el, 0.14 + i * 0.12, 0.7) : 1;
          _aPos.set(
            s.pos[0],
            s.pos[1],
            s.pos[2] + (i - 1) * detailOpen * 0.18,
          );
          _aScale.set(pop, pop * (s.thickness * 1.45), pop);
        } else {
          _aPos.set(jx, jy, jz);
          _aScale.set(jScale, jScale * (JOINER.thickness * 1.45), jScale);
        }
        _aQuat.copy(_xRotQuat);
        _aMat.compose(_aPos, _aQuat, _aScale);
        arb.setMatrixAt(i, _aMat);
      }
      arb.instanceMatrix.needsUpdate = true;
    }

    /* 4. Dial bezel, frosted chassis plate, base rail & shockwave */
    if (bezelRef.current) {
      const bPop = anim ? introAt(el, 0.2, 0.85) : 1;
      bezelRef.current.scale.setScalar(Math.max(bPop * (0.88 + 0.12 * lock), 0.001));
      bezelRef.current.rotation.z = -master.current * 0.25;
    }
    if (chassisRef.current) {
      const cPop = anim ? introAt(el, 0.05, 0.8) : 1;
      chassisRef.current.scale.set(Math.max(cPop, 0.001), Math.max(cPop, 0.001), 1);
      chassisRef.current.position.z = -0.44 - detailOpen * 0.22;
    }
    if (railRef.current) {
      const rPop = anim ? introAt(el, 0, 0.7) : 1;
      railRef.current.scale.set(Math.max(rPop, 0.001), 1, Math.max(rPop, 0.001));
    }
    shockMat.uniforms.uTau.value = tau;

    /* 5. Hotspot on deep master gear */
    const deep = gearRefs.current[1];
    if (deep) {
      report(deep, state.camera, 0.52 + 0.42 * Math.max(lock, engaged));
    }

    /* 6. Pointer tilt on rig */
    if (rigRef.current) {
      tilt.current.x = damp(tilt.current.x, anim ? pointer.y * 0.045 : 0, 3.2, dt);
      tilt.current.y = damp(tilt.current.y, anim ? pointer.x * 0.1 : 0, 3.2, dt);
      rigRef.current.rotation.x = tilt.current.x;
      rigRef.current.rotation.y =
        tilt.current.y +
        truth * 0.1 -
        feature * 0.14 +
        detailOpen * 0.24 -
        ctaCalm * 0.08;
    }

    /* 7. Camera & lens shift */
    const inMoment = anim ? Math.max(mo.enter * (1 - mo.leave), 0) : 0;
    const az =
      (anim ? Math.sin(el * 0.05) * 0.085 : 0.08) +
      inMoment * -0.05 +
      feature * 0.16 -
      detailOpen * 0.22 +
      ctaCalm * 0.08;
    const radius =
      (q.compact ? 12.6 : 9.5) -
      intro * 0.45 -
      inMoment * 0.65 +
      detailOpen * 0.3 +
      ctaCalm * 0.5;
    const camY =
      0.95 -
      inMoment * 0.2 +
      truth * 0.16 +
      detailOpen * 0.35 -
      ctaCalm * 0.15 +
      (anim ? pointer.y * 0.24 : 0);

    _cam.set(
      Math.sin(az) * radius - 0.15 + (anim ? pointer.x * 0.34 : 0),
      camY,
      Math.cos(az) * radius,
    );
    if (anim) state.camera.position.lerp(_cam, 0.05);
    else state.camera.position.copy(_cam);

    _look.set(-0.1, 0.02 - inMoment * 0.04, 0);
    state.camera.lookAt(_look);

    const k = anim ? 0.05 : 1;
    if (q.compact) lens(0, -0.08 + inMoment * 0.08, k);
    else lens(0.22 * (1 - inMoment), -0.03 * (1 - inMoment), k);
  });

  return (
    <group ref={groupRef}>
      <SceneLightRig />

      <group ref={rigRef}>
        {/* base dispatch rail + engagement shockwave */}
        <RoundedBox
          ref={railRef}
          args={[5.6, 0.08, 2.1]}
          radius={0.03}
          smoothness={4}
          position={[0.05, RAIL_Y, 0]}
        >
          <GlassMaterial kind="ice" />
        </RoundedBox>

        <ShockRing
          material={shockMat}
          radius={3.4}
          position={[0.1, RAIL_Y + 0.045, 0]}
        />

        {/* horological movement assembly */}
        <group position={[-0.25, -0.02, 0]} scale={0.92}>
          {/* frosted pane movement backplate */}
          <RoundedBox
            ref={chassisRef}
            args={[5.5, 3.4, 0.07]}
            radius={0.08}
            smoothness={4}
            position={[0.28, 0.06, -0.44]}
          >
            <GlassMaterial kind="pane" />
          </RoundedBox>

          {/* calibrated gradient-glass escapement bezel framing master gear */}
          <mesh ref={bezelRef} position={[0.1, 0.1, -0.22]}>
            <torusGeometry args={[2.12, 0.026, 18, 112]} />
            <GradientGlassMaterial opacity={0.9} />
          </mesh>

          {/* standing 3-gear train */}
          {GEARS.map((s, i) => (
            <mesh
              key={`${s.kind}-${s.teeth}`}
              ref={(m) => {
                gearRefs.current[i] = m;
              }}
              geometry={geometries[i]}
              position={[s.pos[0], s.pos[1], s.pos[2]]}
            >
              <GlassMaterial
                ref={(mat) => {
                  gearMatRefs.current[i] = mat;
                }}
                kind={s.kind}
                emissive={_emissive}
                emissiveIntensity={0}
              />
            </mesh>
          ))}

          {/* fourth crystal dispatch gear */}
          <mesh
            ref={joinerRef}
            geometry={joinerGeo}
            position={[JOINER_AWAY[0], JOINER_AWAY[1], JOINER_AWAY[2]]}
          >
            <GlassMaterial
              ref={joinerMatRef}
              kind={JOINER.kind}
              emissive={_emissive}
              emissiveIntensity={0}
            />
          </mesh>

          {/* 4 prism jewel arbor bearings — single instanced draw call */}
          <instancedMesh
            ref={arborsRef}
            args={[undefined, undefined, 4]}
            frustumCulled={false}
          >
            <cylinderGeometry args={[0.11, 0.11, 1, 28]} />
            <GlassMaterial kind="prism" />
          </instancedMesh>
        </group>
      </group>

      <ParticleField
        count={Math.floor(1350 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.28}
      />
    </group>
  );
}
