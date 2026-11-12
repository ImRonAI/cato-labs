'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * ShelfSystem — The Architectural Retail Shelving Unit & Commodity Bays.
 *
 * A 3-tier luxury retail display gondola with Left & Right shelf wings
 * flanking a central Flagship Atrium. Built with physical tubular cobalt
 * stanchions, frosted glass shelves, front price-rail channels with
 * hanging SKU tags, and 16 uniform pale-ice "marketplace commodity"
 * cartons (with SKU label plates and barcode rules) via InstancedMesh.
 *
 * As `rise` (market-truth) progresses, the flanking commodity bays step
 * backward in Z and compress slightly while the central flagship pedestal
 * steps forward and claims the shelf and the margin.
 */

export interface ShelfSystemProps {
  animState: React.MutableRefObject<{
    intro: number;
    rise: number;
    feature: number;
    detail: number;
    outro: number;
    time: number;
  }>;
}

interface CommoditySlot {
  wing: -1 | 0 | 1;
  tier: number;
  basePos: [number, number, number];
  size: [number, number, number];
  delay: number;
}

const SHELF_Y = [-1.02, -0.10, 0.82] as const;
const WING_X_INNER = 0.48;
const WING_X_OUTER = 1.18;
const WING_W = WING_X_OUTER - WING_X_INNER; // 0.70
const WING_CENTER_X = (WING_X_INNER + WING_X_OUTER) * 0.5; // 0.83
const SHELF_D = 0.78;

const COMMODITY_SLOTS: CommoditySlot[] = [
  // Left wing — Bottom tier (y = -1.02)
  { wing: -1, tier: 0, basePos: [-1.00, -0.84, 0.02], size: [0.27, 0.31, 0.36], delay: 0.10 },
  { wing: -1, tier: 0, basePos: [-0.66, -0.84, 0.02], size: [0.27, 0.31, 0.36], delay: 0.14 },
  // Left wing — Middle tier (y = -0.10)
  { wing: -1, tier: 1, basePos: [-1.01, 0.06, 0.03], size: [0.24, 0.27, 0.32], delay: 0.18 },
  { wing: -1, tier: 1, basePos: [-0.71, 0.06, 0.03], size: [0.24, 0.27, 0.32], delay: 0.22 },
  // Left wing — Top tier (y = 0.82)
  { wing: -1, tier: 2, basePos: [-1.00, 0.97, 0.02], size: [0.26, 0.25, 0.32], delay: 0.26 },
  { wing: -1, tier: 2, basePos: [-0.67, 0.97, 0.02], size: [0.26, 0.25, 0.32], delay: 0.30 },

  // Right wing — Bottom tier (y = -1.02)
  { wing: 1, tier: 0, basePos: [0.66, -0.84, 0.02], size: [0.27, 0.31, 0.36], delay: 0.12 },
  { wing: 1, tier: 0, basePos: [1.00, -0.84, 0.02], size: [0.27, 0.31, 0.36], delay: 0.16 },
  // Right wing — Middle tier (y = -0.10)
  { wing: 1, tier: 1, basePos: [0.71, 0.06, 0.03], size: [0.24, 0.27, 0.32], delay: 0.20 },
  { wing: 1, tier: 1, basePos: [1.01, 0.06, 0.03], size: [0.24, 0.27, 0.32], delay: 0.24 },
  // Right wing — Top tier (y = 0.82)
  { wing: 1, tier: 2, basePos: [0.67, 0.97, 0.02], size: [0.26, 0.25, 0.32], delay: 0.28 },
  { wing: 1, tier: 2, basePos: [1.00, 0.97, 0.02], size: [0.26, 0.25, 0.32], delay: 0.32 },

  // Center bottom bay — under the flagship plinth (y = -1.02)
  { wing: 0, tier: 0, basePos: [-0.24, -0.86, -0.06], size: [0.22, 0.26, 0.32], delay: 0.15 },
  { wing: 0, tier: 0, basePos: [0.24, -0.86, -0.06], size: [0.22, 0.26, 0.32], delay: 0.19 },
];

const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();

