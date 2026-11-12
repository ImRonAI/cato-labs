'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, GradientGlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import { getSectionProgress, pointer, sectionRange, smooth } from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import CatoBody, { type CatoBodyHandle } from '../../../kit/cato/CatoBody';
import { createStageState, readStage, damp } from '../lib-a/dwell';
import { contactShadowTexture } from '../lib-a/place';
import { createPalmSpringsShaders } from './palm-springs/shaders';
import {
  FLOOR_Y,
  PALM_SPECS,
  TURBINE_SPECS,
  buildCelestialDialLines,
  buildMountainAndPassGeometries,
  buildPalmGeometries,
  buildPavilionAndTerraceGeometries,
  buildTramwayGeometries,
  buildWindFarmGeometries,
  sampleTramPath,
} from './palm-springs/geometries';

/**
 * PalmSpringsScene — "The Desert Modern & Chino Canyon Ascent"
 *
 * A museum-grade porcelain, frosted-crystal, and electric-blue architectural
 * miniature of Palm Springs:
 *  1. Mount San Jacinto's sheer granite escarpment & Chino Canyon rising behind the city
 *  2. The Palm Springs Aerial Tramway: twin counter-balanced rotating circular tramcars
 *     climbing from Valley Station past Lattice Tower 1 to Mountain Station
 *  3. A Mid-Century Modern butterfly-roof pavilion (Krisel / Kaufmann tribute) with
 *     exposed structural roof beams, clerestory glass, and a 3D star breeze-block screen
 *     casting real-time raking geometric shadows across the travertine terrace
 *  4. A turquoise-blue swimming pool with animated caustics, concentric ripples, diving board,
 *     mid-century loungers, striped parasol umbrella, and five swaying California Fan Palms
 *  5. The San Gorgonio Pass wind farm spinning along the northern horizon ridge
 *  6. Cato the robot poolside on the sun deck — waving, cheering the ascending tram,
 *     grooving through the festival calendar, and scanning the desert horizon.
 */

/* Module-scope temporaries — zero allocation inside useFrame */
const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _tramPos1 = new THREE.Vector3();
const _tramPos2 = new THREE.Vector3();

