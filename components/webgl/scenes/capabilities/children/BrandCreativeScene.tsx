'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { brandBus, lerp } from '@/lib/content/overhaul/cap-brand';
import {
  AppIconMiniature,
  BusinessCardMiniature,
  ConstructionGridBackplate,
  ExtrudedGlassLogomark,
  SignageTotemMiniature,
  SwatchFanMiniature,
  WebsiteHeroMiniature,
} from './brand-creative/AtelierObjects';

/**
 * BrandCreativeScene — "The Identity Engine & Brand Atelier".
 *
 * Replaces the generic prism with a museum-grade glass & porcelain Brand System
 * Atelier stage-right:
 * - Central Swiss Construction Grid Plinth & live-extruded 3D Glass Logomark
 *   that morphs in real time with `brandBus` (seeded by company name + Archetype,
 *   Voice, Structure dials).
 * - Four sculpted glass & porcelain application miniatures orbiting the plinth:
 *   1. Architectural Signage Totem / Billboard (upper-left)
 *   2. Flagship Website Hero Browser Window (upper-right)
 *   3. Tactile Business Card Stack (lower-left)
 *   4. Rounded-Squircle App Icon Jewel (lower-right)
 * - Five-blade Blue-Spectrum Swatch Fan at the base.
 *
 * Zero allocations inside useFrame. Reduced motion renders a static, finished
 * composition.
 */

const _look = new THREE.Vector3();

