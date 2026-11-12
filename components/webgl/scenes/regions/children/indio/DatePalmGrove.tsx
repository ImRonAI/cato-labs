'use client';

import React, { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GlassMaterial } from '../../../../lib/materials';

export interface DatePalmGroveHandle {
  update: (time: number, beatPulse: number, anim: boolean) => void;
}

interface PalmSpec {
  x: number;
  y: number;
  z: number;
  height: number;
  leanX: number;
  leanZ: number;
  scale: number;
}

const PALMS: PalmSpec[] = [
  // Right-flank Medjool Date Grove beside the stage
  { x: 2.08, y: -1.325, z: -0.16, height: 1.44, leanX: 0.12, leanZ: 0.04, scale: 1.0 },
  { x: 1.84, y: -1.325, z: 0.38, height: 1.18, leanX: 0.15, leanZ: 0.10, scale: 0.88 },
  { x: 1.90, y: -1.325, z: -0.68, height: 1.58, leanX: 0.08, leanZ: -0.06, scale: 1.06 },
  // Center-back promenade palm between Wheel & Stage
  { x: -0.06, y: -1.325, z: -0.82, height: 1.50, leanX: -0.04, leanZ: -0.05, scale: 0.98 },
  // Left-flank palm beside the Ferris Wheel
  { x: -2.16, y: -1.325, z: -0.22, height: 1.36, leanX: -0.14, leanZ: 0.05, scale: 0.94 },
];

const RINGS_PER_TRUNK = 12;
const FRONDS_PER_PALM = 14;
const DATES_PER_PALM = 6;

const _m = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _euler = new THREE.Euler();

/**
 * DatePalmGrove — Sculpted miniature grove of 5 Medjool date palms
 * (Phoenix dactylifera), referencing Indio's heritage as the Date Capital
 * and host of the National Date Festival. Built with 3 InstancedMeshes
 * (diamond-faceted trunks, arching pinnate fronds, and sapphire date bunches).
 */
