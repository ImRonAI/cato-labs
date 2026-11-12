'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, type GlassKind } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import { getSectionProgress, pointer, sectionRange, smooth } from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import CatoBody, { type CatoBodyHandle } from '../../../kit/cato/CatoBody';
import { createStageState, readStage, damp } from '../lib-a/dwell';
import { contactShadowTexture } from '../lib-a/place';
import { buildMountainAndArrowhead } from './san-bernardino/mountainArrowhead';
import { buildSantaFeDepotAndLandmarks } from './san-bernardino/santaFeDepot';
import { buildRailAndTrain } from './san-bernardino/railAndTrain';

/**
 * SanBernardinoScene — "The Crossroads Under the Arrowhead".
 *
 * A crafted glass-and-porcelain architectural miniature of San Bernardino:
 *   1. The San Bernardino Mountains & Cajon Pass massif in frosted ice glass
 *      with topographic contour lines and the natural downward-pointing
 *      Arrowhead landmark inlaid in luminous prism glass on Arrowhead Peak.
 *   2. The historic 1918 Santa Fe Depot — twin Mission Revival domed bell
 *      towers, curved espadaña parapet gable, rose oculus, and arched
 *      trackside colonnade — beside the BNSF West Yard intermodal gantry.
 *   3. A winding BNSF / Santa Fe rail corridor on a steel-truss Cajon Pass
 *      trestle carrying a 7-car consist (sculpted freight locomotive with
 *      twin headlights + 6 double-stack intermodal container cars).
 *   4. Historic U.S. Route 66 paralleling the tracks with a sculpted 3D
 *      U.S. 66 Highway Shield monument.
 *   5. Cato the robot on the Route 66 / Depot promenade — waving at the
 *      hero, scanning the intermodal freight yard at stats, walking along
 *      Route 66 beside the climbing train during the signature moment dwell,
 *      and celebrating across the lower sections.
 */

const CARS = 7;
const CAR_LEN = 0.38;
const CAR_GAP = 0.055;
const SLEEPERS = 165;
const LOWER_KINDS: GlassKind[] = ['deep', 'core', 'azure', 'deep', 'core', 'azure', 'deep'];
const UPPER_KINDS: GlassKind[] = ['core', 'crystal', 'ice', 'azure', 'crystal', 'core', 'ice'];

const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
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

