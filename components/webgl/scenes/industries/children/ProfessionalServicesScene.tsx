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
import BoardroomTable, { TABLE_TOP_Y } from './professional-services/BoardroomTable';
import EvidenceFolio, { FAN_PAGE_COUNT } from './professional-services/EvidenceFolio';
import ShortlistAndIntake from './professional-services/ShortlistAndIntake';

/**
 * ProfessionalServicesScene — "The Partner's Evidence Table" (v2).
 *
 * A museum-grade porcelain, cobalt and crystal-glass architectural miniature
 * of a partner's boardroom table surrounded by four sculpted executive chairs,
 * a cantilevered banker's lamp, an open hardbound proposal folio whose
 * evidence leaves fan open, a fountain pen on its rest, three stepped
 * case-study dossiers, a three-firm shortlist rack where your firm's
 * sapphire slate rises above the peers, and an angled glass calendar console
 * where the partner consultation slot illuminates as the meeting is booked.
 *
 * Zero allocations in useFrame; reduced motion renders the finished tableau.
 */

const _camPos = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

export default function ProfessionalServicesScene() {
  const q = useQuality();
  const stageRef = useRef<THREE.Group>(null);
  const hotspotTargetRef = useRef<THREE.Group>(null);

  const clientChairRef = useRef<THREE.Group>(null);
  const lampShadeRef = useRef<THREE.Group>(null);
  const lampLightRef = useRef<THREE.MeshStandardMaterial>(null);

  const folioPageRefs = useRef<(THREE.Group | null)[]>([]);
  const dossierRefs = useRef<(THREE.Group | null)[]>([]);
  const fountainPenRef = useRef<THREE.Group>(null);
  const evidenceBarsRef = useRef<(THREE.Mesh | null)[]>([]);

  const shortlistRefs = useRef<(THREE.Group | null)[]>([]);
  const winnerCrestMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const citationArcGroupRef = useRef<THREE.Group>(null);
  const bookedSlotRef = useRef<THREE.Group>(null);
  const bookedSlotMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const intakeNodeMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const partnerBriefRef = useRef<THREE.Group>(null);

  const reportHotspot = useHotspotReporter('ps-beam');

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const compact = q.compact;

    const marketTruth = anim ? getSectionProgress('market-truth') : 1;
    const feature = anim ? getSectionProgress('feature') : 1;
    const detail = anim ? getSectionProgress('detail') : 1;
    const faq = anim ? getSectionProgress('faq') : 0;
    const cta = anim ? getSectionProgress('cta') : 0;

    const intro = anim ? smooth(Math.min(el / 1.4, 1)) : 1;

    /* Distinct section progress curves (0..1) */
    const pTruth = anim ? smooth(sectionRange(marketTruth, 0.04, 0.72)) : 1;
    const pPlay1 = anim ? smooth(sectionRange(feature, 0.02, 0.36)) : 1;
    const pPlay2 = anim ? smooth(sectionRange(feature, 0.28, 0.66)) : 1;
    const pPlay3 = anim ? smooth(sectionRange(feature, 0.54, 0.94)) : 1;
    const pDetail = anim ? smooth(sectionRange(detail, 0.04, 0.75)) : 1;
    const pFaq = anim ? smooth(sectionRange(faq, 0.05, 0.75)) : 0;
    const pCta = anim ? smooth(sectionRange(cta, 0.05, 0.75)) : 0;

    /* 1. Stage placement & rotation — each section has a distinct camera/model framing */
    const stage = stageRef.current;
    if (stage) {
      const baseScale = compact
        ? 0.46 - pFaq * 0.04 - pCta * 0.04
        : 0.79 + pTruth * 0.05 - pFaq * 0.11 - pCta * 0.15;
      stage.scale.setScalar(Math.max(baseScale * (0.86 + 0.14 * intro), 0.001));

      if (compact) {
        const yMobile =
          -1.82 +
          pPlay1 * 0.92 -
          pDetail * 0.42 -
          pFaq * 0.42 +
          pCta * 0.35 -
          (1 - intro) * 0.45;
        stage.position.set(0, yMobile, 0);
        stage.rotation.set(
          0.16 + pDetail * 0.05,
          -0.42 + pTruth * 0.18 - pPlay3 * 0.22 + pDetail * 0.14,
          0
        );
      } else {
        const xTarget =
          1.98 -
          pTruth * 0.14 +
          pPlay1 * 0.06 -
          pPlay3 * 0.08 +
          pFaq * 0.06 +
          pCta * 0.12;
        const yTarget =
          -1.18 +
          pTruth * 0.36 +
          pPlay1 * 0.05 -
          pDetail * 0.06 +
          pFaq * 0.08 +
          pCta * 0.24 -
          (1 - intro) * 0.65;
        stage.position.set(xTarget, yTarget, 0);

        const idleYaw = anim ? Math.sin(el * 0.28) * 0.028 : 0;
        const yawTarget =
          -0.46 +
          pTruth * 0.24 +
          pPlay1 * 0.16 -
          pPlay3 * 0.34 +
          pDetail * 0.14 +
          idleYaw;
        const pitchTarget = 0.12 + pTruth * 0.05 + pPlay2 * 0.04 + pDetail * 0.04;
        stage.rotation.set(pitchTarget, yawTarget, 0);
      }
    }

    /* 2. Open Proposal Folio — leaves fan wider from hero -> market-truth -> feature */
    const fanSpread = 0.22 + pTruth * 0.52 + pPlay1 * 0.26;
    for (let i = 0; i < FAN_PAGE_COUNT; i++) {
      const pg = folioPageRefs.current[i];
      if (!pg) continue;
      const frac = (i + 1) / (FAN_PAGE_COUNT + 1);
      const baseAngle = 0.15 + frac * (0.75 + fanSpread * 1.85);
      const flutter = anim ? Math.sin(el * 1.1 + i * 1.3) * 0.016 : 0;
      pg.rotation.z = baseAngle + flutter;
    }

    /* 3. 3D Evidence Bars on Right Folio Page — rise with pTruth & pPlay2 */
    const barLift = 0.32 + 0.68 * Math.max(pTruth, pPlay2);
    for (let b = 0; b < 4; b++) {
      const m = evidenceBarsRef.current[b];
      if (!m) continue;
      const hScale = (0.4 + b * 0.24) * barLift;
      m.scale.set(1, hScale, 1);
      m.position.y = 0.034 + (0.16 * hScale) / 2;
    }

    /* 4. Three Case-Study Dossiers — step upward & fan outward in Play 01 */
    const dossierStep = 0.15 + 0.85 * Math.max(pPlay1, pDetail);
    for (let d = 0; d < 3; d++) {
      const dg = dossierRefs.current[d];
      if (!dg) continue;
      dg.position.set(
        d * (0.03 + dossierStep * 0.095),
        d * (0.028 + dossierStep * 0.068),
        -d * (0.035 + dossierStep * 0.085)
      );
      dg.rotation.y = d * 0.085 * dossierStep;
    }

    /* 5. The Shortlist of Three — Center Winner Slate rises dramatically in Market Truth & Play 02 */
    const shortlistRise = 0.18 + 0.82 * Math.max(pTruth, pPlay2);
    const peerLeft = shortlistRefs.current[0];
    const winner = shortlistRefs.current[1];
    const peerRight = shortlistRefs.current[2];

    if (peerLeft) {
      peerLeft.position.y = 0.34 - shortlistRise * 0.05;
    }
    if (peerRight) {
      peerRight.position.y = 0.34 - shortlistRise * 0.05;
    }
    if (winner) {
      const floatY = anim ? Math.sin(el * 1.4) * 0.012 : 0;
      winner.position.y = 0.38 + shortlistRise * 0.38 + floatY;
      winner.position.z = 0.02 + shortlistRise * 0.06;
      winner.scale.setScalar(1 + shortlistRise * 0.1);
    }
    if (winnerCrestMatRef.current) {
      winnerCrestMatRef.current.emissiveIntensity = 1.0 + shortlistRise * 1.6;
    }
    if (citationArcGroupRef.current) {
      citationArcGroupRef.current.scale.y = 0.25 + 0.75 * shortlistRise;
    }

    /* 6. Intelligent Intake & Calendar Slate — Meeting Slot lights up & rises in Play 03 & Detail */
    const intakeActive = Math.max(0.15, pPlay3, pDetail);
    for (let n = 0; n < 3; n++) {
      const mat = intakeNodeMatRefs.current[n];
      if (!mat) continue;
      const pulse = anim ? 0.5 + 0.5 * Math.sin(el * 3.2 - n * 1.1) : 1;
      const nodeOn = smooth(sectionRange(intakeActive, n * 0.18, 0.42 + n * 0.18));
      mat.emissiveIntensity = 0.3 + nodeOn * (1.5 + pulse * 0.8);
    }

    if (bookedSlotRef.current) {
      const slotLift = smooth(sectionRange(intakeActive, 0.2, 0.92));
      const slotBob = anim ? Math.sin(el * 2.1) * 0.004 * slotLift : 0;
      bookedSlotRef.current.position.z = 0.024 + slotLift * 0.048 + slotBob;
      bookedSlotRef.current.scale.setScalar(1 + slotLift * 0.2);
    }
    if (bookedSlotMatRef.current) {
      const slotGlow = smooth(sectionRange(intakeActive, 0.2, 0.92));
      bookedSlotMatRef.current.emissiveIntensity = 0.8 + slotGlow * 2.2;
    }

    /* Partner Brief Card glides along the table toward the Senior Partner's chair */
    if (partnerBriefRef.current) {
      const briefSlide = Math.max(pPlay3, pDetail);
      partnerBriefRef.current.position.x = -0.88 - briefSlide * 0.52;
      partnerBriefRef.current.position.y = TABLE_TOP_Y + 0.016 + briefSlide * 0.012;
    }

    /* 7. In Practice (`detail`): Client Chair rotates & glides in; Fountain Pen lifts into poise */
    const chairProgress = Math.max(pPlay3 * 0.35, pDetail);
    if (clientChairRef.current) {
      clientChairRef.current.position.x = 2.32 - chairProgress * 0.36;
      clientChairRef.current.position.z = 0.26 - chairProgress * 0.26;
      clientChairRef.current.rotation.y = Math.PI - 0.48 * (1 - chairProgress);
    }

    if (fountainPenRef.current) {
      const penPoise = pDetail;
      fountainPenRef.current.position.y = 0.045 + penPoise * 0.11;
      fountainPenRef.current.rotation.z = -0.05 - penPoise * 0.42;
      fountainPenRef.current.rotation.y = -0.18 + penPoise * 0.32;
    }

    if (lampShadeRef.current) {
      lampShadeRef.current.rotation.z = -0.06 + pDetail * 0.1;
    }
    if (lampLightRef.current) {
      lampLightRef.current.emissiveIntensity = 1.6 + pTruth * 0.5 + pDetail * 0.7;
    }

    /* Report hotspot to ProximityType */
    if (hotspotTargetRef.current) {
      reportHotspot(
        hotspotTargetRef.current,
        state.camera,
        0.55 + 0.4 * Math.max(pTruth, pDetail)
      );
    }

    /* 8. Camera — elevated architectural 3/4 view with gentle pointer parallax */
    const orbit = anim ? Math.sin(el * 0.07) * 0.05 : 0;
    const dist = (compact ? 9.5 : 8.2) - intro * 0.35;
    const camX =
      Math.sin(orbit) * dist +
      (anim ? pointer.x * 0.3 : 0) -
      (compact ? 0 : 0.3);
    const camY = (compact ? 4.35 : 4.05) + (anim ? pointer.y * 0.2 : 0);
    const camZ = Math.cos(orbit) * dist;

    _camPos.set(camX, camY, camZ);
    state.camera.position.lerp(_camPos, 0.06);

    _lookAt.set(compact ? 0 : 0.24, 0.22, 0);
    state.camera.lookAt(_lookAt);
  });

  return (
    <group>
      <SceneLightRig />

      <group ref={stageRef}>
        <BoardroomTable
          clientChairRef={clientChairRef}
          lampShadeRef={lampShadeRef}
          lampLightRef={lampLightRef}
        />

        <EvidenceFolio
          folioPageRefs={folioPageRefs}
          dossierRefs={dossierRefs}
          fountainPenRef={fountainPenRef}
          evidenceBarsRef={evidenceBarsRef}
        />

        <ShortlistAndIntake
          shortlistRefs={shortlistRefs}
          winnerCrestMatRef={winnerCrestMatRef}
          citationArcGroupRef={citationArcGroupRef}
          bookedSlotRef={bookedSlotRef}
          bookedSlotMatRef={bookedSlotMatRef}
          intakeNodeMatRefs={intakeNodeMatRefs}
          partnerBriefRef={partnerBriefRef}
        />

        {/* Hotspot anchor above the Folio & Shortlist Winner */}
        <group ref={hotspotTargetRef} position={[0.15, TABLE_TOP_Y + 0.38, -0.08]} />
      </group>

      <ParticleField
        count={Math.floor(1100 * q.particles)}
        drift={q.animate ? 0.09 : 0}
        opacity={0.3}
      />
    </group>
  );
}
