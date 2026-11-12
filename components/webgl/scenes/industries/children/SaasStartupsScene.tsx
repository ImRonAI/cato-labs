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
 * SaasStartupsScene — "Modular Glass Stack & Compounding Telemetry Pipeline".
 *
 * Four modular glass architecture layers (Infrastructure, Data Bus, Product
 * Engine, Distribution Surface), four coaxial alignment pins, a gradient-glass
 * flywheel collar, and a 3D compounding telemetry pipeline.
 * Across the 280vh `moment` dwell (t: 0 → 1):
 *   • 0.04 → 0.54: Exploded, laterally offset glass modules slide into coaxial
 *     registration and snap down onto the vertical alignment pins.
 *   • 0.48 → 0.88: Inter-layer optical buses ignite, the compounding pipeline
 *     draws upward out of the top tier, telemetry packets stream along the
 *     arc, and the deep-sapphire breakout cube ascends to the trajectory apex.
 *
 * Continues choreographing across `market-truth`, `feature`, `detail`, and
 * `cta`. Hotspot 'ind-saas-breakout' rides the breakout module.
 * Zero allocations in useFrame; reduced motion renders the locked stack + arc.
 */

const TIER_COUNT = 4;
const PACKET_COUNT = 16;
const CURVE_SEGS = 120;
const BASE_Y = -1.05;
const TIER_PITCH = 0.36;
const LOCK_HIT = 0.52;
const TAU_RATE = 5.4;

interface TierSpec {
  w: number;
  d: number;
  kind: GlassKind;
  restY: number;
  explodeY: number;
  dx: number;
  dz: number;
  rotY: number;
}

const TIERS: readonly TierSpec[] = [
  {
    w: 2.75,
    d: 1.95,
    kind: 'pane',
    restY: BASE_Y,
    explodeY: BASE_Y - 0.35,
    dx: -0.42,
    dz: 0.22,
    rotY: -0.16,
  },
  {
    w: 2.42,
    d: 1.72,
    kind: 'ice',
    restY: BASE_Y + TIER_PITCH,
    explodeY: BASE_Y + TIER_PITCH + 0.28,
    dx: 0.48,
    dz: -0.24,
    rotY: 0.19,
  },
  {
    w: 2.1,
    d: 1.48,
    kind: 'azure',
    restY: BASE_Y + TIER_PITCH * 2,
    explodeY: BASE_Y + TIER_PITCH * 2 + 0.68,
    dx: -0.38,
    dz: -0.18,
    rotY: -0.14,
  },
  {
    w: 1.78,
    d: 1.26,
    kind: 'crystal',
    restY: BASE_Y + TIER_PITCH * 3,
    explodeY: BASE_Y + TIER_PITCH * 3 + 1.08,
    dx: 0.36,
    dz: 0.2,
    rotY: 0.18,
  },
];

const TOP_SURFACE_Y = BASE_Y + TIER_PITCH * 3 + 0.12;

const PIN_CORNERS: readonly [number, number][] = [
  [-0.68, -0.46],
  [0.68, -0.46],
  [-0.68, 0.46],
  [0.68, 0.46],
];

const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _emissive = new THREE.Color('#2e4bff');

