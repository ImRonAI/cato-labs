'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { GlassMaterial, GradientGlassMaterial } from '../../../../lib/materials';

/**
 * Helper geometries & porcelain/enamel materials for the Brand & Creative Systems
 * 3D miniature ("The Identity Engine & Brand Atelier").
 *
 * Palette strictly follows CONTRACTS.md:
 * - Porcelain white (#fafbfe / #eef2ff)
 * - Soft ice blue (#dce4ff / #b9c9ff)
 * - Azure (#6b87ff / #93a9ff)
 * - Electric blue (#2e4bff)
 * - Deep ultramarine / navy (#1226c8 / #0a1890)
 * - Ink (#0a0c12)
 */

/** Rounded rectangle / squircle Shape helper for extruded glass cards, icons & beams. */
export function makeRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  const cr = Math.min(r, hw * 0.9, hh * 0.9);
  shape.moveTo(-hw + cr, -hh);
  shape.lineTo(hw - cr, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + cr);
  shape.lineTo(hw, hh - cr);
  shape.quadraticCurveTo(hw, hh, hw - cr, hh);
  shape.lineTo(-hw + cr, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - cr);
  shape.lineTo(-hw, -hh + cr);
  shape.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
  return shape;
}

/** Circle points in XY plane for drei <Line>. */
export function makeCirclePoints(radius: number, segments = 64, z = 0): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([Math.cos(a) * radius, Math.sin(a) * radius, z]);
  }
  return pts;
}

/** Hexagon points in XY plane for construction grid. */
export function makePolygonPoints(radius: number, sides = 6, z = 0, rotOffset = Math.PI / 6): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= sides; i++) {
    const a = rotOffset + (i / sides) * Math.PI * 2;
    pts.push([Math.cos(a) * radius, Math.sin(a) * radius, z]);
  }
  return pts;
}

/* ---------------------------------------------------------------- */
/*  1. Architectural Construction Grid & Drafting Plinth             */
/* ---------------------------------------------------------------- */

