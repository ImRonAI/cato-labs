'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, GradientGlassMaterial, type GlassKind } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { CURVE_SAMPLES, strategyBus } from './strategy-transformation/bus';
import MonteCarloCloud from './strategy-transformation/MonteCarloCloud';

/**
 * StrategyTransformationScene — "The Strategic Decision Table & Probability Field".
 *
 * A crafted glass-and-cobalt architectural miniature of a quantitative
 * strategy instrument:
 *   1. Bevelled sapphire-rimmed & frosted-glass Horizon Table with calibrated
 *      Q1–Q8 coordinate rails and breakeven datum lines.
 *   2. Gimballed Decision Compass at Origin T0 (octahedral deep-blue crystal
 *      inside concentric azimuth rings) that locks onto the chosen path.
 *   3. Three branching glass trajectory bridges (Path A, Path B, Path C) with
 *      a live 3D P10 / P50 / P90 fan envelope and confidence struts that morph
 *      in real time with THE DECISION ENGINE's Monte Carlo percentiles.
 *   4. Four sculpted 3D Gaussian probability density slices (bell-curve glass
 *      ridges) standing along the horizon that shift and scale with outcome
 *      median and variance spread.
 *   5. Three Milestone Gate portals (Gate 01..03) + glowing trajectory nodes
 *      that sequence the master plan.
 *   6. Shader-driven MonteCarloCloud of simulated futures streaming from T0
 *      into the outcome landscape.
 *
 * Zero allocations in useFrame; < 35 draw calls; static finished composition
 * under prefers-reduced-motion.
 */

const TABLE_W = 4.95;
const TABLE_D = 3.15;
const DECK_Y = 0.08;

const PATH_LANES_Z = [-1.02, 0.0, 1.02] as const;
const SLICE_X = [-0.55, 0.3, 1.15, 2.0] as const;
const GATE_X = [-1.1, 0.05, 1.2] as const;

/* Module-scope temporaries — never allocate inside useFrame */
const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();

/** Build a smooth 3D Gaussian bell-curve extruded glass geometry */
function buildBellSliceGeometry(peakHeight: number, halfWidth: number, depth: number) {
  const shape = new THREE.Shape();
  const steps = 36;
  const sigma = halfWidth * 0.42;
  shape.moveTo(-halfWidth, 0);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const z = (u * 2 - 1) * halfWidth;
    const gaussian = Math.exp(-(z * z) / (2 * sigma * sigma));
    const y = 0.032 + peakHeight * gaussian;
    shape.lineTo(z, y);
  }
  shape.lineTo(halfWidth, 0);
  shape.closePath();

  const extrude = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
  });
  extrude.rotateY(Math.PI / 2);
  extrude.translate(-depth * 0.5, 0, 0);
  return extrude;
}

/** Build a 3-post architectural Milestone Gate portal geometry */
function buildGateGeometry(width: number, height: number, barThickness: number) {
  const shape = new THREE.Shape();
  const hw = width * 0.5;
  const t = barThickness;
  shape.moveTo(-hw, 0);
  shape.lineTo(-hw, height);
  shape.lineTo(hw, height);
  shape.lineTo(hw, 0);
  shape.lineTo(hw - t, 0);
  shape.lineTo(hw - t, height - t);
  shape.lineTo(-hw + t, height - t);
  shape.lineTo(-hw + t, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: t * 1.15,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.006,
    bevelThickness: 0.006,
  });
  geo.rotateY(Math.PI / 2);
  geo.translate(-t * 0.58, 0, 0);
  return geo;
}

