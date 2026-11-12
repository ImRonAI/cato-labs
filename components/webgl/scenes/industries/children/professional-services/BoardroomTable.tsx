'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line, RoundedBox } from '@react-three/drei';
import { GlassMaterial } from '../../../../lib/materials';
import { createPlinthGridTexture } from './textures';

export const TABLE_TOP_Y = 0.9;

interface ExecutiveChairProps {
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
  isHeadChair?: boolean;
}

const STAR_ANGLES = [0, (Math.PI * 2) / 5, (Math.PI * 4) / 5, (Math.PI * 6) / 5, (Math.PI * 8) / 5];

/**
 * ExecutiveChair — sculpted ribbed ice-porcelain & deep-navy shell boardroom chair
 * on a 5-star cantilevered base. High contrast against paper-white background.
 */
export const ExecutiveChair = React.forwardRef<THREE.Group, ExecutiveChairProps>(
  function ExecutiveChair({ position = [0, 0, 0], rotationY = 0, scale = 1, isHeadChair = false }, ref) {
    const backHeight = isHeadChair ? 0.64 : 0.56;

    return (
      <group ref={ref} position={position} rotation={[0, rotationY, 0]} scale={scale}>
        {/* Soft contact shadow disc on plinth */}
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.35, 24]} />
          <meshBasicMaterial color="#5f7dff" transparent opacity={0.28} depthWrite={false} />
        </mesh>

        {/* 5-star base hub & legs */}
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.042, 0.052, 0.12, 12]} />
          <meshStandardMaterial color="#18285c" metalness={0.5} roughness={0.28} />
        </mesh>
        {STAR_ANGLES.map((ang, i) => (
          <group key={i} rotation={[0, ang, 0]}>
            <mesh position={[0.14, 0.055, 0]} rotation={[0, 0, -0.14]}>
              <boxGeometry args={[0.28, 0.026, 0.036]} />
              <meshStandardMaterial color="#2e4bff" metalness={0.45} roughness={0.26} />
            </mesh>
            {/* Caster wheel */}
            <mesh position={[0.26, 0.022, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.024, 10]} />
              <meshStandardMaterial color="#0f1b42" metalness={0.3} roughness={0.4} />
            </mesh>
          </group>
        ))}

        {/* Pneumatic column */}
        <mesh position={[0, 0.27, 0]}>
          <cylinderGeometry args={[0.03, 0.034, 0.34, 12]} />
          <meshStandardMaterial color="#16275c" metalness={0.55} roughness={0.24} />
        </mesh>

        {/* Under-seat tilt cradle */}
        <mesh position={[-0.02, 0.43, 0]}>
          <boxGeometry args={[0.28, 0.045, 0.26]} />
          <meshStandardMaterial color="#12204f" metalness={0.45} roughness={0.3} />
        </mesh>

        {/* Seat cushion (ice-blue upholstery over deep navy shell) */}
        <RoundedBox
          args={[0.49, 0.068, 0.49]}
          radius={0.024}
          smoothness={3}
          position={[0.02, 0.48, 0]}
        >
          <meshStandardMaterial color="#d2dfff" roughness={0.42} metalness={0.05} />
        </RoundedBox>
        <RoundedBox
          args={[0.51, 0.034, 0.51]}
          radius={0.012}
          smoothness={2}
          position={[0.01, 0.445, 0]}
        >
          <meshStandardMaterial color="#18285c" roughness={0.28} metalness={0.3} />
        </RoundedBox>

        {/* Sculpted backrest — reclined slightly (-10 deg) */}
        <group position={[-0.21, 0.5, 0]} rotation={[0, 0, 0.17]}>
          {/* Outer structural deep-navy & cobalt shell */}
          <RoundedBox
            args={[0.052, backHeight, 0.48]}
            radius={0.018}
            smoothness={3}
            position={[-0.024, backHeight / 2, 0]}
          >
            <meshStandardMaterial
              color={isHeadChair ? '#16275c' : '#223882'}
              roughness={0.26}
              metalness={0.28}
            />
          </RoundedBox>

          {/* 3 Ribbed ice-blue upholstery bolsters */}
          {[0, 1, 2].map((r) => {
            const segH = (backHeight - 0.06) / 3;
            const y = 0.04 + r * segH + segH / 2;
            return (
              <RoundedBox
                key={r}
                args={[0.05, segH - 0.016, 0.44]}
                radius={0.016}
                smoothness={3}
                position={[0.016, y, 0]}
              >
                <meshStandardMaterial color="#d6e3ff" roughness={0.42} metalness={0.04} />
              </RoundedBox>
            );
          })}
        </group>

        {/* Cantilevered loop armrests (left & right) */}
        {[-0.25, 0.25].map((zOff, sideIdx) => (
          <group key={sideIdx} position={[0.02, 0.58, zOff]}>
            {/* Top arm pad */}
            <RoundedBox args={[0.31, 0.028, 0.045]} radius={0.01} smoothness={2} position={[0, 0.06, 0]}>
              <meshStandardMaterial color="#18285c" roughness={0.25} metalness={0.35} />
            </RoundedBox>
            {/* Front & rear vertical arm supports */}
            <mesh position={[0.12, 0.0, 0]} rotation={[0, 0, -0.18]}>
              <boxGeometry args={[0.024, 0.13, 0.028]} />
              <meshStandardMaterial color="#2e4bff" metalness={0.5} roughness={0.22} />
            </mesh>
            <mesh position={[-0.14, 0.0, 0]} rotation={[0, 0, 0.15]}>
              <boxGeometry args={[0.026, 0.13, 0.028]} />
              <meshStandardMaterial color="#2e4bff" metalness={0.5} roughness={0.22} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
);

export interface BoardroomTableProps {
  clientChairRef: React.RefObject<THREE.Group | null>;
  lampShadeRef: React.RefObject<THREE.Group | null>;
  lampLightRef: React.RefObject<THREE.MeshStandardMaterial | null>;
}

/**
 * BoardroomTable — The Partner's Boardroom Table, Architectural Vitrine Plinth,
 * 4 Executive Chairs, and Cantilevered Partner's Desk Lamp.
 */
export default function BoardroomTable({
  clientChairRef,
  lampShadeRef,
  lampLightRef,
}: BoardroomTableProps) {
  const plinthTex = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return createPlinthGridTexture();
  }, []);

  useEffect(() => {
    return () => {
      plinthTex?.dispose();
    };
  }, [plinthTex]);

  const plinthBorderPts = useMemo<THREE.Vector3[]>(() => {
    const w = 1.88;
    const d = 1.02;
    const y = 0.006;
    return [
      new THREE.Vector3(-w, y, -d),
      new THREE.Vector3(w, y, -d),
      new THREE.Vector3(w, y, d),
      new THREE.Vector3(-w, y, d),
      new THREE.Vector3(-w, y, -d),
    ];
  }, []);

  const tableEdgePts = useMemo<THREE.Vector3[]>(() => {
    const w = 1.78;
    const d = 0.92;
    const y = TABLE_TOP_Y + 0.003;
    return [
      new THREE.Vector3(-w, y, -d),
      new THREE.Vector3(w, y, -d),
      new THREE.Vector3(w, y, d),
      new THREE.Vector3(-w, y, d),
      new THREE.Vector3(-w, y, -d),
    ];
  }, []);

  const inlayEdgePts = useMemo<THREE.Vector3[]>(() => {
    const w = 1.02;
    const d = 0.2;
    const y = TABLE_TOP_Y + 0.006;
    return [
      new THREE.Vector3(-w, y, -d),
      new THREE.Vector3(w, y, -d),
      new THREE.Vector3(w, y, d),
      new THREE.Vector3(-w, y, d),
      new THREE.Vector3(-w, y, -d),
    ];
  }, []);

  return (
    <group>
      {/* ==================== ARCHITECTURAL VITRINE PLINTH ==================== */}
      {/* Upper porcelain-blue gallery deck with subtle blueprint grid */}
      <RoundedBox
        args={[3.82, 0.055, 2.1]}
        radius={0.022}
        smoothness={4}
        position={[0, -0.028, 0]}
      >
        <meshStandardMaterial
          color="#dce6ff"
          map={plinthTex ?? null}
          roughness={0.55}
          metalness={0.05}
        />
      </RoundedBox>
      {/* Lower deep-sapphire architectural base skirt */}
      <RoundedBox
        args={[3.9, 0.04, 2.18]}
        radius={0.016}
        smoothness={3}
        position={[0, -0.068, 0]}
      >
        <meshStandardMaterial color="#1b2e73" roughness={0.32} metalness={0.28} />
      </RoundedBox>
      {/* Crisp perimeter rule on plinth */}
      <Line points={plinthBorderPts} color="#2e4bff" lineWidth={1.5} transparent opacity={0.75} />

      {/* Soft ambient table shadow on the plinth */}
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.48, 1.78]} />
        <meshBasicMaterial color="#4a68ff" transparent opacity={0.22} depthWrite={false} />
      </mesh>

      {/* ==================== SCULPTURAL TRESTLE PEDESTALS ==================== */}
      {[-1.08, 1.08].map((xPos, idx) => (
        <group key={idx} position={[xPos, 0, 0]}>
          {/* Floor plinth foot plate */}
          <RoundedBox args={[0.4, 0.04, 1.1]} radius={0.012} smoothness={3} position={[0, 0.02, 0]}>
            <meshStandardMaterial color="#18285c" roughness={0.28} metalness={0.3} />
          </RoundedBox>
          {/* Twin angled architectural fins */}
          <RoundedBox
            args={[0.095, 0.82, 0.24]}
            radius={0.02}
            smoothness={3}
            position={[0, 0.43, -0.24]}
            rotation={[0.18, 0, 0]}
          >
            <meshStandardMaterial color="#c9d8ff" roughness={0.35} metalness={0.12} />
          </RoundedBox>
          <RoundedBox
            args={[0.095, 0.82, 0.24]}
            radius={0.02}
            smoothness={3}
            position={[0, 0.43, 0.24]}
            rotation={[-0.18, 0, 0]}
          >
            <meshStandardMaterial color="#c9d8ff" roughness={0.35} metalness={0.12} />
          </RoundedBox>
          {/* Central refractive core glass column */}
          <RoundedBox args={[0.15, 0.78, 0.28]} radius={0.025} smoothness={3} position={[0, 0.42, 0]}>
            <GlassMaterial kind="core" />
          </RoundedBox>
        </group>
      ))}

      {/* Central horizontal cobalt tension beam */}
      <RoundedBox args={[2.28, 0.06, 0.11]} radius={0.015} smoothness={3} position={[0, 0.38, 0]}>
        <meshStandardMaterial color="#18285c" roughness={0.25} metalness={0.42} />
      </RoundedBox>

      {/* ==================== PARTNER BOARDROOM TABLETOP ==================== */}
      {/* Lower deep-cobalt architectural bevel frame */}
      <RoundedBox
        args={[3.46, 0.048, 1.76]}
        radius={0.018}
        smoothness={4}
        position={[0, TABLE_TOP_Y - 0.062, 0]}
      >
        <meshStandardMaterial color="#203580" roughness={0.28} metalness={0.28} />
      </RoundedBox>

      {/* Primary thick sapphire-crystal boardroom tabletop */}
      <RoundedBox
        args={[3.58, 0.078, 1.86]}
        radius={0.032}
        smoothness={5}
        position={[0, TABLE_TOP_Y - 0.038, 0]}
      >
        <GlassMaterial kind="azure" />
      </RoundedBox>

      {/* Crisp electric-blue architectural edge rule on tabletop */}
      <Line points={tableEdgePts} color="#2e4bff" lineWidth={1.8} transparent opacity={0.85} />

      {/* Central recessed boardroom console channel */}
      <RoundedBox
        args={[2.06, 0.016, 0.4]}
        radius={0.006}
        smoothness={2}
        position={[0, TABLE_TOP_Y - 0.001, 0]}
      >
        <meshStandardMaterial color="#16275c" roughness={0.32} metalness={0.22} />
      </RoundedBox>
      <Line points={inlayEdgePts} color="#5f7dff" lineWidth={1.4} transparent opacity={0.8} />

      {/* ==================== FOUR EXECUTIVE BOARDROOM CHAIRS ==================== */}
      {/* 1. Senior Partner's Chair at the left head of the table */}
      <ExecutiveChair position={[-2.08, 0, 0]} rotationY={0} scale={1.06} isHeadChair />

      {/* 2 & 3. Associate / Practice Partner Chairs along the far side */}
      <ExecutiveChair position={[-0.64, 0, -1.18]} rotationY={-Math.PI / 2 + 0.08} scale={0.96} />
      <ExecutiveChair position={[0.64, 0, -1.18]} rotationY={-Math.PI / 2 - 0.08} scale={0.96} />

      {/* 4. The Client's Chair at the right head (animated inward on scroll) */}
      <ExecutiveChair
        ref={clientChairRef}
        position={[2.24, 0, 0.18]}
        rotationY={Math.PI - 0.42}
        scale={1.02}
      />

      {/* ==================== PARTNER'S CANTILEVERED DESK LAMP ==================== */}
      <group position={[-1.36, TABLE_TOP_Y, -0.56]} rotation={[0, 0.42, 0]}>
        {/* Weighted deep-navy & cobalt cylindrical base */}
        <mesh position={[0, 0.028, 0]}>
          <cylinderGeometry args={[0.14, 0.16, 0.056, 24]} />
          <meshStandardMaterial color="#16275c" roughness={0.26} metalness={0.32} />
        </mesh>
        <mesh position={[0, 0.062, 0]}>
          <cylinderGeometry args={[0.11, 0.12, 0.022, 24]} />
          <meshStandardMaterial color="#2e4bff" roughness={0.2} metalness={0.45} />
        </mesh>

        {/* Twin articulated cobalt stem rods */}
        {[-0.032, 0.032].map((zOff, i) => (
          <mesh key={i} position={[0.06, 0.34, zOff]} rotation={[0, 0, -0.22]}>
            <cylinderGeometry args={[0.012, 0.014, 0.58, 10]} />
            <meshStandardMaterial color="#2e4bff" metalness={0.55} roughness={0.2} />
          </mesh>
        ))}

        {/* Upper knuckle joint */}
        <mesh position={[0.12, 0.61, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.026, 0.026, 0.1, 12]} />
          <meshStandardMaterial color="#16275c" metalness={0.5} roughness={0.25} />
        </mesh>

        {/* Cantilevered horizontal lamp arm & shade */}
        <group ref={lampShadeRef} position={[0.12, 0.61, 0]}>
          <mesh position={[0.16, 0.03, 0]} rotation={[0, 0, -1.35]}>
            <cylinderGeometry args={[0.011, 0.011, 0.34, 10]} />
            <meshStandardMaterial color="#2e4bff" metalness={0.55} roughness={0.2} />
          </mesh>
          {/* Banker/Architect frosted-glass & cobalt hood */}
          <RoundedBox
            args={[0.44, 0.062, 0.19]}
            radius={0.02}
            smoothness={4}
            position={[0.32, 0.04, 0]}
          >
            <GlassMaterial kind="core" />
          </RoundedBox>
          {/* Top navy cap on lamp hood */}
          <RoundedBox
            args={[0.4, 0.022, 0.15]}
            radius={0.008}
            smoothness={2}
            position={[0.32, 0.074, 0]}
          >
            <meshStandardMaterial color="#16275c" roughness={0.25} metalness={0.3} />
          </RoundedBox>
          {/* Electric emissive bulb bar inside hood */}
          <mesh position={[0.32, 0.006, 0]}>
            <boxGeometry args={[0.35, 0.016, 0.11]} />
            <meshStandardMaterial
              ref={lampLightRef}
              color="#dce6ff"
              emissive="#2e4bff"
              emissiveIntensity={2.1}
              roughness={0.1}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