export function ConstructionGridBackplate({
  ringRef,
  outerRingRef,
}: {
  ringRef: React.RefObject<THREE.Group | null>;
  outerRingRef: React.RefObject<THREE.Group | null>;
}) {
  const innerCircle = useMemo(() => makeCirclePoints(0.88, 64, 0.02), []);
  const midCircle = useMemo(() => makeCirclePoints(1.28, 72, 0.01), []);
  const outerCircle = useMemo(() => makeCirclePoints(1.62, 80, 0), []);
  const hexOverlay = useMemo(() => makePolygonPoints(1.28, 6, 0.015, Math.PI / 6), []);

  // Golden ratio tangent callout circles
  const goldenTop = useMemo(
    () => makeCirclePoints(0.36, 40, 0.025).map(([x, y, z]) => [x, y + 0.48, z] as [number, number, number]),
    [],
  );
  const goldenBot = useMemo(
    () => makeCirclePoints(0.56, 48, 0.025).map(([x, y, z]) => [x, y - 0.24, z] as [number, number, number]),
    [],
  );

  return (
    <group>
      {/* Frosted glass drafting disc */}
      <mesh position={[0, 0, -0.14]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.66, 1.72, 0.1, 48]} />
        <GlassMaterial kind="ice" />
      </mesh>

      {/* Porcelain inner drafting surface */}
      <mesh position={[0, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.32, 1.32, 0.04, 48]} />
        <meshStandardMaterial color="#f4f7ff" roughness={0.28} metalness={0.04} />
      </mesh>

      {/* Rotating inner construction rings + golden ratio circles */}
      <group ref={ringRef}>
        <Line points={innerCircle} color="#2e4bff" lineWidth={1.3} transparent opacity={0.55} />
        <Line points={hexOverlay} color="#6b87ff" lineWidth={1} transparent opacity={0.42} />
        <Line points={goldenTop} color="#2e4bff" lineWidth={1} transparent opacity={0.38} />
        <Line points={goldenBot} color="#6b87ff" lineWidth={1} transparent opacity={0.38} />
        {/* Axial crosshairs */}
        <Line
          points={[
            [-1.48, 0, 0.02],
            [1.48, 0, 0.02],
          ]}
          color="#2e4bff"
          lineWidth={1}
          transparent
          opacity={0.35}
        />
        <Line
          points={[
            [0, -1.48, 0.02],
            [0, 1.48, 0.02],
          ]}
          color="#2e4bff"
          lineWidth={1}
          transparent
          opacity={0.35}
        />
        {/* 45-degree diagonal construction axes */}
        <Line
          points={[
            [-1.05, -1.05, 0.015],
            [1.05, 1.05, 0.015],
          ]}
          color="#93a9ff"
          lineWidth={0.9}
          transparent
          opacity={0.3}
        />
        <Line
          points={[
            [-1.05, 1.05, 0.015],
            [1.05, -1.05, 0.015],
          ]}
          color="#93a9ff"
          lineWidth={0.9}
          transparent
          opacity={0.3}
        />
      </group>

      {/* Counter-rotating outer calibration ring & crop marks */}
      <group ref={outerRingRef}>
        <Line points={midCircle} color="#2e4bff" lineWidth={1.1} transparent opacity={0.45} />
        <Line points={outerCircle} color="#93a9ff" lineWidth={1} transparent opacity={0.4} />
        {/* Four architectural registration crop marks */}
        {[
          [-1, 1],
          [1, 1],
          [1, -1],
          [-1, -1],
        ].map(([sx, sy], idx) => (
          <React.Fragment key={idx}>
            <Line
              points={[
                [sx * 1.42, sy * 1.18, 0.03],
                [sx * 1.42, sy * 1.42, 0.03],
                [sx * 1.18, sy * 1.42, 0.03],
              ]}
              color="#1226c8"
              lineWidth={1.5}
              transparent
              opacity={0.65}
            />
          </React.Fragment>
        ))}
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- */
/*  2. Extruded 3D Glass Logomark (Parametric Multi-Element Rig)     */
/* ---------------------------------------------------------------- */

export interface ExtrudedMarkRefs {
  root: React.RefObject<THREE.Group | null>;
  leftBeam: React.RefObject<THREE.Mesh | null>;
  rightBeam: React.RefObject<THREE.Mesh | null>;
  crossBeam: React.RefObject<THREE.Mesh | null>;
  innerRing: React.RefObject<THREE.Mesh | null>;
  coreFrame: React.RefObject<THREE.Mesh | null>;
  orbitalNode: React.RefObject<THREE.Mesh | null>;
}

export function ExtrudedGlassLogomark({ refs }: { refs: ExtrudedMarkRefs }) {
  const { beamGeo, crossGeo } = useMemo(() => {
    const beamShape = makeRoundedRectShape(0.24, 1.72, 0.11);
    const bGeo = new THREE.ExtrudeGeometry(beamShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.04,
      bevelSegments: 4,
    });
    bGeo.center();

    const crossShape = makeRoundedRectShape(1.12, 0.2, 0.09);
    const cGeo = new THREE.ExtrudeGeometry(crossShape, {
      depth: 0.3,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.035,
      bevelSegments: 3,
    });
    cGeo.center();

    return { beamGeo: bGeo, crossGeo: cGeo };
  }, []);

  useEffect(() => {
    return () => {
      beamGeo.dispose();
      crossGeo.dispose();
    };
  }, [beamGeo, crossGeo]);

  return (
    <group ref={refs.root} position={[0, 0, 0.22]}>
      {/* Left primary structural glass beam */}
      <mesh ref={refs.leftBeam} geometry={beamGeo} position={[-0.38, 0.02, 0]} rotation={[0, 0, -0.34]}>
        <GradientGlassMaterial />
      </mesh>

      {/* Right primary structural glass beam */}
      <mesh ref={refs.rightBeam} geometry={beamGeo} position={[0.38, 0.02, 0]} rotation={[0, 0, 0.34]}>
        <GlassMaterial kind="core" />
      </mesh>

      {/* Horizontal / axial crossbar */}
      <mesh ref={refs.crossBeam} geometry={crossGeo} position={[0, -0.18, 0.08]}>
        <GlassMaterial kind="deep" />
      </mesh>

      {/* Precision meridian torus ring (scales up on orbital/hex/harmonic motifs) */}
      <mesh ref={refs.innerRing} position={[0, 0.04, -0.03]}>
        <torusGeometry args={[0.72, 0.065, 20, 64]} />
        <GlassMaterial kind="crystal" />
      </mesh>

      {/* Central diamond / prism core */}
      <mesh ref={refs.coreFrame} position={[0, 0.14, 0.12]} rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.24, 0]} />
        <GlassMaterial kind="prism" />
      </mesh>

      {/* Satellite accent sphere (the signature dot of the mark) */}
      <mesh ref={refs.orbitalNode} position={[0.52, 0.72, 0.16]}>
        <sphereGeometry args={[0.14, 28, 28]} />
        <meshStandardMaterial
          color="#2e4bff"
          emissive="#2e4bff"
          emissiveIntensity={1.15}
          roughness={0.15}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- */
