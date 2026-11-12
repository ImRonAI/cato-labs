'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line, RoundedBox } from '@react-three/drei';
import { GlassMaterial, type GlassKind } from '../../../../lib/materials';
import { TABLE_TOP_Y } from './BoardroomTable';
import { createFolioPageTexture } from './textures';

/**
 * Builds a single-sided arched folio leaf geometry hinged at x = 0,
 * extending to x = +width, with a natural parabolic page curl in Y.
 */
function createCurvedPageGeometry(width = 0.62, depth = 0.84, segsX = 18): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, depth, segsX, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const u = x / width;
    const arch = Math.sin(u * Math.PI) * 0.058 + Math.sin(u * Math.PI * 0.5) * 0.02;
    pos.setY(i, arch);
  }
  geo.computeVertexNormals();
  return geo;
}

export interface EvidenceFolioProps {
  folioPageRefs: React.MutableRefObject<(THREE.Group | null)[]>;
  dossierRefs: React.MutableRefObject<(THREE.Group | null)[]>;
  fountainPenRef: React.RefObject<THREE.Group | null>;
  evidenceBarsRef: React.MutableRefObject<(THREE.Mesh | null)[]>;
}

const DOSSIER_SPECS: readonly { kind: GlassKind; tabOffset: number; color: string; folderColor: string }[] = [
  { kind: 'ice', tabOffset: -0.16, color: '#6b87ff', folderColor: '#c8d7ff' },
  { kind: 'azure', tabOffset: 0.0, color: '#3b5bff', folderColor: '#9db5ff' },
  { kind: 'core', tabOffset: 0.16, color: '#2e4bff', folderColor: '#5f7dff' },
];

export const FAN_PAGE_COUNT = 5;

