'use client';

import React, { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GlassMaterial } from '../../../../lib/materials';

export interface FestivalWheelHandle {
  hubMesh: THREE.Mesh | null;
  update: (angle: number, swing: number, beat: number, beatPulse: number, anim: boolean) => void;
}

const R = 1.24;
const R_INNER = 1.11;
const R_STAR = 0.44;
const SPOKES = 24;
const CARS = 12;
const BULBS = 72; // 24 front rim + 24 back rim + 24 inner star ring
const BASE_Y = -1.545; // relative to hub center at y = 0.22 -> world y = -1.325

const _m = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _euler = new THREE.Euler();
const _c = new THREE.Color();
const _dim = new THREE.Color('#c5d2ff');
const _lit = new THREE.Color('#4d6eff').multiplyScalar(2.5);
const _hot = new THREE.Color('#ffffff').multiplyScalar(3.2);

/**
 * FestivalWheel — Crafted 3D glass & porcelain miniature of the Empire Polo
 * Club Ferris wheel, with 3D tubular A-frame towers, boarding station deck,
 * 24-spoke truss lattice, 12 swinging passenger gondolas, and 72 chase bulbs.
 */
const FestivalWheel = React.forwardRef<FestivalWheelHandle, { position?: [number, number, number] }>(
  function FestivalWheel({ position = [-1.08, 0.22, -0.38] }, ref) {
    const wheelGroup = useRef<THREE.Group>(null);
    const hubRef = useRef<THREE.Mesh>(null);
    const bulbsRef = useRef<THREE.InstancedMesh>(null);
    const cabinGlassRef = useRef<THREE.InstancedMesh>(null);
    const cabinRoofRef = useRef<THREE.InstancedMesh>(null);

    /* Wheel spoke & space-frame truss lattice (rotates with wheel) */
    const wheelLattice = useMemo(() => {
      const pts: number[] = [];
      const addRing = (r: number, z: number, n = 96) => {
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI * 2;
          const a1 = ((i + 1) / n) * Math.PI * 2;
          pts.push(
            Math.cos(a0) * r, Math.sin(a0) * r, z,
            Math.cos(a1) * r, Math.sin(a1) * r, z,
          );
        }
      };

      addRing(R_INNER, 0.12);
      addRing(R_INNER, -0.12);
      addRing(R_STAR, 0.08);
      addRing(R_STAR, -0.08);

      for (let i = 0; i < SPOKES; i++) {
        const a = (i / SPOKES) * Math.PI * 2;
        const b = ((i + 1) / SPOKES) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const cb = Math.cos(b), sb = Math.sin(b);

        // Front and back radial tension spokes
        pts.push(0, 0, 0.14, ca * R, sa * R, 0.12);
        pts.push(0, 0, -0.14, ca * R, sa * R, -0.12);

        // Diagonal star-hub bracing
        pts.push(ca * R_STAR, sa * R_STAR, 0.08, cb * R_INNER, sb * R_INNER, -0.12);
        pts.push(ca * R_STAR, sa * R_STAR, -0.08, cb * R_INNER, sb * R_INNER, 0.12);

        // Outer rim X-truss web between front and back rims
        pts.push(ca * R, sa * R, 0.12, ca * R, sa * R, -0.12);
        pts.push(ca * R, sa * R, 0.12, cb * R_INNER, sb * R_INNER, -0.12);
        pts.push(ca * R, sa * R, -0.12, cb * R_INNER, sb * R_INNER, 0.12);
      }

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      return g;
    }, []);

    /* Static A-frame support bracing & boarding station railings */
    const towerLines = useMemo(() => {
      const pts: number[] = [];
      const y0 = BASE_Y + 0.08;
      // Cross-bracing between A-frame legs
      for (const z of [0.34, -0.34]) {
        const zTop = z > 0 ? 0.19 : -0.19;
        // Horizontal ties at 35% and 68% height
        const y1 = y0 * 0.65;
        const y2 = y0 * 0.34;
        const z1 = zTop + (z - zTop) * 0.65;
        const z2 = zTop + (z - zTop) * 0.34;
        pts.push(-0.56, y1, z1, 0.56, y1, z1);
        pts.push(-0.30, y2, z2, 0.30, y2, z2);
        // X-braces
        pts.push(-0.56, y1, z1, 0.30, y2, z2);
        pts.push(0.56, y1, z1, -0.30, y2, z2);
      }
      // Boarding platform safety railings
      const rx = 1.02, rz = 0.46, ry = BASE_Y + 0.14;
      pts.push(
        -rx, ry, rz, rx, ry, rz,
        -rx, ry, -rz, rx, ry, -rz,
        -rx, ry, -rz, -rx, ry, rz,
        rx, ry, -rz, rx, ry, rz,
      );
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      return g;
    }, []);

    /* 3D A-frame tubular legs geometry (4 angled struts merged into 1 draw call) */
    const legsGeo = useMemo(() => {
      const yBot = BASE_Y + 0.06;
      const specs: [number, number, number, number, number, number][] = [
        [-0.04, 0, 0.19, -0.86, yBot, 0.36],
        [0.04, 0, 0.19, 0.86, yBot, 0.36],
        [-0.04, 0, -0.19, -0.86, yBot, -0.36],
        [0.04, 0, -0.19, 0.86, yBot, -0.36],
      ];
      const pos: number[] = [];
      const norm: number[] = [];
      const baseCyl = new THREE.CylinderGeometry(0.022, 0.032, 1, 10, 1);
      const up = new THREE.Vector3(0, 1, 0);
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const mid = new THREE.Vector3();
      const dir = new THREE.Vector3();
      const q = new THREE.Quaternion();
      const mat = new THREE.Matrix4();
      const nMat = new THREE.Matrix3();
      const v = new THREE.Vector3();

      for (const [x0, y0, z0, x1, y1, z1] of specs) {
        a.set(x0, y0, z0);
        b.set(x1, y1, z1);
        mid.addVectors(a, b).multiplyScalar(0.5);
        dir.subVectors(a, b);
        const len = dir.length();
        dir.normalize();
        q.setFromUnitVectors(up, dir);
        mat.compose(mid, q, new THREE.Vector3(1, len, 1));
        nMat.getNormalMatrix(mat);

        const pAttr = baseCyl.attributes.position;
        const nAttr = baseCyl.attributes.normal;
        const idx = baseCyl.index!;
        for (let i = 0; i < idx.count; i++) {
          const vi = idx.getX(i);
          v.fromBufferAttribute(pAttr, vi).applyMatrix4(mat);
          pos.push(v.x, v.y, v.z);
          v.fromBufferAttribute(nAttr, vi).applyMatrix3(nMat).normalize();
          norm.push(v.x, v.y, v.z);
        }
      }
      baseCyl.dispose();
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      return g;
    }, []);

    /* Combined gondola hanger + roof cap geometry for instancing */
    const roofHangerGeo = useMemo(() => {
      const parts: THREE.BufferGeometry[] = [
        // Suspension rod from pivot (0,0,0) down to roof at y = -0.14
        new THREE.CylinderGeometry(0.006, 0.006, 0.15, 8).translate(0, -0.075, 0),
        // Gondola roof canopy cap at y = -0.15
        new THREE.CylinderGeometry(0.065, 0.098, 0.036, 16).translate(0, -0.15, 0),
        // Bottom gondola floor bumper ring at y = -0.31
        new THREE.CylinderGeometry(0.076, 0.056, 0.024, 16).translate(0, -0.31, 0),
      ];
      const pos: number[] = [];
      const norm: number[] = [];
      const v = new THREE.Vector3();
      for (const p of parts) {
        const pAttr = p.attributes.position;
        const nAttr = p.attributes.normal;
        const idx = p.index!;
        for (let i = 0; i < idx.count; i++) {
          const vi = idx.getX(i);
          v.fromBufferAttribute(pAttr, vi);
          pos.push(v.x, v.y, v.z);
          v.fromBufferAttribute(nAttr, vi);
          norm.push(v.x, v.y, v.z);
        }
        p.dispose();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      return g;
    }, []);

    /* Gondola glass cabin geometry (offset relative to pivot at y = -0.23) */
    const cabinGlassGeo = useMemo(() => {
      const g = new THREE.CapsuleGeometry(0.082, 0.065, 8, 18);
      g.translate(0, -0.23, 0);
      return g;
    }, []);

    const lineMat = useMemo(
      () => new THREE.LineBasicMaterial({ color: '#5875ff', transparent: true, opacity: 0.68 }),
      [],
    );
    const towerLineMat = useMemo(
      () => new THREE.LineBasicMaterial({ color: '#2e4bff', transparent: true, opacity: 0.5 }),
      [],
    );
    const bulbMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);

    /* Initialize 72 bulb positions around the wheel */
    useEffect(() => {
      const b = bulbsRef.current;
      if (!b) return;
      for (let i = 0; i < BULBS; i++) {
        const k = i % 24;
        const a = (k / 24) * Math.PI * 2;
        const ringIdx = Math.floor(i / 24); // 0: front rim, 1: back rim, 2: inner star ring
        const r = ringIdx < 2 ? R : R_STAR;
        const z = ringIdx === 0 ? 0.135 : ringIdx === 1 ? -0.135 : 0;
        _m.makeTranslation(Math.cos(a) * r, Math.sin(a) * r, z);
        b.setMatrixAt(i, _m);
        b.setColorAt(i, _dim);
      }
      b.instanceMatrix.needsUpdate = true;
      if (b.instanceColor) b.instanceColor.needsUpdate = true;
    }, []);

    useEffect(
      () => () => {
        wheelLattice.dispose();
        towerLines.dispose();
        legsGeo.dispose();
        roofHangerGeo.dispose();
        cabinGlassGeo.dispose();
        lineMat.dispose();
        towerLineMat.dispose();
        bulbMat.dispose();
      },
      [wheelLattice, towerLines, legsGeo, roofHangerGeo, cabinGlassGeo, lineMat, towerLineMat, bulbMat],
    );

    useImperativeHandle(
      ref,
      () => ({
        get hubMesh() {
          return hubRef.current;
        },
        update(angle: number, swing: number, beat: number, beatPulse: number, anim: boolean) {
          if (wheelGroup.current) {
            wheelGroup.current.rotation.z = angle;
          }

          // Update 12 passenger gondolas (counter-rotated to hang plumb + physical pendulum swing)
          const glassMesh = cabinGlassRef.current;
          const roofMesh = cabinRoofRef.current;
          if (glassMesh && roofMesh) {
            for (let i = 0; i < CARS; i++) {
              const a = (i / CARS) * Math.PI * 2 + Math.PI / CARS;
              _pos.set(Math.cos(a) * R, Math.sin(a) * R, 0);
              const carSwing = -angle + swing * (0.85 + 0.35 * Math.sin(i * 1.7));
              _euler.set(0, 0, carSwing);
              _quat.setFromEuler(_euler);
              _scl.setScalar(1);
              _m.compose(_pos, _quat, _scl);
              glassMesh.setMatrixAt(i, _m);
              roofMesh.setMatrixAt(i, _m);
            }
            glassMesh.instanceMatrix.needsUpdate = true;
            roofMesh.instanceMatrix.needsUpdate = true;
          }

          // Update 72 chase bulbs around the rims & star hub
          const b = bulbsRef.current;
          if (b) {
            const turned = Math.max(0, -angle);
            for (let i = 0; i < BULBS; i++) {
              const k = i % 24;
              const ringIdx = Math.floor(i / 24);
              const a0 = (k / 24) * Math.PI * 2;
              let need = a0 - Math.PI / 2;
              need = ((need % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
              // Base ignition from wheel rotation + festival chase wave
              const baseOn = anim ? Math.min(1, Math.max(0.35, (turned + 0.8 - need * 0.45) / 0.6)) : 1;
              const chase = anim
                ? 0.5 + 0.5 * Math.sin(beat * Math.PI * 2 - k * 0.52 + ringIdx * 1.1)
                : 0.5;
              const spark = anim ? Math.pow(chase, 3) * (0.45 + 0.55 * beatPulse) : 0.25;
              _c.copy(_dim).lerp(_lit, baseOn).lerp(_hot, spark * baseOn);
              b.setColorAt(i, _c);
            }
            if (b.instanceColor) b.instanceColor.needsUpdate = true;
          }

          if (hubRef.current) {
            const m = hubRef.current.material as THREE.MeshPhysicalMaterial;
            m.emissiveIntensity = 0.45 + 0.55 * beatPulse;
          }
        },
      }),
      [],
    );

    return (
      <group position={position}>
        {/* Static A-frame support legs & cross-bracing */}
        <mesh geometry={legsGeo}>
          <GlassMaterial kind="azure" />
        </mesh>
        <lineSegments geometry={towerLines} material={towerLineMat} />

        {/* Boarding station platform at base of Ferris wheel */}
        <mesh position={[0, BASE_Y + 0.04, 0]}>
          <boxGeometry args={[2.08, 0.08, 0.94]} />
          <meshStandardMaterial color="#e8eeff" roughness={0.3} metalness={0.05} />
        </mesh>
        <mesh position={[0, BASE_Y + 0.095, 0]}>
          <boxGeometry args={[1.64, 0.035, 0.68]} />
          <GlassMaterial kind="pane" />
        </mesh>

        {/* Rotating wheel assembly */}
        <group ref={wheelGroup}>
          <lineSegments geometry={wheelLattice} material={lineMat} />

          {/* Twin outer structural glass rims + inner ring */}
          <mesh position={[0, 0, 0.12]}>
            <torusGeometry args={[R, 0.026, 12, 128]} />
            <GlassMaterial kind="azure" />
          </mesh>
          <mesh position={[0, 0, -0.12]}>
            <torusGeometry args={[R, 0.026, 12, 128]} />
            <GlassMaterial kind="azure" />
          </mesh>
          <mesh>
            <torusGeometry args={[R_INNER, 0.016, 10, 96]} />
            <GlassMaterial kind="crystal" />
          </mesh>

          {/* 72 Rim & Star-Hub Chase Bulbs */}
          <instancedMesh ref={bulbsRef} args={[undefined, undefined, BULBS]} material={bulbMat}>
            <sphereGeometry args={[0.025, 8, 8]} />
          </instancedMesh>

          {/* 12 Gondola Hangers + Enamel Roofs */}
          <instancedMesh ref={cabinRoofRef} args={[roofHangerGeo, undefined, CARS]}>
            <meshStandardMaterial color="#2e4bff" roughness={0.22} metalness={0.18} />
          </instancedMesh>

          {/* 12 Gondola Refractive Glass Cabins */}
          <instancedMesh ref={cabinGlassRef} args={[cabinGlassGeo, undefined, CARS]}>
            <GlassMaterial kind="crystal" />
          </instancedMesh>
        </group>

        {/* Central Hub & Bearing Collars */}
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.048, 0.048, 0.44, 16]} />
          <meshStandardMaterial color="#dce5ff" roughness={0.2} metalness={0.3} />
        </mesh>
        <mesh ref={hubRef}>
          <sphereGeometry args={[0.135, 28, 20]} />
          <GlassMaterial kind="deep" emissive="#2e4bff" emissiveIntensity={0.5} />
        </mesh>
      </group>
    );
  },
);

export default FestivalWheel;
