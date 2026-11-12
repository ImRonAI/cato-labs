'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, GradientGlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { opsBus } from './operations-automation/ops-bus';
import {
  RAIL_Y,
  STATION_X,
  makePortalArchGeometry,
  makeRailNetworkLines,
  makeScannerReticleGeometry,
  sampleBranchPoint,
} from './operations-automation/geometries';

/**
 * OperationsAutomationScene — "The Glass Sorting & Dispatch Line".
 *
 * A museum-grade architectural glass miniature of an automated 5-station
 * sorting and routing rail machine:
 *   01 Infeed Hopper & Singulator Portal (trigger)
 *   02 Optical Extraction Gantry & Laser Curtain (extract)
 *   03 SOP Logic & Classification Chamber (classify)
 *   04 Rotary Track Diverter — 2 Automated Rails + 1 Human Escalation Spur (route)
 *   05 System Ledger Press, Slate Magazine & Dispatch Signal Mast (update + notify)
 */

const PARCEL_COUNT = 12;
const SLAT_COUNT = 28;
const LEDGER_SLATES = 8;

/* Module-scope temporaries — zero allocations inside useFrame */
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _lookNow = new THREE.Vector3(-1.95, 0.56, 0);
const _branchPt = new THREE.Vector3();
const _colorTmp = new THREE.Color();

/* Camera choreography stops:
 * HERO:    Machine framed cleanly in the lower-right quadrant, below the wide H1
 * MACHINE: Full-stage centred vitrine view above the 5-station callout strip
 * STUDIO:  Elevated companion view to the upper-right of the Studio header
 * FEATURE: High 45-degree isometric view showcasing the 3-way diverter & tracks
 * DETAIL:  Close-up angle on the right emphasizing the outbound rails & mast
 */
const CAM_HERO = new THREE.Vector3(-2.35, 3.05, 11.8);
const LOOK_HERO = new THREE.Vector3(-1.95, 0.56, 0.0);

const CAM_MACHINE = new THREE.Vector3(0.0, 2.55, 9.7);
const LOOK_MACHINE = new THREE.Vector3(0.0, -0.18, 0.0);

const CAM_STUDIO = new THREE.Vector3(-1.45, 3.25, 12.0);
const LOOK_STUDIO = new THREE.Vector3(-1.15, -0.42, 0.0);

const CAM_FEATURE = new THREE.Vector3(-1.85, 4.45, 11.4);
const LOOK_FEATURE = new THREE.Vector3(-1.35, -0.1, 0.0);

const CAM_DETAIL = new THREE.Vector3(-1.5, 3.1, 11.1);
const LOOK_DETAIL = new THREE.Vector3(-0.85, 0.05, 0.0);