export default function EvidenceFolio({
  folioPageRefs,
  dossierRefs,
  fountainPenRef,
  evidenceBarsRef,
}: EvidenceFolioProps) {
  const pageGeo = useMemo(() => createCurvedPageGeometry(0.62, 0.84, 18), []);

  const textures = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return {
      thesis: createFolioPageTexture('thesis'),
      evidence: createFolioPageTexture('evidence'),
      matrix: createFolioPageTexture('matrix'),
    };
  }, []);

  useEffect(() => {
    return () => {
      pageGeo.dispose();
      if (textures) {
        textures.thesis.dispose();
        textures.evidence.dispose();
        textures.matrix.dispose();
      }
    };
  }, [pageGeo, textures]);

  const leafEdgePts = useMemo<THREE.Vector3[]>(() => {
    const pts: THREE.Vector3[] = [];
    const w = 0.62;
    const hd = 0.42;
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = u * w;
      const y = Math.sin(u * Math.PI) * 0.058 + Math.sin(u * Math.PI * 0.5) * 0.02 + 0.002;
      pts.push(new THREE.Vector3(x, y, -hd));
    }
    for (let i = steps; i >= 0; i--) {
      const u = i / steps;
      const x = u * w;
      const y = Math.sin(u * Math.PI) * 0.058 + Math.sin(u * Math.PI * 0.5) * 0.02 + 0.002;
      pts.push(new THREE.Vector3(x, y, hd));
    }
    return pts;
  }, []);

  const coverOutlineLeft = useMemo<THREE.Vector3[]>(
    () => [
      new THREE.Vector3(-0.68, 0.018, -0.46),
      new THREE.Vector3(-0.02, 0.018, -0.46),
      new THREE.Vector3(-0.02, 0.018, 0.46),
      new THREE.Vector3(-0.68, 0.018, 0.46),
      new THREE.Vector3(-0.68, 0.018, -0.46),
    ],
    []
  );

  const coverOutlineRight = useMemo<THREE.Vector3[]>(
    () => [
      new THREE.Vector3(0.02, 0.018, -0.46),
      new THREE.Vector3(0.68, 0.018, -0.46),
      new THREE.Vector3(0.68, 0.018, 0.46),
      new THREE.Vector3(0.02, 0.018, 0.46),
      new THREE.Vector3(0.02, 0.018, -0.46),
    ],
    []
  );

  const dossierOutlinePts = useMemo<THREE.Vector3[]>(
    () => [
      new THREE.Vector3(-0.26, 0.02, -0.35),
      new THREE.Vector3(0.26, 0.02, -0.35),
      new THREE.Vector3(0.26, 0.02, 0.35),
      new THREE.Vector3(-0.26, 0.02, 0.35),
      new THREE.Vector3(-0.26, 0.02, -0.35),
    ],
    []
  );

  return (
    <group>
      {/* ==================== OPEN PARTNER PROPOSAL FOLIO ==================== */}
      <group position={[-0.24, TABLE_TOP_Y + 0.01, 0.14]} rotation={[0, 0.12, 0]}>
        {/* Central bound spine cylinder */}
        <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.026, 0.026, 0.94, 16]} />
          <meshStandardMaterial color="#2e4bff" roughness={0.22} metalness={0.38} />
        </mesh>

        {/* Left Hardcover Board */}
        <RoundedBox
          args={[0.66, 0.032, 0.92]}
          radius={0.01}
          smoothness={3}
          position={[-0.35, 0.016, 0]}
        >
          <meshStandardMaterial color="#142354" roughness={0.3} metalness={0.22} />
        </RoundedBox>
        <Line points={coverOutlineLeft} color="#2e4bff" lineWidth={1.6} transparent opacity={0.9} />

        {/* Left Inside Spread — Positioning Matrix Page */}
        <mesh position={[-0.34, 0.034, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.61, 0.85]} />
          <meshStandardMaterial
            color="#e2ebff"
            map={textures?.thesis ?? null}
            roughness={0.68}
            metalness={0.0}
          />
        </mesh>
        {/* 3D raised Positioning Pin on the upper-right quadrant of Left Page */}
        <mesh position={[-0.21, 0.052, -0.11]}>
          <cylinderGeometry args={[0.024, 0.024, 0.032, 16]} />
          <meshStandardMaterial
            color="#2e4bff"
            emissive="#2e4bff"
            emissiveIntensity={1.4}
            roughness={0.15}
          />
        </mesh>

        {/* Right Hardcover Board */}
        <RoundedBox
          args={[0.66, 0.032, 0.92]}
          radius={0.01}
          smoothness={3}
          position={[0.35, 0.016, 0]}
        >
          <meshStandardMaterial color="#142354" roughness={0.3} metalness={0.22} />
        </RoundedBox>
        <Line points={coverOutlineRight} color="#2e4bff" lineWidth={1.6} transparent opacity={0.9} />

        {/* Right Inside Spread — Case Evidence Page */}
        <mesh position={[0.34, 0.034, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.61, 0.85]} />
          <meshStandardMaterial
            color="#e2ebff"
            map={textures?.evidence ?? null}
            roughness={0.68}
            metalness={0.0}
          />
        </mesh>

        {/* 4 3D Refractive Evidence Pillar Bars rising off the Right Page */}
        {[0, 1, 2, 3].map((bIdx) => (
          <RoundedBox
            key={bIdx}
            ref={(m) => {
              evidenceBarsRef.current[bIdx] = m;
            }}
            args={[0.048, 0.16, 0.048]}
            radius={0.008}
            smoothness={2}
            position={[0.16 + bIdx * 0.11, 0.08, -0.06]}
          >
            <meshStandardMaterial
              color={bIdx === 3 ? '#2e4bff' : '#3c59dc'}
              emissive={bIdx === 3 ? '#2e4bff' : '#16275c'}
              emissiveIntensity={bIdx === 3 ? 0.85 : 0.25}
              roughness={0.2}
              metalness={0.3}
            />
          </RoundedBox>
        ))}

        {/* 5 Fanning Evidence Leaves hinged at the central spine */}
        {Array.from({ length: FAN_PAGE_COUNT }).map((_, i) => {
          const tex =
            i === 0
              ? textures?.thesis
              : i === FAN_PAGE_COUNT - 1
              ? textures?.matrix
              : textures?.evidence;
          return (
            <group
              key={i}
              ref={(g) => {
                folioPageRefs.current[i] = g;
              }}
              position={[0, 0.038 + i * 0.002, 0]}
              rotation={[0, 0, 0.35 + i * 0.24]}
            >
              <mesh geometry={pageGeo}>
                <meshStandardMaterial
                  color="#dde7ff"
                  map={tex ?? null}
                  roughness={0.65}
                  metalness={0.0}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <Line
                points={leafEdgePts}
                color={i === 0 || i === FAN_PAGE_COUNT - 1 ? '#2e4bff' : '#4a68ff'}
                lineWidth={1.6}
                transparent
                opacity={0.92}
              />
            </group>
          );
        })}
      </group>

      {/* ==================== PARTNER'S FOUNTAIN PEN & REST ==================== */}
      <group position={[-0.22, TABLE_TOP_Y, 0.72]}>
        {/* Deep-navy & cobalt pen rest block */}
        <RoundedBox
          args={[0.24, 0.03, 0.08]}
          radius={0.008}
          smoothness={3}
          position={[-0.04, 0.015, 0]}
        >
          <meshStandardMaterial color="#18285c" roughness={0.25} metalness={0.3} />
        </RoundedBox>

        {/* Sculpted Partner's Fountain Pen */}
        <group
          ref={fountainPenRef}
          position={[0, 0.045, 0]}
          rotation={[0, -0.18, -0.05]}
        >
          {/* Tapered deep-sapphire barrel */}
          <mesh position={[-0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.018, 0.024, 0.36, 16]} />
            <meshStandardMaterial color="#101d47" roughness={0.18} metalness={0.48} />
          </mesh>
          {/* Electric-blue cap band */}
          <mesh position={[0.09, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.026, 16]} />
            <meshStandardMaterial
              color="#2e4bff"
              emissive="#2e4bff"
              emissiveIntensity={0.8}
              metalness={0.6}
              roughness={0.15}
            />
          </mesh>
          {/* Pen grip section */}
          <mesh position={[0.14, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.022, 0.08, 16]} />
            <meshStandardMaterial color="#2e4bff" roughness={0.2} metalness={0.5} />
          </mesh>
          {/* Sculpted fountain pen nib */}
          <mesh position={[0.215, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.015, 0.072, 4]} />
            <meshStandardMaterial color="#dce6ff" metalness={0.75} roughness={0.12} />
          </mesh>
          {/* Pocket clip along barrel */}
          <mesh position={[-0.14, 0.026, 0]}>
            <boxGeometry args={[0.17, 0.009, 0.012]} />
            <meshStandardMaterial color="#5f7dff" metalness={0.7} roughness={0.15} />
          </mesh>
        </group>
      </group>

      {/* ==================== THREE STEPPED CASE-STUDY DOSSIERS ==================== */}
      <group position={[-1.12, TABLE_TOP_Y + 0.008, 0.22]} rotation={[0, 0.26, 0]}>
        {DOSSIER_SPECS.map((d, i) => (
          <group
            key={i}
            ref={(g) => {
              dossierRefs.current[i] = g;
            }}
            position={[i * 0.04, i * 0.038, -i * 0.05]}
          >
            {/* Inner case sheet */}
            <RoundedBox
              args={[0.48, 0.018, 0.66]}
              radius={0.005}
              smoothness={2}
              position={[0, 0.01, 0]}
            >
              <meshStandardMaterial
                color="#dce6ff"
                map={textures?.evidence ?? null}
                roughness={0.6}
                metalness={0.02}
              />
            </RoundedBox>
            {/* Refractive Glass Folder Jacket */}
            <RoundedBox
              args={[0.52, 0.028, 0.7]}
              radius={0.009}
              smoothness={3}
              position={[0, 0.018, 0]}
            >
              <GlassMaterial kind={d.kind} />
            </RoundedBox>
            {/* Protruding Index Tab on fore-edge */}
            <RoundedBox
              args={[0.07, 0.026, 0.165]}
              radius={0.006}
              smoothness={2}
              position={[0.275, 0.018, d.tabOffset]}
            >
              <meshStandardMaterial
                color={d.color}
                emissive={i === 2 ? '#2e4bff' : '#16275c'}
                emissiveIntensity={i === 2 ? 0.7 : 0.2}
                roughness={0.2}
                metalness={0.3}
              />
            </RoundedBox>
            <Line points={dossierOutlinePts} color={d.color} lineWidth={1.5} transparent opacity={0.85} />
          </group>
        ))}
      </group>
    </group>
  );
}
