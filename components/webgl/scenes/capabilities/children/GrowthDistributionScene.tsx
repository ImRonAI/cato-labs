'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
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
import {
  CHANNEL_NODES,
  COHORT_PILLAR_BASES,
  ROUTER_POS,
  SAMPLES_PER_PATH,
  buildDistributionNetworkGeometry,
} from './growth-distribution/DistributionNetworkGeometry';
import { engineBus } from './growth-distribution/engine-bus';

/**
 * GrowthDistributionScene — "The Compounding Distribution Manifold".
 *
 * A museum-grade glass architectural miniature of a 6-channel acquisition
 * and distribution network:
 *   1. Left radial arc: 6 sculpted glass Channel Source Towers (Search/SEO
 *      tiered index monolith, Paid collimator prism, Social 6-dialect array,
 *      Partnership twin bridge arches, CRM retention torus, Local radar beacon).
 *   2. Centre: The Refractive Intent & Qualification Router chamber with
 *      counter-rotating blue-enamel gimbal rings.
 *   3. Right ascending arc: The 24-Month Compounding Revenue Monolith — 24
 *      instanced bevelled glass cohort columns whose heights respond in real
 *      time to the visitor's budget allocation, horizon, and mode in
 *      THE GROWTH ENGINE, paired with a 3D Activity-Only baseline wire.
 *   4. Optical conduits & live instanced audience particles whose flow speed
 *      and density per channel are driven by engineBus.weights, plus a
 *      radial shockwave & conversion surge when the visitor clicks "Launch Asset".
 */

/* Module-scope reusable math objects — zero allocations inside useFrame */
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _look = new THREE.Vector3();
const _col = new THREE.Color();
const _colIce = new THREE.Color('#dce4ff');
const _colAzure = new THREE.Color('#6b87ff');
const _colElectric = new THREE.Color('#2e4bff');
const _colDeep = new THREE.Color('#1226c8');