const DatePalmGrove = React.forwardRef<DatePalmGroveHandle, object>(function DatePalmGrove(_, ref) {
  const trunksRef = useRef<THREE.InstancedMesh>(null);
  const frondsRef = useRef<THREE.InstancedMesh>(null);
  const datesRef = useRef<THREE.InstancedMesh>(null);

  /* Crown top positions for each palm (computed once from trunk curve) */
  const crownTops = useMemo(() => {
    return PALMS.map((p) => ({
      x: p.x + p.leanX,
      y: p.y + p.height,
      z: p.z + p.leanZ,
      scale: p.scale,
      leanX: p.leanX,
      leanZ: p.leanZ,
    }));
  }, []);

  /* Sculpted pinnate palm frond geometry (curved spine + V-angled leaflet pairs) */
  const frondGeo = useMemo(() => {
    const pos: number[] = [];
    const norm: number[] = [];
    const segs = 12;
    const len = 0.64;

    const spinePt = (u: number): [number, number, number] => {
      const z = u * len;
      const y = Math.sin(u * Math.PI * 0.72) * 0.16 - u * u * 0.24;
      return [0, y, z];
    };

    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();
    const pC = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const n = new THREE.Vector3();

    const addTri = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number,
    ) => {
      pA.set(ax, ay, az);
      pB.set(bx, by, bz);
      pC.set(cx, cy, cz);
      ab.subVectors(pB, pA);
      ac.subVectors(pC, pA);
      n.crossVectors(ab, ac).normalize();
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      norm.push(n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z);
    };

    for (let i = 0; i < segs; i++) {
      const u0 = i / segs;
      const u1 = (i + 1) / segs;
      const um = (u0 + u1) * 0.5;
      const [x0, y0, z0] = spinePt(u0);
      const [x1, y1, z1] = spinePt(u1);
      const env = Math.sin(Math.pow(um, 0.75) * Math.PI);
      const w = 0.014 + 0.088 * env;
      const droop = -0.028 * env;
      const zTip = z0 + (z1 - z0) * 0.85;
      const yTip = (y0 + y1) * 0.5 + droop;

      // Left leaflet blade
      addTri(x0, y0, z0, x1, y1, z1, -w, yTip, zTip);
      // Right leaflet blade
      addTri(x0, y0, z0, w, yTip, zTip, x1, y1, z1);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    return g;
  }, []);

  /* Populate static trunk segments & hanging date clusters */
  useEffect(() => {
    const trunkMesh = trunksRef.current;
    const dateMesh = datesRef.current;
    if (!trunkMesh || !dateMesh) return;

    let tIdx = 0;
    let dIdx = 0;

    PALMS.forEach((p, pi) => {
      for (let r = 0; r < RINGS_PER_TRUNK; r++) {
        const u = (r + 0.5) / RINGS_PER_TRUNK;
        const curve = u * u;
        const x = p.x + p.leanX * curve;
        const y = p.y + p.height * u;
        const z = p.z + p.leanZ * curve;
        // Tapered trunk with characteristic pineapple crown swelling at top
        const isCrown = r === RINGS_PER_TRUNK - 1;
        const radScale = isCrown
          ? 1.28 * p.scale
          : (1.08 - 0.34 * u) * p.scale;
        const hScale = (p.height / RINGS_PER_TRUNK) / 0.12;
        _pos.set(x, y, z);
        _euler.set(
          (p.leanZ / p.height) * 2 * u,
          (r % 2) * (Math.PI / 7) + pi * 0.5,
          -(p.leanX / p.height) * 2 * u,
        );
        _quat.setFromEuler(_euler);
        _scl.set(radScale, hScale, radScale);
        _m.compose(_pos, _quat, _scl);
        trunkMesh.setMatrixAt(tIdx++, _m);
      }

      const top = crownTops[pi];
      for (let d = 0; d < DATES_PER_PALM; d++) {
        const a = (d / DATES_PER_PALM) * Math.PI * 2 + pi * 0.4;
        const rad = 0.088 * top.scale;
        _pos.set(
          top.x + Math.cos(a) * rad,
          top.y - 0.065 * top.scale,
          top.z + Math.sin(a) * rad,
        );
        _euler.set(0.25 * Math.sin(a), a, -0.25 * Math.cos(a));
        _quat.setFromEuler(_euler);
        _scl.set(top.scale, top.scale * 1.45, top.scale);
        _m.compose(_pos, _quat, _scl);
        dateMesh.setMatrixAt(dIdx++, _m);
      }
    });

    trunkMesh.instanceMatrix.needsUpdate = true;
    dateMesh.instanceMatrix.needsUpdate = true;
  }, [crownTops]);

  useEffect(
    () => () => {
      frondGeo.dispose();
    },
    [frondGeo],
  );

  useImperativeHandle(
    ref,
    () => ({
      update(time: number, beatPulse: number, anim: boolean) {
        const frondMesh = frondsRef.current;
        if (!frondMesh) return;
        let fIdx = 0;
        for (let pi = 0; pi < crownTops.length; pi++) {
          const top = crownTops[pi];
          for (let f = 0; f < FRONDS_PER_PALM; f++) {
            const isUpper = f >= 8;
            const countInTier = isUpper ? 6 : 8;
            const idxInTier = isUpper ? f - 8 : f;
            const yaw =
              (idxInTier / countInTier) * Math.PI * 2 +
              (isUpper ? Math.PI / 6 : 0) +
              pi * 0.65;
            const breeze = anim
              ? Math.sin(time * 1.65 + pi * 1.3 + f * 0.7) * 0.048 +
                beatPulse * 0.018
              : 0;
            const pitch = (isUpper ? -0.46 : -0.12) + breeze;
            _pos.set(top.x, top.y + (isUpper ? 0.02 : -0.01), top.z);
            _euler.set(pitch, yaw, 0, 'YXZ');
            _quat.setFromEuler(_euler);
            const s = top.scale * (isUpper ? 0.86 : 1.04);
            _scl.set(s, s, s);
            _m.compose(_pos, _quat, _scl);
            frondMesh.setMatrixAt(fIdx++, _m);
          }
        }
        frondMesh.instanceMatrix.needsUpdate = true;
      },
    }),
    [crownTops],
  );

  return (
    <group>
      {/* 60 Diamond-Faceted Porcelain-Blue Palm Trunk Segments */}
      <instancedMesh
        ref={trunksRef}
        args={[undefined, undefined, PALMS.length * RINGS_PER_TRUNK]}
      >
        <cylinderGeometry args={[0.048, 0.062, 0.125, 7]} />
        <meshStandardMaterial color="#d6e1ff" roughness={0.38} metalness={0.05} />
      </instancedMesh>

      {/* 30 Hanging Sapphire-Glass Date Clusters */}
      <instancedMesh
        ref={datesRef}
        args={[undefined, undefined, PALMS.length * DATES_PER_PALM]}
      >
        <sphereGeometry args={[0.032, 10, 8]} />
        <GlassMaterial kind="core" emissive="#2e4bff" emissiveIntensity={0.65} />
      </instancedMesh>

      {/* 70 Arching Pinnate Date Palm Fronds */}
      <instancedMesh
        ref={frondsRef}
        args={[frondGeo, undefined, PALMS.length * FRONDS_PER_PALM]}
      >
        <GlassMaterial kind="azure" side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
});

export default DatePalmGrove;
