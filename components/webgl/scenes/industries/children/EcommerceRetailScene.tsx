'use client';

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
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
import {
  ShelfSystem,
  type ShelfSystemHandle,
} from './ecommerce-retail/ShelfSystem';
import {
  FlagshipVitrine,
  type FlagshipVitrineHandle,
} from './ecommerce-retail/FlagshipVitrine';
import {
  RetentionLoop,
  type RetentionLoopHandle,
} from './ecommerce-retail/RetentionLoop';

/**
 * EcommerceRetailScene — "Own the Shelf, Own the Margin".
 *
 * An architectural luxury retail miniature in porcelain, frosted/crystal
 * glass, deep cobalt enamel, and fine blueprint linework:
 *
 * - Beat 0 (`hero`): A 3-tier architectural retail shelving gondola with
 *   flanking bays of identical pale-ice "marketplace commodity" cartons
 *   (with SKU labels, barcode strips, and hanging shelf price tags). In
 *   the central atrium sits the Flagship Display Pedestal under a museum
 *   vitrine frame and gallery spotlight halo, showcasing the "Resting Art"
 *   sculptural lounge chair + ottoman, a tailored boutique shopping bag
 *   with braided cord handles and swaying margin hang-tag, and a faceted
 *   sapphire flacon.
 * - Beat 1 (`market-truth`): The commodity shelf wings step back while the
 *   central Flagship Pedestal telescopes upward on its 4-pillar truss;
 *   the hinged glass vitrine doors swing open and the electric-blue margin
 *   halo blooms. Hotspot 'retail-vitrine' tints ProximityType.
 * - Beat 2 (`feature` — The Plays): A porcelain-and-cobalt Flagship
 *   Storefront & AI Concierge UI slate unfolds beside the risen vitrine.
 * - Beat 3 (`detail` — Resting Art & Retention): A 3D luminous elliptical
 *   orbital fulfilment & retention loop awakens around the vitrine; a
 *   bespoke D2C parcel sealed with electric-blue tape glides between the
 *   flagship and a miniature customer doorstep portal.
 * - Beat 4 (`faq` / `cta`): The miniature frames cleanly in the upper-right
 *   gallery space so the FAQ and CTA copy read on unobstructed paper-white.
 */

const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();

export default function EcommerceRetailScene() {
  const q = useQuality();
  const rootRef = useRef<THREE.Group>(null);
  const shelfRef = useRef<ShelfSystemHandle>(null);
  const vitrineRef = useRef<FlagshipVitrineHandle>(null);
  const loopRef = useRef<RetentionLoopHandle>(null);
  const hotspotRef = useRef<THREE.Group>(null);

  const animState = useRef({
    intro: 1,
    rise: 0,
    feature: 0,
    detail: 0,
    outro: 0,
    time: 0,
  });

  const report = useHotspotReporter('retail-vitrine');

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;

    const rawTruth = getSectionProgress('market-truth');
    const rawFeature = getSectionProgress('feature');
    const rawDetail = getSectionProgress('detail');
    const rawFaq = getSectionProgress('faq');
    const rawCta = getSectionProgress('cta');

    const intro = anim ? smooth(Math.min(el / 1.45, 1)) : 1;
    const rise = smooth(sectionRange(rawTruth, 0.08, 0.65));
    const feature = smooth(sectionRange(rawFeature, 0.08, 0.65));
    const detail = smooth(sectionRange(rawDetail, 0.08, 0.68));
    const outro = smooth(
      Math.max(sectionRange(rawFaq, 0.2, 0.85), sectionRange(rawCta, 0.05, 0.65)),
    );
    const ctaLift = smooth(sectionRange(rawCta, 0.1, 0.75));

    const s = animState.current;
    s.intro = intro;
    s.rise = anim ? rise : Math.max(0.32, rise);
    s.feature = feature;
    s.detail = detail;
    s.outro = outro;
    s.time = anim ? el : 1.8;

    shelfRef.current?.update();
    vitrineRef.current?.update();
    loopRef.current?.update();

    /* Root group placement & rotation across scroll beats */
    const g = rootRef.current;
    if (g) {
      if (q.compact) {
        // Mobile viewport: centered horizontally, positioned cleanly below hero copy
        const mobScale = 0.40 - outro * 0.05;
        g.scale.setScalar(mobScale);
        g.position.set(
          0.02,
          -1.02 + rise * 0.28 + outro * 0.52 + ctaLift * 0.28 - (1 - intro) * 0.35,
          -0.2,
        );
        g.rotation.y =
          -0.24 +
          rise * 0.12 -
          detail * 0.16 +
          (anim ? Math.sin(el * 0.25) * 0.04 : 0);
      } else {
        // Desktop viewport: poised on the right stage (x ≈ 58%..93% of viewport width)
        const deskScale = 0.86 - detail * 0.03 - outro * 0.10;
        g.scale.setScalar(deskScale);
        const baseX = 1.54 + feature * 0.06 - detail * 0.04 + outro * 0.18;
        const baseY = -0.12 - rise * 0.04 + ctaLift * 0.68 - (1 - intro) * 0.5;
        const baseZ = -outro * 0.45;
        g.position.set(baseX, baseY, baseZ);
        g.rotation.y =
          -0.32 +
          rise * 0.10 +
          feature * 0.06 -
          detail * 0.14 +
          outro * 0.14 +
          (anim ? Math.sin(el * 0.22) * 0.04 : 0);
      }
    }

    /* Report hotspot for ProximityType on market-truth */
    if (hotspotRef.current) {
      report(hotspotRef.current, state.camera, 0.58 + 0.42 * s.rise);
    }

    /* Camera choreography — smooth damped lerp */
    const px = anim ? pointer.x * 0.24 : 0;
    const py = anim ? pointer.y * 0.16 : 0;

    if (q.compact) {
      _camPos.set(px * 0.5, 0.22 + py * 0.5, 8.8 - intro * 0.3);
      _camLook.set(0, -0.18, 0);
    } else {
      const camZ = 7.65 - intro * 0.3 - rise * 0.2 + detail * 0.15 + outro * 0.35;
      const camY = 0.24 + rise * 0.10 - detail * 0.04 + py;
      const camX = px;
      _camPos.set(camX, camY, camZ);
      _camLook.set(-0.30, 0.05 + rise * 0.08, 0);
    }

    if (anim) {
      state.camera.position.lerp(_camPos, 0.06);
    } else {
      state.camera.position.copy(_camPos);
    }
    state.camera.lookAt(_camLook);
  });

  return (
    <group>
      <SceneLightRig />

      <group ref={rootRef} position={[1.54, -0.12, 0]} rotation={[0, -0.32, 0]}>
        <ShelfSystem ref={shelfRef} animState={animState} />
        <FlagshipVitrine
          ref={vitrineRef}
          animState={animState}
          hotspotRef={hotspotRef}
        />
        <RetentionLoop ref={loopRef} animState={animState} />
      </group>

      <ParticleField
        count={Math.floor(1100 * q.particles)}
        drift={q.animate ? 0.09 : 0}
        opacity={0.28}
      />
    </group>
  );
}