function hash01(i: number, seed: number) {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export default function OperationsAutomationScene() {
  const q = useQuality();
  const compact = q.compact;

  const rootRef = useRef<THREE.Group>(null);
  const machineAnchorRef = useRef<THREE.Mesh>(null);
  const rawMeshRef = useRef<THREE.InstancedMesh>(null);
  const doneMeshRef = useRef<THREE.InstancedMesh>(null);
  const slatMeshRef = useRef<THREE.InstancedMesh>(null);
  const ledgerMeshRef = useRef<THREE.InstancedMesh>(null);

  const diverterArmRef = useRef<THREE.Group>(null);
  const diverterDiscRef = useRef<THREE.Mesh>(null);
  const stampHeadRef = useRef<THREE.Group>(null);
  const scanCurtainMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const escalationBeaconMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const activeTokenGroupRef = useRef<THREE.Group>(null);
  const stationRingMatsRef = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const mastRingRefs = useRef<(THREE.Mesh | null)[]>([]);
  const logicPillarRefs = useRef<(THREE.Mesh | null)[]>([]);
  const keyLightRef = useRef<THREE.PointLight>(null);

  const startTRef = useRef(-1);
  const diverterAngleRef = useRef(0.22);
  const report = useHotspotReporter('ops-current');

  /* Procedural geometries — slender open-frame gantries for high legibility */
  const geos = useMemo(() => {
    const plinth = new RoundedBoxGeometry(7.9, 0.16, 2.75, 4, 0.06);
    const subPlinth = new RoundedBoxGeometry(7.5, 0.12, 2.35, 3, 0.04);
    const trunkBed = new RoundedBoxGeometry(5.0, 0.075, 0.62, 3, 0.025);
    const branchBedStraight = new RoundedBoxGeometry(2.15, 0.065, 0.36, 2, 0.02);
    const branchBedSpur = new RoundedBoxGeometry(1.95, 0.065, 0.34, 2, 0.02);

    const portalInfeed = makePortalArchGeometry(0.86, 0.78, 0.2, 0.66, 0.62);
    const portalScan = makePortalArchGeometry(0.98, 0.98, 0.24, 0.74, 0.78);
    const portalClassify = makePortalArchGeometry(0.92, 0.86, 0.26, 0.68, 0.66);
    const portalCommit = makePortalArchGeometry(1.42, 0.86, 0.24, 1.16, 0.66);

    const parcelRaw = new RoundedBoxGeometry(0.32, 0.2, 0.26, 3, 0.045);
    const parcelDone = new RoundedBoxGeometry(0.34, 0.19, 0.24, 3, 0.05);
    const slat = new THREE.BoxGeometry(0.03, 0.008, 0.46);
    const ledgerSlate = new RoundedBoxGeometry(0.42, 0.032, 0.28, 2, 0.01);

    const stationRing = new THREE.TorusGeometry(0.21, 0.016, 12, 36);
    const mastRing = new THREE.TorusGeometry(0.2, 0.012, 10, 32);
    const diverterBase = new THREE.CylinderGeometry(0.54, 0.58, 0.085, 36);
    const diverterBlade = new RoundedBoxGeometry(0.76, 0.13, 0.055, 2, 0.02);

    const railLines = makeRailNetworkLines();
    const scanReticle = makeScannerReticleGeometry();

    return {
      plinth,
      subPlinth,
      trunkBed,
      branchBedStraight,
      branchBedSpur,
      portalInfeed,
      portalScan,
      portalClassify,
      portalCommit,
      parcelRaw,
      parcelDone,
      slat,
      ledgerSlate,
      stationRing,
      mastRing,
      diverterBase,
      diverterBlade,
      railLines,
      scanReticle,
    };
  }, []);

  useEffect(
    () => () => {
      Object.values(geos).forEach((g) => g.dispose());
    },
    [geos],
  );

  useEffect(() => {
    rawMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    doneMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    slatMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ledgerMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (startTRef.current < 0) startTRef.current = t;
    const anim = q.animate;
    const intro = anim ? smooth(Math.min((t - startTRef.current) / 1.5, 1)) : 1;

    const hp = anim ? getSectionProgress('hero') : 0;
    const mp = anim ? getSectionProgress('machine') : 0.0;
    const sp = anim ? getSectionProgress('studio') : 0.0;
    const fp = anim ? getSectionProgress('feature') : 0.0;
    const dp = anim ? getSectionProgress('detail') : 0.0;

    /* Continuous rail motion: combines smooth ambient clock + scroll scrub */
    const flowPhase = anim
      ? t * 0.42 + mp * 2.2 + sp * 1.4 + (fp + dp) * 0.9
      : 1.35;

    /* 1. Slat conveyor along the main trunk (-3.5 to +1.35) */
    const trunkLen = 4.85;
    const sm = slatMeshRef.current;
    if (sm) {
      for (let i = 0; i < SLAT_COUNT; i++) {
        const u = ((i / SLAT_COUNT) + flowPhase * 0.18) % 1;
        const x = -3.5 + u * trunkLen;
        const edge = smooth(Math.min(u * 8, (1 - u) * 8, 1));
        _p.set(x, RAIL_Y + 0.048, 0);
        _s.set(1, 1, Math.max(0.001, edge * intro));
        _m.compose(_p, _q.identity(), _s);
        sm.setMatrixAt(i, _m);
      }
      sm.instanceMatrix.needsUpdate = true;
    }

    /* 2. Diverter arm angle — switches to Escalation Spur (-0.44 rad) when escalated */
    const targetDiverterAngle = opsBus.escalated
      ? -0.44
      : Math.sin(flowPhase * 1.5) > 0
        ? 0.24
        : 0.0;
    diverterAngleRef.current = THREE.MathUtils.lerp(
      diverterAngleRef.current,
      targetDiverterAngle,
      anim ? Math.min(1, delta * 7) : 1,
    );
    if (diverterArmRef.current) {
      diverterArmRef.current.rotation.y = diverterAngleRef.current;
    }
    if (diverterDiscRef.current) {
      diverterDiscRef.current.rotation.y = diverterAngleRef.current * 0.6;
    }

    /* 3. Work parcels: raw askew before Station 02, squared crystal capsules after */
    const rm = rawMeshRef.current;
    const dm = doneMeshRef.current;
    let scanPassGlow = 0;
    let commitPassGlow = 0;

    if (rm && dm) {
      for (let i = 0; i < PARCEL_COUNT; i++) {
        const u = ((i / PARCEL_COUNT) + flowPhase * 0.11) % 1;
        const totalX = -3.45 + u * 6.9; // -3.45 .. +3.45
        const fadeEnds = smooth(Math.min(u * 9, (1 - u) * 9, 1)) * intro;

        // Station 02 (x = -1.55) transforms raw askew parcel into aligned capsule
        const transformT = smooth(sectionRange(totalX, -1.75, -1.25));
        const rawScale = (1 - transformT) * fadeEnds;
        const doneScale = transformT * fadeEnds;

        // Raw parcel (infeed hopper -> scanner)
        const jitterZ = (hash01(i, 1) - 0.5) * 0.18 * (1 - transformT);
        const hopDrop = Math.max(0, (-2.95 - totalX) * 0.35);
        _e.set(
          (hash01(i, 2) - 0.5) * 0.35 * (1 - transformT),
          (hash01(i, 3) - 0.5) * 0.65 * (1 - transformT),
          (hash01(i, 4) - 0.5) * 0.28 * (1 - transformT),
        );
        _q.setFromEuler(_e);
        _p.set(totalX, RAIL_Y + 0.15 + hopDrop, jitterZ);
        _s.setScalar(Math.max(0.0001, rawScale));
        _m.compose(_p, _q, _s);
        rm.setMatrixAt(i, _m);

        // Processed capsule (scanner -> diverter -> 3 branches)
        let posX = totalX;
        let posY = RAIL_Y + 0.14;
        let posZ = 0;
        let yaw = 0;

        if (totalX > 1.35) {
          const branchU = (totalX - 1.35) / 2.1;
          const branchIdx: 0 | 1 | 2 =
            opsBus.escalated && i % 3 === 0
              ? 2
              : i % 2 === 0
                ? 0
                : 1;
          sampleBranchPoint(branchU, branchIdx, _branchPt);
          posX = _branchPt.x;
          posY = _branchPt.y + 0.08;
          posZ = _branchPt.z;
          if (branchIdx === 0) yaw = -0.26 * Math.sin(branchU * Math.PI);
          else if (branchIdx === 2) yaw = 0.36 * Math.sin(branchU * Math.PI);
        }

        _e.set(0, yaw, 0);
        _q.setFromEuler(_e);
        _p.set(posX, posY, posZ);
        _s.setScalar(Math.max(0.0001, doneScale));
        _m.compose(_p, _q, _s);
        dm.setMatrixAt(i, _m);

        // Proximity glow triggers for Station 02 (Scan) and Station 05 (Commit)
        const dScan = Math.abs(totalX - STATION_X[1]);
        if (dScan < 0.45) scanPassGlow = Math.max(scanPassGlow, 1 - dScan / 0.45);
        const dCommit = Math.abs(totalX - STATION_X[4]);
        if (dCommit < 0.45) commitPassGlow = Math.max(commitPassGlow, 1 - dCommit / 0.45);
      }
      rm.instanceMatrix.needsUpdate = true;
      dm.instanceMatrix.needsUpdate = true;
    }

    /* 4. Live Studio Token Capsule — tracks opsBus.runProgress during active Studio runs */
    if (activeTokenGroupRef.current) {
      const p = opsBus.runProgress;
      const tokenX = -3.25 + p * 6.55;
      let tx = tokenX;
      let ty = RAIL_Y + 0.21;
      let tz = 0;
      if (tokenX > 1.35) {
        const bu = (tokenX - 1.35) / 2.1;
        sampleBranchPoint(bu, opsBus.escalated ? 2 : 0, _branchPt);
        tx = _branchPt.x;
        ty = _branchPt.y + 0.13;
        tz = _branchPt.z;
      }
      activeTokenGroupRef.current.position.set(tx, ty, tz);
      const pulseScale = opsBus.isRunning
        ? 1.15 + Math.sin(t * 10) * 0.08
        : 0.92;
      activeTokenGroupRef.current.scale.setScalar(pulseScale * intro);
    }

    /* 5. Ledger Slate Magazine (8 stacked glass slates next to Station 05) */
    const lm = ledgerMeshRef.current;
    if (lm) {
      const litCount = Math.min(LEDGER_SLATES, Math.max(2, opsBus.completedRuns));
      for (let i = 0; i < LEDGER_SLATES; i++) {
        const activeSlate = i < litCount;
        const lift =
          activeSlate && i === litCount - 1 && commitPassGlow > 0.3
            ? commitPassGlow * 0.04
            : 0;
        _p.set(2.75, RAIL_Y + 0.08 + i * 0.052 + lift, -0.68);
        _q.identity();
        _s.set(activeSlate ? 1.0 : 0.82, 1, activeSlate ? 1.0 : 0.82);
        _s.multiplyScalar(intro);
        _m.compose(_p, _q, _s);
        lm.setMatrixAt(i, _m);
      }
      lm.instanceMatrix.needsUpdate = true;
    }

    /* 6. Station 05 Ledger Stamp Head & Dispatch Signal Mast Rings */
    if (stampHeadRef.current) {
      const press = opsBus.stationEnabled[4] ? commitPassGlow * 0.11 : 0;
      stampHeadRef.current.position.y = 0.56 - press;
    }

    for (let i = 0; i < 3; i++) {
      const ring = mastRingRefs.current[i];
      if (!ring) continue;
      const wave = anim ? (t * 0.9 + i * 0.33) % 1 : i * 0.33;
      const s = 0.75 + wave * 0.55;
      ring.scale.setScalar(s * intro);
      ring.position.y =
        0.74 + i * 0.17 + (anim ? Math.sin(t * 2 + i) * 0.015 : 0);
    }

    /* 7. Station 03 Logic Pillars & Station Beacon Rings */
    for (let i = 0; i < 3; i++) {
      const pil = logicPillarRefs.current[i];
      if (!pil) continue;
      const pulse = anim ? 0.85 + 0.25 * Math.sin(t * 3.2 + i * 1.3) : 1;
      pil.scale.y = pulse;
    }

    for (let i = 0; i < 5; i++) {
      const mat = stationRingMatsRef.current[i];
      if (!mat) continue;
      const enabled = opsBus.stationEnabled[i];
      const isFocused = opsBus.activeStation === i;
      if (!enabled) {
        mat.emissiveIntensity = 0.08;
        mat.opacity = 0.25 * intro;
      } else if (isFocused) {
        mat.emissiveIntensity = 1.65 + (anim ? Math.sin(t * 6) * 0.35 : 0);
        mat.opacity = 0.98 * intro;
      } else {
        mat.emissiveIntensity = 0.65 + (i === 1 ? scanPassGlow * 0.7 : 0);
        mat.opacity = 0.78 * intro;
      }
    }

    if (scanCurtainMatRef.current) {
      const scanEnabled = opsBus.stationEnabled[1];
      const scanActive = opsBus.activeStation === 1 || scanPassGlow > 0.1;
      scanCurtainMatRef.current.opacity = scanEnabled
        ? (0.2 + scanPassGlow * 0.36 + (scanActive ? 0.15 : 0)) * intro
        : 0.03;
    }

    if (escalationBeaconMatRef.current) {
      escalationBeaconMatRef.current.emissiveIntensity = opsBus.escalated
        ? 1.9 + (anim ? Math.sin(t * 7) * 0.4 : 0)
        : 0.25;
      _colorTmp.set(opsBus.escalated ? '#2e4bff' : '#93a9ff');
      escalationBeaconMatRef.current.emissive.copy(_colorTmp);
    }

    if (machineAnchorRef.current) {
      report(machineAnchorRef.current, state.camera, 0.75);
    }

    /* 8. Camera & Root Choreography across hero -> machine -> studio -> feature -> detail */
    const kMachine = anim ? easeInOut(sectionRange(mp, 0.04, 0.38)) : 0;
    const kStudio = anim ? easeInOut(sectionRange(sp, 0.04, 0.36)) : 0;
    const kFeature = anim ? easeInOut(sectionRange(fp, 0.05, 0.45)) : 0;
    const kDetail = anim ? easeInOut(sectionRange(dp, 0.05, 0.45)) : 0;

    if (rootRef.current) {
      const machineFocus = kMachine * (1 - kStudio * 0.8);
      const baseYaw = THREE.MathUtils.lerp(-0.34, -0.1, machineFocus);
      const basePitch = THREE.MathUtils.lerp(0.11, 0.16, machineFocus);
      rootRef.current.rotation.y = baseYaw + (anim ? pointer.x * 0.05 : 0);
      rootRef.current.rotation.x = basePitch + (anim ? -pointer.y * 0.03 : 0);
      rootRef.current.position.y = -0.45 * (1 - intro);
      rootRef.current.scale.setScalar(compact ? 0.54 : 0.88);
    }

    _cam
      .copy(CAM_HERO)
      .lerp(CAM_MACHINE, kMachine)
      .lerp(CAM_STUDIO, kStudio)
      .lerp(CAM_FEATURE, kFeature)
      .lerp(CAM_DETAIL, kDetail);

    _look
      .copy(LOOK_HERO)
      .lerp(LOOK_MACHINE, kMachine)
      .lerp(LOOK_STUDIO, kStudio)
      .lerp(LOOK_FEATURE, kFeature)
      .lerp(LOOK_DETAIL, kDetail);

    if (compact) {
      _cam.x = 0;
      _look.x = 0;
      _cam.y = 3.25;
      _cam.z = 13.6;
      _look.y = 1.22;
    }

    if (anim) {
      _cam.x += pointer.x * 0.3;
      _cam.y += pointer.y * 0.2;
    }

    state.camera.position.lerp(_cam, anim ? 0.06 : 1);
    _lookNow.lerp(_look, anim ? 0.06 : 1);
    state.camera.lookAt(_lookNow);

    if (keyLightRef.current) {
      keyLightRef.current.position.set(
        0.5 + pointer.x * 2.8,
        2.8 + pointer.y * 1.2,
        3.4,
      );
    }
  });

  return (
    <group>
      <SceneLightRig />
      <pointLight
        ref={keyLightRef}
        color="#dce6ff"
        intensity={16}
        distance={14}
        decay={2}
        position={[0.5, 2.8, 3.4]}
      />

      <group ref={rootRef}>
        {/* ==================== ARCHITECTURAL VITRINE PLINTH ==================== */}
        <mesh position={[0, RAIL_Y - 0.19, -0.06]}>
          <primitive object={geos.plinth} attach="geometry" />
          <GlassMaterial kind="ice" roughness={0.22} />
        </mesh>
        <mesh position={[0, RAIL_Y - 0.32, -0.06]}>
          <primitive object={geos.subPlinth} attach="geometry" />
          <meshStandardMaterial color="#eef2ff" roughness={0.35} metalness={0.15} />
        </mesh>

        {/* Main conveyor glass bed */}
        <mesh ref={machineAnchorRef} position={[-1.05, RAIL_Y, 0]}>
          <primitive object={geos.trunkBed} attach="geometry" />
          <GlassMaterial kind="pane" roughness={0.18} />
        </mesh>

        {/* 3 Diverging Physical Branch Track Beds after Station 04 */}
        {/* Branch A: Front Auto Rail */}
        <mesh
          geometry={geos.branchBedStraight}
          position={[2.42, RAIL_Y, 0.32]}
          rotation={[0, -0.27, 0]}
        >
          <GlassMaterial kind="pane" roughness={0.18} />
        </mesh>
        {/* Branch B: Center Auto Rail */}
        <mesh
          geometry={geos.branchBedStraight}
          position={[2.42, RAIL_Y, 0]}
        >
          <GlassMaterial kind="pane" roughness={0.18} />
        </mesh>
        {/* Branch C: Rising Human Escalation Spur */}
        <mesh
          geometry={geos.branchBedSpur}
          position={[2.3, RAIL_Y + 0.17, -0.44]}
          rotation={[0, 0.4, 0.17]}
        >
          <GlassMaterial kind="azure" roughness={0.16} />
        </mesh>

        {/* Precision rail & track network lines */}
        <lineSegments geometry={geos.railLines}>
          <lineBasicMaterial color="#3d5eff" transparent opacity={0.55} />
        </lineSegments>

        {/* Moving conveyor slats */}
        <instancedMesh
          ref={slatMeshRef}
          args={[geos.slat, undefined, SLAT_COUNT]}
          frustumCulled={false}
        >
          <meshBasicMaterial color="#7d97ff" transparent opacity={0.65} />
        </instancedMesh>

        {/* ==================== STATION 01: INFEED HOPPER & SINGULATOR ==================== */}
        <group position={[STATION_X[0], RAIL_Y, 0]}>
          {/* Angled infeed chute */}
          <mesh position={[-0.42, 0.2, 0]} rotation={[0, 0, -0.32]}>
            <boxGeometry args={[0.62, 0.045, 0.52]} />
            <GlassMaterial kind="crystal" />
          </mesh>
          {/* Sleek open-frame singulator arch */}
          <mesh geometry={geos.portalInfeed} position={[0, 0.02, 0]}>
            <GlassMaterial kind="pane" />
          </mesh>
          {/* Station 01 overhead beacon ring */}
          <mesh
            geometry={geos.stationRing}
            position={[0, 0.94, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              ref={(m) => {
                stationRingMatsRef.current[0] = m;
              }}
              color="#6b87ff"
              emissive="#2e4bff"
              emissiveIntensity={0.8}
              transparent
              opacity={0.85}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* ==================== STATION 02: OPTICAL EXTRACTION GANTRY ==================== */}
        <group position={[STATION_X[1], RAIL_Y, 0]}>
          <mesh geometry={geos.portalScan} position={[0, 0.02, 0]}>
            <GlassMaterial kind="crystal" />
          </mesh>
          {/* Overhead optical prism lens */}
          <mesh position={[0, 1.05, 0]}>
            <cylinderGeometry args={[0.2, 0.26, 0.12, 24]} />
            <GlassMaterial kind="prism" />
          </mesh>
          {/* Electric-blue laser scan curtain */}
          <mesh position={[0, 0.38, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.64, 0.68]} />
            <meshBasicMaterial
              ref={scanCurtainMatRef}
              color="#2e4bff"
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          {/* Optical scan reticle & laser fan lines */}
          <lineSegments geometry={geos.scanReticle}>
            <lineBasicMaterial
              color="#2e4bff"
              transparent
              opacity={0.9}
              toneMapped={false}
            />
          </lineSegments>
          {/* Station 02 overhead beacon ring */}
          <mesh
            geometry={geos.stationRing}
            position={[0, 1.2, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              ref={(m) => {
                stationRingMatsRef.current[1] = m;
              }}
              color="#6b87ff"
              emissive="#2e4bff"
              emissiveIntensity={0.9}
              transparent
              opacity={0.85}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* ==================== STATION 03: CLASSIFICATION & SOP LOGIC CHAMBER ==================== */}
        <group position={[STATION_X[2], RAIL_Y, 0]}>
          <mesh geometry={geos.portalClassify} position={[0, 0.02, 0]}>
            <GlassMaterial kind="azure" />
          </mesh>
          {/* 3 vertical SOP rule-evaluation light columns */}
          {([-0.16, 0, 0.16] as const).map((dx, idx) => (
            <mesh
              key={idx}
              ref={(m) => {
                logicPillarRefs.current[idx] = m;
              }}
              position={[dx, 0.98, 0]}
            >
              <cylinderGeometry args={[0.03, 0.03, 0.2, 16]} />
              <GlassMaterial kind="core" />
            </mesh>
          ))}
          {/* Station 03 overhead beacon ring */}
          <mesh
            geometry={geos.stationRing}
            position={[0, 1.18, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              ref={(m) => {
                stationRingMatsRef.current[2] = m;
              }}
              color="#6b87ff"
              emissive="#2e4bff"
              emissiveIntensity={0.85}
              transparent
              opacity={0.85}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* ==================== STATION 04: ROTARY TRACK DIVERTER ==================== */}
        <group position={[STATION_X[3], RAIL_Y, 0]}>
          {/* Turntable recessed disc */}
          <mesh
            ref={diverterDiscRef}
            geometry={geos.diverterBase}
            position={[0, 0.02, 0]}
          >
            <GlassMaterial kind="crystal" />
          </mesh>
          {/* Central pivot hub */}
          <mesh position={[0, 0.11, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.15, 24]} />
            <GlassMaterial kind="deep" />
          </mesh>
          {/* Pivoting diverter arm that switches between Auto Rails and Escalation Spur */}
          <group ref={diverterArmRef} position={[0, 0.13, 0]}>
            <mesh geometry={geos.diverterBlade} position={[0.22, 0, 0]}>
              <GradientGlassMaterial />
            </mesh>
          </group>
          {/* Station 04 overhead beacon ring */}
          <mesh
            geometry={geos.stationRing}
            position={[0, 0.96, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              ref={(m) => {
                stationRingMatsRef.current[3] = m;
              }}
              color="#6b87ff"
              emissive="#2e4bff"
              emissiveIntensity={0.85}
              transparent
              opacity={0.85}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* ==================== HUMAN ESCALATION SPUR & REVIEW DESK POD ==================== */}
        <group position={[3.22, RAIL_Y + 0.34, -0.84]}>
          {/* Review console podium */}
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.58, 0.18, 0.48]} />
            <GlassMaterial kind="pane" />
          </mesh>
          {/* Curved/angled glass operator screen */}
          <mesh position={[0.08, 0.32, 0]} rotation={[0, -0.35, 0.28]}>
            <boxGeometry args={[0.04, 0.34, 0.42]} />
            <GlassMaterial kind="core" />
          </mesh>
          {/* Escalation beacon dome */}
          <mesh position={[-0.14, 0.24, -0.14]}>
            <sphereGeometry args={[0.055, 16, 16]} />
            <meshStandardMaterial
              ref={escalationBeaconMatRef}
              color="#93a9ff"
              emissive="#2e4bff"
              emissiveIntensity={0.35}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* ==================== STATION 05: LEDGER PRESS, MAGAZINE & DISPATCH MAST ==================== */}
        <group position={[STATION_X[4], RAIL_Y, 0.28]}>
          {/* Wide open commit arch spanning Lanes A & B */}
          <mesh geometry={geos.portalCommit} position={[0, 0.02, 0]}>
            <GlassMaterial kind="pane" />
          </mesh>
          {/* Synchronized actuator stamp head */}
          <group ref={stampHeadRef} position={[0, 0.56, 0]}>
            <mesh>
              <boxGeometry args={[0.24, 0.16, 0.76]} />
              <GlassMaterial kind="core" />
            </mesh>
          </group>
          {/* Station 05 overhead beacon ring */}
          <mesh
            geometry={geos.stationRing}
            position={[0, 1.02, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              ref={(m) => {
                stationRingMatsRef.current[4] = m;
              }}
              color="#6b87ff"
              emissive="#2e4bff"
              emissiveIntensity={0.85}
              transparent
              opacity={0.85}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* Stacked glass ledger slates (commits accumulate visibly) */}
        <instancedMesh
          ref={ledgerMeshRef}
          args={[geos.ledgerSlate, undefined, LEDGER_SLATES]}
          frustumCulled={false}
        >
          <GlassMaterial kind="azure" />
        </instancedMesh>

        {/* Outbound Dispatch Signal Mast (Notify) */}
        <group position={[3.42, RAIL_Y, 0.28]}>
          <mesh position={[0, 0.54, 0]}>
            <cylinderGeometry args={[0.032, 0.048, 1.08, 20]} />
            <GlassMaterial kind="crystal" />
          </mesh>
          <mesh position={[0, 1.12, 0]}>
            <sphereGeometry args={[0.072, 20, 20]} />
            <GlassMaterial kind="core" />
          </mesh>
          {[0, 1, 2].map((idx) => (
            <mesh
              key={idx}
              ref={(m) => {
                mastRingRefs.current[idx] = m;
              }}
              geometry={geos.mastRing}
              position={[0, 0.74 + idx * 0.17, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <meshBasicMaterial
                color="#2e4bff"
                transparent
                opacity={0.55 - idx * 0.12}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>

        {/* ==================== MOVING WORK ITEMS & STUDIO TOKEN ==================== */}
        <instancedMesh
          ref={rawMeshRef}
          args={[geos.parcelRaw, undefined, PARCEL_COUNT]}
          frustumCulled={false}
        >
          <GlassMaterial kind="ice" roughness={0.2} />
        </instancedMesh>

        <instancedMesh
          ref={doneMeshRef}
          args={[geos.parcelDone, undefined, PARCEL_COUNT]}
          frustumCulled={false}
        >
          <GlassMaterial kind="core" />
        </instancedMesh>

        {/* Active Studio Token Capsule tracking live studio runs */}
        <group ref={activeTokenGroupRef} position={[1.35, RAIL_Y + 0.21, 0]}>
          <mesh geometry={geos.parcelDone}>
            <GradientGlassMaterial />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
            <ringGeometry args={[0.2, 0.25, 28]} />
            <meshBasicMaterial
              color="#2e4bff"
              side={THREE.DoubleSide}
              transparent
              opacity={0.85}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>

      <ParticleField
        count={Math.floor(750 * q.particles)}
        drift={q.animate ? 0.07 : 0}
        opacity={0.24}
      />
    </group>
  );
}