export default function StrategyTransformationScene() {
  const q = useQuality();
  const rootRef = useRef<THREE.Group>(null);
  const compassRingOuterRef = useRef<THREE.Mesh>(null);
  const compassRingInnerRef = useRef<THREE.Mesh>(null);
  const coreCrystalRef = useRef<THREE.Mesh>(null);
  const pointerArmRef = useRef<THREE.Group>(null);

  const sliceRefs = useRef<(THREE.Group | null)[]>([]);
  const gateRefs = useRef<(THREE.Group | null)[]>([]);
  const gateBeamRefs = useRef<(THREE.Mesh | null)[]>([]);
  const nodeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pathTubeRefs = useRef<(THREE.Mesh | null)[]>([]);

  const reportHotspot = useHotspotReporter('strategy-core');

  const smoothState = useRef({
    selectedPath: 0,
    p10: 0.22,
    p50: 0.68,
    p90: 1.24,
    spread: 0.58,
    curveP10: new Float32Array(CURVE_SAMPLES),
    curveP50: new Float32Array(CURVE_SAMPLES),
    curveP90: new Float32Array(CURVE_SAMPLES),
  });

  const assets = useMemo(() => {
    /* 1. Calibrated horizon table grid & tick hairlines */
    const gridPts: number[] = [];
    const yG = DECK_Y + 0.008;
    const xMin = -2.28;
    const xMax = 2.28;
    const zMin = -1.38;
    const zMax = 1.38;

    /* Outer perimeter frame */
    gridPts.push(xMin, yG, zMin, xMax, yG, zMin);
    gridPts.push(xMax, yG, zMin, xMax, yG, zMax);
    gridPts.push(xMax, yG, zMax, xMin, yG, zMax);
    gridPts.push(xMin, yG, zMax, xMin, yG, zMin);

    /* 8 horizon time intervals (Q1..Q8) + fine subdivisions */
    for (let i = 0; i <= 8; i++) {
      const x = xMin + ((xMax - xMin) * i) / 8;
      gridPts.push(x, yG, zMin, x, yG, zMax);
      gridPts.push(x, yG, zMax, x, yG + 0.045, zMax + 0.06);
      gridPts.push(x, yG, zMin, x, yG + 0.045, zMin - 0.06);
      if (i < 8) {
        const xm = x + (xMax - xMin) / 16;
        gridPts.push(xm, yG, zMax - 0.14, xm, yG, zMax);
        gridPts.push(xm, yG, zMin, xm, yG, zMin + 0.14);
      }
    }

    /* 5 longitudinal lane hairlines */
    const zLines = [-1.38, -1.02, 0.0, 1.02, 1.38];
    for (const z of zLines) {
      gridPts.push(xMin, yG, z, xMax, yG, z);
    }

    /* Compass azimuth radial hairlines around Origin (-2.05, yG, 0) */
    const cx = -2.05;
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      const r0 = 0.32;
      const r1 = a % 3 === 0 ? 0.46 : 0.39;
      gridPts.push(
        cx + Math.cos(ang) * r0,
        yG + 0.01,
        Math.sin(ang) * r0,
        cx + Math.cos(ang) * r1,
        yG + 0.01,
        Math.sin(ang) * r1,
      );
    }

    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gridPts), 3));

    /* 2. Three sculpted glass trajectory tubes (Path A, Path B, Path C) */
    const pathTubes = PATH_LANES_Z.map((laneZ, idx) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        const x = -2.05 + u * 4.18;
        const branch = Math.pow(u, 0.78);
        const z = laneZ * branch;
        const endH = idx === 0 ? 0.92 : idx === 1 ? 1.15 : 0.56;
        const dip = -0.1 * Math.sin(u * Math.PI) * (1 - u * 0.65);
        const y = DECK_Y + 0.24 + dip + endH * Math.pow(u, 1.25);
        pts.push(new THREE.Vector3(x, y, z));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      return new THREE.TubeGeometry(curve, 36, 0.032, 10, false);
    });

    /* 3. Dynamic P10 / P50 / P90 fan envelope line buffer + vertical confidence struts */
    const fanSegments = 3 * (CURVE_SAMPLES - 1) + CURVE_SAMPLES;
    const fanPositions = new Float32Array(fanSegments * 2 * 3);
    const fanGeo = new THREE.BufferGeometry();
    fanGeo.setAttribute('position', new THREE.BufferAttribute(fanPositions, 3));

    /* 4. Translucent P10..P90 Fan Ribbon Mesh */
    const ribbonVerts = new Float32Array(CURVE_SAMPLES * 2 * 3);
    const ribbonIndices: number[] = [];
    for (let i = 0; i < CURVE_SAMPLES - 1; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      ribbonIndices.push(a, b, c, b, d, c);
    }
    const ribbonGeo = new THREE.BufferGeometry();
    ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonVerts, 3));
    ribbonGeo.setIndex(ribbonIndices);

    /* 5. Four 3D Gaussian Bell-Curve Glass Slices + Edge Outlines */
    const bellGeo = buildBellSliceGeometry(0.74, 0.62, 0.056);
    const bellEdges = new THREE.EdgesGeometry(bellGeo, 15);

    /* 6. Three Milestone Gate Portals + Edge Outlines */
    const gateGeo = buildGateGeometry(0.74, 0.88, 0.058);
    const gateEdges = new THREE.EdgesGeometry(gateGeo, 18);

    return {
      gridGeo,
      pathTubes,
      fanGeo,
      fanPositions,
      ribbonGeo,
      ribbonVerts,
      bellGeo,
      bellEdges,
      gateGeo,
      gateEdges,
    };
  }, []);

  useEffect(() => {
    return () => {
      assets.gridGeo.dispose();
      assets.pathTubes.forEach((t) => t.dispose());
      assets.fanGeo.dispose();
      assets.ribbonGeo.dispose();
      assets.bellGeo.dispose();
      assets.bellEdges.dispose();
      assets.gateGeo.dispose();
      assets.gateEdges.dispose();
    };
  }, [assets]);

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;

    const feature = anim ? getSectionProgress('feature') : 1;
    const engine = anim ? getSectionProgress('engine') : 0.5;
    const detail = anim ? getSectionProgress('detail') : 0;
    const intro = anim ? smooth(Math.min(el / 1.4, 1)) : 1;

    const S = smoothState.current;
    const kLerp = anim ? 0.09 : 1.0;
    S.selectedPath += (strategyBus.selectedPathIndex - S.selectedPath) * (anim ? 0.12 : 1.0);
    S.p10 += (strategyBus.p10Norm - S.p10) * kLerp;
    S.p50 += (strategyBus.p50Norm - S.p50) * kLerp;
    S.p90 += (strategyBus.p90Norm - S.p90) * kLerp;
    S.spread += (strategyBus.spreadNorm - S.spread) * kLerp;

    for (let i = 0; i < CURVE_SAMPLES; i++) {
      S.curveP10[i] += (strategyBus.curveP10[i] - S.curveP10[i]) * kLerp;
      S.curveP50[i] += (strategyBus.curveP50[i] - S.curveP50[i]) * kLerp;
      S.curveP90[i] += (strategyBus.curveP90[i] - S.curveP90[i]) * kLerp;
    }

    const activeLaneZ = (S.selectedPath - 1) * 1.02;

    /* 1. Root miniature placement — compact and framed cleanly inside the right half of desktop viewport */
    const root = rootRef.current;
    if (root) {
      const fPush = smooth(sectionRange(feature, 0.05, 0.85));
      const ePush = smooth(sectionRange(engine, 0.05, 0.75));
      const dPush = smooth(sectionRange(detail, 0.05, 0.8));

      const baseScale = q.compact ? 0.5 : 0.68;
      root.scale.setScalar(baseScale * (0.92 + 0.08 * intro));

      const targetX = q.compact
        ? 0.08
        : 1.76 - fPush * 0.16 + ePush * 0.18 - dPush * 0.22;
      const targetY =
        (q.compact ? -0.68 : -0.32) -
        (1 - intro) * 0.65 +
        fPush * 0.1 -
        ePush * 0.08;
      const targetRotY =
        -0.46 +
        fPush * 0.16 -
        ePush * 0.12 +
        dPush * 0.14 +
        (anim ? Math.sin(el * 0.14) * 0.04 : 0);
      const targetRotX = 0.22 + fPush * 0.05 - ePush * 0.04;

      root.position.x += (targetX - root.position.x) * (anim ? 0.06 : 1);
      root.position.y += (targetY - root.position.y) * (anim ? 0.06 : 1);
      root.rotation.y += (targetRotY - root.rotation.y) * (anim ? 0.06 : 1);
      root.rotation.x += (targetRotX - root.rotation.x) * (anim ? 0.06 : 1);
    }

    /* 2. Gimballed Decision Compass at Origin (-2.05, 0.34, 0) */
    if (compassRingOuterRef.current) {
      compassRingOuterRef.current.rotation.z = anim ? el * 0.22 : 0.4;
    }
    if (compassRingInnerRef.current) {
      compassRingInnerRef.current.rotation.x =
        Math.PI * 0.35 + (anim ? Math.sin(el * 0.7) * 0.12 : 0);
      compassRingInnerRef.current.rotation.y = -activeLaneZ * 0.32;
    }
    if (pointerArmRef.current) {
      const targetAngle = -Math.atan2(activeLaneZ, 3.1);
      pointerArmRef.current.rotation.y +=
        (targetAngle - pointerArmRef.current.rotation.y) * (anim ? 0.12 : 1);
    }
    if (coreCrystalRef.current) {
      coreCrystalRef.current.rotation.y = anim ? el * 0.55 : Math.PI * 0.25;
      coreCrystalRef.current.rotation.x = anim ? Math.sin(el * 0.9) * 0.18 : 0.1;
      const pulseBoost =
        anim && strategyBus.pulseAt > 0
          ? Math.max(0, 1 - (performance.now() - strategyBus.pulseAt) / 900)
          : 0;
      coreCrystalRef.current.scale.setScalar(1 + pulseBoost * 0.22);
      reportHotspot(coreCrystalRef.current, state.camera, 0.85);
    }

    /* 3. Dynamic P10 / P50 / P90 Fan Lines & Translucent Fan Ribbon */
    const pos = assets.fanPositions;
    const rib = assets.ribbonVerts;
    let ptr = 0;

    for (let i = 0; i < CURVE_SAMPLES; i++) {
      const u = i / (CURVE_SAMPLES - 1);
      const x = -2.05 + u * 4.18;
      const branch = Math.pow(u, 0.78);
      const z = activeLaneZ * branch;

      const y10 = Math.max(DECK_Y + 0.08, DECK_Y + 0.26 + S.curveP10[i] * 0.76 * intro);
      const y50 = Math.max(DECK_Y + 0.12, DECK_Y + 0.26 + S.curveP50[i] * 0.76 * intro);
      const y90 = Math.max(DECK_Y + 0.18, DECK_Y + 0.26 + S.curveP90[i] * 0.76 * intro);

      rib[i * 6] = x;
      rib[i * 6 + 1] = y10;
      rib[i * 6 + 2] = z;
      rib[i * 6 + 3] = x;
      rib[i * 6 + 4] = y90;
      rib[i * 6 + 5] = z;

      pos[ptr++] = x;
      pos[ptr++] = y10;
      pos[ptr++] = z;
      pos[ptr++] = x;
      pos[ptr++] = y90;
      pos[ptr++] = z;

      if (i < CURVE_SAMPLES - 1) {
        const uNext = (i + 1) / (CURVE_SAMPLES - 1);
        const xNext = -2.05 + uNext * 4.18;
        const zNext = activeLaneZ * Math.pow(uNext, 0.78);
        const y10Next = Math.max(
          DECK_Y + 0.08,
          DECK_Y + 0.26 + S.curveP10[i + 1] * 0.76 * intro,
        );
        const y50Next = Math.max(
          DECK_Y + 0.12,
          DECK_Y + 0.26 + S.curveP50[i + 1] * 0.76 * intro,
        );
        const y90Next = Math.max(
          DECK_Y + 0.18,
          DECK_Y + 0.26 + S.curveP90[i + 1] * 0.76 * intro,
        );

        pos[ptr++] = x;
        pos[ptr++] = y10;
        pos[ptr++] = z;
        pos[ptr++] = xNext;
        pos[ptr++] = y10Next;
        pos[ptr++] = zNext;

        pos[ptr++] = x;
        pos[ptr++] = y50;
        pos[ptr++] = z;
        pos[ptr++] = xNext;
        pos[ptr++] = y50Next;
        pos[ptr++] = zNext;

        pos[ptr++] = x;
        pos[ptr++] = y90;
        pos[ptr++] = z;
        pos[ptr++] = xNext;
        pos[ptr++] = y90Next;
        pos[ptr++] = zNext;
      }
    }

    (assets.fanGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (assets.ribbonGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    assets.ribbonGeo.computeVertexNormals();

    /* 4. Update the 3 glass trajectory tubes */
    for (let i = 0; i < 3; i++) {
      const m = pathTubeRefs.current[i];
      if (!m) continue;
      const dist = Math.abs(i - S.selectedPath);
      const activeFactor = Math.max(0, 1 - dist);
      const scaleY = 0.8 + activeFactor * (0.3 + Math.max(0, S.p50) * 0.22);
      m.scale.set(1, scaleY * intro, 1);
    }

    /* 5. Update the 4 Gaussian Bell-Curve Glass Slices + Milestone Nodes */
    for (let i = 0; i < SLICE_X.length; i++) {
      const slice = sliceRefs.current[i];
      if (!slice) continue;
      const x = SLICE_X[i];
      const u = (x - -2.05) / 4.18;
      const branch = Math.pow(Math.max(0, u), 0.78);
      const zCenter = activeLaneZ * branch;

      const hScale =
        (0.56 + u * (0.58 + Math.max(0.1, S.p50) * 0.54)) *
        intro *
        (0.88 + 0.12 * smooth(sectionRange(feature, i * 0.12, 0.55 + i * 0.1)));
      const wScale = 0.56 + u * (0.46 + S.spread * 0.52);

      slice.position.set(x, DECK_Y + 0.01, zCenter);
      slice.scale.set(1, Math.max(0.05, hScale), wScale);

      const node = nodeRefs.current[i];
      if (node) {
        const sampleIdx = Math.min(CURVE_SAMPLES - 1, Math.round(u * (CURVE_SAMPLES - 1)));
        const yNode = Math.max(
          DECK_Y + 0.18,
          DECK_Y + 0.26 + S.curveP50[sampleIdx] * 0.76 * intro,
        );
        node.position.set(x, yNode, zCenter);
        node.rotation.y = anim ? el * 0.6 + i : 0.4;
      }
    }

    /* 6. Update the 3 Phased Milestone Gate Portals */
    for (let i = 0; i < GATE_X.length; i++) {
      const gate = gateRefs.current[i];
      if (!gate) continue;
      const x = GATE_X[i];
      const u = (x - -2.05) / 4.18;
      const zCenter = activeLaneZ * Math.pow(Math.max(0, u), 0.78);
      const rise =
        intro * (0.85 + 0.15 * smooth(sectionRange(feature, 0.1 + i * 0.18, 0.65 + i * 0.15)));
      gate.position.set(x, DECK_Y, zCenter);
      gate.scale.set(1, Math.max(0.05, rise), 1);

      const beam = gateBeamRefs.current[i];
      if (beam) {
        const pulseAge =
          anim && strategyBus.pulseAt > 0
            ? (performance.now() - strategyBus.pulseAt) / 1000
            : 99;
        const gateHit = Math.max(0, 1 - Math.abs(pulseAge - (0.25 + i * 0.32)) * 4.5);
        beam.scale.y = 1 + gateHit * 0.8;
      }
    }

    /* 7. Camera choreography — centered lookAt so stage-right root stays cleanly inside frame */
    const orbit = anim ? Math.sin(el * 0.08) * 0.14 : 0.06;
    const detailZoom = smooth(sectionRange(detail, 0.1, 0.85));
    const camX =
      Math.sin(orbit) * 8.6 +
      (anim ? pointer.x * 0.36 : 0) -
      detailZoom * 0.3;
    const camY =
      3.55 +
      (anim ? pointer.y * 0.22 : 0) +
      smooth(sectionRange(feature, 0.1, 0.8)) * 0.28 -
      detailZoom * 0.2;
    const camZ = 9.15 - intro * 0.4 - detailZoom * 0.45;

    _camPos.set(camX, camY, camZ);
    state.camera.position.lerp(_camPos, anim ? 0.05 : 1);
    _camLook.set(0.0, 0.12, 0);
    state.camera.lookAt(_camLook);
  });

  const sliceKinds: readonly GlassKind[] = ['azure', 'core', 'azure', 'deep'];

  return (
    <group>
      <SceneLightRig intensity={1.05} accent={1.2} />

      <group ref={rootRef} position={[1.76, -0.32, 0]} rotation={[0.22, -0.46, 0]}>
        {/* ---------- 1. Vitrine Strategy Table Base & Sapphire-Rimmed Horizon Deck ---------- */}
        {/* Deep-cobalt architectural outer rim */}
        <RoundedBox
          args={[TABLE_W + 0.22, 0.13, TABLE_D + 0.22]}
          radius={0.04}
          smoothness={4}
          position={[0, -0.025, 0]}
        >
          <meshStandardMaterial color="#b9c9ff" roughness={0.22} metalness={0.14} />
        </RoundedBox>

        {/* Sapphire bevel accent strip under the deck */}
        <RoundedBox
          args={[TABLE_W + 0.08, 0.04, TABLE_D + 0.08]}
          radius={0.015}
          smoothness={2}
          position={[0, 0.032, 0]}
        >
          <meshStandardMaterial color="#2e4bff" emissive="#1226c8" emissiveIntensity={0.35} />
        </RoundedBox>

        {/* Recessed blue-tinted frosted glass horizon slab */}
        <RoundedBox
          args={[TABLE_W, 0.085, TABLE_D]}
          radius={0.03}
          smoothness={4}
          position={[0, 0.042, 0]}
        >
          <GlassMaterial kind="azure" />
        </RoundedBox>

        {/* Precision coordinate grid & compass graduations */}
        <lineSegments geometry={assets.gridGeo}>
          <lineBasicMaterial color="#1226c8" transparent opacity={0.52} />
        </lineSegments>

        {/* Front & back blue enamel datum rails */}
        <mesh position={[0, DECK_Y + 0.018, TABLE_D * 0.5 - 0.06]}>
          <boxGeometry args={[TABLE_W - 0.24, 0.022, 0.028]} />
          <meshStandardMaterial color="#1226c8" emissive="#2e4bff" emissiveIntensity={0.55} />
        </mesh>
        <mesh position={[0, DECK_Y + 0.018, -TABLE_D * 0.5 + 0.06]}>
          <boxGeometry args={[TABLE_W - 0.24, 0.022, 0.028]} />
          <meshStandardMaterial color="#2e4bff" emissive="#1226c8" emissiveIntensity={0.35} />
        </mesh>

        {/* ---------- 2. The Gimballed Decision Compass at Origin T0 ---------- */}
        <group position={[-2.05, DECK_Y + 0.02, 0]}>
          {/* Stepped cobalt & porcelain pedestal */}
          <mesh position={[0, 0.035, 0]}>
            <cylinderGeometry args={[0.35, 0.42, 0.07, 36]} />
            <meshStandardMaterial color="#93a9ff" roughness={0.2} metalness={0.18} />
          </mesh>
          <mesh position={[0, 0.075, 0]}>
            <cylinderGeometry args={[0.26, 0.3, 0.03, 36]} />
            <meshStandardMaterial color="#1226c8" emissive="#1226c8" emissiveIntensity={0.4} />
          </mesh>

          {/* Outer azimuth ring */}
          <mesh ref={compassRingOuterRef} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.34, 0.022, 16, 48]} />
            <GlassMaterial kind="core" />
          </mesh>

          {/* Inner gimbal ring */}
          <mesh ref={compassRingInnerRef} position={[0, 0.3, 0]}>
            <torusGeometry args={[0.25, 0.016, 14, 40]} />
            <meshStandardMaterial color="#1226c8" emissive="#2e4bff" emissiveIntensity={0.75} />
          </mesh>

          {/* Directional vector needle arm */}
          <group ref={pointerArmRef} position={[0, 0.3, 0]}>
            <mesh position={[0.26, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.04, 0.3, 12]} />
              <meshStandardMaterial color="#2e4bff" emissive="#2e4bff" emissiveIntensity={0.95} />
            </mesh>
          </group>

          {/* Central Decision Core — faceted deep-blue crystal */}
          <mesh ref={coreCrystalRef} position={[0, 0.3, 0]}>
            <octahedronGeometry args={[0.17, 0]} />
            <GlassMaterial kind="deep" />
          </mesh>
        </group>

        {/* ---------- 3. Three Branching Glass Trajectory Bridges ---------- */}
        {assets.pathTubes.map((tubeGeo, i) => (
          <mesh
            key={i}
            ref={(el) => {
              pathTubeRefs.current[i] = el;
            }}
            geometry={tubeGeo}
          >
            <GlassMaterial kind={i === 0 ? 'deep' : i === 1 ? 'core' : 'azure'} />
          </mesh>
        ))}

        {/* ---------- 4. Live P10 / P50 / P90 Fan Envelope & Ribbon ---------- */}
        <mesh geometry={assets.ribbonGeo} frustumCulled={false}>
          <GradientGlassMaterial
            opacity={0.46}
            sheen={0.55}
            ice="#dce4ff"
            azure="#6b87ff"
            electric="#2e4bff"
            deep="#1226c8"
          />
        </mesh>
        <lineSegments geometry={assets.fanGeo} frustumCulled={false}>
          <lineBasicMaterial color="#1226c8" transparent opacity={0.85} />
        </lineSegments>

        {/* ---------- 5. Four 3D Glass Gaussian Probability Density Slices ---------- */}
        {SLICE_X.map((x, i) => (
          <React.Fragment key={x}>
            <group
              ref={(el) => {
                sliceRefs.current[i] = el;
              }}
              position={[x, DECK_Y + 0.01, 0]}
            >
              <mesh geometry={assets.bellGeo}>
                <GlassMaterial kind={sliceKinds[i]} />
              </mesh>
              <lineSegments geometry={assets.bellEdges}>
                <lineBasicMaterial color="#1226c8" transparent opacity={0.74} />
              </lineSegments>
              {/* Cobalt base bar under each Gaussian bell slice */}
              <mesh position={[0, 0.014, 0]}>
                <boxGeometry args={[0.06, 0.022, 1.24]} />
                <meshStandardMaterial color="#2e4bff" emissive="#1226c8" emissiveIntensity={0.45} />
              </mesh>
            </group>

            {/* Milestone checkpoint crystal node on the P50 spine */}
            <mesh
              ref={(el) => {
                nodeRefs.current[i] = el;
              }}
              position={[x, 0.55, 0]}
            >
              <octahedronGeometry args={[0.075, 0]} />
              <meshStandardMaterial color="#1226c8" emissive="#2e4bff" emissiveIntensity={0.85} />
            </mesh>
          </React.Fragment>
        ))}

        {/* ---------- 6. Three Phased Milestone Gate Portals ---------- */}
        {GATE_X.map((x, i) => (
          <group
            key={x}
            ref={(el) => {
              gateRefs.current[i] = el;
            }}
            position={[x, DECK_Y, 0]}
          >
            <mesh geometry={assets.gateGeo}>
              <GlassMaterial kind={i === 0 ? 'deep' : 'core'} />
            </mesh>
            <lineSegments geometry={assets.gateEdges}>
              <lineBasicMaterial color="#1226c8" transparent opacity={0.65} />
            </lineSegments>
            {/* Glowing lintel threshold indicator */}
            <mesh
              ref={(el) => {
                gateBeamRefs.current[i] = el;
              }}
              position={[0, 0.86, 0]}
            >
              <boxGeometry args={[0.045, 0.032, 0.62]} />
              <meshStandardMaterial
                color="#2e4bff"
                emissive="#1226c8"
                emissiveIntensity={1.1}
              />
            </mesh>
          </group>
        ))}

        {/* ---------- 7. Simulated Futures Monte Carlo Cloud ---------- */}
        <MonteCarloCloud
          count={Math.floor(1900 * q.particles)}
          animate={q.animate}
        />
      </group>

      {/* Ambient studio particle dust */}
      <ParticleField
        count={Math.floor(1100 * q.particles)}
        drift={q.animate ? 0.08 : 0}
        opacity={0.28}
        position={[0.8, 0, -1]}
      />
    </group>
  );
}