/*  3. Application 01 — Architectural Signage Monolith / Billboard   */
/* ---------------------------------------------------------------- */

export function SignageTotemMiniature({
  groupRef,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  const slabGeo = useMemo(() => {
    const s = makeRoundedRectShape(0.86, 1.54, 0.08);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 3,
    });
    g.center();
    return g;
  }, []);

  useEffect(() => () => slabGeo.dispose(), [slabGeo]);

  return (
    <group ref={groupRef} position={[-1.52, 1.04, -0.25]} rotation={[0.06, 0.3, 0]}>
      {/* Architectural pedestal base */}
      <mesh position={[0, -0.86, 0]}>
        <boxGeometry args={[1.12, 0.1, 0.42]} />
        <meshStandardMaterial color="#e8eeff" roughness={0.25} metalness={0.08} />
      </mesh>

      {/* Main monolith glass & porcelain body */}
      <mesh geometry={slabGeo} position={[0, 0, 0]}>
        <GlassMaterial kind="azure" />
      </mesh>

      {/* Inner porcelain signage face (offset cleanly in front of bevel at z=0.115) */}
      <mesh position={[0, -0.04, 0.115]}>
        <boxGeometry args={[0.74, 1.26, 0.024]} />
        <meshStandardMaterial color="#fafbfe" roughness={0.22} metalness={0.05} />
      </mesh>

      {/* Top illuminated electric-blue beacon header */}
      <mesh position={[0, 0.64, 0.12]}>
        <boxGeometry args={[0.74, 0.13, 0.032]} />
        <meshStandardMaterial
          color="#2e4bff"
          emissive="#2e4bff"
          emissiveIntensity={1.1}
          roughness={0.2}
        />
      </mesh>

      {/* Miniature raised emblem on signage face */}
      <mesh position={[-0.18, 0.32, 0.145]} rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.1, 0]} />
        <GlassMaterial kind="deep" />
      </mesh>
      <mesh position={[0.12, 0.32, 0.14]}>
        <boxGeometry args={[0.28, 0.06, 0.025]} />
        <meshStandardMaterial color="#0a1890" roughness={0.3} />
      </mesh>

      {/* Wayfinding typographic bars on the totem */}
      <mesh position={[-0.06, 0.04, 0.14]}>
        <boxGeometry args={[0.52, 0.055, 0.022]} />
        <meshStandardMaterial color="#1226c8" roughness={0.3} />
      </mesh>
      <mesh position={[-0.12, -0.1, 0.14]}>
        <boxGeometry args={[0.4, 0.04, 0.022]} />
        <meshStandardMaterial color="#6b87ff" roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.34, 0.14]}>
        <boxGeometry args={[0.58, 0.22, 0.02]} />
        <meshStandardMaterial color="#dce4ff" roughness={0.35} />
      </mesh>

      {/* Precision frame outline */}
      <Line
        points={[
          [-0.44, -0.77, 0.135],
          [0.44, -0.77, 0.135],
          [0.44, 0.77, 0.135],
          [-0.44, 0.77, 0.135],
          [-0.44, -0.77, 0.135],
        ]}
        color="#2e4bff"
        lineWidth={1.1}
        transparent
        opacity={0.6}
      />
    </group>
  );
}

/* ---------------------------------------------------------------- */
/*  4. Application 02 — Flagship Website Hero Browser Miniature      */
/* ---------------------------------------------------------------- */

