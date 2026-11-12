'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { GlassMaterial, GradientGlassMaterial } from '../../../../lib/materials';

/**
 * FlagshipVitrine — The Central Elevated Pedestal, Museum Vitrine with
 * Hinged Double Doors, Overhead Gallery Spotlight Halo, "Resting Art"
 * Sculptural Lounge Chair, Luxury Boutique Shopping Bag (with grommets,
 * arched cord handles & swaying margin hang-tag), and Faceted Flacon.
 */

export interface FlagshipVitrineProps {
  animState: React.MutableRefObject<{
    intro: number;
    rise: number;
    feature: number;
    detail: number;
    outro: number;
    time: number;
  }>;
  hotspotRef: React.RefObject<THREE.Group | null>;
}

export interface FlagshipVitrineHandle {
  update: () => void;
}

export const FlagshipVitrine = React.forwardRef<
  FlagshipVitrineHandle,
  FlagshipVitrineProps
>(function FlagshipVitrine({ animState, hotspotRef }, ref) {
  const plinthGroupRef = useRef<THREE.Group>(null);
  const liftTrussRef = useRef<THREE.Group>(null);
  const leftDoorRef = useRef<THREE.Group>(null);
  const rightDoorRef = useRef<THREE.Group>(null);
  const productTurntableRef = useRef<THREE.Group>(null);
  const hangTagRef = useRef<THREE.Group>(null);
  const haloMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const plinthRingMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const { vitrineLinesGeo, doorLinesGeo } = useMemo(() => {
    const vPts: number[] = [];
    const addLine = (
      arr: number[],
      x1: number,
      y1: number,
      z1: number,
      x2: number,
      y2: number,
      z2: number,
    ) => {
      arr.push(x1, y1, z1, x2, y2, z2);
    };
    const hw = 0.45;
    const hh = 0.54;
    const hd = 0.37;

    // Top & bottom vitrine perimeter frames
    for (const y of [0, hh * 2]) {
      addLine(vPts, -hw, y, -hd, hw, y, -hd);
      addLine(vPts, hw, y, -hd, hw, y, hd);
      addLine(vPts, hw, y, hd, -hw, y, hd);
      addLine(vPts, -hw, y, hd, -hw, y, -hd);
    }
    // 4 vertical corner mullions
    addLine(vPts, -hw, 0, -hd, -hw, hh * 2, -hd);
    addLine(vPts, hw, 0, -hd, hw, hh * 2, -hd);
    addLine(vPts, hw, 0, hd, hw, hh * 2, hd);
    addLine(vPts, -hw, 0, hd, -hw, hh * 2, hd);

    const vitrineLinesGeo = new THREE.BufferGeometry();
    vitrineLinesGeo.setAttribute('position', new THREE.Float32BufferAttribute(vPts, 3));

    // Single hinged glass door outline (width = 0.44, height = 1.06)
    const dPts: number[] = [];
    const dw = 0.44;
    const dh = 1.06;
    addLine(dPts, 0, 0, 0, dw, 0, 0);
    addLine(dPts, dw, 0, 0, dw, dh, 0);
    addLine(dPts, dw, dh, 0, 0, dh, 0);
    addLine(dPts, 0, dh, 0, 0, 0, 0);
    const doorLinesGeo = new THREE.BufferGeometry();
    doorLinesGeo.setAttribute('position', new THREE.Float32BufferAttribute(dPts, 3));

    return { vitrineLinesGeo, doorLinesGeo };
  }, []);

  useEffect(() => {
    return () => {
      vitrineLinesGeo.dispose();
      doorLinesGeo.dispose();
    };
  }, [vitrineLinesGeo, doorLinesGeo]);

  React.useImperativeHandle(ref, () => ({
    update() {
      const { intro, rise, detail, time } = animState.current;

      // Pedestal elevation: starts at lower-mid atrium (y = -0.26) and rises to +0.16
      // so the vitrine canopy (height 1.08) always stays cleanly under the roof bridge (y = 1.40)
      const basePlinthY = -0.26 + rise * 0.42;
      const hoverBob = Math.sin(time * 1.5) * 0.015 * (0.3 + 0.7 * rise);
      const currentY = basePlinthY + hoverBob - (1 - intro) * 0.45;

      if (plinthGroupRef.current) {
        plinthGroupRef.current.position.y = currentY;
        plinthGroupRef.current.position.z = rise * 0.08;
        const s = Math.max(0.001, intro);
        plinthGroupRef.current.scale.setScalar(s);
      }

      // Telescoping 4-pillar architectural lift truss from bottom shelf (-1.00) to currentY
      if (liftTrussRef.current) {
        const bottomY = -1.00;
        const colH = Math.max(0.05, currentY - 0.06 - bottomY);
        liftTrussRef.current.position.y = bottomY + colH * 0.5;
        liftTrussRef.current.position.z = rise * 0.08;
        liftTrussRef.current.scale.set(1, colH, 1);
      }

      // Hinged vitrine front doors swing open as `rise` (market-truth) progresses
      const doorSwing = rise * 1.18;
      if (leftDoorRef.current) {
        leftDoorRef.current.rotation.y = -doorSwing;
      }
      if (rightDoorRef.current) {
        rightDoorRef.current.rotation.y = doorSwing;
      }

      // Turntable rotation for the hero product ensemble on the plinth
      if (productTurntableRef.current) {
        productTurntableRef.current.rotation.y =
          0.18 + Math.sin(time * 0.45) * 0.12 + rise * 0.28 + detail * 0.38;
      }

      // Gentle sway on the boutique shopping bag's price/margin hang-tag
      if (hangTagRef.current) {
        hangTagRef.current.rotation.z = -0.2 + Math.sin(time * 2.1) * 0.06;
      }

      // Emissive bloom on halo rings as margin is claimed
      if (haloMatRef.current) {
        haloMatRef.current.emissiveIntensity = 1.0 + rise * 1.4;
      }
      if (plinthRingMatRef.current) {
        plinthRingMatRef.current.emissiveIntensity = 0.8 + rise * 1.5;
      }
    },
  }));

  return (
    <group>
      {/* Architectural 4-Pillar Pedestal Lift Truss (replaces heavy stove-pipe cylinder) */}
      <group ref={liftTrussRef} position={[0, -0.65, 0]}>
        {/* Central brushed-porcelain core shaft */}
        <mesh>
          <boxGeometry args={[0.28, 1, 0.24]} />
          <meshPhysicalMaterial
            color="#dce6ff"
            roughness={0.22}
            metalness={0.08}
            clearcoat={0.6}
          />
        </mesh>
        {/* 4 corner cobalt guide columns */}
        {[-0.18, 0.18].map((x) =>
          [-0.15, 0.15].map((z) => (
            <mesh key={`col-${x}-${z}`} position={[x, 0, z]}>
              <cylinderGeometry args={[0.016, 0.016, 1, 12]} />
              <meshStandardMaterial color="#1226c8" roughness={0.2} metalness={0.5} />
            </mesh>
          )),
        )}
        {/* Glowing vertical electric-blue power accent strip on front of shaft */}
        <mesh position={[0, 0, 0.124]}>
          <boxGeometry args={[0.04, 0.96, 0.008]} />
          <meshStandardMaterial
            color="#2e4bff"
            emissive="#2e4bff"
            emissiveIntensity={0.95}
          />
        </mesh>
      </group>

      {/* Main Risen Flagship Pedestal Group */}
      <group ref={plinthGroupRef} position={[0, -0.26, 0]}>
        {/* Hotspot anchor for ProximityType — offset toward the left editorial column so the glint illuminates market-truth */}
        <group ref={hotspotRef} position={[-1.65, 0.35, 0.3]} />

        {/* Stepped porcelain & cobalt flagship plinth */}
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[0.92, 0.06, 0.76]} />
          <meshPhysicalMaterial
            color="#f4f7ff"
            roughness={0.15}
            metalness={0.04}
            clearcoat={0.85}
          />
        </mesh>
        {/* Front cobalt fascia trim on plinth */}
        <mesh position={[0, -0.05, 0.383]}>
          <boxGeometry args={[0.92, 0.024, 0.01]} />
          <meshStandardMaterial color="#1226c8" roughness={0.2} metalness={0.4} />
        </mesh>
        {/* Circular turntable dais */}
        <mesh position={[0, 0.0, 0]}>
          <cylinderGeometry args={[0.37, 0.40, 0.045, 36]} />
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.12}
            metalness={0.04}
            clearcoat={0.9}
          />
        </mesh>
        {/* Luminous electric-blue Margin Halo Ring around the turntable dais */}
        <mesh position={[0, 0.015, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.39, 0.013, 12, 48]} />
          <meshStandardMaterial
            ref={plinthRingMatRef}
            color="#2e4bff"
            emissive="#2e4bff"
            emissiveIntensity={0.9}
          />
        </mesh>

        {/* ============================================================
            HERO PRODUCT ENSEMBLE ON TURNTABLE (Scaled 1.32x for bold legibility)
            1. "Resting Art" Sculptural Lounge Chair & Ottoman (Left)
            2. Tailored Luxury Boutique Shopping Bag + Margin Tag (Front-Right)
            3. Faceted Crystal Flagship Flacon (Back-Right)
           ============================================================ */}
        <group ref={productTurntableRef} position={[0, 0.025, 0]} scale={1.26}>
          {/* --- 1. "RESTING ART" SCULPTURAL LOUNGE CHAIR --- */}
          <group position={[-0.08, 0, -0.01]} rotation={[0, 0.34, 0]}>
            {/* Physical tubular sled rails */}
            {[-0.12, 0.12].map((sx) => (
              <group key={sx}>
                {/* Floor runner */}
                <mesh position={[sx, 0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.28, 8]} />
                  <meshStandardMaterial color="#0a1890" metalness={0.5} roughness={0.2} />
                </mesh>
                {/* Cantilever leg */}
                <mesh position={[sx, 0.08, 0.08]} rotation={[-0.35, 0, 0]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.15, 8]} />
                  <meshStandardMaterial color="#0a1890" metalness={0.5} roughness={0.2} />
                </mesh>
                {/* Backrest spine post */}
                <mesh position={[sx * 0.85, 0.26, -0.14]} rotation={[-0.38, 0, 0]}>
                  <cylinderGeometry args={[0.009, 0.009, 0.28, 8]} />
                  <meshStandardMaterial color="#0a1890" metalness={0.5} roughness={0.2} />
                </mesh>
              </group>
            ))}

            {/* Molded deep-navy under-shell */}
            <RoundedBox
              args={[0.27, 0.036, 0.25]}
              radius={0.012}
              smoothness={3}
              position={[0, 0.13, -0.01]}
              rotation={[-0.22, 0, 0]}
            >
              <meshStandardMaterial color="#0a1890" roughness={0.2} metalness={0.35} />
            </RoundedBox>

            {/* Plush electric-blue seat cushion */}
            <RoundedBox
              args={[0.25, 0.058, 0.23]}
              radius={0.022}
              smoothness={3}
              position={[0, 0.17, 0.0]}
              rotation={[-0.22, 0, 0]}
            >
              <GradientGlassMaterial
                ice="#dce6ff"
                azure="#5f7dff"
                electric="#2e4bff"
                deep="#1226c8"
              />
            </RoundedBox>

            {/* Reclined backrest shell */}
            <RoundedBox
              args={[0.27, 0.28, 0.038]}
              radius={0.014}
              smoothness={3}
              position={[0, 0.29, -0.14]}
              rotation={[-0.4, 0, 0]}
            >
              <meshStandardMaterial color="#0a1890" roughness={0.2} metalness={0.35} />
            </RoundedBox>

            {/* Plush backrest cushion */}
            <RoundedBox
              args={[0.24, 0.25, 0.052]}
              radius={0.02}
              smoothness={3}
              position={[0, 0.30, -0.115]}
              rotation={[-0.4, 0, 0]}
            >
              <GradientGlassMaterial
                ice="#dce6ff"
                azure="#5f7dff"
                electric="#2e4bff"
                deep="#1226c8"
              />
            </RoundedBox>

            {/* Sculpted cylindrical porcelain headrest bolster */}
            <mesh position={[0, 0.41, -0.15]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.036, 0.036, 0.22, 20]} />
              <meshPhysicalMaterial
                color="#f4f7ff"
                roughness={0.14}
                clearcoat={0.85}
              />
            </mesh>

            {/* Matching Sculpted Ottoman in front */}
            <group position={[0, 0, 0.19]}>
              <mesh position={[0, 0.04, 0]}>
                <cylinderGeometry args={[0.016, 0.055, 0.08, 16]} />
                <meshStandardMaterial color="#0a1890" roughness={0.22} metalness={0.45} />
              </mesh>
              <RoundedBox
                args={[0.20, 0.048, 0.14]}
                radius={0.018}
                smoothness={3}
                position={[0, 0.09, 0]}
                rotation={[0.08, 0, 0]}
              >
                <GradientGlassMaterial
                  ice="#e8eeff"
                  azure="#6b87ff"
                  electric="#2e4bff"
                  deep="#1226c8"
                />
              </RoundedBox>
            </group>
          </group>

          {/* --- 2. LUXURY BOUTIQUE SHOPPING BAG + MARGIN HANG-TAG --- */}
          <group position={[0.16, 0, 0.09]} rotation={[0, -0.28, 0]}>
            {/* Main structured porcelain-white & cobalt luxury tote body */}
            <RoundedBox
              args={[0.23, 0.30, 0.125]}
              radius={0.015}
              smoothness={3}
              position={[0, 0.15, 0]}
            >
              <meshPhysicalMaterial
                color="#eef3ff"
                roughness={0.16}
                metalness={0.04}
                clearcoat={0.9}
              />
            </RoundedBox>

            {/* Side cobalt gusset accent panels */}
            <mesh position={[-0.116, 0.15, 0]}>
              <boxGeometry args={[0.005, 0.27, 0.095]} />
              <meshStandardMaterial color="#2e4bff" roughness={0.25} />
            </mesh>
            <mesh position={[0.116, 0.15, 0]}>
              <boxGeometry args={[0.005, 0.27, 0.095]} />
              <meshStandardMaterial color="#2e4bff" roughness={0.25} />
            </mesh>

            {/* Deep-cobalt top cuff band */}
            <mesh position={[0, 0.282, 0]}>
              <boxGeometry args={[0.234, 0.042, 0.128]} />
              <meshStandardMaterial color="#1226c8" roughness={0.22} metalness={0.35} />
            </mesh>

            {/* Front electric-blue brand emblem plaque on bag */}
            <RoundedBox
              args={[0.11, 0.042, 0.008]}
              radius={0.006}
              smoothness={2}
              position={[0, 0.155, 0.064]}
            >
              <meshStandardMaterial
                color="#2e4bff"
                emissive="#2e4bff"
                emissiveIntensity={0.65}
              />
            </RoundedBox>

            {/* 2 Arched braided-cord handles (front & back) */}
            <mesh position={[0, 0.295, 0.044]}>
              <torusGeometry args={[0.058, 0.0095, 12, 32, Math.PI]} />
              <meshStandardMaterial color="#0a1890" roughness={0.2} metalness={0.4} />
            </mesh>
            <mesh position={[0, 0.295, -0.044]}>
              <torusGeometry args={[0.058, 0.0095, 12, 32, Math.PI]} />
              <meshStandardMaterial color="#0a1890" roughness={0.2} metalness={0.4} />
            </mesh>

            {/* Grommet eyelets */}
            <mesh position={[-0.058, 0.28, 0.065]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.006, 12]} />
              <meshStandardMaterial color="#ffffff" metalness={0.6} roughness={0.15} />
            </mesh>
            <mesh position={[0.058, 0.28, 0.065]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.006, 12]} />
              <meshStandardMaterial color="#ffffff" metalness={0.6} roughness={0.15} />
            </mesh>

            {/* Swaying Margin Hang-Tag attached to front-right handle */}
            <group ref={hangTagRef} position={[0.058, 0.28, 0.072]}>
              <RoundedBox
                args={[0.068, 0.10, 0.01]}
                radius={0.007}
                smoothness={2}
                position={[0.022, -0.055, 0]}
              >
                <meshStandardMaterial color="#1226c8" roughness={0.2} />
              </RoundedBox>
              {/* Bright porcelain & electric-blue margin badge on hang-tag */}
              <mesh position={[0.022, -0.045, 0.006]}>
                <boxGeometry args={[0.048, 0.022, 0.004]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0.022, -0.075, 0.006]}>
                <boxGeometry args={[0.048, 0.018, 0.004]} />
                <meshStandardMaterial
                  color="#2e4bff"
                  emissive="#2e4bff"
                  emissiveIntensity={1.1}
                />
              </mesh>
            </group>
          </group>

          {/* --- 3. FACETED SAPPHIRE FLAGSHIP FLACON (Back-Right) --- */}
          <group position={[0.14, 0, -0.12]}>
            {/* Faceted octagonal sapphire bottle body */}
            <mesh position={[0, 0.13, 0]}>
              <cylinderGeometry args={[0.072, 0.082, 0.26, 8]} />
              <GlassMaterial kind="core" emissive="#2e4bff" emissiveIntensity={0.22} />
            </mesh>
            {/* Ribbed porcelain-chrome atomizer neck collar */}
            <mesh position={[0, 0.285, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.048, 16]} />
              <meshStandardMaterial color="#eef3ff" metalness={0.65} roughness={0.15} />
            </mesh>
            {/* Deep cobalt geometric stopper cap */}
            <RoundedBox
              args={[0.082, 0.062, 0.082]}
              radius={0.012}
              smoothness={3}
              position={[0, 0.34, 0]}
              rotation={[0, Math.PI / 4, 0]}
            >
              <meshStandardMaterial color="#0a1890" roughness={0.15} metalness={0.4} />
            </RoundedBox>
          </group>
        </group>

        {/* ============================================================
            OPEN-FRONT MUSEUM VITRINE FRAME, HINGED GLASS DOORS & HALO
           ============================================================ */}
        <group position={[0, -0.02, 0]}>
          {/* Top vitrine luminaire canopy */}
          <mesh position={[0, 1.08, 0]}>
            <boxGeometry args={[0.92, 0.032, 0.76]} />
            <meshPhysicalMaterial
              color="#dce6ff"
              roughness={0.16}
              metalness={0.1}
              clearcoat={0.9}
            />
          </mesh>

          {/* Overhead Gallery Spotlight Halo Ring */}
          <mesh position={[0, 1.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.31, 0.016, 12, 48]} />
            <meshStandardMaterial
              ref={haloMatRef}
              color="#ffffff"
              emissive="#2e4bff"
              emissiveIntensity={1.2}
            />
          </mesh>

          {/* Subtle frosted rear gallery backplate (depthWrite=false so it never occludes) */}
          <mesh position={[0, 0.54, -0.37]}>
            <planeGeometry args={[0.88, 1.06]} />
            <meshPhysicalMaterial
              color="#b9c9ff"
              transparent
              opacity={0.14}
              roughness={0.2}
              depthWrite={false}
            />
          </mesh>

          {/* Hinged Left Vitrine Door (swings open on `market-truth`) */}
          <group ref={leftDoorRef} position={[-0.45, 0.01, 0.37]}>
            <mesh position={[0.22, 0.53, 0]}>
              <planeGeometry args={[0.44, 1.06]} />
              <meshPhysicalMaterial
                color="#dce6ff"
                transparent
                opacity={0.12}
                roughness={0.08}
                clearcoat={1}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Door handle */}
            <mesh position={[0.41, 0.53, 0.012]}>
              <boxGeometry args={[0.012, 0.14, 0.016]} />
              <meshStandardMaterial color="#2e4bff" emissive="#2e4bff" emissiveIntensity={0.6} />
            </mesh>
            <lineSegments geometry={doorLinesGeo}>
              <lineBasicMaterial color="#2e4bff" transparent opacity={0.55} />
            </lineSegments>
          </group>

          {/* Hinged Right Vitrine Door (swings open on `market-truth`) */}
          <group ref={rightDoorRef} position={[0.45, 0.01, 0.37]}>
            <group scale={[-1, 1, 1]}>
              <mesh position={[0.22, 0.53, 0]}>
                <planeGeometry args={[0.44, 1.06]} />
                <meshPhysicalMaterial
                  color="#dce6ff"
                  transparent
                  opacity={0.12}
                  roughness={0.08}
                  clearcoat={1}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <mesh position={[0.41, 0.53, 0.012]}>
                <boxGeometry args={[0.012, 0.14, 0.016]} />
                <meshStandardMaterial color="#2e4bff" emissive="#2e4bff" emissiveIntensity={0.6} />
              </mesh>
              <lineSegments geometry={doorLinesGeo}>
                <lineBasicMaterial color="#2e4bff" transparent opacity={0.55} />
              </lineSegments>
            </group>
          </group>

          {/* Fine cobalt architectural mullions */}
          <lineSegments geometry={vitrineLinesGeo}>
            <lineBasicMaterial color="#1226c8" transparent opacity={0.65} />
          </lineSegments>
        </group>
      </group>
    </group>
  );
});
