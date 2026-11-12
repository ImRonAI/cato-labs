'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line, RoundedBox } from '@react-three/drei';
import { GlassMaterial } from '../../../../lib/materials';
import { TABLE_TOP_Y } from './BoardroomTable';
import { createCalendarSlateTexture, createFolioPageTexture } from './textures';

export interface ShortlistAndIntakeProps {
  shortlistRefs: React.MutableRefObject<(THREE.Group | null)[]>;
  winnerCrestMatRef: React.RefObject<THREE.MeshStandardMaterial | null>;
  citationArcGroupRef: React.RefObject<THREE.Group | null>;
  bookedSlotRef: React.RefObject<THREE.Group | null>;
  bookedSlotMatRef: React.RefObject<THREE.MeshStandardMaterial | null>;
  intakeNodeMatRefs: React.MutableRefObject<(THREE.MeshStandardMaterial | null)[]>;
  partnerBriefRef: React.RefObject<THREE.Group | null>;
}

export default function ShortlistAndIntake({
  shortlistRefs,
  winnerCrestMatRef,
  citationArcGroupRef,
  bookedSlotRef,
  bookedSlotMatRef,
  intakeNodeMatRefs,
  partnerBriefRef,
}: ShortlistAndIntakeProps) {
  const textures = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return {
      calendar: createCalendarSlateTexture(),
      brief: createFolioPageTexture('brief'),
      matrix: createFolioPageTexture('matrix'),
    };
  }, []);

  useEffect(() => {
    return () => {
      if (textures) {
        textures.calendar.dispose();
        textures.brief.dispose();
        textures.matrix.dispose();
      }
    };
  }, [textures]);

  const peerOutlinePts = useMemo<THREE.Vector3[]>(
    () => [
      new THREE.Vector3(-0.17, -0.28, 0.02),
      new THREE.Vector3(0.17, -0.28, 0.02),
      new THREE.Vector3(0.17, 0.28, 0.02),
      new THREE.Vector3(-0.17, 0.28, 0.02),
      new THREE.Vector3(-0.17, -0.28, 0.02),
    ],
    []
  );

  const winnerOutlinePts = useMemo<THREE.Vector3[]>(
    () => [
      new THREE.Vector3(-0.2, -0.36, 0.028),
      new THREE.Vector3(0.2, -0.36, 0.028),
      new THREE.Vector3(0.2, 0.36, 0.028),
      new THREE.Vector3(-0.2, 0.36, 0.028),
      new THREE.Vector3(-0.2, -0.36, 0.028),
    ],
    []
  );

  const calendarOutlinePts = useMemo<THREE.Vector3[]>(
    () => [
      new THREE.Vector3(-0.39, -0.27, 0.022),
      new THREE.Vector3(0.39, -0.27, 0.022),
      new THREE.Vector3(0.39, 0.27, 0.022),
      new THREE.Vector3(-0.39, 0.27, 0.022),
      new THREE.Vector3(-0.39, -0.27, 0.022),
    ],
    []
  );

  const slotOutlinePts = useMemo<THREE.Vector3[]>(
    () => [
      new THREE.Vector3(-0.075, -0.05, 0.018),
      new THREE.Vector3(0.075, -0.05, 0.018),
      new THREE.Vector3(0.075, 0.05, 0.018),
      new THREE.Vector3(-0.075, 0.05, 0.018),
      new THREE.Vector3(-0.075, -0.05, 0.018),
    ],
    []
  );

  /* Two parabolic citation arcs connecting the Proposal Folio to the Shortlist Winner Slate */
  const { arcPointsA, arcPointsB } = useMemo(() => {
    const curveA = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.22, TABLE_TOP_Y + 0.09, 0.08),
      new THREE.Vector3(0.2, TABLE_TOP_Y + 0.72, -0.16),
      new THREE.Vector3(0.62, TABLE_TOP_Y + 0.58, -0.34)
    );
    const curveB = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0.06, TABLE_TOP_Y + 0.09, 0.14),
      new THREE.Vector3(0.38, TABLE_TOP_Y + 0.56, -0.04),
      new THREE.Vector3(0.62, TABLE_TOP_Y + 0.44, -0.34)
    );
    return {
      arcPointsA: curveA.getPoints(28),
      arcPointsB: curveB.getPoints(28),
    };
  }, []);

  return (
    <group>
      {/* ==================== THE SHORTLIST OF THREE RACK ==================== */}
      <group position={[0.62, TABLE_TOP_Y + 0.005, -0.36]} rotation={[0, -0.26, 0]}>
        {/* Sculpted deep-navy & cobalt presentation plinth */}
        <RoundedBox
          args={[1.4, 0.05, 0.25]}
          radius={0.014}
          smoothness={3}
          position={[0, 0.025, 0]}
        >
          <meshStandardMaterial color="#18285c" roughness={0.26} metalness={0.28} />
        </RoundedBox>
        <RoundedBox
          args={[1.3, 0.02, 0.15]}
          radius={0.006}
          smoothness={2}
          position={[0, 0.054, 0]}
        >
          <meshStandardMaterial color="#2e4bff" roughness={0.2} metalness={0.42} />
        </RoundedBox>

        {/* Left Competitor Slate (index 0 — muted ice glass) */}
        <group
          ref={(g) => {
            shortlistRefs.current[0] = g;
          }}
          position={[-0.44, 0.34, 0]}
        >
          <RoundedBox args={[0.34, 0.56, 0.036]} radius={0.012} smoothness={3}>
            <GlassMaterial kind="ice" />
          </RoundedBox>
          <mesh position={[0, 0.12, 0.019]}>
            <boxGeometry args={[0.22, 0.03, 0.006]} />
            <meshStandardMaterial color="#5f7dff" roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.04, 0.019]}>
            <boxGeometry args={[0.22, 0.18, 0.006]} />
            <meshStandardMaterial color="#a8beff" roughness={0.48} />
          </mesh>
          <Line points={peerOutlinePts} color="#5f7dff" lineWidth={1.4} transparent opacity={0.75} />
        </group>

        {/* Center Winner Slate — YOUR FIRM (index 1 — rises decisively) */}
        <group
          ref={(g) => {
            shortlistRefs.current[1] = g;
          }}
          position={[0, 0.52, 0.02]}
        >
          {/* Electric sapphire glass monolith */}
          <RoundedBox args={[0.42, 0.75, 0.052]} radius={0.016} smoothness={4}>
            <GlassMaterial kind="core" />
          </RoundedBox>
          {/* Inner credential & matrix proof card */}
          <mesh position={[0, -0.02, 0.028]}>
            <planeGeometry args={[0.34, 0.55]} />
            <meshStandardMaterial
              color="#dce6ff"
              map={textures?.matrix ?? null}
              roughness={0.62}
              metalness={0.0}
            />
          </mesh>
          {/* Luminous verification crest at top of Winner Slate */}
          <mesh position={[0, 0.295, 0.029]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.016, 20]} />
            <meshStandardMaterial
              ref={winnerCrestMatRef}
              color="#2e4bff"
              emissive="#2e4bff"
              emissiveIntensity={1.8}
              roughness={0.15}
            />
          </mesh>
          <Line points={winnerOutlinePts} color="#2e4bff" lineWidth={2.2} transparent opacity={0.98} />
        </group>

        {/* Right Competitor Slate (index 2 — muted ice glass) */}
        <group
          ref={(g) => {
            shortlistRefs.current[2] = g;
          }}
          position={[0.44, 0.34, 0]}
        >
          <RoundedBox args={[0.34, 0.56, 0.036]} radius={0.012} smoothness={3}>
            <GlassMaterial kind="ice" />
          </RoundedBox>
          <mesh position={[0, 0.12, 0.019]}>
            <boxGeometry args={[0.22, 0.03, 0.006]} />
            <meshStandardMaterial color="#5f7dff" roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.04, 0.019]}>
            <boxGeometry args={[0.22, 0.18, 0.006]} />
            <meshStandardMaterial color="#a8beff" roughness={0.48} />
          </mesh>
          <Line points={peerOutlinePts} color="#5f7dff" lineWidth={1.4} transparent opacity={0.75} />
        </group>
      </group>

      {/* Citation Arcs connecting the Open Evidence Folio to the Shortlist Winner */}
      <group ref={citationArcGroupRef}>
        <Line points={arcPointsA} color="#2e4bff" lineWidth={2.0} transparent opacity={0.85} />
        <Line points={arcPointsB} color="#4a68ff" lineWidth={1.5} transparent opacity={0.68} />
      </group>

      {/* ==================== INTELLIGENT INTAKE & CALENDAR SLATE ==================== */}
      <group position={[1.12, TABLE_TOP_Y + 0.006, 0.32]} rotation={[0, -0.38, 0]}>
        {/* Angled navy & cobalt easel stand */}
        <RoundedBox
          args={[0.58, 0.1, 0.24]}
          radius={0.014}
          smoothness={3}
          position={[0, 0.05, -0.06]}
        >
          <meshStandardMaterial color="#18285c" roughness={0.28} metalness={0.28} />
        </RoundedBox>

        {/* Tilted Glass Schedule Console (-0.54 rad tilt so face points toward camera, not ceiling) */}
        <group position={[0, 0.22, 0]} rotation={[-0.54, 0, 0]}>
          <RoundedBox args={[0.8, 0.56, 0.036]} radius={0.014} smoothness={4}>
            <GlassMaterial kind="core" />
          </RoundedBox>

          {/* Printed Calendar Schedule Matrix face */}
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[0.74, 0.5]} />
            <meshStandardMaterial
              color="#dce6ff"
              map={textures?.calendar ?? null}
              roughness={0.68}
              metalness={0.0}
            />
          </mesh>

          <Line points={calendarOutlinePts} color="#2e4bff" lineWidth={1.8} transparent opacity={0.92} />

          {/* THE BOOKED PARTNER MEETING SLOT (Col 4, Row 2 — rises & lights up!) */}
          <group ref={bookedSlotRef} position={[0.14, 0.02, 0.03]}>
            <RoundedBox args={[0.15, 0.1, 0.028]} radius={0.008} smoothness={3}>
              <meshStandardMaterial
                ref={bookedSlotMatRef}
                color="#2e4bff"
                emissive="#2e4bff"
                emissiveIntensity={2.0}
                roughness={0.14}
                metalness={0.25}
              />
            </RoundedBox>
            {/* Crisp white confirmation bar on top of lit calendar slot */}
            <mesh position={[0, 0.012, 0.016]}>
              <boxGeometry args={[0.098, 0.018, 0.004]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[-0.015, -0.016, 0.016]}>
              <boxGeometry args={[0.068, 0.012, 0.004]} />
              <meshBasicMaterial color="#dce6ff" />
            </mesh>
            <Line points={slotOutlinePts} color="#ffffff" lineWidth={1.6} transparent opacity={0.98} />
          </group>
        </group>
      </group>

      {/* ==================== INTAKE QUALIFICATION NODES & PARTNER BRIEF ==================== */}
      {/* 3 Qualification Gate Nodes along the central table console channel */}
      {[0.72, 0.24, -0.24].map((xPos, nIdx) => (
        <mesh
          key={nIdx}
          position={[xPos, TABLE_TOP_Y + 0.014, -0.04]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.02, 0.038, 20]} />
          <meshStandardMaterial
            ref={(m) => {
              intakeNodeMatRefs.current[nIdx] = m;
            }}
            color="#2e4bff"
            emissive="#2e4bff"
            emissiveIntensity={1.0}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* The Partner Brief Card — slides to the Senior Partner's position at the head of the table */}
      <group
        ref={partnerBriefRef}
        position={[-1.36, TABLE_TOP_Y + 0.016, 0.04]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <RoundedBox args={[0.4, 0.022, 0.52]} radius={0.006} smoothness={3}>
          <meshStandardMaterial color="#142354" roughness={0.28} metalness={0.28} />
        </RoundedBox>
        <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.36, 0.48]} />
          <meshStandardMaterial
            color="#dce6ff"
            map={textures?.brief ?? null}
            roughness={0.65}
            metalness={0.0}
          />
        </mesh>
      </group>
    </group>
  );
}