export function WebsiteHeroMiniature({
  groupRef,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  const winGeo = useMemo(() => {
    const s = makeRoundedRectShape(1.56, 1.04, 0.09);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
    });
    g.center();
    return g;
  }, []);

  useEffect(() => () => winGeo.dispose(), [winGeo]);

  return (
    <group ref={groupRef} position={[2.08, 1.05, -0.3]} rotation={[0.05, -0.32, 0]}>
      {/* Frosted glass browser window frame */}
      <mesh geometry={winGeo}>
        <GlassMaterial kind="pane" />
      </mesh>

      {/* White inner viewport surface */}
      <mesh position={[0, -0.05, 0.05]}>
        <boxGeometry args={[1.42, 0.8, 0.018]} />
        <meshStandardMaterial color="#fafbfe" roughness={0.22} metalness={0.04} />
      </mesh>

      {/* Browser window chrome bar + 3 dots */}
      {[-0.6, -0.51, -0.42].map((bx, i) => (
        <mesh key={i} position={[bx, 0.42, 0.065]}>
          <sphereGeometry args={[0.024, 12, 12]} />
          <meshStandardMaterial color={i === 0 ? '#2e4bff' : '#93a9ff'} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0.08, 0.42, 0.06]}>
        <boxGeometry args={[0.72, 0.04, 0.015]} />
        <meshStandardMaterial color="#dce4ff" roughness={0.3} />
      </mesh>

      {/* Left column: Hero headline bars + electric blue CTA pill */}
      <mesh position={[-0.34, 0.14, 0.07]}>
        <boxGeometry args={[0.56, 0.085, 0.022]} />
        <meshStandardMaterial color="#0a1890" roughness={0.25} />
      </mesh>
      <mesh position={[-0.38, 0.01, 0.07]}>
        <boxGeometry args={[0.48, 0.085, 0.022]} />
        <meshStandardMaterial color="#1226c8" roughness={0.25} />
      </mesh>
      <mesh position={[-0.4, -0.13, 0.07]}>
        <boxGeometry args={[0.44, 0.038, 0.018]} />
        <meshStandardMaterial color="#6b87ff" roughness={0.3} />
      </mesh>
      {/* CTA Pill */}
      <mesh position={[-0.46, -0.28, 0.075]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.048, 0.2, 8, 16]} />
        <meshStandardMaterial
          color="#2e4bff"
          emissive="#2e4bff"
          emissiveIntensity={1.05}
          roughness={0.2}
        />
      </mesh>

      {/* Right column: Hero 3D visual card inside the website mockup */}
      <mesh position={[0.36, -0.05, 0.07]}>
        <boxGeometry args={[0.54, 0.56, 0.024]} />
        <meshStandardMaterial color="#e8eeff" roughness={0.25} />
      </mesh>
      <mesh position={[0.36, -0.05, 0.11]} rotation={[0.3, 0.5, 0]}>
        <octahedronGeometry args={[0.15, 0]} />
        <GlassMaterial kind="core" />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- */
/*  5. Application 03 — Tactile Business Card Stack Miniature        */
/* ---------------------------------------------------------------- */

export function BusinessCardMiniature({
  groupRef,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  const cardGeo = useMemo(() => {
    const s = makeRoundedRectShape(1.24, 0.74, 0.06);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
    });
    g.center();
    return g;
  }, []);

  useEffect(() => () => cardGeo.dispose(), [cardGeo]);

  return (
    <group ref={groupRef} position={[-1.92, -1.12, 0.32]} rotation={[-0.18, 0.36, 0.06]}>
      {/* Back card — deep blue refractive glass */}
      <group position={[-0.12, 0.12, -0.1]} rotation={[0, 0, 0.14]}>
        <mesh geometry={cardGeo}>
          <GlassMaterial kind="deep" />
        </mesh>
        <mesh position={[0, 0, 0.038]}>
          <torusGeometry args={[0.15, 0.024, 12, 32]} />
          <meshStandardMaterial color="#fafbfe" roughness={0.2} />
        </mesh>
      </group>

      {/* Front card — heavy matte porcelain stock with blue edge bevel & debossed type */}
      <group position={[0.08, -0.04, 0.04]} rotation={[0, 0, -0.05]}>
        <mesh geometry={cardGeo}>
          <meshStandardMaterial color="#fafbfe" roughness={0.24} metalness={0.05} />
        </mesh>
        {/* Electric blue top edge accent strip */}
        <mesh position={[0, 0.34, 0.03]}>
          <boxGeometry args={[1.14, 0.035, 0.015]} />
          <meshStandardMaterial
            color="#2e4bff"
            emissive="#2e4bff"
            emissiveIntensity={0.9}
            roughness={0.2}
          />
        </mesh>
        {/* Emblem relief top-left */}
        <mesh position={[-0.4, 0.12, 0.038]}>
          <cylinderGeometry args={[0.11, 0.11, 0.025, 3]} />
          <meshStandardMaterial color="#2e4bff" roughness={0.2} />
        </mesh>
        {/* Name & title bars bottom-left */}
        <mesh position={[-0.22, -0.12, 0.035]}>
          <boxGeometry args={[0.52, 0.055, 0.015]} />
          <meshStandardMaterial color="#0a1890" roughness={0.3} />
        </mesh>
        <mesh position={[-0.28, -0.22, 0.035]}>
          <boxGeometry args={[0.38, 0.032, 0.015]} />
          <meshStandardMaterial color="#6b87ff" roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- */
/*  6. Application 04 — Rounded-Squircle App Icon Jewel              */
/* ---------------------------------------------------------------- */

export function AppIconMiniature({
  groupRef,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  const squircleGeo = useMemo(() => {
    const s = makeRoundedRectShape(1.06, 1.06, 0.26);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.04,
      bevelSegments: 5,
    });
    g.center();
    return g;
  }, []);

  useEffect(() => () => squircleGeo.dispose(), [squircleGeo]);

  return (
    <group ref={groupRef} position={[1.95, -1.06, 0.35]} rotation={[-0.14, -0.34, -0.05]}>
      {/* Squircle icon body in electric core glass */}
      <mesh geometry={squircleGeo}>
        <GlassMaterial kind="core" />
      </mesh>

      {/* Inner porcelain / ice emblem relief inside the icon */}
      <mesh position={[0, 0, 0.13]}>
        <torusGeometry args={[0.28, 0.042, 16, 48]} />
        <meshStandardMaterial color="#fafbfe" roughness={0.18} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.02, 0.14]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.26, 0.26, 0.045]} />
        <meshStandardMaterial
          color="#2e4bff"
          emissive="#2e4bff"
          emissiveIntensity={1.1}
          roughness={0.18}
        />
      </mesh>
      <mesh position={[0.2, 0.22, 0.16]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial color="#fafbfe" roughness={0.15} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- */
/*  7. Spectral Swatch Fan & Optical Loupe                           */
/* ---------------------------------------------------------------- */

const SWATCH_COLORS = ['#0a1890', '#1226c8', '#2e4bff', '#6b87ff', '#dce4ff'] as const;

export function SwatchFanMiniature({
  groupRef,
  bladeRefs,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  bladeRefs: React.MutableRefObject<(THREE.Group | null)[]>;
}) {
  const bladeGeo = useMemo(() => {
    const s = makeRoundedRectShape(0.26, 0.88, 0.045);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.024,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
    });
    g.translate(0, 0.34, 0);
    return g;
  }, []);

  useEffect(() => () => bladeGeo.dispose(), [bladeGeo]);

  return (
    <group ref={groupRef} position={[0.05, -1.62, 0.52]} rotation={[-0.28, 0, 0]}>
      {SWATCH_COLORS.map((col, i) => (
        <group
          key={col}
          ref={(el) => {
            bladeRefs.current[i] = el;
          }}
          position={[0, 0, i * 0.032]}
          rotation={[0, 0, (i - 2) * 0.28]}
        >
          <mesh geometry={bladeGeo}>
            <meshStandardMaterial
              color={col}
              roughness={0.22}
              metalness={0.06}
              emissive={i === 2 ? '#2e4bff' : '#000000'}
              emissiveIntensity={i === 2 ? 0.55 : 0}
            />
          </mesh>
        </group>
      ))}
      {/* Pivot rivet */}
      <mesh position={[0, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.06, 20]} />
        <meshStandardMaterial color="#fafbfe" roughness={0.2} metalness={0.2} />
      </mesh>
    </group>
  );
}