export default function SanBernardinoScene() {
  const q = useQuality();
  const rig = useRef<THREE.Group>(null);
  const view = useRef<THREE.Group>(null);
  const catoGroup = useRef<THREE.Group>(null);
  const catoBody = useRef<CatoBodyHandle>(null);
  const carGroups = useRef<(THREE.Group | null)[]>([]);
  const lamp = useRef<THREE.Mesh>(null);
  const arrowBeacon = useRef<THREE.Object3D>(null);
  const sleepers = useRef<THREE.InstancedMesh>(null);
  const stage = useMemo(createStageState, []);
  const report = useHotspotReporter('sb-skyline');

  const live = useRef({
    x: 1.48,
    y: -0.16,
    z: 0.28,
    s: 0.88,
    rx: 0.24,
    ry: -0.22,
    trainD: 0.56,
    catoU: 0.68,
    catoRotY: -0.24,
    pose: '',
    scrubbing: false,
  });

  const mountainData = useMemo(() => buildMountainAndArrowhead(), []);
  const depotData = useMemo(() => buildSantaFeDepotAndLandmarks(), []);
  const railData = useMemo(() => buildRailAndTrain(), []);

  const mats = useMemo(() => {
    const shadowMap = typeof document !== 'undefined' ? contactShadowTexture() : null;
    return {
      plinth: new THREE.MeshPhysicalMaterial({
        color: '#eef3ff',
        roughness: 0.22,
        metalness: 0.02,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
      }),
      porcelain: new THREE.MeshPhysicalMaterial({
        color: '#f5f8ff',
        roughness: 0.18,
        metalness: 0.04,
        clearcoat: 0.85,
        clearcoatRoughness: 0.14,
      }),
      roadbed: new THREE.MeshPhysicalMaterial({
        color: '#dce6ff',
        roughness: 0.28,
        metalness: 0.05,
        clearcoat: 0.5,
      }),
      arrowCore: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#dce8ff').multiplyScalar(1.35),
        toneMapped: false,
      }),
      glow: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#7d97ff').multiplyScalar(1.85),
        toneMapped: false,
      }),
      lamp: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffffff').multiplyScalar(3.2),
        toneMapped: false,
      }),
      sleeper: new THREE.MeshBasicMaterial({ color: '#9eb3ff' }),
      contourLines: new THREE.LineBasicMaterial({
        color: '#6b87ff',
        transparent: true,
        opacity: 0.34,
      }),
      arrowRimLines: new THREE.LineBasicMaterial({
        color: '#2e4bff',
        transparent: true,
        opacity: 0.95,
      }),
      depotLines: new THREE.LineBasicMaterial({
        color: '#2e4bff',
        transparent: true,
        opacity: 0.52,
      }),
      plinthLines: new THREE.LineBasicMaterial({
        color: '#7d97ff',
        transparent: true,
        opacity: 0.28,
      }),
      railLines: new THREE.LineBasicMaterial({
        color: '#2e4bff',
        transparent: true,
        opacity: 0.72,
      }),
      hwyLines: new THREE.LineBasicMaterial({
        color: '#1f38e0',
        transparent: true,
        opacity: 0.62,
      }),
      carLines: new THREE.LineBasicMaterial({
        color: '#1226c8',
        transparent: true,
        opacity: 0.55,
      }),
      shadow: new THREE.MeshBasicMaterial({
        map: shadowMap,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    };
  }, []);

  useEffect(
    () => () => {
      mountainData.dispose();
      depotData.dispose();
      railData.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    },
    [mountainData, depotData, railData, mats],
  );

  // Populate railroad ties (sleepers) along the track LUT
  useEffect(() => {
    const s = sleepers.current;
    if (!s) return;
    const { railLut } = railData;
    for (let i = 0; i < SLEEPERS; i++) {
      railLut.sample((i + 0.5) / SLEEPERS, _p, _t);
      _m.lookAt(_p, _p2.copy(_p).add(_t), _up);
      _q.setFromRotationMatrix(_m);
      _m.compose(_p.setY(_p.y - 0.004), _q, _one);
      s.setMatrixAt(i, _m);
    }
    s.instanceMatrix.needsUpdate = true;
  }, [railData]);

  useFrame((state, delta) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const compact = q.compact;
    readStage(stage, q);

    const pStats = getSectionProgress('stats');
    const pAngles = getSectionProgress('angles');
    const pFeature = getSectionProgress('feature');
    const pBuild = getSectionProgress('build');
    const pDetail = getSectionProgress('detail');
    const pFaq = getSectionProgress('faq');
    const pCta = getSectionProgress('cta');

    const intro = anim ? smooth(Math.min(el / 1.6, 1)) : 1;
    const L = live.current;

    // -------------------------------------------------------------------------
    // 1. STAGE PLACEMENT & CAMERA ORIENTATION ACROSS ALL SECTIONS
    // -------------------------------------------------------------------------
    let targetX = compact ? 0.04 : 1.48;
    let targetY = compact ? -0.82 : -0.14;
    let targetZ = compact ? -0.55 : 0.32;
    let targetS = compact ? 0.48 : 0.88;
    let targetRx = compact ? 0.28 : 0.24;
    let targetRy = compact ? -0.18 : -0.22;

    if (anim) {
      // Beat 1: Stats (intermodal yard & double-stack focus)
      const wStats = smooth(sectionRange(pStats, 0.08, 0.55)) * (1 - stage.into);
      targetX += (compact ? 0 : -0.22) * wStats;
      targetY += -0.06 * wStats;
      targetRy += -0.14 * wStats;
      targetRx += 0.04 * wStats;

      // Beat 2: Moment dwell (centered full-stage showcase)
      const fMoment = stage.into * (1 - stage.out);
      const mX = compact ? 0.02 : 0.08;
      const mY = compact ? -0.12 : -0.08;
      const mZ = compact ? 0.15 : 0.82;
      const mS = compact ? 0.55 : 1.04;
      const mRx = 0.27 + Math.sin(stage.t * Math.PI) * 0.05;
      const mRy = -0.22 + stage.t * 0.38;

      targetX = targetX * (1 - fMoment) + mX * fMoment;
      targetY = targetY * (1 - fMoment) + mY * fMoment;
      targetZ = targetZ * (1 - fMoment) + mZ * fMoment;
      targetS = targetS * (1 - fMoment) + mS * fMoment;
      targetRx = targetRx * (1 - fMoment) + mRx * fMoment;
      targetRy = targetRy * (1 - fMoment) + mRy * fMoment;

      // Post-moment sections (angles -> feature -> build -> detail -> faq -> cta)
      if (stage.out > 0.001) {
        const wAfter = stage.out;
        // Default post-moment resting position on right side of viewport
        let postX = compact ? 0.05 : 1.56;
        let postY = compact ? -0.58 : -0.12;
        let postZ = compact ? -0.55 : 0.18;
        let postS = compact ? 0.46 : 0.84;
        let postRx = 0.31;
        let postRy = 0.12;

        // Beat 3: Angles ("The local read" — high overview of the crossroads)
        const wAngles = smooth(sectionRange(pAngles, 0.1, 0.85));
        postRx = 0.24 + 0.10 * wAngles;

        // Beat 4: Feature ("The focus" — alternating left/right pillars)
        // Pillar 01 is left (scene right), Pillar 02 is right (scene swings left), Pillar 03 is left (scene right)
        if (pFeature > 0.02 && pFeature < 0.98) {
          const swingLeft =
            smooth(sectionRange(pFeature, 0.28, 0.45)) *
            (1 - smooth(sectionRange(pFeature, 0.62, 0.78)));
          if (!compact) {
            postX = 1.56 * (1 - swingLeft) + -1.38 * swingLeft;
          }
          postRy = -0.24 * (1 - swingLeft) + 0.28 * swingLeft;
          postRx = 0.23;
        }

        // Beat 5: Build & Detail (Depot towers + Arrowhead close framing on right)
        const wBuild = smooth(sectionRange(pBuild, 0.1, 0.6));
        const wDetail = smooth(sectionRange(pDetail, 0.1, 0.6));
        if (wBuild > 0.01) {
          postRy = postRy * (1 - wBuild) + -0.28 * wBuild;
          postRx = postRx * (1 - wBuild) + 0.22 * wBuild;
        }
        if (wDetail > 0.01) {
          postRy = postRy * (1 - wDetail) + -0.16 * wDetail;
          postRx = postRx * (1 - wDetail) + 0.20 * wDetail;
        }

        // Beat 6: FAQ & CTA
        const wFaq = smooth(sectionRange(pFaq, 0.1, 0.7));
        const wCta = smooth(sectionRange(pCta, 0.1, 0.7));
        if (wFaq > 0.01 || wCta > 0.01) {
          const wEnd = Math.max(wFaq, wCta);
          postX = compact ? 0.04 : 1.62;
          postY = compact ? -0.55 : -0.08;
          postS = compact ? 0.45 : 0.80;
          postRy = postRy * (1 - wEnd) + -0.20 * wEnd;
        }

        targetX = targetX * (1 - wAfter) + postX * wAfter;
        targetY = targetY * (1 - wAfter) + postY * wAfter;
        targetZ = targetZ * (1 - wAfter) + postZ * wAfter;
        targetS = targetS * (1 - wAfter) + postS * wAfter;
        targetRx = targetRx * (1 - wAfter) + postRx * wAfter;
        targetRy = targetRy * (1 - wAfter) + postRy * wAfter;
      }

      L.x = damp(L.x, targetX, 5.5, delta);
      L.y = damp(L.y, targetY - (1 - intro) * 0.45, 5.5, delta);
      L.z = damp(L.z, targetZ, 5.5, delta);
      L.s = damp(L.s, targetS * (0.9 + 0.1 * intro), 5.5, delta);
      L.rx = damp(L.rx, targetRx - pointer.y * 0.035, 4, delta);
      L.ry = damp(L.ry, targetRy + pointer.x * 0.10, 4, delta);
    } else {
      // Reduced motion: static finished hero composition
      L.x = compact ? 0.04 : 1.45;
      L.y = compact ? -0.78 : -0.14;
      L.z = compact ? -0.50 : 0.30;
      L.s = compact ? 0.48 : 0.88;
      L.rx = 0.25;
      L.ry = -0.20;
    }

    if (rig.current) {
      rig.current.position.set(L.x, L.y, L.z);
      rig.current.scale.setScalar(L.s);
    }
    if (view.current) {
      view.current.rotation.x = L.rx;
      view.current.rotation.y = L.ry;
    }

    // -------------------------------------------------------------------------
    // 2. TRAIN THROTTLE & BANKING PHYSICS ON THE CAJON PASS TRACK
    // -------------------------------------------------------------------------
    const { railLut, highwayLut } = railData;
    const trainLen = CARS * (CAR_LEN + CAR_GAP);
    const span = trainLen / railLut.length;

    let targetTrainD = 0.62;
    if (anim) {
      if (stage.focus > 0.05) {
        // Inside the moment dwell: scroll scrubs the train from the depot yard up through Cajon Pass
        const momentD = span + 0.05 + smooth(stage.t) * (0.96 - span - 0.05);
        const idleD = 0.58 + Math.sin(el * 0.28) * 0.11;
        targetTrainD = idleD * (1 - stage.focus) + momentD * stage.focus;
      } else {
        // Outside the moment dwell: steady scenic cruise past the Santa Fe Depot & horseshoe trestle
        targetTrainD = 0.58 + Math.sin(el * 0.28) * 0.12;
      }
      L.trainD = damp(L.trainD, targetTrainD, 5, delta);
    } else {
      L.trainD = 0.62;
    }

    for (let i = 0; i < CARS; i++) {
      const cg = carGroups.current[i];
      if (!cg) continue;
      const u = L.trainD - (i * (CAR_LEN + CAR_GAP) + CAR_LEN * 0.5) / railLut.length;
      railLut.sample(u, _p, _t);
      railLut.sample(Math.min(1, u + 0.012), _p2, _t2);
      _n.crossVectors(_t, _t2);
      const bank = Math.max(-0.18, Math.min(0.18, _n.y * 6));
      _m.lookAt(_p, _p2.copy(_p).add(_t), _up);
      _q.setFromRotationMatrix(_m);
      _roll.setFromAxisAngle(_zAxis, -bank);
      _q.multiply(_roll);
      cg.position.set(_p.x, _p.y + 0.006, _p.z);
      cg.quaternion.copy(_q);
      const vis =
        Math.min(Math.max((u + 0.01) * 40, 0), 1) *
        Math.min(Math.max((1.0 - u) * 40, 0), 1);
      cg.scale.setScalar(Math.max(vis * intro, 0.001));

      if (i === 0 && lamp.current) {
        lamp.current.position.copy(cg.position);
        lamp.current.quaternion.copy(cg.quaternion);
        lamp.current.translateY(0.084);
        lamp.current.translateZ(-0.22);
        lamp.current.scale.setScalar(Math.max(vis * intro, 0.001));
      }
    }

    // -------------------------------------------------------------------------
    // 3. CATO THE ROBOT — ROUTE 66 PROMENADE & SCROLL BEATS
    // -------------------------------------------------------------------------
    const core = catoBody.current?.core;
    const cato = catoGroup.current;
    if (core && cato) {
      let wantU = 0.72; // By default right next to the U.S. Route 66 Shield Monument
      let wantRotY = 0.18; // Facing viewer & slightly toward the train
      let wantMove = 'wave';
      let useScrubWalk = false;

      if (!anim) {
        wantU = 0.72;
        wantRotY = 0.15;
        wantMove = 'wave';
      } else if (stage.focus > 0.25) {
        // Moment dwell: Cato walks briskly along Route 66 beside the climbing train!
        wantU = 0.28 + smooth(stage.t) * 0.48;
        if (stage.t < 0.84) {
          useScrubWalk = true;
          wantRotY = 1.32; // Facing along the Route 66 ribbon toward the pass
        } else {
          wantMove = 'cheer';
          wantRotY = 0.12;
        }
      } else if (pStats > 0.22 && pStats < 0.78 && stage.into < 0.2) {
        // Stats beat: Cato scans the intermodal freight yard & double-stack containers
        wantU = 0.56;
        wantRotY = -0.35;
        wantMove = 'scan';
      } else if (pAngles > 0.22 && pAngles < 0.78) {
        // Angles beat: surveying the Inland Empire crossroads
        wantU = 0.64;
        wantRotY = -0.15;
        wantMove = 'scan';
      } else if (pFeature > 0.2 && pFeature < 0.82) {
        // Feature beat: active robot showcase
        wantU = 0.70;
        wantRotY = 0.22;
        wantMove = 'robot';
      } else if (pBuild > 0.2 && pBuild < 0.8) {
        wantU = 0.66;
        wantRotY = 0.08;
        wantMove = 'cheer';
      } else if (pFaq > 0.2 && pFaq < 0.8) {
        wantU = 0.72;
        wantRotY = 0.15;
        wantMove = 'bow';
      } else {
        // Hero, Detail, CTA: Cato waves warmly beside the Route 66 Highway Shield
        wantU = 0.72;
        wantRotY = 0.18;
        wantMove = 'wave';
      }

      L.catoU = anim ? damp(L.catoU, wantU, 4.5, delta) : wantU;
      L.catoRotY = anim ? damp(L.catoRotY, wantRotY, 6, delta) : wantRotY;

      highwayLut.sample(L.catoU, _p, _t);
      _side.crossVectors(_t, _up).normalize();
      // Stand on the foreground promenade shoulder of Route 66 (clear of the rail track)
      cato.position.set(
        _p.x + _side.x * 0.14,
        _p.y + 0.004,
        _p.z + _side.z * 0.14,
      );
      cato.rotation.y = L.catoRotY;
      const catoScale = (compact ? 0.46 : 0.42) * Math.max(intro, 0.01);
      cato.scale.setScalar(catoScale);

      if (useScrubWalk && anim) {
        core.scrub('walk', stage.t * 5.5);
        L.scrubbing = true;
        L.pose = '__scrub_walk__';
      } else {
        if (L.scrubbing) {
          core.release();
          L.scrubbing = false;
        }
        if (L.pose !== wantMove) {
          core.play(wantMove);
          L.pose = wantMove;
        }
      }
    }

    if (arrowBeacon.current) {
      report(arrowBeacon.current, state.camera, 0.55 + 0.35 * stage.focus);
    }

    // Camera subtle parallax + moment dolly & detail/cta handoff
    const camZ = anim ? 9.06 - 0.48 * stage.focus + 0.12 * smooth(sectionRange(pCta, 0.05, 0.8)) : 9.0;
    const camY = anim ? 0.22 + pointer.y * 0.14 + 0.12 * stage.focus : 0.22;
    _cam.set(
      anim ? pointer.x * 0.22 : 0,
      camY,
      camZ,
    );
    _look.set(0, -0.06 + 0.06 * stage.focus, 0);
    state.camera.position.lerp(_cam, 0.06);
    state.camera.lookAt(_look);
  });

  return (
    <>
      <SceneLightRig />
      <group ref={rig}>
        <group ref={view}>
          {/* Soft contact shadow beneath the diorama */}
          <mesh position={[0, -0.83, 0]} rotation-x={-Math.PI / 2} material={mats.shadow}>
            <planeGeometry args={[6.4, 5.2]} />
          </mesh>

          {/* 1. Architectural Vitrine Plinth & Survey Grid */}
          <mesh geometry={railData.plinthGeo} material={mats.plinth} />
          <lineSegments geometry={railData.plinthLinesGeo} material={mats.plinthLines} />

          {/* 2. San Bernardino Mountains, Cajon Pass & The Natural Arrowhead Landmark */}
          <mesh geometry={mountainData.mountainGeo}>
            <GlassMaterial kind="ice" />
          </mesh>
          <lineSegments geometry={mountainData.contourLinesGeo} material={mats.contourLines} />
          <mesh geometry={mountainData.arrowheadCrystalGeo}>
            <GlassMaterial kind="prism" emissive="#2e4bff" emissiveIntensity={0.42} />
          </mesh>
          <mesh geometry={mountainData.arrowheadCoreGeo} material={mats.arrowCore} />
          <lineSegments geometry={mountainData.arrowheadRimLinesGeo} material={mats.arrowRimLines} />
          <object3D ref={arrowBeacon} position={[0.85, 0.72, -1.25]} />

          {/* 3. Historic 1918 Santa Fe Depot, Intermodal Gantry & U.S. Route 66 Shield */}
          <mesh geometry={depotData.depotWallsGeo} material={mats.porcelain} />
          <mesh geometry={depotData.depotRoofsGeo}>
            <GlassMaterial kind="azure" />
          </mesh>
          <mesh geometry={depotData.depotAccentGeo}>
            <GlassMaterial kind="core" emissive="#2e4bff" emissiveIntensity={0.22} />
          </mesh>
          <mesh geometry={depotData.depotGlowGeo} material={mats.glow} />
          <lineSegments geometry={depotData.depotLinesGeo} material={mats.depotLines} />

          {/* 4. Winding Rail Roadbed, Cajon Pass Steel-Truss Trestle & Route 66 Ribbon */}
          <mesh geometry={railData.roadbedGeo} material={mats.roadbed} />
          <lineSegments geometry={railData.railsAndTrestleGeo} material={mats.railLines} />
          <lineSegments geometry={railData.highwayDashGeo} material={mats.hwyLines} />
          <instancedMesh ref={sleepers} args={[undefined, undefined, SLEEPERS]} material={mats.sleeper}>
            <boxGeometry args={[0.16, 0.008, 0.022]} />
          </instancedMesh>

          {/* 5. Crafted 7-Car Freight & Double-Stack Intermodal Train */}
          {Array.from({ length: CARS }, (_, i) => (
            <group
              key={i}
              ref={(g: THREE.Group | null) => {
                carGroups.current[i] = g;
              }}
            >
              {i === 0 ? (
                <>
                  <mesh geometry={railData.locoBodyGeo}>
                    <GlassMaterial kind="deep" emissive="#2e4bff" emissiveIntensity={0.35} />
                  </mesh>
                  <mesh geometry={railData.locoGlowGeo} material={mats.lamp} />
                  <lineSegments geometry={railData.locoLinesGeo} material={mats.carLines} />
                </>
              ) : (
                <>
                  <mesh geometry={railData.carLowerGeo}>
                    <GlassMaterial kind={LOWER_KINDS[i]} emissive="#2e4bff" emissiveIntensity={0.08} />
                  </mesh>
                  <mesh geometry={railData.carUpperGeo}>
                    <GlassMaterial kind={UPPER_KINDS[i]} emissive="#2e4bff" emissiveIntensity={0.06} />
                  </mesh>
                  <lineSegments geometry={railData.carLinesGeo} material={mats.carLines} />
                </>
              )}
            </group>
          ))}
          <mesh ref={lamp} material={mats.lamp}>
            <sphereGeometry args={[0.028, 14, 10]} />
          </mesh>

          {/* 6. Cato the Robot on Historic Route 66 */}
          <group ref={catoGroup} position={[1.05, -0.66, 0.88]} scale={0.42}>
            <CatoBody ref={catoBody} paused={!q.animate} />
          </group>
        </group>
      </group>
      <ParticleField count={Math.floor(750 * q.particles)} drift={q.animate ? 0.07 : 0} opacity={0.2} />
    </>
  );
}