export default function PalmSpringsScene() {
  const q = useQuality();
  const rigRef = useRef<THREE.Group>(null);
  const mountainGroupRef = useRef<THREE.Group>(null);
  const houseGroupRef = useRef<THREE.Group>(null);
  const sunGroupRef = useRef<THREE.Group>(null);
  const sunMeshRef = useRef<THREE.Mesh>(null);
  const tram1Ref = useRef<THREE.Group>(null);
  const tram1CabinRef = useRef<THREE.Group>(null);
  const tram2Ref = useRef<THREE.Group>(null);
  const tram2CabinRef = useRef<THREE.Group>(null);
  const floatRingRef = useRef<THREE.Mesh>(null);
  const interiorGlowRef = useRef<THREE.Mesh>(null);
  const palmCrownRefs = useRef<(THREE.Mesh | null)[]>([]);
  const rotorRefs = useRef<(THREE.Mesh | null)[]>([]);

  const catoGroupRef = useRef<THREE.Group>(null);
  const catoBodyRef = useRef<CatoBodyHandle>(null);

  const stage = useMemo(createStageState, []);
  const reportHotspot = useHotspotReporter('ps-skyline');

  const live = useRef({
    px: 0,
    py: 0,
    rigX: 2.16,
    rigY: -0.26,
    rigZ: -0.15,
    rigScale: 0.80,
    rigRotY: -0.24,
    rigRotX: 0.15,
    tramT: 0.28,
    nightGlow: 0.0,
    svgHidden: false,
  });

  const shaders = useMemo(() => createPalmSpringsShaders(), []);
  const geos = useMemo(() => {
    const mountain = buildMountainAndPassGeometries();
    const pavilion = buildPavilionAndTerraceGeometries();
    const tram = buildTramwayGeometries();
    const palms = buildPalmGeometries();
    const wind = buildWindFarmGeometries();
    const dialLines = buildCelestialDialLines();
    return { ...mountain, ...pavilion, ...tram, ...palms, ...wind, dialLines };
  }, []);

  const materials = useMemo(() => {
    const porcelainMat = new THREE.MeshPhysicalMaterial({
      color: '#eaf0ff',
      roughness: 0.22,
      metalness: 0.04,
      clearcoat: 0.65,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.25,
    });
    const enamelMat = new THREE.MeshPhysicalMaterial({
      color: '#1e38db',
      emissive: '#0c1aa6',
      emissiveIntensity: 0.22,
      roughness: 0.18,
      metalness: 0.28,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.45,
    });
    const palmTrunkMat = new THREE.MeshPhysicalMaterial({
      color: '#3f5ae0',
      roughness: 0.30,
      metalness: 0.08,
      clearcoat: 0.45,
      envMapIntensity: 1.2,
    });
    const palmCrownMat = new THREE.MeshPhysicalMaterial({
      color: '#2e4bff',
      emissive: '#1022b8',
      emissiveIntensity: 0.24,
      roughness: 0.24,
      metalness: 0.12,
      clearcoat: 0.75,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.35,
    });
    const turbineTowerMat = new THREE.MeshPhysicalMaterial({
      color: '#bacbff',
      emissive: '#2e4bff',
      emissiveIntensity: 0.12,
      roughness: 0.16,
      metalness: 0.2,
      clearcoat: 0.85,
    });
    const turbineBladeMat = new THREE.MeshPhysicalMaterial({
      color: '#2e4bff',
      emissive: '#1226c8',
      emissiveIntensity: 0.22,
      roughness: 0.14,
      metalness: 0.22,
      clearcoat: 0.9,
    });
    const ridgeLineMat = new THREE.LineBasicMaterial({
      color: '#2e4bff',
      transparent: true,
      opacity: 0.46,
    });
    const subtleLineMat = new THREE.LineBasicMaterial({
      color: '#5f7dff',
      transparent: true,
      opacity: 0.36,
    });
    const cableLineMat = new THREE.LineBasicMaterial({
      color: '#1226c8',
      transparent: true,
      opacity: 0.76,
    });
    const interiorGlowMat = new THREE.MeshBasicMaterial({
      color: '#2e4bff',
      transparent: true,
      opacity: 0.22,
    });
    const shadowTex = typeof document !== 'undefined' ? contactShadowTexture() : null;
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.78,
    });

    return {
      porcelainMat,
      enamelMat,
      palmTrunkMat,
      palmCrownMat,
      turbineTowerMat,
      turbineBladeMat,
      ridgeLineMat,
      subtleLineMat,
      cableLineMat,
      interiorGlowMat,
      shadowMat,
    };
  }, []);

  useEffect(() => {
    return () => {
      shaders.dispose();
      Object.values(geos).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [shaders, geos, materials]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    readStage(stage, q);

    /* Ensure Cato's 2D SVG emote overlay stays hidden so only pure 3D WebGL renders */
    const core = catoBodyRef.current?.core;
    if (core && !live.current.svgHidden) {
      core.svg.style.display = 'none';
      live.current.svgHidden = true;
    }

    const pStats = getSectionProgress('stats');
    const pAngles = getSectionProgress('angles');
    const pFeature = getSectionProgress('feature');
    const pBuild = getSectionProgress('build');
    const pDetail = getSectionProgress('detail');
    const pFaq = getSectionProgress('faq');
    const pCta = getSectionProgress('cta');

    const intro = anim ? smooth(Math.min(el / 1.5, 1)) : 1;
    const L = live.current;

    L.px = anim ? damp(L.px, pointer.x * 0.14, 3.0, dt) : 0;
    L.py = anim ? damp(L.py, pointer.y * 0.09, 3.0, dt) : 0;

    /* --------------------------------------------------------------------
       1. MULTI-BEAT STAGE PLACEMENT ACROSS THE ENTIRE PAGE
       -------------------------------------------------------------------- */
    const statsBeat = smooth(sectionRange(pStats, 0.08, 0.70));
    const anglesBeat = smooth(sectionRange(pAngles, 0.05, 0.85));
    const featureActive =
      smooth(sectionRange(pFeature, 0.05, 0.25)) * (1 - smooth(sectionRange(pFeature, 0.82, 0.98)));
    /* Feature 02 is right-aligned in the DOM (around pFeature 0.46..0.72), so sway left there */
    const featureMidSway =
      smooth(sectionRange(pFeature, 0.44, 0.54)) * (1 - smooth(sectionRange(pFeature, 0.66, 0.78)));
    const buildBeat = smooth(sectionRange(pBuild, 0.05, 0.85));
    const detailBeat = smooth(sectionRange(pDetail, 0.05, 0.85));
    const faqBeat = smooth(sectionRange(pFaq, 0.05, 0.85));
    const ctaBeat = smooth(sectionRange(pCta, 0.05, 0.80));

    const postMoment = stage.out;

    let targetX = q.compact ? 0.0 : 2.16;
    let targetY = q.compact ? -0.92 : -0.26;
    let targetZ = q.compact ? -0.65 : -0.15;
    let targetScale = q.compact ? 0.42 : 0.80;
    let targetRotY = q.compact ? -0.16 : -0.24;
    let targetRotX = 0.15;

    if (anim) {
      /* Pre-moment: Hero -> Stats */
      const preX = q.compact ? 0.0 : 2.16 + 0.24 * statsBeat;
      const preY = q.compact ? -0.92 + 0.35 * statsBeat : -0.26 + 0.62 * statsBeat;
      const preZ = q.compact ? -0.65 : -0.15 - 0.45 * statsBeat;
      const preScale = q.compact ? 0.42 : 0.80 - 0.07 * statsBeat;
      const preRotY = -0.24 - 0.12 * statsBeat;

      /* Moment dwell: centered full-stage showcase with generous summit headroom */
      const momX = q.compact ? 0.0 : 0.04;
      const momY = q.compact ? -0.24 : -0.44;
      const momZ = q.compact ? -0.10 : 0.36;
      const momScale = q.compact ? 0.46 : 0.95;
      const momRotY = -0.26 + 0.50 * smooth(stage.t);

      /* Post-moment:
         - In Feature 01/03: sits cleanly on the right at x = 2.18, y = -0.24
         - In Feature 02: sways to the left at x = -2.08
         - In Angles & Build (2-column grids below left-aligned header): lifts into the upper-right
           negative space (x = 2.48, y = 0.64, scale = 0.68) above column 2!
         - In Detail & FAQ: sits in the upper-right beside the left column
         - In CTA: frames the centered CTA headline from the far right (x = 2.66, y = 0.26, scale = 0.66) */
      const gridLift = Math.max(anglesBeat, buildBeat);
      const postX = q.compact
        ? 0.0
        : 2.34 -
          0.16 * featureActive -
          4.25 * featureMidSway +
          0.16 * gridLift +
          0.14 * faqBeat +
          0.32 * ctaBeat;
      const postY = q.compact
        ? -0.76 + 0.14 * ctaBeat
        : 0.16 -
          0.40 * featureActive +
          0.48 * gridLift +
          0.26 * faqBeat +
          0.12 * ctaBeat;
      const postZ = q.compact ? -0.65 : -0.52 + 0.34 * featureActive - 0.12 * gridLift;
      const postScale = q.compact
        ? 0.40
        : 0.74 + 0.06 * featureActive - 0.06 * gridLift - 0.06 * faqBeat - 0.08 * ctaBeat;
      const postRotY =
        -0.34 +
        0.10 * featureActive +
        0.58 * featureMidSway +
        0.10 * buildBeat +
        0.08 * ctaBeat;

      const intoM = stage.into;
      const outM = postMoment;
      targetX = THREE.MathUtils.lerp(THREE.MathUtils.lerp(preX, momX, intoM), postX, outM);
      targetY = THREE.MathUtils.lerp(THREE.MathUtils.lerp(preY, momY, intoM), postY, outM);
      targetZ = THREE.MathUtils.lerp(THREE.MathUtils.lerp(preZ, momZ, intoM), postZ, outM);
      targetScale = THREE.MathUtils.lerp(THREE.MathUtils.lerp(preScale, momScale, intoM), postScale, outM);
      targetRotY = THREE.MathUtils.lerp(THREE.MathUtils.lerp(preRotY, momRotY, intoM), postRotY, outM);
      targetRotX = 0.15 + 0.03 * stage.focus;
    }

    L.rigX = anim ? damp(L.rigX, targetX, 5.5, dt) : targetX;
    L.rigY = anim ? damp(L.rigY, targetY - (1 - intro) * 0.45, 5.5, dt) : targetY;
    L.rigZ = anim ? damp(L.rigZ, targetZ, 5.5, dt) : targetZ;
    L.rigScale = anim ? damp(L.rigScale, targetScale * (0.9 + 0.1 * intro), 5.5, dt) : targetScale;
    L.rigRotY = anim ? damp(L.rigRotY, targetRotY + L.px * 0.32, 5.0, dt) : targetRotY;
    L.rigRotX = anim ? damp(L.rigRotX, targetRotX - L.py * 0.18, 5.0, dt) : targetRotX;

    if (rigRef.current) {
      rigRef.current.position.set(L.rigX, L.rigY, L.rigZ);
      rigRef.current.scale.setScalar(L.rigScale);
      rigRef.current.rotation.set(L.rigRotX, L.rigRotY, 0);
    }

    if (mountainGroupRef.current) {
      const mIntro = anim ? smooth(sectionRange(intro, 0.0, 0.85)) : 1;
      mountainGroupRef.current.scale.y = Math.max(0.001, mIntro);
      mountainGroupRef.current.position.y = (1 - mIntro) * -0.45;
    }
    if (houseGroupRef.current) {
      const hIntro = anim ? smooth(sectionRange(intro, 0.15, 1.0)) : 1;
      houseGroupRef.current.scale.setScalar(Math.max(0.001, hIntro));
    }

    /* --------------------------------------------------------------------
       2. DESERT SUN ARC & BREEZE-BLOCK SHADOWS
       -------------------------------------------------------------------- */
    const solarProgress = anim
      ? THREE.MathUtils.clamp(
          0.22 + 0.12 * statsBeat + 0.54 * stage.t + 0.12 * postMoment,
          0.15,
          0.92,
        )
      : 0.66;
    const sunAz = -1.08 + 2.16 * solarProgress + L.px * 0.5;
    const sunEl = 0.28 + 0.58 * Math.sin(Math.PI * solarProgress) + L.py * 0.3;
    const cosEl = Math.cos(sunEl);

    shaders.sunVec
      .set(Math.sin(sunAz) * cosEl * 0.9, Math.sin(sunEl) * 0.78 + 0.15, Math.cos(sunAz) * cosEl * 0.65 + 0.35)
      .normalize();

    const targetNight = anim ? Math.max(buildBeat * 0.85, detailBeat * 0.95, faqBeat * 0.55) : 0.25;
    L.nightGlow = anim ? damp(L.nightGlow, targetNight, 4.0, dt) : targetNight;

    shaders.screenFrontMat.uniforms.uOpacity.value = intro;
    shaders.screenBackMat.uniforms.uOpacity.value = intro;
    shaders.terraceMat.uniforms.uOpacity.value = intro;
    shaders.terraceMat.uniforms.uNightGlow.value = L.nightGlow;
    shaders.poolMat.uniforms.uOpacity.value = intro;
    shaders.poolMat.uniforms.uTime.value = anim ? el : 1.4;
    shaders.poolMat.uniforms.uNightGlow.value = L.nightGlow;
    shaders.plinthMat.uniforms.uOpacity.value = intro;

    if (interiorGlowRef.current) {
      materials.interiorGlowMat.opacity = (0.18 + L.nightGlow * 0.48) * intro;
    }

    if (sunGroupRef.current) {
      sunGroupRef.current.position.set(
        Math.sin(sunAz) * 2.35,
        1.05 + Math.sin(sunEl) * 1.02,
        -0.85,
      );
      sunGroupRef.current.rotation.y = el * 0.25;
    }
    if (sunMeshRef.current) {
      reportHotspot(sunMeshRef.current, state.camera, 0.55 + 0.35 * stage.focus);
    }

    /* --------------------------------------------------------------------
       3. PALM SPRINGS AERIAL TRAMWAY — TWIN ROTATING CABINS
       -------------------------------------------------------------------- */
    const scenicLoop = 0.5 + 0.38 * Math.sin(el * 0.28);
    const desiredTramT = anim
      ? THREE.MathUtils.lerp(scenicLoop, THREE.MathUtils.clamp(0.08 + stage.t * 0.86, 0.06, 0.94), stage.focus)
      : 0.62;
    L.tramT = anim ? damp(L.tramT, desiredTramT, 6.0, dt) : 0.62;

    if (tram1Ref.current && tram1CabinRef.current) {
      sampleTramPath(L.tramT, 0.075, _tramPos1);
      tram1Ref.current.position.copy(_tramPos1);
      tram1CabinRef.current.rotation.y = anim ? el * 0.65 + L.tramT * Math.PI * 3 : 0.8;
    }
    if (tram2Ref.current && tram2CabinRef.current) {
      sampleTramPath(1.0 - L.tramT, -0.075, _tramPos2);
      tram2Ref.current.position.copy(_tramPos2);
      tram2CabinRef.current.rotation.y = anim ? -el * 0.65 - L.tramT * Math.PI * 3 : -0.8;
    }

    /* --------------------------------------------------------------------
       4. SAN GORGONIO WIND TURBINES, FAN PALMS & POOL FLOAT
       -------------------------------------------------------------------- */
    const windSpeedMult = 1.0 + 0.65 * anglesBeat + 0.55 * stage.focus;
    for (let i = 0; i < TURBINE_SPECS.length; i++) {
      const rotor = rotorRefs.current[i];
      if (!rotor) continue;
      const spec = TURBINE_SPECS[i];
      rotor.rotation.z = anim ? -(el * spec.speed * windSpeedMult + spec.phase) : -spec.phase;
    }

    for (let i = 0; i < PALM_SPECS.length; i++) {
      const crown = palmCrownRefs.current[i];
      if (!crown) continue;
      const spec = PALM_SPECS[i];
      crown.rotation.z = anim ? Math.sin(el * 1.3 + spec.phase) * 0.045 : 0;
      crown.rotation.x = anim ? Math.cos(el * 1.0 + spec.phase) * 0.035 : 0;
    }

    if (floatRingRef.current) {
      floatRingRef.current.position.y =
        FLOOR_Y + 0.025 + (anim ? Math.sin(el * 2.1) * 0.008 : 0);
      floatRingRef.current.rotation.y = anim ? el * 0.35 : 0.4;
    }

    /* --------------------------------------------------------------------
       5. CATO THE ROBOT — POOLSIDE CHOREOGRAPHY
       -------------------------------------------------------------------- */
    if (core && catoGroupRef.current) {
      if (!anim) {
        core.scrub('wave', 1.15);
        catoGroupRef.current.rotation.y = -0.15;
      } else if (stage.focus > 0.35) {
        if (stage.t < 0.65) {
          core.scrub('cheer', 0.45 + ((el * 0.85) % 2.1));
        } else {
          core.scrub('dance', el * 0.95);
        }
        catoGroupRef.current.rotation.y = damp(
          catoGroupRef.current.rotation.y,
          -0.22 + stage.t * 0.35,
          4.0,
          dt,
        );
      } else if (anglesBeat > 0.35 && featureActive < 0.25) {
        core.scrub('dance', el);
        catoGroupRef.current.rotation.y = damp(catoGroupRef.current.rotation.y, 0.12, 4.0, dt);
      } else if (buildBeat > 0.35 && faqBeat < 0.2) {
        const cycle = el % 5.0;
        if (cycle < 2.6) {
          core.scrub('scan', 0.55 + (cycle / 2.6) * 2.2);
        } else {
          core.scrub('wave', 0.55 + ((cycle - 2.6) / 2.4) * 1.55);
        }
        catoGroupRef.current.rotation.y = damp(catoGroupRef.current.rotation.y, -0.12, 4.0, dt);
      } else {
        core.scrub('wave', 0.55 + ((el * 0.78) % 1.55));
        catoGroupRef.current.rotation.y = damp(catoGroupRef.current.rotation.y, -0.16, 4.0, dt);
      }
    }

    /* --------------------------------------------------------------------
       6. CAMERA DAMPING & MULTI-SECTION HANDOFF (SHARED CANVAS 32° FOV)
       -------------------------------------------------------------------- */
    const camZ = anim ? 9.08 - 0.52 * stage.focus + 0.14 * ctaBeat : 9.0;
    const camY = anim ? 0.22 + pointer.y * 0.14 + 0.12 * stage.focus + 0.06 * detailBeat : 0.22;
    _camPos.set(
      anim ? pointer.x * 0.24 : 0,
      camY,
      camZ,
    );
    state.camera.position.lerp(_camPos, 0.055);
    _camLook.set(0, 0.06 * stage.focus - 0.04 * ctaBeat, 0);
    state.camera.lookAt(_camLook);
  });

  return (
    <>
      <SceneLightRig />

      <group ref={rigRef}>
        {/* --- Soft contact shadow & topographic porcelain plinth --- */}
        <mesh
          material={materials.shadowMat}
          position={[0, FLOOR_Y - 0.14, -0.05]}
          rotation-x={-Math.PI / 2}
          renderOrder={-2}
        >
          <planeGeometry args={[6.4, 4.8]} />
        </mesh>
        <mesh
          material={shaders.plinthMat}
          position={[0, FLOOR_Y - 0.08, -0.05]}
          rotation-x={-Math.PI / 2}
          renderOrder={-1}
        >
          <planeGeometry args={[6.2, 4.5]} />
        </mesh>

        {/* --- Terrace floor with real-time breeze-block star shadows --- */}
        <mesh
          material={shaders.terraceMat}
          position={[0, FLOOR_Y + 0.002, 0.05]}
          rotation-x={-Math.PI / 2}
        >
          <planeGeometry args={[4.8, 3.3]} />
        </mesh>

        {/* --- 1. Mount San Jacinto, Chino Canyon & San Gorgonio Wind Farm --- */}
        <group ref={mountainGroupRef}>
          <mesh geometry={geos.mountainGeo}>
            <GradientGlassMaterial
              ice="#dce6ff"
              azure="#7a95ff"
              electric="#2e4bff"
              deep="#1226c8"
              opacity={0.93}
              sheen={0.75}
            />
          </mesh>
          <mesh geometry={geos.mountainCoreGeo}>
            <GlassMaterial kind="core" />
          </mesh>
          <lineSegments geometry={geos.mountainEdgesGeo} material={materials.ridgeLineMat} />

          {/* Palm Springs Aerial Tramway twin cables */}
          <lineSegments geometry={geos.tramCablesGeo} material={materials.cableLineMat} />

          {/* Tramcar 1 (Primary ascending rotating cabin) */}
          <group ref={tram1Ref} position={[-1.25, 0.85, -0.68]}>
            <mesh geometry={geos.tramHangerGeo} material={materials.enamelMat} />
            <group ref={tram1CabinRef} position={[0, -0.22, 0]}>
              <mesh geometry={geos.tramCabinGlassGeo}>
                <GlassMaterial kind="crystal" />
              </mesh>
              <mesh geometry={geos.tramCabinEnamelGeo} material={materials.enamelMat} />
            </group>
          </group>

          {/* Tramcar 2 (Counter-balanced descending rotating cabin) */}
          <group ref={tram2Ref} position={[-0.92, 1.38, -0.86]}>
            <mesh geometry={geos.tramHangerGeo} material={materials.enamelMat} />
            <group ref={tram2CabinRef} position={[0, -0.22, 0]}>
              <mesh geometry={geos.tramCabinGlassGeo}>
                <GlassMaterial kind="crystal" />
              </mesh>
              <mesh geometry={geos.tramCabinEnamelGeo} material={materials.enamelMat} />
            </group>
          </group>

          {/* San Gorgonio Pass Wind Farm (5 towers + 5 spinning 3-blade rotors) */}
          <mesh geometry={geos.windTowersGeo} material={materials.turbineTowerMat} />
          {TURBINE_SPECS.map((spec, i) => (
            <mesh
              key={i}
              ref={(el) => {
                rotorRefs.current[i] = el;
              }}
              geometry={geos.windRotorGeo}
              material={materials.turbineBladeMat}
              position={spec.hubPos}
              scale={spec.rotorScale}
            />
          ))}
        </group>

        {/* --- 2. Mid-Century Modern Butterfly-Roof Pavilion & Pool Terrace --- */}
        <group ref={houseGroupRef}>
          <mesh geometry={geos.porcelainGeo} material={materials.porcelainMat} />
          <mesh geometry={geos.enamelGeo} material={materials.enamelMat} />
          <mesh geometry={geos.glassGeo}>
            <GlassMaterial kind="crystal" />
          </mesh>
          <lineSegments geometry={geos.edgesGeo} material={materials.subtleLineMat} />

          {/* Pavilion warm-blue interior evening core */}
          <mesh
            ref={interiorGlowRef}
            material={materials.interiorGlowMat}
            position={[-0.84, FLOOR_Y + 0.36, 0.06]}
          >
            <boxGeometry args={[1.38, 0.56, 0.66]} />
          </mesh>

          {/* 3D Star Breeze-Block Screen Wall */}
          <mesh
            material={shaders.screenBackMat}
            position={[0.52, FLOOR_Y + 0.37, 0.05]}
          >
            <planeGeometry args={[1.32, 0.72]} />
          </mesh>
          <mesh
            material={shaders.screenFrontMat}
            position={[0.52, FLOOR_Y + 0.37, 0.11]}
          >
            <planeGeometry args={[1.32, 0.72]} />
          </mesh>

          {/* Turquoise-Blue Swimming Pool Water Surface */}
          <mesh
            material={shaders.poolMat}
            position={[0.58, FLOOR_Y + 0.024, 0.74]}
            rotation-x={-Math.PI / 2}
          >
            <planeGeometry args={[1.56, 0.94]} />
          </mesh>

          {/* Translucent Electric-Blue Pool Float Ring */}
          <mesh
            ref={floatRingRef}
            position={[0.92, FLOOR_Y + 0.032, 0.80]}
            rotation-x={Math.PI / 2}
          >
            <torusGeometry args={[0.115, 0.038, 14, 28]} />
            <GlassMaterial kind="core" />
          </mesh>

          {/* California Fan Palms (merged trunks + swaying arched fan crowns) */}
          <mesh geometry={geos.palmTrunksGeo} material={materials.palmTrunkMat} />
          {PALM_SPECS.map((palm, i) => (
            <mesh
              key={i}
              ref={(el) => {
                palmCrownRefs.current[i] = el;
              }}
              geometry={geos.palmCrownGeo}
              material={materials.palmCrownMat}
              position={palm.topPos}
              scale={palm.crownScale}
            />
          ))}

          {/* --- 3. Cato the Robot on the Poolside Sun Deck --- */}
          <group
            ref={catoGroupRef}
            position={[0.14, FLOOR_Y + 0.04, 0.98]}
            rotation-y={-0.16}
            scale={0.50}
          >
            <CatoBody ref={catoBodyRef} paused={!q.animate} />
          </group>
        </group>

        {/* --- 4. Celestial Solar Dial & Deep-Blue Desert Sun --- */}
        <lineSegments geometry={geos.dialLines} material={materials.subtleLineMat} />
        <group ref={sunGroupRef} position={[-1.4, 1.65, -0.85]}>
          <mesh ref={sunMeshRef}>
            <sphereGeometry args={[0.21, 36, 24]} />
            <GlassMaterial kind="deep" emissive="#2e4bff" emissiveIntensity={0.55} />
          </mesh>
          <mesh rotation-x={Math.PI / 2.6} material={materials.enamelMat}>
            <torusGeometry args={[0.33, 0.008, 8, 36]} />
          </mesh>
        </group>
      </group>

      <ParticleField
        count={Math.floor(850 * q.particles)}
        drift={q.animate ? 0.08 : 0}
        opacity={0.22}
      />
    </>
  );
}
