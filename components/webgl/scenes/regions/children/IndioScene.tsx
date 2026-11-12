'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { useQuality } from '../../../lib/quality';
import { getSectionProgress, pointer, sectionRange, smooth } from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import CatoBody, { type CatoBodyHandle } from '../../../kit/cato/CatoBody';
import { createStageState, damp, readStage } from '../lib-a/dwell';
import EmpirePlinth, { type EmpirePlinthHandle } from './indio/EmpirePlinth';
import FestivalWheel, { type FestivalWheelHandle } from './indio/FestivalWheel';
import FestivalStage, { type FestivalStageHandle } from './indio/FestivalStage';
import DatePalmGrove, { type DatePalmGroveHandle } from './indio/DatePalmGrove';

/**
 * IndioScene — "The City of Festivals: Empire Polo Grounds & Date Palm Grove".
 *
 * A crafted glass-and-porcelain architectural miniature of Indio's signature
 * landmarks:
 *   1. The Grand Glass Ferris Wheel above the Empire Polo Club lawns, with
 *      3D A-frame support towers, boarding deck, 12 swinging passenger
 *      gondolas, and 72 rim/star chase bulbs.
 *   2. The Festival Main Stage Pavilion with three sweeping parabolic glass
 *      arches, space-frame truss lattice, line-array speaker towers, 24-bar
 *      curved LED equalizer wall, and 7 volumetric sweeping stage light beams.
 *   3. Cato the Robot on the forestage deck behind his turntables & VU-meter
 *      DJ booth ('dj' move), scratching records and dropping the beat.
 *   4. A sculpted Medjool Date Palm Grove (Phoenix dactylifera) with diamond-
 *      faceted trunks, arching pinnate fronds, and glowing sapphire date
 *      clusters — referencing Indio's National Date Festival & east-valley
 *      agricultural heritage — backed by the faceted Coachella Valley mountains.
 */

const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();

