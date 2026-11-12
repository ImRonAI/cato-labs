'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import { getSectionProgress, pointer, sectionRange, smooth } from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import CatoBody, { type CatoBodyHandle } from '../../../kit/cato/CatoBody';
import { createStageState, damp, readStage } from '../lib-a/dwell';
import { contactShadowTexture } from '../lib-a/place';
import {
  buildPalmDesertGeometries,
  greenHeightAt,
} from './palm-desert/geometries';
import { createPalmDesertMaterials } from './palm-desert/materials';

/**
 * PalmDesertScene — "Mountain Dawn → El Paseo → The Club".
 *
 * A crafted porcelain-and-glass architectural miniature of Palm Desert:
 * - Backdrop: the faceted Santa Rosa Mountains (West Ridge, Dawn Saddle, Toro Peak)
 *   with topographic elevation contours and a rising prism-glass dawn sun halo.
 * - Mid-ground: El Paseo luxury shopping corridor — three Desert Modern storefronts
 *   (cantilevered brise-soleil gallery, two-story colonnade flagship, butterfly-roof
 *   boutique) with crystal glass vitrines and a divided boulevard framed by
 *   California Fan Palms (Washingtonia filifera), desert agave rosettes, and barrel cacti.
 * - Foreground-east: a contoured Country Club golf green with sand bunker, shimmering
 *   water pond, putting cup, tall blue flagstick & pennant, and a rolling golf ball.
 * - Cato the Robot: greets at mountain dawn, strolls down El Paseo as the boutique
 *   vitrines illuminate, then steps onto the golf green and celebrates as the putt drops.
 */

const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();