function smoothstep(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

export interface ShelfSystemHandle {
  update: () => void;
}

export const ShelfSystem = React.forwardRef<ShelfSystemHandle, ShelfSystemProps>(
  function ShelfSystem({ animState }, ref) {
    const leftWingRef = useRef<THREE.Group>(null);
    const rightWingRef = useRef<THREE.Group>(null);
    const frameRef = useRef<THREE.Group>(null);

    const cartonMeshRef = useRef<THREE.InstancedMesh>(null);
    const labelMeshRef = useRef<THREE.InstancedMesh>(null);
    const barcodeMeshRef = useRef<THREE.InstancedMesh>(null);

    const { frameLinesGeo, wingLinesGeo, cartonGeo, labelGeo, barcodeGeo } = useMemo(() => {
      const fPts: number[] = [];
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
      const addRectXZ = (arr: number[], cx: number, y: number, cz: number, w: number, d: number) => {
        const hw = w * 0.5;
        const hd = d * 0.5;
        addLine(arr, cx - hw, y, cz - hd, cx + hw, y, cz - hd);
        addLine(arr, cx + hw, y, cz - hd, cx + hw, y, cz + hd);
        addLine(arr, cx + hw, y, cz + hd, cx - hw, y, cz + hd);
        addLine(arr, cx - hw, y, cz + hd, cx - hw, y, cz - hd);
      };

      // Base architectural plinth platform outline
      addRectXZ(fPts, 0, -1.22, 0, 2.52, 0.96);
      addRectXZ(fPts, 0, -1.27, 0, 2.66, 1.08);

      // Rear X-bracing tension wires in the central bay
      addLine(fPts, -0.46, -1.02, -0.37, 0.46, 1.38, -0.37);
      addLine(fPts, 0.46, -1.02, -0.37, -0.46, 1.38, -0.37);

      // Overhead flagship arch header bridge
      addRectXZ(fPts, 0, 1.40, 0, 2.40, 0.80);

      // Graduation tick marks on inner atrium uprights
      for (let i = 0; i <= 14; i++) {
        const ty = -1.05 + i * 0.16;
        addLine(fPts, -0.48, ty, 0.39, -0.43, ty, 0.39);
        addLine(fPts, 0.48, ty, 0.39, 0.43, ty, 0.39);
      }

      const frameLinesGeo = new THREE.BufferGeometry();
      frameLinesGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPts, 3));

      // Wing lines
      const wPts: number[] = [];
      const hw = WING_W * 0.5;
      const hd = SHELF_D * 0.5;
      for (const sy of SHELF_Y) {
        addRectXZ(wPts, 0, sy + 0.022, 0, WING_W, SHELF_D);
        // Front price-rail channel double rule
        addLine(wPts, -hw, sy - 0.02, hd + 0.005, hw, sy - 0.02, hd + 0.005);
        // Price tag divider ticks along front rail
        for (let t = -2; t <= 2; t++) {
          const tx = t * 0.13;
          addLine(wPts, tx, sy + 0.018, hd + 0.006, tx, sy - 0.018, hd + 0.006);
        }
      }
      // Side X-bracing
      addLine(wPts, hw, -1.02, -hd, hw, 0.82, hd);
      addLine(wPts, hw, -1.02, hd, hw, 0.82, -hd);

      const wingLinesGeo = new THREE.BufferGeometry();
      wingLinesGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPts, 3));

      const cartonGeo = new THREE.BoxGeometry(1, 1, 1);
      const labelGeo = new THREE.BoxGeometry(1, 1, 1);
      const barcodeGeo = new THREE.BoxGeometry(1, 1, 1);

      return { frameLinesGeo, wingLinesGeo, cartonGeo, labelGeo, barcodeGeo };
    }, []);

    useEffect(() => {
      return () => {
        frameLinesGeo.dispose();
        wingLinesGeo.dispose();
        cartonGeo.dispose();
        labelGeo.dispose();
        barcodeGeo.dispose();
      };
    }, [frameLinesGeo, wingLinesGeo, cartonGeo, labelGeo, barcodeGeo]);

    React.useImperativeHandle(ref, () => ({
      update() {
        const { intro, rise } = animState.current;

        // Flanking commodity wings step slightly back in Z as the central vitrine rises
        const wingBackZ = -rise * 0.14;
        const wingOutX = rise * 0.05;
        if (leftWingRef.current) {
          leftWingRef.current.position.set(
            -WING_CENTER_X - wingOutX,
            -(1 - intro) * 0.5,
            wingBackZ,
          );
        }
        if (rightWingRef.current) {
          rightWingRef.current.position.set(
            WING_CENTER_X + wingOutX,
            -(1 - intro) * 0.5,
            wingBackZ,
          );
        }
        if (frameRef.current) {
          frameRef.current.scale.y = Math.max(0.001, intro);
        }

        const cartons = cartonMeshRef.current;
        const labels = labelMeshRef.current;
        const barcodes = barcodeMeshRef.current;
        if (!cartons || !labels || !barcodes) return;

        for (let i = 0; i < COMMODITY_SLOTS.length; i++) {
          const s = COMMODITY_SLOTS[i];
          const localIntro = smoothstep((intro - s.delay) / (1 - s.delay));
          const diminish = 1 - rise * 0.14;
          const xShift = s.wing * wingOutX;
          const zShift = s.wing !== 0 ? wingBackZ : -rise * 0.1;

          const sx = Math.max(0.001, s.size[0] * localIntro * diminish);
          const sy = Math.max(0.001, s.size[1] * localIntro * diminish);
          const sz = Math.max(0.001, s.size[2] * localIntro * diminish);

          const baseY = SHELF_Y[s.tier] + 0.022 + sy * 0.5;
          const px = s.basePos[0] + xShift;
          const py = baseY - (1 - intro) * 0.5;
          const pz = s.basePos[2] + zShift;

          // Carton body
          _pos.set(px, py, pz);
          _quat.identity();
          _scale.set(sx, sy, sz);
          _mat.compose(_pos, _quat, _scale);
          cartons.setMatrixAt(i, _mat);

          // Front SKU label plate
          _pos.set(px, py - sy * 0.06, pz + sz * 0.5 + 0.004);
          _scale.set(sx * 0.64, sy * 0.36, 0.006);
          _mat.compose(_pos, _quat, _scale);
          labels.setMatrixAt(i, _mat);

          // Top center sealing tape / barcode bar
          _pos.set(px, py + sy * 0.5 + 0.003, pz);
          _scale.set(sx * 0.22, 0.005, sz * 0.92);
          _mat.compose(_pos, _quat, _scale);
          barcodes.setMatrixAt(i, _mat);
        }

        cartons.instanceMatrix.needsUpdate = true;
        labels.instanceMatrix.needsUpdate = true;
        barcodes.instanceMatrix.needsUpdate = true;
      },
    }));

    const hw = WING_W * 0.5;
    const hd = SHELF_D * 0.5;

    return (
      <group>
        {/* Central architectural base platform & overhead header bridge */}
        <group ref={frameRef}>
          {/* Stepped porcelain architectural base slab */}
          <mesh position={[0, -1.25, 0]}>
            <boxGeometry args={[2.52, 0.06, 0.96]} />
            <meshPhysicalMaterial
              color="#eef3ff"
              roughness={0.2}
              metalness={0.05}
              clearcoat={0.7}
            />
          </mesh>
          <mesh position={[0, -1.30, 0]}>
            <boxGeometry args={[2.66, 0.04, 1.08]} />
            <meshStandardMaterial color="#b9c9ff" roughness={0.28} metalness={0.18} />
          </mesh>

          {/* Bottom full-span shelf floor in center bay */}
          <mesh position={[0, SHELF_Y[0], 0]}>
            <boxGeometry args={[0.96, 0.04, SHELF_D]} />
            <meshPhysicalMaterial
              color="#dce6ff"
              transmission={0.55}
              thickness={0.5}
              roughness={0.18}
              ior={1.42}
            />
          </mesh>

          {/* 4 Inner Atrium Stanchion Posts (Cobalt Enamel) */}
          {[-0.48, 0.48].map((x) =>
            [-0.38, 0.38].map((z) => (
              <mesh key={`${x}-${z}`} position={[x, 0.08, z]}>
                <cylinderGeometry args={[0.014, 0.014, 2.64, 12]} />
                <meshStandardMaterial color="#1226c8" roughness={0.22} metalness={0.45} />
              </mesh>
            )),
          )}

          {/* Top bridge cornice beam */}
          <mesh position={[0, 1.40, 0]}>
            <boxGeometry args={[2.40, 0.045, 0.80]} />
            <meshPhysicalMaterial
              color="#dce6ff"
              transmission={0.6}
              thickness={0.5}
              roughness={0.15}
              ior={1.45}
            />
          </mesh>
          {/* Front cobalt header fascia strip */}
          <mesh position={[0, 1.40, 0.405]}>
            <boxGeometry args={[2.40, 0.026, 0.016]} />
            <meshStandardMaterial color="#1226c8" roughness={0.2} metalness={0.4} />
          </mesh>

          <lineSegments geometry={frameLinesGeo}>
            <lineBasicMaterial color="#1f38e0" transparent opacity={0.45} />
          </lineSegments>
        </group>

        {/* Left Shelf Wing (3 tiers + tubular stanchions + price rails + SKU hang tags) */}
        <group ref={leftWingRef} position={[-WING_CENTER_X, 0, 0]}>
          {[-hw, hw].map((x) =>
            [-hd, hd].map((z) => (
              <mesh key={`lw-${x}-${z}`} position={[x, 0.08, z]}>
                <cylinderGeometry args={[0.012, 0.012, 2.62, 10]} />
                <meshStandardMaterial color="#1f38e0" roughness={0.25} metalness={0.4} />
              </mesh>
            )),
          )}
          {SHELF_Y.map((sy, idx) => (
            <group key={idx} position={[0, sy, 0]}>
              <mesh>
                <boxGeometry args={[WING_W, 0.04, SHELF_D]} />
                <meshPhysicalMaterial
                  color="#d6e2ff"
                  transmission={0.62}
                  thickness={0.5}
                  roughness={0.16}
                  ior={1.44}
                />
              </mesh>
              {/* Front shelf price-rail strip */}
              <mesh position={[0, -0.004, hd + 0.006]}>
                <boxGeometry args={[WING_W, 0.028, 0.012]} />
                <meshStandardMaterial color="#2e4bff" roughness={0.25} metalness={0.3} />
              </mesh>
              {/* 2 Hanging SKU price tags per shelf bay */}
              {[-0.17, 0.17].map((tx) => (
                <mesh key={tx} position={[tx, -0.032, hd + 0.012]}>
                  <boxGeometry args={[0.08, 0.036, 0.006]} />
                  <meshStandardMaterial color="#eef3ff" roughness={0.2} />
                </mesh>
              ))}
            </group>
          ))}
          <lineSegments geometry={wingLinesGeo}>
            <lineBasicMaterial color="#1f38e0" transparent opacity={0.48} />
          </lineSegments>
        </group>

        {/* Right Shelf Wing (3 tiers + tubular stanchions + price rails + SKU hang tags) */}
        <group ref={rightWingRef} position={[WING_CENTER_X, 0, 0]}>
          {[-hw, hw].map((x) =>
            [-hd, hd].map((z) => (
              <mesh key={`rw-${x}-${z}`} position={[x, 0.08, z]}>
                <cylinderGeometry args={[0.012, 0.012, 2.62, 10]} />
                <meshStandardMaterial color="#1f38e0" roughness={0.25} metalness={0.4} />
              </mesh>
            )),
          )}
          {SHELF_Y.map((sy, idx) => (
            <group key={idx} position={[0, sy, 0]}>
              <mesh>
                <boxGeometry args={[WING_W, 0.04, SHELF_D]} />
                <meshPhysicalMaterial
                  color="#d6e2ff"
                  transmission={0.62}
                  thickness={0.5}
                  roughness={0.16}
                  ior={1.44}
                />
              </mesh>
              {/* Front shelf price-rail strip */}
              <mesh position={[0, -0.004, hd + 0.006]}>
                <boxGeometry args={[WING_W, 0.028, 0.012]} />
                <meshStandardMaterial color="#2e4bff" roughness={0.25} metalness={0.3} />
              </mesh>
              {/* 2 Hanging SKU price tags per shelf bay */}
              {[-0.17, 0.17].map((tx) => (
                <mesh key={tx} position={[tx, -0.032, hd + 0.012]}>
                  <boxGeometry args={[0.08, 0.036, 0.006]} />
                  <meshStandardMaterial color="#eef3ff" roughness={0.2} />
                </mesh>
              ))}
            </group>
          ))}
          <lineSegments geometry={wingLinesGeo}>
            <lineBasicMaterial color="#1f38e0" transparent opacity={0.48} />
          </lineSegments>
        </group>

        {/* Instanced Marketplace Commodity Cartons (14 boxes) */}
        <instancedMesh
          ref={cartonMeshRef}
          args={[cartonGeo, undefined, COMMODITY_SLOTS.length]}
        >
          <meshPhysicalMaterial
            color="#e2ebff"
            roughness={0.36}
            metalness={0.04}
            clearcoat={0.4}
            clearcoatRoughness={0.28}
          />
        </instancedMesh>

        {/* Instanced Front SKU Label Plates */}
        <instancedMesh
          ref={labelMeshRef}
          args={[labelGeo, undefined, COMMODITY_SLOTS.length]}
        >
          <meshStandardMaterial color="#7d97ff" roughness={0.28} metalness={0.18} />
        </instancedMesh>

        {/* Instanced Top Packing Tape / Barcode Strips */}
        <instancedMesh
          ref={barcodeMeshRef}
          args={[barcodeGeo, undefined, COMMODITY_SLOTS.length]}
        >
          <meshStandardMaterial color="#2e4bff" roughness={0.22} metalness={0.25} />
        </instancedMesh>
      </group>
    );
  },
);
