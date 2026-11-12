'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';

/**
 * RetentionLoop — The Flagship Storefront UI Slate (`feature` beat)
 * and the Orbital D2C Parcel & Doorstep Retention Loop (`detail` beat).
 */

export interface RetentionLoopProps {
  animState: React.MutableRefObject<{
    intro: number;
    rise: number;
    feature: number;
    detail: number;
    outro: number;
    time: number;
  }>;
}

export interface RetentionLoopHandle {
  update: () => void;
}

const ORBIT_RX = 1.22;
const ORBIT_RZ = 0.80;
const NODE_COUNT = 8;

const _nodeMat = new THREE.Matrix4();
const _nodePos = new THREE.Vector3();
const _nodeQuat = new THREE.Quaternion();
const _nodeScale = new THREE.Vector3();

export const RetentionLoop = React.forwardRef<
  RetentionLoopHandle,
  RetentionLoopProps
>(function RetentionLoop({ animState }, ref) {
  const storefrontRef = useRef<THREE.Group>(null);
  const orbitGroupRef = useRef<THREE.Group>(null);
  const parcelGroupRef = useRef<THREE.Group>(null);
  const leftFlapRef = useRef<THREE.Mesh>(null);
  const rightFlapRef = useRef<THREE.Mesh>(null);
  const nodesInstRef = useRef<THREE.InstancedMesh>(null);

  const { orbitLinesGeo, uiLinesGeo, nodeGeo } = useMemo(() => {
    const oPts: number[] = [];
    const segs = 72;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      oPts.push(
        Math.cos(a0) * (ORBIT_RX + 0.05),
        0,
        Math.sin(a0) * (ORBIT_RZ + 0.05),
        Math.cos(a1) * (ORBIT_RX + 0.05),
        0,
        Math.sin(a1) * (ORBIT_RZ + 0.05),
      );
      if (i % 3 === 0) {
        oPts.push(
          Math.cos(a0) * (ORBIT_RX - 0.04),
          0,
          Math.sin(a0) * (ORBIT_RZ - 0.04),
          Math.cos(a0) * (ORBIT_RX + 0.05),
          0,
          Math.sin(a0) * (ORBIT_RZ + 0.05),
        );
      }
    }
    const orbitLinesGeo = new THREE.BufferGeometry();
    orbitLinesGeo.setAttribute('position', new THREE.Float32BufferAttribute(oPts, 3));

    const uPts: number[] = [];
    const uw = 0.34;
    const uh = 0.46;
    uPts.push(
      -uw, -uh, 0.016, uw, -uh, 0.016,
      uw, -uh, 0.016, uw, uh, 0.016,
      uw, uh, 0.016, -uw, uh, 0.016,
      -uw, uh, 0.016, -uw, -uh, 0.016,
      -uw + 0.04, uh - 0.09, 0.017, uw - 0.04, uh - 0.09, 0.017,
      -uw + 0.04, -0.05, 0.017, uw - 0.04, -0.05, 0.017,
    );
    const uiLinesGeo = new THREE.BufferGeometry();
    uiLinesGeo.setAttribute('position', new THREE.Float32BufferAttribute(uPts, 3));

    const nodeGeo = new THREE.SphereGeometry(0.025, 12, 12);

    return { orbitLinesGeo, uiLinesGeo, nodeGeo };
  }, []);

  useEffect(() => {
    return () => {
      orbitLinesGeo.dispose();
      uiLinesGeo.dispose();
      nodeGeo.dispose();
    };
  }, [orbitLinesGeo, uiLinesGeo, nodeGeo]);

  React.useImperativeHandle(ref, () => ({
    update() {
      const { rise, feature, detail, time } = animState.current;

      // 1. Flagship Storefront & AI Concierge UI Slate:
      // Prominent during `feature` (Beat 2), then elevates slightly and tucked cleanly
      // above the orbital track during `detail` (Beat 3) so there is zero overlap.
      if (storefrontRef.current) {
        const uiVis = Math.max(0.001, Math.min(1, feature * 1.15 - detail * 0.22));
        storefrontRef.current.scale.setScalar(uiVis);
        storefrontRef.current.position.set(
          -0.84 - (1 - uiVis) * 0.18,
          0.36 + detail * 0.24 + Math.sin(time * 1.3) * 0.02,
          0.44,
        );
        storefrontRef.current.rotation.y = 0.34 + Math.sin(time * 0.7) * 0.04;
      }

      // 2. Orbital Fulfilment & Retention Loop (awakens on `detail`)
      const loopVis = Math.max(0.001, Math.min(1, detail * 1.05));
      if (orbitGroupRef.current) {
        orbitGroupRef.current.scale.setScalar(loopVis);
        orbitGroupRef.current.position.y = -0.22 + rise * 0.14;
      }

      // 3. D2C Parcel Box gliding across the front-left orbital arc
      const parcelAngle = Math.PI * 0.62 + Math.sin(time * 0.65) * 0.26;
      if (parcelGroupRef.current) {
        const px = Math.cos(parcelAngle) * ORBIT_RX;
        const pz = Math.sin(parcelAngle) * ORBIT_RZ;
        const py = 0.05 + Math.sin(time * 1.8) * 0.02;
        parcelGroupRef.current.position.set(px, py, pz);
        parcelGroupRef.current.rotation.y = 0.32 + Math.cos(time * 0.65) * 0.2;
      }

      const flapOpen = 0.16 + Math.max(0, Math.sin(time * 1.3) * 0.18);
      if (leftFlapRef.current) {
        leftFlapRef.current.rotation.z = flapOpen;
      }
      if (rightFlapRef.current) {
        rightFlapRef.current.rotation.z = -flapOpen;
      }

      // 4. Retention pulse nodes streaming around the full 360° elliptical loop
      const nodes = nodesInstRef.current;
      if (nodes) {
        for (let i = 0; i < NODE_COUNT; i++) {
          const na = time * 0.85 + (i / NODE_COUNT) * Math.PI * 2;
          _nodePos.set(Math.cos(na) * ORBIT_RX, 0, Math.sin(na) * ORBIT_RZ);
          _nodeQuat.identity();
          const pulse = 0.75 + 0.35 * Math.sin(time * 3 + i);
          _nodeScale.setScalar(pulse * loopVis);
          _nodeMat.compose(_nodePos, _nodeQuat, _nodeScale);
          nodes.setMatrixAt(i, _nodeMat);
        }
        nodes.instanceMatrix.needsUpdate = true;
      }
    },
  }));

  // Doorstep portal sits on the front-right of the ellipse (angle = 0.20 * PI)
  // completely separated from the left-side Storefront UI Slate!
  const doorAngle = Math.PI * 0.20;
  const doorX = Math.cos(doorAngle) * ORBIT_RX;
  const doorZ = Math.sin(doorAngle) * ORBIT_RZ;

  return (
    <group>
      {/* ============================================================
          BEAT 2: FLAGSHIP STOREFRONT & AI CONCIERGE UI SLATE
         ============================================================ */}
      <group ref={storefrontRef} position={[-0.84, 0.36, 0.44]} scale={0.001}>
        {/* Porcelain-ice editorial storefront slate */}
        <RoundedBox args={[0.68, 0.92, 0.026]} radius={0.025} smoothness={3}>
          <meshPhysicalMaterial
            color="#eef3ff"
            roughness={0.16}
            metalness={0.04}
            clearcoat={0.9}
          />
        </RoundedBox>

        {/* Window controls dots */}
        {[-0.24, -0.19, -0.14].map((wx, idx) => (
          <mesh key={wx} position={[wx, 0.405, 0.015]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.006, 12]} />
            <meshStandardMaterial color={idx === 0 ? '#2e4bff' : '#93a9ff'} />
          </mesh>
        ))}

        {/* Product hero preview card inside slate */}
        <RoundedBox
          args={[0.56, 0.28, 0.014]}
          radius={0.015}
          smoothness={2}
          position={[0, 0.16, 0.016]}
        >
          <meshStandardMaterial color="#dce6ff" roughness={0.22} />
        </RoundedBox>

        {/* Miniature product silhouette inside preview card */}
        <RoundedBox
          args={[0.16, 0.15, 0.018]}
          radius={0.01}
          smoothness={2}
          position={[-0.12, 0.16, 0.025]}
        >
          <meshStandardMaterial color="#1226c8" roughness={0.2} metalness={0.3} />
        </RoundedBox>

        {/* Price & Margin Architecture bars inside preview card */}
        <mesh position={[0.10, 0.20, 0.025]}>
          <boxGeometry args={[0.20, 0.028, 0.006]} />
          <meshStandardMaterial color="#0a1890" />
        </mesh>
        <mesh position={[0.08, 0.14, 0.025]}>
          <boxGeometry args={[0.16, 0.022, 0.006]} />
          <meshStandardMaterial
            color="#2e4bff"
            emissive="#2e4bff"
            emissiveIntensity={0.85}
          />
        </mesh>

        {/* AI Concierge Guided-Selling Chat Bubbles */}
        <RoundedBox
          args={[0.46, 0.075, 0.014]}
          radius={0.018}
          smoothness={2}
          position={[-0.04, -0.12, 0.018]}
        >
          <meshStandardMaterial color="#b9c9ff" roughness={0.2} />
        </RoundedBox>
        <RoundedBox
          args={[0.44, 0.075, 0.014]}
          radius={0.018}
          smoothness={2}
          position={[0.04, -0.22, 0.018]}
        >
          <meshStandardMaterial color="#1226c8" roughness={0.22} />
        </RoundedBox>

        {/* Direct Checkout CTA Pill Button ("Own the customer") */}
        <RoundedBox
          args={[0.54, 0.088, 0.018]}
          radius={0.024}
          smoothness={3}
          position={[0, -0.35, 0.02]}
        >
          <meshStandardMaterial
            color="#2e4bff"
            emissive="#2e4bff"
            emissiveIntensity={1.0}
            roughness={0.2}
          />
        </RoundedBox>

        <lineSegments geometry={uiLinesGeo}>
          <lineBasicMaterial color="#1226c8" transparent opacity={0.65} />
        </lineSegments>
      </group>

      {/* ============================================================
          BEAT 3: ORBITAL FULFILMENT & RETENTION LOOP
         ============================================================ */}
      <group
        ref={orbitGroupRef}
        position={[0, -0.08, 0]}
        rotation={[0.20, 0, -0.08]}
        scale={0.001}
      >
        {/* Solid 3D Luminous Elliptical Track Ring */}
        <group scale={[1, 1, ORBIT_RZ / ORBIT_RX]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[ORBIT_RX, 0.015, 12, 72]} />
            <meshStandardMaterial
              color="#2e4bff"
              emissive="#2e4bff"
              emissiveIntensity={0.95}
              roughness={0.2}
            />
          </mesh>
        </group>

        {/* Outer technical graduation ring */}
        <lineSegments geometry={orbitLinesGeo}>
          <lineBasicMaterial color="#1226c8" transparent opacity={0.55} />
        </lineSegments>

        {/* Customer Doorstep Threshold Portal (Front-Right of Orbit) */}
        <group position={[doorX, 0, doorZ]} rotation={[0, -0.45, 0]}>
          {/* Stepped porch threshold slab */}
          <mesh position={[0, -0.04, 0]}>
            <boxGeometry args={[0.34, 0.036, 0.26]} />
            <meshPhysicalMaterial color="#eef3ff" roughness={0.18} clearcoat={0.8} />
          </mesh>
          {/* Welcome mat accent */}
          <mesh position={[0, -0.018, 0.04]}>
            <boxGeometry args={[0.18, 0.008, 0.11]} />
            <meshStandardMaterial color="#2e4bff" />
          </mesh>
          {/* Left & Right doorway jamb pillars */}
          <mesh position={[-0.11, 0.11, 0]}>
            <boxGeometry args={[0.036, 0.28, 0.036]} />
            <meshStandardMaterial color="#1226c8" roughness={0.22} metalness={0.35} />
          </mesh>
          <mesh position={[0.11, 0.11, 0]}>
            <boxGeometry args={[0.036, 0.28, 0.036]} />
            <meshStandardMaterial color="#1226c8" roughness={0.22} metalness={0.35} />
          </mesh>
          {/* Arched doorway lintel */}
          <mesh position={[0, 0.25, 0]}>
            <torusGeometry args={[0.11, 0.02, 12, 24, Math.PI]} />
            <meshStandardMaterial
              color="#2e4bff"
              emissive="#2e4bff"
              emissiveIntensity={1.0}
            />
          </mesh>
        </group>

        {/* Bespoke D2C Fulfilment Parcel Box (Front-Left of Orbit) */}
        <group ref={parcelGroupRef} position={[-ORBIT_RX * 0.45, 0.05, ORBIT_RZ * 0.88]}>
          {/* Parcel carton body */}
          <RoundedBox
            args={[0.28, 0.20, 0.23]}
            radius={0.015}
            smoothness={3}
            position={[0, 0, 0]}
          >
            <meshPhysicalMaterial
              color="#eef3ff"
              roughness={0.2}
              metalness={0.05}
              clearcoat={0.75}
            />
          </RoundedBox>
          {/* Left & Right top flaps */}
          <mesh ref={leftFlapRef} position={[-0.068, 0.104, 0]}>
            <boxGeometry args={[0.135, 0.014, 0.22]} />
            <meshPhysicalMaterial color="#dce6ff" roughness={0.22} />
          </mesh>
          <mesh ref={rightFlapRef} position={[0.068, 0.104, 0]}>
            <boxGeometry args={[0.135, 0.014, 0.22]} />
            <meshPhysicalMaterial color="#dce6ff" roughness={0.22} />
          </mesh>
          {/* Electric-blue branded sealing tape cross-stripes */}
          <mesh position={[0, 0.112, 0]}>
            <boxGeometry args={[0.038, 0.008, 0.234]} />
            <meshStandardMaterial
              color="#2e4bff"
              emissive="#2e4bff"
              emissiveIntensity={1.1}
            />
          </mesh>
          <mesh position={[0, 0.02, 0.117]}>
            <boxGeometry args={[0.038, 0.16, 0.006]} />
            <meshStandardMaterial
              color="#2e4bff"
              emissive="#2e4bff"
              emissiveIntensity={0.95}
            />
          </mesh>
          {/* Front shipping label badge */}
          <mesh position={[0.065, -0.01, 0.117]}>
            <boxGeometry args={[0.095, 0.068, 0.006]} />
            <meshStandardMaterial color="#0a1890" />
          </mesh>
        </group>

        {/* Instanced Retention Pulse Nodes along the orbital loop */}
        <instancedMesh ref={nodesInstRef} args={[nodeGeo, undefined, NODE_COUNT]}>
          <meshStandardMaterial
            color="#ffffff"
            emissive="#2e4bff"
            emissiveIntensity={1.6}
          />
        </instancedMesh>
      </group>
    </group>
  );
});