export default function BrandCreativeScene() {
  const q = useQuality();
  const start = useRef<number | null>(null);
  const lookCur = useRef(new THREE.Vector3(0.42, 0, 0));

  const atelierRoot = useRef<THREE.Group>(null);
  const centerGroup = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Group>(null);
  const outerRingRef = useRef<THREE.Group>(null);

  // Extruded 3D logomark element refs (morphed in useFrame from brandBus)
  const markRoot = useRef<THREE.Group>(null);
  const leftBeam = useRef<THREE.Mesh>(null);
  const rightBeam = useRef<THREE.Mesh>(null);
  const crossBeam = useRef<THREE.Mesh>(null);
  const innerRing = useRef<THREE.Mesh>(null);
  const coreFrame = useRef<THREE.Mesh>(null);
  const orbitalNode = useRef<THREE.Mesh>(null);

  // Application miniature refs
  const signageRef = useRef<THREE.Group>(null);
  const websiteRef = useRef<THREE.Group>(null);
  const cardRef = useRef<THREE.Group>(null);
  const iconRef = useRef<THREE.Group>(null);
  const swatchRef = useRef<THREE.Group>(null);
  const swatchBlades = useRef<(THREE.Group | null)[]>([]);

  // Damped bus values for silky 60fps transitions
  const damped = useRef({
    arch: 1 / 3,
    voice: 0.38,
    struct: 0.44,
    cant: 0.04,
    aperture: 0.56,
    motif: 0,
  });

  const report = useHotspotReporter('brand-prism');

  const stage = useMemo(
    () =>
      q.compact
        ? { pos: [0.48, -1.58, -2.4] as [number, number, number], scale: 0.46 }
        : { pos: [2.42, 0.06, -0.25] as [number, number, number], scale: 0.82 },
    [q.compact],
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (start.current === null) start.current = t;
    const intro = q.animate ? smooth(Math.min((t - start.current) / 1.8, 1)) : 1;

    const featW = smooth(sectionRange(getSectionProgress('feature'), 0.05, 0.6));
    const machineW = smooth(sectionRange(getSectionProgress('machine'), 0.04, 0.55));
    const detailW = smooth(sectionRange(getSectionProgress('detail'), 0.05, 0.6));
    const faqW = smooth(sectionRange(getSectionProgress('faq'), 0.05, 0.6));
    const calmW = smooth(sectionRange(getSectionProgress('cta'), 0.05, 0.55));

    // Smoothly damp toward live brandBus parameters
    const d = damped.current;
    const rate = q.animate ? Math.min(1, delta * 8) : 1;
    d.arch += (brandBus.arch - d.arch) * rate;
    d.voice += (brandBus.voice - d.voice) * rate;
    d.struct += (brandBus.struct - d.struct) * rate;
    d.cant += (brandBus.cant - d.cant) * rate;
    d.aperture += (brandBus.aperture - d.aperture) * rate;

    // Assembly pulse wave when user triggers build or switches brand preset
    const nowMs = typeof performance !== 'undefined' ? performance.now() : 0;
    const pulseAge = (nowMs - brandBus.assemblyPulseAt) / 1000;
    const pulseBoost =
      q.animate && pulseAge >= 0 && pulseAge < 1.8
        ? Math.sin((pulseAge / 1.8) * Math.PI) * 0.14
        : 0;

    // 1. Root atelier position, scroll choreography & pointer parallax
    const root = atelierRoot.current;
    if (root) {
      const bob = q.animate ? Math.sin(t * 0.55) * 0.048 : 0;
      const scrollXOffset = q.compact
        ? 0
        : featW * 0.14 + machineW * 0.16 - detailW * 0.1 + faqW * 0.24 + calmW * 0.36;
      const scrollYOffset = q.compact
        ? 0
        : featW * 0.35 + machineW * 0.32 - detailW * 0.48 + faqW * 0.15;

      root.position.x = scrollXOffset;
      root.position.y = bob + scrollYOffset;
      const scaleMod = 1 - faqW * 0.08 - calmW * 0.12;
      const s =
        (q.animate ? 0.78 + 0.22 * intro : 1) *
        stage.scale *
        scaleMod *
        (1 + pulseBoost * 0.35);
      root.scale.setScalar(s);

      if (q.animate) {
        const targetRotY =
          -0.2 + featW * 0.16 - machineW * 0.1 + detailW * 0.18 + pointer.x * 0.07;
        const targetRotX = 0.05 + featW * 0.06 - machineW * 0.04 + pointer.y * 0.05;
        root.rotation.y += (targetRotY - root.rotation.y) * 0.06;
        root.rotation.x += (targetRotX - root.rotation.x) * 0.06;
      } else {
        root.rotation.set(0.05, -0.18, 0);
      }
    }

    // 2. Construction grid rings
    if (ringRef.current) {
      ringRef.current.rotation.z = q.animate
        ? t * 0.08 + d.struct * 0.65 + featW * 0.4
        : d.struct * 0.5;
    }
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = q.animate
        ? -t * 0.05 - d.arch * 0.5 - machineW * 0.35
        : -0.25;
    }

    // 3. Morph the 3D Extruded Glass Logomark based on motifIndex + dials
    const motif = brandBus.motifIndex;
    const thickScale = lerp(0.76, 1.38, d.voice);
    const spread = lerp(0.32, 0.52, d.aperture);
    const tilt = d.cant * 0.38;

    if (
      leftBeam.current &&
      rightBeam.current &&
      crossBeam.current &&
      innerRing.current &&
      coreFrame.current &&
      orbitalNode.current
    ) {
      if (motif === 0) {
        // Keystone Monolith (A-portal + crossbar + apex node)
        leftBeam.current.position.set(-spread + tilt * 0.35, 0.02, 0);
        leftBeam.current.rotation.set(0, 0, -0.34 - d.struct * 0.12 + tilt * 0.3);
        leftBeam.current.scale.set(thickScale, 1, 1 + d.voice * 0.3);

        rightBeam.current.position.set(spread + tilt * 0.35, 0.02, 0);
        rightBeam.current.rotation.set(0, 0, 0.34 + d.struct * 0.12 + tilt * 0.3);
        rightBeam.current.scale.set(thickScale, 1, 1 + d.voice * 0.3);

        crossBeam.current.position.set(tilt * 0.25, lerp(-0.24, 0.08, d.struct), 0.09);
        crossBeam.current.rotation.set(0, 0, tilt * 0.25);
        crossBeam.current.scale.set(lerp(0.85, 1.15, d.aperture), thickScale * 0.9, 1);

        innerRing.current.scale.setScalar(lerp(0.78, 1.04, d.struct));
        coreFrame.current.scale.setScalar(lerp(0.65, 1.05, d.voice));
      } else if (motif === 1) {
        // Hexagonal Vault
        leftBeam.current.position.set(-0.46, 0.05, 0.02);
        leftBeam.current.rotation.set(0, 0, -0.52);
        leftBeam.current.scale.set(thickScale * 0.9, 0.86, 1.1);

        rightBeam.current.position.set(0.46, 0.05, 0.02);
        rightBeam.current.rotation.set(0, 0, 0.52);
        rightBeam.current.scale.set(thickScale * 0.9, 0.86, 1.1);

        crossBeam.current.position.set(0, -0.44, 0.06);
        crossBeam.current.rotation.set(0, 0, 0);
        crossBeam.current.scale.set(1.05, thickScale, 1.1);

        innerRing.current.scale.setScalar(1.16);
        coreFrame.current.scale.setScalar(1.32);
      } else if (motif === 2) {
        // Orbital Meridian
        leftBeam.current.position.set(-0.22 - d.struct * 0.16, 0, 0.02);
        leftBeam.current.rotation.set(0, 0, tilt * 0.4);
        leftBeam.current.scale.set(thickScale * 0.78, 0.95, 1);

        rightBeam.current.position.set(0.22 + d.struct * 0.16, 0, 0.02);
        rightBeam.current.rotation.set(0, 0, tilt * 0.4);
        rightBeam.current.scale.set(thickScale * 0.78, 0.95, 1);

        crossBeam.current.position.set(0, 0, 0.08);
        crossBeam.current.rotation.set(0, 0, d.struct * 0.45);
        crossBeam.current.scale.set(1.22, thickScale * 0.75, 1);

        innerRing.current.scale.setScalar(1.24);
        coreFrame.current.scale.setScalar(0.95);
      } else if (motif === 3) {
        // Cantilever Grid (Swiss Cross-Frame)
        leftBeam.current.position.set(-0.34, 0.12 * d.cant, 0.02);
        leftBeam.current.rotation.set(0, 0, 0);
        leftBeam.current.scale.set(thickScale, 0.92, 1.1);

        rightBeam.current.position.set(0.34, -0.12 * d.cant, 0.02);
        rightBeam.current.rotation.set(0, 0, 0);
        rightBeam.current.scale.set(thickScale, 0.92, 1.1);

        crossBeam.current.position.set(0, 0, 0.09);
        crossBeam.current.rotation.set(0, 0, 0);
        crossBeam.current.scale.set(1.26, thickScale, 1.15);

        innerRing.current.scale.setScalar(0.88);
        coreFrame.current.scale.setScalar(1.18);
      } else if (motif === 4) {
        // Harmonic Aperture
        leftBeam.current.position.set(-0.44, 0, 0.03);
        leftBeam.current.rotation.set(0, 0, tilt * 0.25);
        leftBeam.current.scale.set(thickScale * 0.85, 0.96, 1.1);

        rightBeam.current.position.set(0.44, 0, 0.03);
        rightBeam.current.rotation.set(0, 0, tilt * 0.25);
        rightBeam.current.scale.set(thickScale * 0.85, 0.96, 1.1);

        crossBeam.current.position.set(0, 0.04, 0.07);
        crossBeam.current.rotation.set(0, 0, Math.PI / 2 + tilt * 0.25);
        crossBeam.current.scale.set(0.96, thickScale * 0.9, 1.15);

        innerRing.current.scale.setScalar(1.12);
        coreFrame.current.scale.setScalar(0.85);
      } else {
        // Delta Prism Triad
        leftBeam.current.position.set(-0.38, 0.04, 0.02);
        leftBeam.current.rotation.set(0, 0, -0.46);
        leftBeam.current.scale.set(thickScale, 0.94, 1.1);

        rightBeam.current.position.set(0.38, 0.04, 0.02);
        rightBeam.current.rotation.set(0, 0, 0.46);
        rightBeam.current.scale.set(thickScale, 0.94, 1.1);

        crossBeam.current.position.set(0, -0.52, 0.06);
        crossBeam.current.rotation.set(0, 0, 0);
        crossBeam.current.scale.set(1.28, thickScale * 0.95, 1.1);

        innerRing.current.scale.setScalar(0.92);
        coreFrame.current.scale.setScalar(1.24);
      }

      // Satellite node position & gentle orbit
      const nodeAngle = d.struct * 1.4 + d.arch * 0.9 + (q.animate ? Math.sin(t * 0.6) * 0.08 : 0);
      orbitalNode.current.position.set(
        Math.sin(nodeAngle) * 0.68 + tilt * 0.4,
        Math.cos(nodeAngle) * 0.68 + 0.12,
        0.18,
      );
      orbitalNode.current.scale.setScalar(lerp(0.82, 1.32, d.voice) * (1 + pulseBoost));

      if (q.animate) {
        coreFrame.current.rotation.z = Math.PI / 4 + t * 0.22 + d.struct * 0.8;
        coreFrame.current.rotation.y = Math.sin(t * 0.45) * 0.25;
      }
    }

    // 4. Choreograph the 4 surrounding application miniatures
    const spreadOut = 1 + featW * 0.06 + detailW * 0.1;
    const focus = brandBus.focusedApp;

    if (signageRef.current) {
      const fScale = focus === 2 ? 1.16 : 1;
      signageRef.current.position.set(
        -1.52 * spreadOut,
        1.06 * spreadOut + (q.animate ? Math.sin(t * 0.7 + 0.5) * 0.035 : 0),
        -0.25 + detailW * 0.2 + (focus === 2 ? 0.28 : 0),
      );
      signageRef.current.scale.setScalar(intro * fScale);
    }

    if (websiteRef.current) {
      const fScale = focus === 3 ? 1.16 : 1;
      websiteRef.current.position.set(
        1.85 * spreadOut,
        1.04 * spreadOut + (q.animate ? Math.sin(t * 0.65 + 1.7) * 0.035 : 0),
        -0.24 + detailW * 0.2 + (focus === 3 ? 0.28 : 0),
      );
      websiteRef.current.scale.setScalar(intro * fScale);
    }

    if (cardRef.current) {
      const fScale = focus === 0 ? 1.18 : 1;
      cardRef.current.position.set(
        -1.45 * spreadOut,
        -1.12 * spreadOut + (q.animate ? Math.sin(t * 0.75 + 2.6) * 0.035 : 0),
        0.28 + detailW * 0.18 + (focus === 0 ? 0.28 : 0),
      );
      cardRef.current.scale.setScalar(intro * fScale);
    }

    if (iconRef.current) {
      const fScale = focus === 1 ? 1.18 : 1;
      iconRef.current.position.set(
        1.78 * spreadOut,
        -1.06 * spreadOut + (q.animate ? Math.sin(t * 0.72 + 3.8) * 0.035 : 0),
        0.32 + detailW * 0.18 + (focus === 1 ? 0.28 : 0),
      );
      iconRef.current.scale.setScalar(intro * fScale);
    }

    // 5. Swatch fan opens with dials & scroll
    const fanSpread = lerp(0.22, 0.36, d.struct * 0.6 + machineW * 0.4) * (1 - calmW * 0.2);
    for (let i = 0; i < 5; i++) {
      const blade = swatchBlades.current[i];
      if (blade) {
        blade.rotation.z = (i - 2) * fanSpread;
      }
    }

    // 6. Camera choreography — frames hero & drifts calmly across sections
    const cam = state.camera;
    const px = q.animate ? pointer.x * 0.32 : 0;
    const py = q.animate ? pointer.y * 0.2 : 0;
    const tx = px;
    const ty = 0.05 + py;
    const tz = 9.15 - detailW * 0.35 + (1 - intro) * 1.4;

    if (q.animate) {
      cam.position.x += (tx - cam.position.x) * 0.05;
      cam.position.y += (ty - cam.position.y) * 0.05;
      cam.position.z += (tz - cam.position.z) * 0.05;
      _look.set(0.35, 0, 0);
      lookCur.current.lerp(_look, 0.06);
    } else {
      cam.position.set(tx, ty, tz);
      lookCur.current.set(0.35, 0, 0);
    }
    cam.lookAt(lookCur.current);

    if (coreFrame.current) report(coreFrame.current, cam, 0.92 * intro);
  });

  return (
    <group position={stage.pos}>
      <SceneLightRig />

      <group ref={atelierRoot}>
        {/* Central Drafting Plinth + Extruded 3D Glass Logomark */}
        <group ref={centerGroup}>
          <ConstructionGridBackplate ringRef={ringRef} outerRingRef={outerRingRef} />
          <ExtrudedGlassLogomark
            refs={{
              root: markRoot,
              leftBeam,
              rightBeam,
              crossBeam,
              innerRing,
              coreFrame,
              orbitalNode,
            }}
          />
        </group>

        {/* Vector System Leaders connecting the central grammar to the 4 applications */}
        <Line
          points={[
            [-0.95, 0.65, 0],
            [-1.35, 0.92, -0.18],
          ]}
          color="#6b87ff"
          lineWidth={1}
          transparent
          opacity={0.42}
        />
        <Line
          points={[
            [0.95, 0.65, 0],
            [1.48, 0.92, -0.18],
          ]}
          color="#6b87ff"
          lineWidth={1}
          transparent
          opacity={0.42}
        />
        <Line
          points={[
            [-0.95, -0.65, 0],
            [-1.3, -0.92, 0.18],
          ]}
          color="#6b87ff"
          lineWidth={1}
          transparent
          opacity={0.42}
        />
        <Line
          points={[
            [0.95, -0.65, 0],
            [1.42, -0.92, 0.18],
          ]}
          color="#6b87ff"
          lineWidth={1}
          transparent
          opacity={0.42}
        />

        {/* The 4 Physical Brand Applications in Glass & Porcelain */}
        <SignageTotemMiniature groupRef={signageRef} />
        <WebsiteHeroMiniature groupRef={websiteRef} />
        <BusinessCardMiniature groupRef={cardRef} />
        <AppIconMiniature groupRef={iconRef} />

        {/* Blue-Spectrum Swatch Fan at the base */}
        <SwatchFanMiniature groupRef={swatchRef} bladeRefs={swatchBlades} />
      </group>

      <ParticleField
        count={Math.floor(1500 * q.particles)}
        drift={q.animate ? 0.09 : 0}
        opacity={0.36}
      />
    </group>
  );
}