export default function IndioScene() {
  const q = useQuality();
  const rig = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const catoGroup = useRef<THREE.Group>(null);
  const bodyRef = useRef<CatoBodyHandle>(null);
  const plinthRef = useRef<EmpirePlinthHandle>(null);
  const wheelRef = useRef<FestivalWheelHandle>(null);
  const stageRef = useRef<FestivalStageHandle>(null);
  const groveRef = useRef<DatePalmGroveHandle>(null);

  const stage = useMemo(createStageState, []);
  const report = useHotspotReporter('indio-skyline');

  const live = useRef({
    init: false,
    mode: '',
    angle: 0,
    prevVel: 0,
    swing: 0,
    swingV: 0,
    rx: 0.08,
    ry: -0.28,
    x: 1.55,
    y: 0.05,
    z: 0.25,
    s: 0.78,
  });

  useFrame((state, delta) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const compact = q.compact;
    const dt = Math.min(delta, 1 / 30);
    const L = live.current;

    // Initialize Cato's DJ booth & lock Cato's internal scene palette to Cato blue-only
    const core = bodyRef.current?.core;
    if (core) {
      if (!L.init) {
        L.init = true;
        const sc = core.lights?.scene as Record<string, unknown> | undefined;
        if (sc) {
          Object.defineProperty(sc, 'ledA', {
            get: () => 'rgb(147,169,255)',
            set: () => {},
            configurable: true,
          });
          Object.defineProperty(sc, 'ledB', {
            get: () => 'rgb(46,75,255)',
            set: () => {},
            configurable: true,
          });
          Object.defineProperty(sc, 'light', {
            get: () => 'desk',
            set: () => {},
            configurable: true,
          });
        }
        // Recolor the DJ booth body ('#22252C' / '#121418') to deep Cato sapphire blue
        catoGroup.current?.traverse((obj) => {
          const mat = (obj as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
          const uC = mat?.uniforms?.uC?.value as THREE.Vector3 | undefined;
          if (!uC) return;
          if (Math.abs(uC.x - 0.0119) < 0.0025 && Math.abs(uC.z - 0.021) < 0.003) {
            uC.set(0.055, 0.135, 0.58);
          } else if (Math.abs(uC.x - 0.003) < 0.0015 && Math.abs(uC.z - 0.0056) < 0.002) {
            uC.set(0.028, 0.072, 0.36);
          }
        });
      }
      const wantMode = anim ? 'play:dj' : 'scrub:dj';
      if (L.mode !== wantMode) {
        L.mode = wantMode;
        if (anim) {
          core.release();
          core.play('dj');
        } else {
          core.scrub('dj', 2.4);
        }
      }
    }

    // Read scroll sections for multi-beat choreography across the whole page
    readStage(stage, q);
    const pStats = smooth(sectionRange(getSectionProgress('stats'), 0.05, 0.85));
    const pAngles = smooth(sectionRange(getSectionProgress('angles'), 0.05, 0.9));
    const pFeature = smooth(sectionRange(getSectionProgress('feature'), 0.05, 0.9));
    const pBuild = smooth(sectionRange(getSectionProgress('build'), 0.05, 0.9));
    const pDetail = smooth(sectionRange(getSectionProgress('detail'), 0.05, 0.9));
    const pEnd = smooth(sectionRange(getSectionProgress('faq'), 0.0, 1.0));

    const intro = anim ? smooth(Math.min(el / 1.6, 1)) : 1;
    const into = stage.into;
    const out = stage.out;
    const t = stage.t;

    // Compute target diorama pose per scroll beat (never vanishes after `moment`)
    let tx: number;
    let ty: number;
    let tz: number;
    let ts: number;
    let tryYaw: number;
    let trxPitch: number;

    if (compact) {
      // Mobile / portrait choreography: tucked into the lower stage on hero & post-moment,
      // rising to center stage during the pinned `moment` dwell.
      const heroX = 0.04;
      const heroY = -1.16;
      const heroZ = -0.45;
      const heroS = 0.39;

      const momX = 0.04;
      const momY = 0.02;
      const momZ = 0.25;
      const momS = 0.48;

      const postX = 0.05 - 0.06 * pFeature;
      const postY = -1.24 + 0.12 * pDetail;
      const postZ = -0.55;
      const postS = 0.36;

      const preX = heroX + (momX - heroX) * into;
      const preY = heroY + (momY - heroY) * into;
      const preZ = heroZ + (momZ - heroZ) * into;
      const preS = heroS + (momS - heroS) * into;

      tx = preX + (postX - preX) * out;
      ty = preY + (postY - preY) * out;
      tz = preZ + (postZ - preZ) * out;
      ts = preS + (postS - preS) * out;
      tryYaw = -0.22 + into * (0.34 * smooth(t) - 0.12) + out * (0.38 * pAngles - 0.25 * pDetail);
      trxPitch = 0.10 + 0.04 * pFeature;
    } else {
      // Desktop choreography:
      // 1. Hero + Stats: Right-hand showcase beside the hero headline & 3-stat row
      const heroX = 2.02 - 0.06 * pStats;
      const heroY = -0.14 + 0.18 * pStats;
      const heroZ = 0.18 + 0.14 * pStats;
      const heroS = 0.72 + 0.03 * pStats;

      // 2. Moment dwell: Centered full-stage festival diorama
      const momX = 0.06;
      const momY = 0.04;
      const momZ = 1.12;
      const momS = 0.95;

      // 3. Post-moment beats (angles -> feature -> build -> detail -> faq/cta):
      //    Occupies the dedicated right-hand stage column (x ~ 2.04..2.14) while
      //    the editorial copy occupies the left 47% column.
      const postX = 2.06 + 0.08 * pFeature - 0.04 * pBuild + 0.06 * pDetail + 0.18 * pEnd;
      const postY = -0.06 + 0.18 * pFeature - 0.12 * pBuild + 0.14 * pEnd;
      const postZ = 0.22 - 0.30 * pFeature + 0.20 * pDetail;
      const postS = 0.72 - 0.03 * pFeature + 0.03 * pDetail - 0.06 * pEnd;

      const preX = heroX + (momX - heroX) * into;
      const preY = heroY + (momY - heroY) * into;
      const preZ = heroZ + (momZ - heroZ) * into;
      const preS = heroS + (momS - heroS) * into;

      tx = preX + (postX - preX) * out;
      ty = preY + (postY - preY) * out - (1 - intro) * 0.45;
      tz = preZ + (postZ - preZ) * out;
      ts = (preS + (postS - preS) * out) * (0.92 + 0.08 * intro);

      const momSweep = -0.34 + smooth(t) * 0.48;
      const preYaw = -0.26 * (1 - into) + momSweep * into;
      const postYaw = 0.22 - 0.48 * pFeature + 0.18 * pBuild - 0.24 * pDetail;
      tryYaw = preYaw + (postYaw - preYaw) * out + (anim ? pointer.x * 0.16 : 0);
      trxPitch = 0.08 + 0.08 * pFeature - 0.04 * pDetail + (anim ? -pointer.y * 0.04 : 0);
    }

    if (!anim) {
      L.x = compact ? 0.04 : 2.02;
      L.y = compact ? -1.16 : -0.12;
      L.z = compact ? -0.45 : 0.20;
      L.s = compact ? 0.39 : 0.72;
      L.ry = -0.26;
      L.rx = 0.09;
    } else {
      L.x = damp(L.x, tx, 5.5, dt);
      L.y = damp(L.y, ty, 5.5, dt);
      L.z = damp(L.z, tz, 5.5, dt);
      L.s = damp(L.s, ts, 5.5, dt);
      L.ry = damp(L.ry, tryYaw, 4.2, dt);
      L.rx = damp(L.rx, trxPitch, 4.2, dt);
    }

    if (rig.current) {
      rig.current.position.set(L.x, L.y, L.z);
      rig.current.scale.setScalar(L.s);
    }
    if (tilt.current) {
      tilt.current.rotation.y = L.ry;
      tilt.current.rotation.x = L.rx;
    }

    // Wheel rotation: continuous slow festival turn + full revolution across the moment dwell
    const scrollTurn =
      into * (-smooth(t) * Math.PI * 2) -
      pStats * 0.65 -
      out * (pAngles * 1.4 + pFeature * 1.2 + pBuild * 1.2 + pDetail * 1.4);
    const targetAngle = anim ? scrollTurn - el * 0.22 : -Math.PI * 0.65;
    const prevAngle = L.angle;
    L.angle = anim ? damp(L.angle, targetAngle, 3.6, dt) : targetAngle;
    const vel = dt > 0 ? (L.angle - prevAngle) / dt : 0;
    const acc = dt > 0 ? (vel - L.prevVel) / dt : 0;
    L.prevVel = vel;

    // Gondola pendulum swing driven by angular acceleration
    if (anim) {
      const force = -acc * 0.055 - L.swing * 9.2 - L.swingV * 2.3;
      L.swingV += force * dt;
      L.swing += L.swingV * dt;
      L.swing = Math.max(-0.48, Math.min(0.48, L.swing));
    } else {
      L.swing = 0;
    }

    // Synchronize beat clock with Cato's 124 BPM DJ engine
    const sceneBeat = (core?.lights?.scene as { beat?: number; beatPulse?: number } | undefined);
    const beat = anim ? (sceneBeat?.beat ?? (el * 124) / 60) : 1.0;
    const beatPulse = anim
      ? (sceneBeat?.beatPulse ?? Math.pow(1 - (beat % 1), 3))
      : 0.65;

    const reveal = anim ? Math.min(1, 0.45 + pStats * 0.35 + into * 0.5) : 1;

    // Update sub-assemblies (zero React re-renders, direct GPU buffer updates)
    plinthRef.current?.update(el, beat, beatPulse, reveal, anim);
    wheelRef.current?.update(L.angle, L.swing, beat, beatPulse, anim);
    stageRef.current?.update(el, beat, beatPulse, stage.focus, anim);
    groveRef.current?.update(el, beatPulse, anim);

    const hub = wheelRef.current?.hubMesh;
    if (hub) {
      report(hub, state.camera, 0.55 + 0.35 * stage.focus);
    }

    // Subtle camera parallax + smooth moment dolly & detail/cta handoff
    const camZ = anim ? 9.06 - 0.50 * stage.focus + 0.12 * pEnd : 9.0;
    const camY = anim ? pointer.y * 0.14 + 0.08 + 0.10 * stage.focus : 0.08;
    _cam.set(anim ? pointer.x * 0.24 : 0, camY, camZ);
    state.camera.position.lerp(_cam, 0.06);
    _look.set(0, -0.06 + 0.05 * stage.focus, 0);
    state.camera.lookAt(_look);
  });

  return (
    <>
      <SceneLightRig />
      <group ref={rig}>
        <group ref={tilt}>
          {/* 1. Empire Polo Club Plinth, Mountain Ridge, Promenade Lanterns & Bass Rings */}
          <EmpirePlinth ref={plinthRef} />

          {/* 2. Grand Glass Ferris Wheel Miniature (left-back of polo lawn) */}
          <FestivalWheel ref={wheelRef} position={[-1.08, 0.22, -0.38]} />

          {/* 3. Main Festival Stage Pavilion, Light Beams & Cato DJing on the Forestage */}
          <FestivalStage ref={stageRef} position={[0.88, -1.325, 0.28]} rotationY={-0.22}>
            <group ref={catoGroup} position={[0, 0, 0.04]} scale={0.66}>
              <CatoBody ref={bodyRef} paused={!q.animate} />
            </group>
          </FestivalStage>

          {/* 4. Medjool Date Palm Grove (Indio = Date Capital / National Date Festival) */}
          <DatePalmGrove ref={groveRef} />
        </group>
      </group>

      {/* Evening desert dust & festival light motes */}
      <ParticleField
        count={Math.floor(1100 * q.particles)}
        spread={[10, 3.2, 5]}
        position={[0, -2.0, -0.8]}
        drift={q.animate ? 0.1 : 0}
        opacity={0.26}
        colorB="#c9d4ff"
      />
      <ParticleField
        count={Math.floor(450 * q.particles)}
        drift={q.animate ? 0.07 : 0}
        opacity={0.18}
      />
    </>
  );
}