export default function GrowthDistributionScene() {
  const q = useQuality();
  const reportHotspot = useHotspotReporter('growth-ribbon');

  const rootRef = useRef<THREE.Group>(null);
  const routerGroupRef = useRef<THREE.Group>(null);
  const routerOuterRingRef = useRef<THREE.Mesh>(null);
  const routerInnerRingRef = useRef<THREE.Mesh>(null);
  const routerCoreMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const launchWaveRef = useRef<THREE.Mesh>(null);
  const launchWaveMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const channelTowerRefs = useRef<(THREE.Group | null)[]>([]);
  const channelCoreMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  const pillarsInstRef = useRef<THREE.InstancedMesh>(null);
  const capsInstRef = useRef<THREE.InstancedMesh>(null);
  const particlesInstRef = useRef<THREE.InstancedMesh>(null);

  const conduitMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const linesMatRef = useRef<THREE.LineBasicMaterial>(null);

  const startAt = useRef<number | null>(null);
  const lookCur = useRef(new THREE.Vector3(0.35, -0.04, 0));
  const curHeights = useRef<Float32Array>(new Float32Array(engineBus.webglHeights));
  const curActHeights = useRef<Float32Array>(new Float32Array(engineBus.webglActivityHeights));

  const networkGeo = useMemo(() => buildDistributionNetworkGeometry(), []);

  /* Shared geometries for instanced meshes and crest/baseline wires */
  const {
    pillarGeo,
    capGeo,
    particleGeo,
    crestLineObj,
    crestPosAttr,
    crestPositions,
    baselineLineObj,
    baselinePosAttr,
    baselinePositions,
    particleSeeds,
  } = useMemo(() => {
    const pillarGeo = new THREE.BoxGeometry(0.054, 1, 0.125);
    // Shift box origin to bottom (y = 0..1) so scaling Y grows cleanly upward from plinth
    pillarGeo.translate(0, 0.5, 0);

    const capGeo = new THREE.BoxGeometry(0.062, 0.025, 0.138);
    const particleGeo = new THREE.SphereGeometry(0.024, 8, 8);

    const crestPositions = new Float32Array(24 * 3);
    const crestPosAttr = new THREE.BufferAttribute(crestPositions, 3);
    const crestGeo = new THREE.BufferGeometry();
    crestGeo.setAttribute('position', crestPosAttr);
    const crestMat = new THREE.LineBasicMaterial({
      color: '#2e4bff',
      transparent: true,
      opacity: 0.9,
    });
    const crestLineObj = new THREE.Line(crestGeo, crestMat);

    const baselinePositions = new Float32Array(24 * 3);
    const baselinePosAttr = new THREE.BufferAttribute(baselinePositions, 3);
    const baselineGeo = new THREE.BufferGeometry();
    baselineGeo.setAttribute('position', baselinePosAttr);
    const baselineMat = new THREE.LineBasicMaterial({
      color: '#0a0c12',
      transparent: true,
      opacity: 0.36,
    });
    const baselineLineObj = new THREE.Line(baselineGeo, baselineMat);

    const maxParticles = 168;
    const particleSeeds = new Float32Array(maxParticles * 3);
    for (let i = 0; i < maxParticles; i++) {
      particleSeeds[i * 3] = i % CHANNEL_NODES.length; // channel index 0..5
      particleSeeds[i * 3 + 1] = (i / maxParticles + (i % 7) * 0.137) % 1; // phase 0..1
      particleSeeds[i * 3 + 2] = 0.72 + ((i * 19) % 11) * 0.055; // speed multiplier
    }

    return {
      pillarGeo,
      capGeo,
      particleGeo,
      crestLineObj,
      crestPosAttr,
      crestPositions,
      baselineLineObj,
      baselinePosAttr,
      baselinePositions,
      particleSeeds,
    };
  }, []);

  const particleCount = Math.max(36, Math.floor(168 * q.particles));

  useEffect(() => {
    return () => {
      networkGeo.dispose();
      pillarGeo.dispose();
      capGeo.dispose();
      particleGeo.dispose();
      crestLineObj.geometry.dispose();
      (crestLineObj.material as THREE.Material).dispose();
      baselineLineObj.geometry.dispose();
      (baselineLineObj.material as THREE.Material).dispose();
    };
  }, [
    networkGeo,
    pillarGeo,
    capGeo,
    particleGeo,
    crestLineObj,
    baselineLineObj,
  ]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = t;
    const intro = q.animate
      ? 0.82 + 0.18 * smooth(Math.min((t - startAt.current) / 0.85, 1))
      : 1;

    const feature = smooth(sectionRange(getSectionProgress('feature'), 0.05, 0.85));
    const chart = smooth(sectionRange(getSectionProgress('chart'), 0.05, 0.9));
    const levers = smooth(sectionRange(getSectionProgress('levers'), 0.05, 0.85));
    const social = smooth(sectionRange(getSectionProgress('social'), 0.05, 0.85));
    const detail = smooth(sectionRange(getSectionProgress('detail'), 0.05, 0.85));
    const cta = smooth(sectionRange(getSectionProgress('cta'), 0.05, 0.9));

    // Read live state from engineBus transiently
    const weights = engineBus.weights;
    const activeChannel = engineBus.activeChannel;
    const inspectedMonth = engineBus.inspectedMonth;
    const horizon = engineBus.horizonMonths;
    const targetHeights = engineBus.webglHeights;
    const targetActHeights = engineBus.webglActivityHeights;

    // Content Launch Wave progress (0..1 over 4.2 seconds when triggered)
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const launchElapsed =
      engineBus.launchAt > 0 ? (nowMs - engineBus.launchAt) / 1000 : 999;
    const launchActive = launchElapsed >= 0 && launchElapsed < 4.4;
    const launchProgress = launchActive ? launchElapsed / 4.4 : 0;

    // 1. Update conduit & blueprint opacities
    if (conduitMatRef.current) {
      conduitMatRef.current.opacity =
        (0.76 + chart * 0.16 + (launchActive ? 0.2 : 0)) * intro;
    }
    if (haloMatRef.current) {
      haloMatRef.current.opacity =
        (0.18 + chart * 0.12 + (launchActive ? 0.22 : 0)) * intro;
    }
    if (linesMatRef.current) {
      linesMatRef.current.opacity = (0.34 + chart * 0.12) * intro;
    }

    // 2. Animate the 6 Channel Source Towers based on live budget weights
    for (let i = 0; i < CHANNEL_NODES.length; i++) {
      const node = CHANNEL_NODES[i];
      const grp = channelTowerRefs.current[i];
      if (!grp) continue;

      const w = weights[node.id] ?? 0.16;
      const isFocused = activeChannel === node.id;
      const staggerIn = q.animate
        ? 0.78 + 0.22 * smooth(Math.min(Math.max((t - startAt.current - i * 0.05) / 0.65, 0), 1))
        : 1;

      // Launch pulse hits channel towers at launchElapsed 0.4..1.8s
      const launchTowerPulse =
        launchActive && launchElapsed > 0.25 && launchElapsed < 2.2
          ? Math.sin(((launchElapsed - 0.25) / 1.95) * Math.PI) * 0.22
          : 0;

      const bob = q.animate ? Math.sin(t * 1.1 + i * 1.15) * 0.025 : 0;
      const liftY = (w - 0.16) * 0.55 + (isFocused ? 0.12 : 0) + launchTowerPulse;

      grp.position.set(
        node.position[0],
        node.position[1] + liftY + bob - (1 - staggerIn) * 0.4,
        node.position[2],
      );
      const towerScale =
        (0.88 + w * 0.65 + (isFocused ? 0.14 : 0) + launchTowerPulse * 0.4) *
        staggerIn;
      grp.scale.setScalar(Math.max(0.001, towerScale));

      const coreMat = channelCoreMatRefs.current[i];
      if (coreMat) {
        coreMat.emissiveIntensity =
          0.55 + w * 2.2 + (isFocused ? 1.2 : 0) + launchTowerPulse * 3.0;
      }
    }

    // 3. Animate Central Qualification Router Prism & Gimbal Rings
    if (routerOuterRingRef.current && q.animate) {
      routerOuterRingRef.current.rotation.z = t * 0.32;
      routerOuterRingRef.current.rotation.x = Math.sin(t * 0.4) * 0.22 + 0.35;
    }
    if (routerInnerRingRef.current && q.animate) {
      routerInnerRingRef.current.rotation.y = -t * 0.48;
      routerInnerRingRef.current.rotation.x = Math.cos(t * 0.35) * 0.28 - 0.25;
    }
    if (routerCoreMatRef.current) {
      const pulse = q.animate ? Math.sin(t * 2.2) * 0.25 : 0;
      routerCoreMatRef.current.emissiveIntensity =
        1.35 + chart * 0.5 + pulse + (launchActive ? 2.2 : 0);
    }

    // Launch radial shockwave ring
    if (launchWaveRef.current && launchWaveMatRef.current) {
      if (launchActive) {
        const waveR = 0.2 + launchProgress * 4.2;
        launchWaveRef.current.scale.setScalar(waveR);
        launchWaveMatRef.current.opacity =
          Math.sin(launchProgress * Math.PI) * 0.65;
        launchWaveRef.current.visible = true;
      } else {
        launchWaveRef.current.visible = false;
      }
    }

    // 4. Update 24-Month Compounding Revenue Monolith (InstancedMesh + wires)
    const pillarsMesh = pillarsInstRef.current;
    const capsMesh = capsInstRef.current;
    if (pillarsMesh && capsMesh) {
      const damp = q.animate ? Math.min(1, delta * 9) : 1;
      const maxBarHeight = 1.95;

      for (let i = 0; i < 24; i++) {
        const base = COHORT_PILLAR_BASES[i];
        const monthNum = i + 1;
        const inHorizon = monthNum <= horizon;
        const tgtH = (targetHeights[i] ?? 0.25) * (inHorizon ? 1 : 0.38);
        const tgtActH = (targetActHeights[i] ?? 0.18) * (inHorizon ? 1 : 0.38);

        curHeights.current[i] += (tgtH - curHeights.current[i]) * damp;
        curActHeights.current[i] += (tgtActH - curActHeights.current[i]) * damp;

        // Launch ripple along the 24 columns (1.6s -> 4.2s)
        let launchBarBoost = 0;
        if (launchActive && launchElapsed > 1.2) {
          const wavePos = ((launchElapsed - 1.2) / 2.8) * 28 - i;
          if (wavePos > 0 && wavePos < 6) {
            launchBarBoost = Math.sin((wavePos / 6) * Math.PI) * 0.22;
          }
        }

        const h =
          Math.max(0.08, curHeights.current[i] + launchBarBoost) *
          maxBarHeight *
          intro;
        const actH = Math.max(0.06, curActHeights.current[i]) * maxBarHeight * intro;

        _pos.set(base.x, base.y, base.z);
        _euler.set(0, base.angle, 0);
        _quat.setFromEuler(_euler);
        _scale.set(1, h, 1);
        _mat4.compose(_pos, _quat, _scale);
        pillarsMesh.setMatrixAt(i, _mat4);

        // Color grading per column: inspected month or milestone months glow deeper electric blue
        const isInspected = monthNum === inspectedMonth;
        const isMilestone =
          monthNum === 3 ||
          monthNum === 6 ||
          monthNum === 9 ||
          monthNum === 15 ||
          monthNum === 21 ||
          monthNum === horizon;

        if (!inHorizon) {
          _col.copy(_colIce);
        } else if (isInspected) {
          _col.copy(_colDeep);
        } else if (isMilestone) {
          _col.copy(_colElectric);
        } else {
          _col.copy(_colAzure).lerp(_colElectric, i / 23);
        }
        pillarsMesh.setColorAt(i, _col);

        // Cap plate sits right on top of each glass column
        _pos.set(base.x, base.y + h + 0.022, base.z);
        _scale.set(
          isInspected ? 1.28 : 1,
          isInspected ? 1.45 : 1,
          isInspected ? 1.28 : 1,
        );
        _mat4.compose(_pos, _quat, _scale);
        capsMesh.setMatrixAt(i, _mat4);
        capsMesh.setColorAt(
          i,
          isInspected ? _colElectric : isMilestone ? _colDeep : _colAzure,
        );

        // Update 3D Crest Wire & Activity Baseline Wire coordinates
        crestPositions[i * 3] = base.x;
        crestPositions[i * 3 + 1] = base.y + h + 0.055;
        crestPositions[i * 3 + 2] = base.z;

        baselinePositions[i * 3] = base.x;
        baselinePositions[i * 3 + 1] = base.y + actH + 0.02;
        baselinePositions[i * 3 + 2] = base.z + 0.095;
      }

      pillarsMesh.instanceMatrix.needsUpdate = true;
      if (pillarsMesh.instanceColor) pillarsMesh.instanceColor.needsUpdate = true;
      capsMesh.instanceMatrix.needsUpdate = true;
      if (capsMesh.instanceColor) capsMesh.instanceColor.needsUpdate = true;
      crestPosAttr.needsUpdate = true;
      baselinePosAttr.needsUpdate = true;
    }

    // 5. Update Instanced Audience Flow Particles along the 6 channel paths
    const pMesh = particlesInstRef.current;
    if (pMesh) {
      const pathTable = networkGeo.particlePathTable;
      const launchSpeedMult = launchActive ? 2.6 : 1.0;

      for (let i = 0; i < particleCount; i++) {
        const chIdx = particleSeeds[i * 3] | 0;
        const basePhase = particleSeeds[i * 3 + 1];
        const speedSeed = particleSeeds[i * 3 + 2];
        const chId = CHANNEL_NODES[chIdx].id;
        const w = weights[chId] ?? 0.16;

        // Flow velocity scales with channel budget weight
        const speed = (0.14 + w * 0.65) * speedSeed * launchSpeedMult;
        const u = q.animate ? (basePhase + t * speed) % 1 : basePhase;

        const exactSample = u * (SAMPLES_PER_PATH - 1);
        const s0 = exactSample | 0;
        const s1 = Math.min(SAMPLES_PER_PATH - 1, s0 + 1);
        const frac = exactSample - s0;

        const idx0 = (chIdx * SAMPLES_PER_PATH + s0) * 3;
        const idx1 = (chIdx * SAMPLES_PER_PATH + s1) * 3;

        const px = pathTable[idx0] + (pathTable[idx1] - pathTable[idx0]) * frac;
        const py =
          pathTable[idx0 + 1] + (pathTable[idx1 + 1] - pathTable[idx0 + 1]) * frac;
        const pz =
          pathTable[idx0 + 2] + (pathTable[idx1 + 2] - pathTable[idx0 + 2]) * frac;

        // Scale particles by channel weight & fade gently at endpoints
        const edgeFade = Math.sin(u * Math.PI);
        const pScale =
          (0.45 + w * 2.1 + (launchActive ? 0.45 : 0)) * edgeFade * intro;

        _pos.set(px, py, pz);
        _quat.identity();
        _scale.setScalar(Math.max(0.001, pScale));
        _mat4.compose(_pos, _quat, _scale);
        pMesh.setMatrixAt(i, _mat4);
      }
      pMesh.instanceMatrix.needsUpdate = true;
    }

    // 6. Root miniature positioning & scroll choreography
    const root = rootRef.current;
    if (root) {
      if (q.compact) {
        root.position.set(0.02, -0.92 + chart * 0.3, -0.45);
        root.scale.setScalar(0.62 * intro);
        root.rotation.set(0.16, -0.2 + chart * 0.1, 0);
      } else {
        // Desktop: sits cleanly in the right half of the viewport so left-aligned
        // H1/H2 copy and centered CTA copy have pure paper-white contrast
        const rx =
          1.78 +
          feature * 0.08 +
          chart * 0.14 +
          levers * 0.12 +
          detail * 0.12 +
          cta * 0.42;
        const ry =
          -0.06 +
          feature * 0.06 +
          chart * 0.12 -
          social * 0.35 +
          cta * 0.18;
        const rz = -0.12 - social * 0.75 - cta * 0.35;

        root.position.x += (rx - root.position.x) * 0.06;
        root.position.y += (ry - root.position.y) * 0.06;
        root.position.z += (rz - root.position.z) * 0.06;

        const targetRotY =
          -0.24 +
          feature * 0.12 +
          chart * 0.1 -
          levers * 0.15 +
          cta * 0.1 +
          (q.animate ? pointer.x * 0.06 : 0);
        const targetRotX =
          0.16 +
          levers * 0.1 -
          chart * 0.04 +
          (q.animate ? -pointer.y * 0.04 : 0);

        root.rotation.y += (targetRotY - root.rotation.y) * 0.05;
        root.rotation.x += (targetRotX - root.rotation.x) * 0.05;
        root.scale.setScalar(0.88 * intro);
      }
    }

    // 7. Camera choreography
    const cam = state.camera;
    if (!q.animate) {
      cam.position.set(0.05, 0.34, 7.85);
      cam.lookAt(0.35, -0.04, 0);
    } else {
      const cx =
        0.05 +
        pointer.x * 0.2 -
        feature * 0.15 +
        chart * 0.15 +
        Math.sin(t * 0.06) * 0.09;
      const cy =
        0.34 +
        pointer.y * 0.14 +
        levers * 0.35 -
        social * 0.18 +
        Math.cos(t * 0.05) * 0.06;
      const cz =
        7.85 -
        feature * 0.25 -
        chart * 0.15 +
        social * 0.85 +
        (1 - intro) * 1.3;

      cam.position.x += (cx - cam.position.x) * 0.05;
      cam.position.y += (cy - cam.position.y) * 0.05;
      cam.position.z += (cz - cam.position.z) * 0.05;

      _look.set(
        0.35 - feature * 0.1 + chart * 0.1,
        -0.04 + chart * 0.06,
        0,
      );
      lookCur.current.lerp(_look, 0.05);
      cam.lookAt(lookCur.current);
    }

    // 8. Report hotspot from Central Qualification Router via ProximityType's
    // epsilon-gated useHotspotReporter (0.5 - _proj.y * 0.5 screen y-down, zero idle allocations)
    if (routerGroupRef.current) {
      reportHotspot(routerGroupRef.current, cam, (0.7 + chart * 0.3) * intro);
    }
  });

  return (
    <group>
      <SceneLightRig />

      <group ref={rootRef} position={[1.78, -0.06, -0.12]} rotation={[0.16, -0.24, 0]}>
        {/* ---- 1. ARCHITECTURAL DATUM PLINTH & TELEMETRY GRID ---- */}
        <group position={[0.3, -0.88, 0]}>
          {/* Frosted glass architectural table */}
          <RoundedBox args={[4.45, 0.065, 1.85]} radius={0.022} smoothness={3}>
            <GlassMaterial kind="ice" />
          </RoundedBox>
          {/* Matte porcelain structural sub-plinth */}
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[4.32, 0.032, 1.72]} />
            <meshStandardMaterial color="#eef2ff" roughness={0.35} metalness={0.05} />
          </mesh>
          {/* Precision blue-enamel perimeter trim */}
          <mesh position={[0, 0.035, 0.88]}>
            <boxGeometry args={[4.28, 0.008, 0.012]} />
            <meshBasicMaterial color="#2e4bff" transparent opacity={0.55} />
          </mesh>
        </group>

        {/* Merged Schematic Datum Rings, Ticks & Guide Rails */}
        <lineSegments geometry={networkGeo.blueprintLinesGeo}>
          <lineBasicMaterial
            ref={linesMatRef}
            color="#5f7dff"
            transparent
            opacity={0.36}
          />
        </lineSegments>

        {/* ---- 2. MERGED OPTICAL CONDUITS (6 INTAKE + 3 OUTFEED) ---- */}
        <mesh geometry={networkGeo.conduitTubeGeo} renderOrder={1}>
          <meshBasicMaterial
            ref={conduitMatRef}
            color="#2e4bff"
            transparent
            opacity={0.82}
          />
        </mesh>
        <mesh geometry={networkGeo.conduitHaloGeo} renderOrder={0}>
          <meshBasicMaterial
            ref={haloMatRef}
            color="#93a9ff"
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* ---- 3. SIX SCULPTED GLASS CHANNEL SOURCE TOWERS ---- */}
        {CHANNEL_NODES.map((node, i) => (
          <group
            key={node.id}
            position={node.position}
            ref={(el) => {
              channelTowerRefs.current[i] = el;
            }}
          >
            {/* Porcelain & blue-enamel base socket */}
            <mesh position={[0, -0.14, 0]}>
              <cylinderGeometry args={[0.2, 0.23, 0.045, 24]} />
              <meshStandardMaterial color="#f4f7ff" roughness={0.25} metalness={0.08} />
            </mesh>
            <mesh position={[0, -0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.19, 0.012, 12, 32]} />
              <meshStandardMaterial
                ref={(el) => {
                  channelCoreMatRefs.current[i] = el;
                }}
                color="#2e4bff"
                emissive="#2e4bff"
                emissiveIntensity={0.9}
                roughness={0.15}
              />
            </mesh>

            {/* Distinct channel miniature geometry per channel */}
            {node.id === 'seo' && (
              /* CH-01 Search & SEO: 3-tier stepped glass index library */
              <group>
                <RoundedBox
                  args={[0.28, 0.06, 0.22]}
                  radius={0.015}
                  smoothness={2}
                  position={[0, -0.05, 0]}
                >
                  <GlassMaterial kind="crystal" />
                </RoundedBox>
                <RoundedBox
                  args={[0.22, 0.06, 0.18]}
                  radius={0.015}
                  smoothness={2}
                  position={[0, 0.03, 0]}
                >
                  <GlassMaterial kind="azure" />
                </RoundedBox>
                <RoundedBox
                  args={[0.16, 0.14, 0.12]}
                  radius={0.015}
                  smoothness={2}
                  position={[0, 0.14, 0]}
                >
                  <GlassMaterial kind="core" />
                </RoundedBox>
              </group>
            )}

            {node.id === 'paid' && (
              /* CH-02 Paid Search: Precision collimator lens prism */
              <group>
                <mesh rotation={[0, Math.PI / 4, 0]} position={[0, 0.05, 0]}>
                  <octahedronGeometry args={[0.16, 0]} />
                  <GlassMaterial kind="prism" />
                </mesh>
                <mesh rotation={[0, 0.3, Math.PI / 2]} position={[0, 0.05, 0]}>
                  <torusGeometry args={[0.2, 0.014, 12, 28]} />
                  <meshStandardMaterial color="#1226c8" roughness={0.2} />
                </mesh>
              </group>
            )}

            {node.id === 'social' && (
              /* CH-03 Social Engine: 6-dialect broadcast carousel */
              <group position={[0, 0.04, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.09, 0.09, 0.22, 6]} />
                  <GlassMaterial kind="core" />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.18, 0.018, 10, 6]} />
                  <GlassMaterial kind="crystal" />
                </mesh>
              </group>
            )}

            {node.id === 'partners' && (
              /* CH-04 Partnerships: Interlocking twin co-distribution arches */
              <group position={[0, 0.05, 0]}>
                <mesh position={[-0.045, 0, 0]} rotation={[0, 0.35, 0]}>
                  <torusGeometry args={[0.12, 0.028, 12, 24]} />
                  <GlassMaterial kind="azure" />
                </mesh>
                <mesh position={[0.045, 0.02, 0]} rotation={[Math.PI / 3, -0.35, 0]}>
                  <torusGeometry args={[0.12, 0.028, 12, 24]} />
                  <GlassMaterial kind="core" />
                </mesh>
              </group>
            )}

            {node.id === 'crm' && (
              /* CH-05 Lifecycle & CRM: Recirculating retention torus loop */
              <group position={[0, 0.04, 0]}>
                <mesh rotation={[0.55, 0.25, 0]}>
                  <torusGeometry args={[0.14, 0.036, 14, 28]} />
                  <GlassMaterial kind="crystal" />
                </mesh>
                <mesh>
                  <sphereGeometry args={[0.065, 16, 16]} />
                  <meshStandardMaterial
                    color="#2e4bff"
                    emissive="#2e4bff"
                    emissiveIntensity={1.1}
                  />
                </mesh>
              </group>
            )}

            {node.id === 'local' && (
              /* CH-06 Local Capture: Map-pack beacon pin & radar ring */
              <group position={[0, 0.05, 0]}>
                <mesh position={[0, 0.04, 0]}>
                  <coneGeometry args={[0.12, 0.24, 6]} />
                  <GlassMaterial kind="deep" />
                </mesh>
                <mesh position={[0, -0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.16, 0.01, 10, 24]} />
                  <meshBasicMaterial color="#2e4bff" />
                </mesh>
              </group>
            )}
          </group>
        ))}

        {/* ---- 4. CENTRAL INTENT & QUALIFICATION ROUTER CHAMBER ---- */}
        <group ref={routerGroupRef} position={ROUTER_POS}>
          {/* Refractive diamond router core */}
          <mesh rotation={[0.2, 0.4, 0]}>
            <octahedronGeometry args={[0.32, 0]} />
            <GlassMaterial kind="prism" />
          </mesh>

          {/* Inner electric conversion nucleus */}
          <mesh>
            <octahedronGeometry args={[0.13, 1]} />
            <meshStandardMaterial
              ref={routerCoreMatRef}
              color="#2e4bff"
              emissive="#2e4bff"
              emissiveIntensity={1.6}
              roughness={0.1}
            />
          </mesh>

          {/* Outer precision gimbal ring */}
          <mesh ref={routerOuterRingRef} rotation={[0.4, 0, 0]}>
            <torusGeometry args={[0.46, 0.014, 14, 48]} />
            <GradientGlassMaterial opacity={0.95} />
          </mesh>

          {/* Inner counter-rotating telemetry ring */}
          <mesh ref={routerInnerRingRef} rotation={[-0.35, 0.4, 0]}>
            <torusGeometry args={[0.38, 0.01, 12, 40]} />
            <meshBasicMaterial color="#2e4bff" />
          </mesh>

          {/* Router porcelain pedestal stem to datum */}
          <mesh position={[0, -0.46, 0]}>
            <cylinderGeometry args={[0.045, 0.14, 0.84, 20]} />
            <GlassMaterial kind="ice" />
          </mesh>

          {/* Launch Asset radial shockwave ring */}
          <mesh
            ref={launchWaveRef}
            rotation={[Math.PI / 2, 0, 0]}
            visible={false}
          >
            <ringGeometry args={[0.82, 1.0, 48]} />
            <meshBasicMaterial
              ref={launchWaveMatRef}
              color="#2e4bff"
              transparent
              opacity={0}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* ---- 5. 24-MONTH COMPOUNDING REVENUE MONOLITH ---- */}
        {/* 24 Instanced Bevelled Glass Cohort Columns */}
        <instancedMesh
          ref={pillarsInstRef}
          args={[pillarGeo, undefined, 24]}
          frustumCulled={false}
        >
          <GlassMaterial kind="azure" color="#ffffff" />
        </instancedMesh>

        {/* 24 Instanced Electric-Blue Enamel Cap Beacons */}
        <instancedMesh
          ref={capsInstRef}
          args={[capGeo, undefined, 24]}
          frustumCulled={false}
        >
          <meshStandardMaterial
            color="#ffffff"
            emissive="#2e4bff"
            emissiveIntensity={0.65}
            roughness={0.18}
            metalness={0.15}
          />
        </instancedMesh>

        {/* 3D Compounding Crest Wire & Activity-Only Baseline Wire */}
        <primitive object={crestLineObj} />
        <primitive object={baselineLineObj} />

        {/* ---- 6. LIVE AUDIENCE FLOW PARTICLES ---- */}
        <instancedMesh
          ref={particlesInstRef}
          args={[particleGeo, undefined, particleCount]}
          frustumCulled={false}
        >
          <meshStandardMaterial
            color="#e8eeff"
            emissive="#2e4bff"
            emissiveIntensity={1.85}
            roughness={0.1}
          />
        </instancedMesh>
      </group>

      {/* Subtle ambient studio dust */}
      <ParticleField
        count={Math.floor(1400 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        parallax={q.animate ? 0.8 : 0}
        opacity={0.34}
      />
    </group>
  );
}