export default function SaasStartupsScene() {
  const q = useQuality();
  const lens = useLensShift();
  const moment = useRef(newMoment());
  const startAt = useRef<number | null>(null);

  const groupRef = useRef<THREE.Group>(null);
  const rigRef = useRef<THREE.Group>(null);
  const tierRefs = useRef<(THREE.Mesh | null)[]>([]);
  const tierMats = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const pinRefs = useRef<(THREE.Mesh | null)[]>([]);
  const collarRef = useRef<THREE.Mesh>(null);
  const packetsRef = useRef<THREE.InstancedMesh>(null);
  const breakoutRef = useRef<THREE.Mesh>(null);
  const breakoutMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const tilt = useRef({ x: 0, y: 0 });

  const report = useHotspotReporter('ind-saas-breakout');

  /* compounding telemetry pipeline curve + tube geometry */
  const pipeline = useMemo(() => {
    const waypoints = [
      new THREE.Vector3(0, BASE_Y - 0.05, 0),
      new THREE.Vector3(0, BASE_Y + TIER_PITCH * 1.5, 0),
      new THREE.Vector3(0, TOP_SURFACE_Y + 0.15, 0),
      new THREE.Vector3(0.38, TOP_SURFACE_Y + 0.42, 0.12),
      new THREE.Vector3(0.92, TOP_SURFACE_Y + 0.85, 0.18),
      new THREE.Vector3(1.52, TOP_SURFACE_Y + 1.52, 0.08),
      new THREE.Vector3(2.08, TOP_SURFACE_Y + 2.38, -0.08),
    ];
    const curve = new THREE.CatmullRomCurve3(waypoints, false, 'catmullrom', 0.45);
    const tube = new THREE.TubeGeometry(curve, CURVE_SEGS, 0.016, 8, false);
    tube.setDrawRange(0, 0);

    /* pre-sample curve positions so useFrame allocates zero vectors */
    const samples = new Float32Array((CURVE_SEGS + 1) * 3);
    const pt = new THREE.Vector3();
    for (let i = 0; i <= CURVE_SEGS; i++) {
      curve.getPointAt(i / CURVE_SEGS, pt);
      samples[i * 3] = pt.x;
      samples[i * 3 + 1] = pt.y;
      samples[i * 3 + 2] = pt.z;
    }
    return {
      tube,
      samples,
      indexCount: tube.index ? tube.index.count : 0,
    };
  }, []);

  useEffect(() => () => pipeline.tube.dispose(), [pipeline]);

  const shockMat = useShockMaterial({
    speed: 1.15,
    width: 0.026,
    color: '#2e4bff',
    hot: '#dce4ff',
  });
  const packetColor = useMemo(() => new THREE.Color(0.8, 1.08, 2.85), []);

  const sampleCurve = (u: number, out: THREE.Vector3) => {
    const clamped = u < 0 ? 0 : u > 1 ? 1 : u;
    const f = clamped * CURVE_SEGS;
    const i0 = Math.min(Math.floor(f), CURVE_SEGS - 1);
    const i1 = i0 + 1;
    const frac = f - i0;
    const s = pipeline.samples;
    out.set(
      s[i0 * 3] + (s[i1 * 3] - s[i0 * 3]) * frac,
      s[i0 * 3 + 1] + (s[i1 * 3 + 1] - s[i0 * 3 + 1]) * frac,
      s[i0 * 3 + 2] + (s[i1 * 3 + 2] - s[i0 * 3 + 2]) * frac,
    );
  };

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = now;
    const el = now - startAt.current;
    const anim = q.animate;
    const dt = Math.min(delta, 0.05);

    const mo = readMoment(moment.current, anim);
    const t = mo.t;
    const settled = anim ? Math.max(t, mo.leave > 0 ? 1 : 0) : 1;

    /* post-dwell section reads */
    const truth = smooth(sectionRange(getSectionProgress('market-truth'), 0.05, 0.9));
    const feat = smooth(sectionRange(getSectionProgress('feature'), 0.05, 0.9));
    const det = smooth(sectionRange(getSectionProgress('detail'), 0.08, 0.88));
    const cta = smooth(sectionRange(getSectionProgress('cta'), 0.05, 0.85));

    const intro = anim ? introAt(el, 0, 1.55) : 1;
    if (groupRef.current) {
      groupRef.current.position.y = -0.85 * (1 - intro);
    }

    /* 4 modular glass tiers snap coaxially onto the alignment pins */
    for (let i = 0; i < TIER_COUNT; i++) {
      const mesh = tierRefs.current[i];
      if (!mesh) continue;
      const spec = TIERS[i];
      const lockStart = 0.04 + i * 0.11;
      const lock = beat(settled, lockStart, lockStart + 0.22);
      const loose = 1 - lock;

      /* subtleexploded inspection separation on `detail` */
      const inspectLift = det * (1 - cta) * i * 0.075;
      const idle = anim ? Math.sin(el * 0.8 + i * 1.4) * 0.045 * loose : 0;

      mesh.position.set(
        spec.dx * loose,
        spec.restY + (spec.explodeY - spec.restY) * loose + idle + inspectLift,
        spec.dz * loose,
      );
      mesh.rotation.y = spec.rotY * loose;

      const pop = anim ? introAt(el, 0.06 + i * 0.07, 0.72) : 1;
      mesh.scale.setScalar(Math.max(pop, 0.001));

      const mat = tierMats.current[i];
      if (mat) {
        const contactFlash =
          lock > 0.75 && lock < 1 ? Math.sin(((lock - 0.75) / 0.25) * Math.PI) : 0;
        mat.emissiveIntensity = contactFlash * 0.7 + beat(settled, 0.5, 0.85) * 0.16;
      }
    }

    /* 4 coaxial alignment pins */
    const pinLock = beat(settled, 0.15, 0.52);
    for (let i = 0; i < 4; i++) {
      const pMesh = pinRefs.current[i];
      if (!pMesh) continue;
      const pop = anim ? introAt(el, 0.2 + i * 0.04, 0.65) : 1;
      pMesh.scale.set(1, Math.max(pop * (0.25 + 0.75 * pinLock), 0.001), 1);
    }

    /* flywheel collar atop Tier 3 */
    if (collarRef.current) {
      const collarIn = beat(settled, 0.36, 0.66);
      const pop = anim ? introAt(el, 0.35, 0.75) : 1;
      collarRef.current.position.y =
        TOP_SURFACE_Y + 0.08 + (1 - collarIn) * 0.45 + det * (1 - cta) * 0.24;
      collarRef.current.rotation.x = Math.PI / 2;
      collarRef.current.rotation.z = anim ? -el * (0.25 + 0.55 * collarIn) : 0.4;
      collarRef.current.scale.setScalar(Math.max(pop * (0.65 + 0.35 * collarIn), 0.001));
    }

    /* shock-ring at stack lock */
    const tau = settled > LOCK_HIT ? (settled - LOCK_HIT) * TAU_RATE : 0;
    shockMat.uniforms.uTau.value = anim && mo.leave < 0.8 ? tau : 0;

    /* compounding telemetry pipeline progressive draw */
    const pipeDraw = anim ? beat(settled, 0.46, 0.88) : 1;
    const tris = Math.floor((pipeDraw * pipeline.indexCount) / 6) * 6;
    pipeline.tube.setDrawRange(0, tris);

    /* 16 instanced telemetry packets streaming up the stack & arc */
    const pInst = packetsRef.current;
    if (pInst) {
      _q.identity();
      for (let i = 0; i < PACKET_COUNT; i++) {
        let sc = 0.0001;
        if (pipeDraw > 0.04) {
          const baseU = anim
            ? (((el * 0.36 + i / PACKET_COUNT) % 1) + 1) % 1
            : (i + 0.5) / PACKET_COUNT;
          const u = baseU * pipeDraw;
          sampleCurve(u, _p);
          const env = Math.sin((u / Math.max(pipeDraw, 0.01)) * Math.PI);
          sc = Math.max(intro * pipeDraw * (0.45 + 0.75 * env), 0.0001);
        } else {
          _p.set(0, -100, 0);
        }
        _s.setScalar(sc);
        _m.compose(_p, _q, _s);
        pInst.setMatrixAt(i, _m);
      }
      pInst.instanceMatrix.needsUpdate = true;
    }

    /* deep-sapphire breakout cube ascends along the compounding pipeline */
    const br = breakoutRef.current;
    if (br) {
      const climb = anim ? beat(settled, 0.5, 0.92) : 1;
      sampleCurve(0.32 + climb * 0.68, _p);
      br.position.copy(_p);
      if (anim) {
        br.rotation.x = 0.35 + el * 0.45 + climb * 1.4;
        br.rotation.y = 0.4 + el * 0.38 + climb * 1.8;
      } else {
        br.rotation.set(0.55, 0.78, 0.22);
      }
      const pop = anim ? introAt(el, 0.32, 0.75) : 1;
      br.scale.setScalar(Math.max(pop * (0.88 + 0.24 * climb), 0.001));
      report(br, state.camera, 0.52 + 0.42 * climb + 0.08 * truth);
    }
    if (breakoutMatRef.current) {
      breakoutMatRef.current.emissiveIntensity =
        0.35 + beat(settled, 0.65, 0.95) * 0.85;
    }

    /* pointer tilt + sculptural azimuth */
    if (rigRef.current) {
      tilt.current.x = damp(tilt.current.x, anim ? -pointer.y * 0.06 : 0, 3.5, dt);
      tilt.current.y = damp(
        tilt.current.y,
        -0.38 + (anim ? pointer.x * 0.12 : 0) + feat * 0.24 - det * 0.18,
        3.5,
        dt,
      );
      rigRef.current.rotation.x = 0.08 + tilt.current.x;
      rigRef.current.rotation.y = tilt.current.y;
    }

    /* camera choreography across hero → moment → market-truth → feature → detail → cta */
    const inMoment = anim ? mo.enter * (1 - mo.leave) : 0;
    const orb =
      (anim ? Math.sin(el * 0.048) * 0.06 : 0.12) -
      inMoment * 0.08 +
      feat * 0.16;
    const radius =
      (q.compact ? 11.8 : 9.2) -
      intro * 0.55 -
      inMoment * 0.85 -
      det * 0.4 +
      cta * 0.8;

    _cam.set(
      0.35 + Math.sin(orb) * radius + (anim ? pointer.x * 0.32 : 0),
      1.35 + inMoment * 0.35 + pipeDraw * 0.28 + cta * 0.3 + (anim ? pointer.y * 0.2 : 0),
      Math.cos(orb) * radius,
    );
    if (anim) state.camera.position.lerp(_cam, 0.055);
    else state.camera.position.copy(_cam);

    _look.set(0.32 * pipeDraw, 0.18 + pipeDraw * 0.32, 0);
    state.camera.lookAt(_look);

    /* lens shift: stage-right alongside copy, centred on the pinned moment */
    if (q.compact) lens(0, -0.08 + inMoment * 0.08);
    else lens(0.22 * (1 - inMoment), -0.03 * (1 - inMoment));
  });

  return (
    <group ref={groupRef}>
      <SceneLightRig />

      <group ref={rigRef}>
        {/* 4 modular glass architecture layers */}
        {TIERS.map((spec, i) => (
          <RoundedBox
            key={i}
            ref={(m) => {
              tierRefs.current[i] = m;
            }}
            args={[spec.w, 0.13, spec.d]}
            radius={0.032}
            smoothness={4}
            position={[spec.dx, spec.explodeY, spec.dz]}
          >
            <GlassMaterial
              ref={(mat) => {
                tierMats.current[i] = mat;
              }}
              kind={spec.kind}
              emissive={_emissive}
              emissiveIntensity={0}
            />
          </RoundedBox>
        ))}

        {/* 4 vertical coaxial alignment pins */}
        {PIN_CORNERS.map(([px, pz], i) => (
          <mesh
            key={i}
            ref={(m) => {
              pinRefs.current[i] = m;
            }}
            position={[px, BASE_Y + (TIER_PITCH * 3) / 2, pz]}
          >
            <cylinderGeometry args={[0.018, 0.018, TIER_PITCH * 3 + 0.24, 14]} />
            <GlassMaterial kind="azure" />
          </mesh>
        ))}

        {/* gradient-glass distribution flywheel collar */}
        <mesh ref={collarRef} position={[0, TOP_SURFACE_Y + 0.08, 0]}>
          <torusGeometry args={[0.62, 0.048, 24, 96]} />
          <GradientGlassMaterial />
        </mesh>

        {/* compounding telemetry pipeline tube */}
        <mesh geometry={pipeline.tube} frustumCulled={false}>
          <meshBasicMaterial
            color="#2e4bff"
            toneMapped={false}
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* 16 instanced telemetry light packets (1 draw call) */}
        <instancedMesh
          ref={packetsRef}
          args={[undefined, undefined, PACKET_COUNT]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.034, 10, 10]} />
          <meshBasicMaterial
            color={packetColor}
            toneMapped={false}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </instancedMesh>

        {/* deep-sapphire breakout prism module */}
        <RoundedBox
          ref={breakoutRef}
          args={[0.32, 0.32, 0.32]}
          radius={0.07}
          smoothness={4}
          position={[0, TOP_SURFACE_Y + 0.2, 0]}
        >
          <GlassMaterial
            ref={breakoutMatRef}
            kind="deep"
            emissive={_emissive}
            emissiveIntensity={0.4}
          />
        </RoundedBox>

        {/* stack-lock shockwave at plinth */}
        <ShockRing
          material={shockMat}
          radius={3.2}
          position={[0, BASE_Y - 0.08, 0]}
        />
      </group>

      <ParticleField
        count={Math.floor(1300 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.3}
      />
    </group>
  );
}