export default function PalmDesertScene() {
  const q = useQuality();
  const rig = useRef<THREE.Group>(null);
  const sunGroup = useRef<THREE.Group>(null);
  const storefrontsGroup = useRef<THREE.Group>(null);
  const flagPennantRef = useRef<THREE.Mesh>(null);
  const golfBallRef = useRef<THREE.Mesh>(null);
  const rippleRingRef = useRef<THREE.Mesh>(null);
  const hotspotAnchor = useRef<THREE.Group>(null);

  const catoGroup = useRef<THREE.Group>(null);
  const catoUnHeading = useRef<THREE.Group>(null);
  const catoUnPos = useRef<THREE.Group>(null);
  const catoBody = useRef<CatoBodyHandle>(null);
  const catoModeRef = useRef<string>('');

  const stage = useMemo(createStageState, []);
  const reportHotspot = useHotspotReporter('pd-skyline');

  const geos = useMemo(() => buildPalmDesertGeometries(q.compact), [q.compact]);
  const mats = useMemo(() => createPalmDesertMaterials(), []);
  const shadowMap = useMemo(
    () => (typeof document === 'undefined' ? null : contactShadowTexture()),
    [],
  );

  useEffect(() => {
    return () => {
      geos.dispose();
      mats.dispose();
    };
  }, [geos, mats]);

  const cupY = useMemo(() => greenHeightAt(1.88, 0.38), []);

  useFrame((state, delta) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    readStage(stage, q);

    // Read all page section progresses transiently
    const pStats = getSectionProgress('stats');
    const pAngles = getSectionProgress('angles');
    const pFeature = getSectionProgress('feature');
    const pBuild = getSectionProgress('build');
    const pDetail = getSectionProgress('detail');
    const pFaq = getSectionProgress('faq');
    const pCta = getSectionProgress('cta');

    // Mount intro (0 -> 1 over 1.4s)
    const intro = anim ? smooth(Math.min(el / 1.4, 1)) : 1;

    // ------------------------------------------------------------------
    // Beat progression weights:
    //   Beat 1 (Mountain Dawn) : hero -> stats (before moment dwell)
    //   Beat 2 (El Paseo)      : moment dwell (stage.into -> stage.t)
    //   Beat 3 (The Club)      : angles -> feature -> build -> detail -> faq -> cta
    // ------------------------------------------------------------------
    const dwellIn = anim ? stage.into : 0;
    const dwellT = anim ? stage.t : 1;
    const dwellOut = anim ? stage.out : 0;

    // Club beat activates as moment unpins and angles/feature enter
    const clubBeat = anim
      ? smooth(
          Math.max(
            dwellOut,
            sectionRange(pAngles, 0.12, 0.6),
            sectionRange(pFeature, 0.05, 0.5),
          ),
        )
      : 0.65;

    // Putt progress across the green during angles -> feature -> build
    const puttRaw = anim
      ? Math.max(
          sectionRange(pAngles, 0.25, 0.85),
          sectionRange(pFeature, 0.05, 0.6),
          pBuild > 0.05 ? 1 : 0,
        )
      : 1;
    const puttP = smooth(puttRaw);

    // ------------------------------------------------------------------
    // 1. STAGE PLACEMENT & CAMERA CHOREOGRAPHY
    // ------------------------------------------------------------------
    if (rig.current) {
      if (!anim) {
        // Reduced motion: composed static tableau
        if (q.compact) {
          rig.current.position.set(0, -1.05, -0.2);
          rig.current.scale.setScalar(0.54);
          rig.current.rotation.set(0.24, -0.26, 0);
        } else {
          rig.current.position.set(1.75, -0.68, 0.2);
          rig.current.scale.setScalar(0.84);
          rig.current.rotation.set(0.22, -0.28, 0);
        }
      } else if (q.compact) {
        // Mobile portrait: below hero copy -> centered in moment -> lower-center in club beat
        const heroX = 0.0;
        const heroY = -1.28;
        const heroZ = -0.35;
        const heroS = 0.52;

        const midX = 0.0;
        const midY = -0.34;
        const midZ = 0.18;
        const midS = 0.62;

        const clubX = -0.16;
        const clubY = -0.92;
        const clubZ = -0.15;
        const clubS = 0.54;

        const inCenter = dwellIn * (1 - dwellOut);
        const tx = heroX * (1 - dwellIn) + midX * inCenter + clubX * dwellOut;
        const ty =
          heroY * (1 - dwellIn) +
          midY * inCenter +
          clubY * dwellOut -
          (1 - intro) * 0.45;
        const tz = heroZ * (1 - dwellIn) + midZ * inCenter + clubZ * dwellOut;
        const ts =
          (heroS * (1 - dwellIn) + midS * inCenter + clubS * dwellOut) *
          (0.9 + 0.1 * intro);

        rig.current.position.x = damp(rig.current.position.x, tx, 8, delta);
        rig.current.position.y = damp(rig.current.position.y, ty, 8, delta);
        rig.current.position.z = damp(rig.current.position.z, tz, 8, delta);
        rig.current.scale.setScalar(damp(rig.current.scale.x, ts, 8, delta));
        rig.current.rotation.x = damp(
          rig.current.rotation.x,
          0.24 + 0.04 * inCenter,
          6,
          delta,
        );
        rig.current.rotation.y = damp(
          rig.current.rotation.y,
          -0.24 + 0.12 * inCenter - 0.18 * clubBeat,
          6,
          delta,
        );
      } else {
        // Desktop:
        // Beat 1 (Hero/Stats): Lower-right so h1 & lede copy are 100% clear
        // Beat 2 (Moment dwell): Glides to centre-stage for the El Paseo showcase
        // Beat 3 (Angles/Feature/Build/Detail): Pivots on the right half to feature the Golf Green & Cato
        const inCenter = dwellIn * (1 - dwellOut);
        const afterDwell = dwellOut;

        const statsLift = smooth(sectionRange(pStats, 0.15, 0.75)) * (1 - dwellIn);
        const outroShift = smooth(
          Math.max(sectionRange(pFaq, 0.2, 0.8), sectionRange(pCta, 0.1, 0.7)),
        );

        const heroX = 1.86 - 0.35 * statsLift;
        const heroY = -0.78 + 0.28 * statsLift;
        const heroZ = 0.18;
        const heroS = 0.82 + 0.06 * statsLift;

        const centerX = 0.06 - (dwellT - 0.5) * 0.24;
        const centerY = -0.42;
        const centerZ = 0.68;
        const centerS = 1.05;

        const clubX = 1.48 - 0.22 * outroShift;
        const clubY = -0.48 + 0.08 * outroShift;
        const clubZ = 0.35;
        const clubS = 0.88;

        const tx = heroX * (1 - dwellIn) + centerX * inCenter + clubX * afterDwell;
        const ty =
          heroY * (1 - dwellIn) +
          centerY * inCenter +
          clubY * afterDwell -
          (1 - intro) * 0.5;
        const tz = heroZ * (1 - dwellIn) + centerZ * inCenter + clubZ * afterDwell;
        const ts =
          (heroS * (1 - dwellIn) + centerS * inCenter + clubS * afterDwell) *
          (0.9 + 0.1 * intro);

        const targetRotX =
          0.21 + 0.04 * inCenter + 0.03 * clubBeat + pointer.y * 0.025;
        const targetRotY =
          -0.28 * (1 - dwellIn) +
          (-0.14 + (dwellT - 0.5) * 0.16) * inCenter +
          (-0.4 + 0.08 * outroShift) * afterDwell +
          pointer.x * 0.045;

        rig.current.position.x = damp(rig.current.position.x, tx, 8, delta);
        rig.current.position.y = damp(rig.current.position.y, ty, 8, delta);
        rig.current.position.z = damp(rig.current.position.z, tz, 8, delta);
        rig.current.scale.setScalar(damp(rig.current.scale.x, ts, 8, delta));
        rig.current.rotation.x = damp(rig.current.rotation.x, targetRotX, 6, delta);
        rig.current.rotation.y = damp(rig.current.rotation.y, targetRotY, 6, delta);
      }
    }

    // ------------------------------------------------------------------
    // 2. BEAT 1 — MOUNTAIN DAWN (Sun rise & Santa Rosa ridge illumination)
    // ------------------------------------------------------------------
    const dawnProgress = anim
      ? smooth(
          Math.min(
            1,
            0.38 + pStats * 0.5 + dwellIn * 0.45 + Math.min(el / 3.0, 0.35),
          ),
        )
      : 1;
    mats.mountainsMat.uniforms.uDawn.value = dawnProgress;
    mats.mountainsMat.uniforms.uOpacity.value = intro;
    mats.floraMat.uniforms.uTime.value = anim ? el : 0;
    mats.floraMat.uniforms.uOpacity.value = intro;

    if (sunGroup.current) {
      const sunY = 0.88 + 0.52 * dawnProgress;
      sunGroup.current.position.set(-0.14, sunY, -1.42);
      const sunScale = (0.82 + 0.2 * dawnProgress) * intro;
      sunGroup.current.scale.setScalar(sunScale);
      sunGroup.current.rotation.z = anim ? el * 0.04 : 0;
    }

    // ------------------------------------------------------------------
    // 3. BEAT 2 — EL PASEO STOREFRONTS & BOUTIQUE VITRINE SWEEP
    // ------------------------------------------------------------------
    const sweepProgress = anim
      ? Math.max(0.45, dwellIn * 0.65 + dwellT * 0.85, clubBeat * 1.2)
      : 1.2;
    mats.storefrontGlowMat.uniforms.uSweep.value = sweepProgress;
    mats.storefrontGlowMat.uniforms.uOpacity.value = intro;

    if (storefrontsGroup.current) {
      const extrudeY = anim
        ? 0.88 + 0.12 * Math.max(intro * 0.7, dwellIn, clubBeat)
        : 1;
      storefrontsGroup.current.scale.y = damp(
        storefrontsGroup.current.scale.y,
        extrudeY,
        8,
        delta,
      );
    }

    // ------------------------------------------------------------------
    // 4. BEAT 3 — THE CLUB (Golf ball putt, flag flutter, celebration ring)
    // ------------------------------------------------------------------
    if (flagPennantRef.current) {
      flagPennantRef.current.rotation.y = anim
        ? 0.25 + Math.sin(el * 3.2) * 0.16 + 0.15 * clubBeat
        : 0.28;
    }

    if (golfBallRef.current) {
      const bx = 1.12 + (1.88 - 1.12) * puttP;
      const bz = 0.72 + (0.38 - 0.72) * puttP - 0.14 * Math.sin(Math.PI * puttP);
      const by =
        greenHeightAt(bx, bz) +
        0.048 * (1 - 0.55 * smooth(sectionRange(puttP, 0.88, 1.0)));
      golfBallRef.current.position.set(bx, by, bz);
    }

    const cupEntered = puttP > 0.7 || clubBeat > 0.4;
    const pulseVal = anim ? (cupEntered ? (el * 0.55) % 1 : 0) : 0.42;
    mats.golfGreenMat.uniforms.uPulse.value = pulseVal;
    mats.golfGreenMat.uniforms.uOpacity.value = intro;

    if (rippleRingRef.current) {
      if (cupEntered) {
        rippleRingRef.current.visible = true;
        const rScale = 0.15 + pulseVal * 0.85;
        rippleRingRef.current.scale.set(rScale, rScale, 1);
        mats.rippleRingMat.opacity = (1 - pulseVal) * 0.65 * intro;
      } else {
        rippleRingRef.current.visible = false;
      }
    }

    // ------------------------------------------------------------------
    // 5. CATO THE ROBOT — 3-BEAT CHOREOGRAPHY
    // ------------------------------------------------------------------
    const core = catoBody.current?.core;
    if (core && catoGroup.current && catoUnHeading.current && catoUnPos.current) {
      let cx = -0.18;
      let cz = 0.36;
      let cy = 0.04;
      let cYaw = 0.28;

      if (!anim) {
        // Reduced motion: Cato stands cheerfully where El Paseo meets the golf green
        cx = 1.16;
        cz = 0.42;
        cy = greenHeightAt(cx, cz);
        cYaw = 0.24;
        core.scrub('wave', 1.1);
      } else if (dwellIn < 0.5 && clubBeat < 0.25) {
        // BEAT 1 (Mountain Dawn / Hero & Stats):
        // Cato stands in the open El Paseo central plaza, waving warmly to the visitor
        cx = -0.18 - 0.32 * smooth(sectionRange(pStats, 0.1, 0.8));
        cz = 0.36;
        cy = 0.04;
        cYaw = 0.26 + Math.sin(el * 0.8) * 0.08;
        catoModeRef.current = 'wave-scrub';
        core.scrub('wave', 0.65 + ((el * 0.85) % 1.45));
      } else if (clubBeat < 0.45) {
        // BEAT 2 (Strolling El Paseo — active throughout the moment dwell):
        // Cato strolls east along the front promenade past the illuminated vitrines
        const u = clamp01(dwellT);
        cx = -0.48 + u * 1.42; // -0.48 (Central Flagship) -> +0.94 (East Boutique)
        cz = 0.36 + 0.04 * Math.sin(u * Math.PI);
        cy = 0.04;
        cYaw = 0.78; // angled three-quarters toward the viewer & down El Paseo
        if (catoModeRef.current !== 'walk') {
          core.release();
          core.play('walk');
          catoModeRef.current = 'walk';
        }
      } else {
        // BEAT 3 (The Club — angles, feature, build, detail, faq, cta):
        // Cato stands on the Championship Golf Green beside the flagstick and celebrates!
        cx = 1.38;
        cz = 0.44;
        cy = greenHeightAt(cx, cz);
        cYaw = 0.22 + Math.sin(el * 1.1) * 0.1;
        catoModeRef.current = 'cheer-scrub';
        core.scrub('cheer', 0.48 + ((el * 1.05) % 2.1));
      }

      catoGroup.current.position.x = damp(catoGroup.current.position.x, cx, 10, delta);
      catoGroup.current.position.y = damp(catoGroup.current.position.y, cy, 10, delta);
      catoGroup.current.position.z = damp(catoGroup.current.position.z, cz, 10, delta);
      catoGroup.current.rotation.y = damp(catoGroup.current.rotation.y, cYaw, 8, delta);
      catoGroup.current.scale.setScalar(0.5 * intro);

      // Cancel out internal loco drift from core.body so Cato stays pinned to catoGroup's exact transform
      catoUnHeading.current.rotation.y = -core.body.heading;
      catoUnPos.current.position.set(-core.body.x, 0, -core.body.z);
    }

    // ------------------------------------------------------------------
    // 6. HOTSPOT REPORTER (drives ProximityType on detail section headline)
    // ------------------------------------------------------------------
    if (hotspotAnchor.current) {
      hotspotAnchor.current.position.set(1.02, 1.65, -1.0);
      reportHotspot(
        hotspotAnchor.current,
        state.camera,
        0.45 + 0.35 * Math.max(stage.focus, sectionRange(pDetail, 0.1, 0.8)),
      );
    }

    // ------------------------------------------------------------------
    // 7. CAMERA HANDOFF (HERO -> MOMENT DOLLY -> CLUB / DETAIL / CTA)
    // ------------------------------------------------------------------
    const camZ = anim ? 9.06 - 0.48 * stage.focus + 0.12 * smooth(sectionRange(pCta, 0.05, 0.8)) : 9.0;
    const camY = anim ? 0.32 + pointer.y * 0.16 + 0.10 * stage.focus : 0.32;
    _camPos.set(
      anim ? pointer.x * 0.26 : 0,
      camY,
      camZ,
    );
    state.camera.position.lerp(_camPos, 0.055);
    _camLook.set(0, -0.08 + 0.05 * stage.focus, 0);
    state.camera.lookAt(_camLook);
  });

  return (
    <>
      <SceneLightRig />
      <group ref={rig}>
        {/* Soft radial contact shadow beneath the architectural plinth */}
        {shadowMap && (
          <mesh position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[6.8, 4.4]} />
            <meshBasicMaterial
              map={shadowMap}
              transparent
              opacity={0.48}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* Plinth & El Paseo Boulevard Base */}
        <mesh geometry={geos.plinthPorcelainGeo} material={mats.porcelainMat} />
        <mesh geometry={geos.plinthAzureGeo} material={mats.azureBaseMat} />

        {/* Santa Rosa Mountains Backdrop + Topographic Contours */}
        <mesh geometry={geos.mountainsGeo} material={mats.mountainsMat} />
        <lineSegments
          geometry={geos.mountainsLineGeo}
          material={mats.mountainsLineMat}
        />

        {/* Mountain Dawn Sun Disc (rotated into XY plane) & Concentric Halo */}
        <group ref={sunGroup} position={[-0.14, 1.32, -1.42]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.46, 0.46, 0.04, 40]} />
            <GlassMaterial kind="prism" />
          </mesh>
          <mesh>
            <torusGeometry args={[0.46, 0.012, 12, 48]} />
            <meshBasicMaterial color="#2e4bff" />
          </mesh>
          <lineSegments geometry={geos.sunHaloGeo} material={mats.sunHaloMat} />
        </group>

        {/* El Paseo Luxury Storefronts (Porcelain Pavilions, Crystal Vitrines, Boutique Glow) */}
        <group ref={storefrontsGroup}>
          <mesh
            geometry={geos.storefrontsPorcelainGeo}
            material={mats.porcelainMat}
          />
          <mesh geometry={geos.storefrontsGlassGeo}>
            <GlassMaterial kind="crystal" />
          </mesh>
          <mesh
            geometry={geos.storefrontsGlowGeo}
            material={mats.storefrontGlowMat}
          />
        </group>

        {/* California Fan Palms & Desert Flora (Agaves, Barrel Cacti) */}
        <mesh geometry={geos.palmsTrunksGeo} material={mats.trunkMat} />
        <mesh geometry={geos.palmsAndFloraGeo} material={mats.floraMat} />

        {/* Championship Golf Green, Water Hazard Pond, Sand Bunker & Flagstick */}
        <mesh geometry={geos.golfGreenGeo} material={mats.golfGreenMat} />
        <mesh geometry={geos.waterPondGeo}>
          <GlassMaterial kind="liquid" />
        </mesh>
        <mesh geometry={geos.bunkerGeo} material={mats.bunkerMat} />
        <mesh geometry={geos.flagstickGeo} material={mats.flagstickMat} />
        <mesh
          ref={flagPennantRef}
          geometry={geos.flagPennantGeo}
          material={mats.flagPennantMat}
          position={[1.88, cupY + 1.2, 0.38]}
        />

        {/* Golf Ball & Cup Celebration Ripple Ring */}
        <mesh
          ref={golfBallRef}
          material={mats.golfBallMat}
          position={[1.88, cupY + 0.03, 0.38]}
        >
          <sphereGeometry args={[0.048, 16, 12]} />
        </mesh>
        <mesh
          ref={rippleRingRef}
          material={mats.rippleRingMat}
          position={[1.88, cupY + 0.015, 0.38]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.28, 0.35, 32]} />
        </mesh>

        {/* Crisp Architectural Linework (Mullions, Boulevard Lanes, Green Contours, Putting Arc) */}
        <lineSegments geometry={geos.lineworkGeo} material={mats.lineworkMat} />

        {/* Cato the Robot */}
        <group ref={catoGroup} position={[-0.18, 0.04, 0.36]} scale={0.5}>
          <group ref={catoUnHeading}>
            <group ref={catoUnPos}>
              <CatoBody ref={catoBody} paused={!q.animate} />
            </group>
          </group>
        </group>

        {/* Skyline Hotspot Anchor */}
        <group ref={hotspotAnchor} position={[1.02, 1.65, -1.0]} />
      </group>

      <ParticleField
        count={Math.floor(420 * q.particles)}
        drift={q.animate ? 0.07 : 0}
        opacity={0.2}
      />
    </>
  );
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
