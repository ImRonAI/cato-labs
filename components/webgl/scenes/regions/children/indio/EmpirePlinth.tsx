'use client';

import React, { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GlassMaterial } from '../../../../lib/materials';
import { contactShadowTexture } from '../../lib-a/place';

export interface EmpirePlinthHandle {
  update: (time: number, beat: number, beatPulse: number, reveal: number, anim: boolean) => void;
}

const LANTERN_POSITIONS: [number, number, number][] = [
  // Promenade curve from Ferris wheel (-1.1, -0.3) toward Main Stage (0.95, 0.35)
  [-1.65, -1.31, 0.18],
  [-1.38, -1.31, 0.36],
  [-1.08, -1.31, 0.50],
  [-0.76, -1.31, 0.58],
  [-0.42, -1.31, 0.62],
  [-0.08, -1.31, 0.60],
  [0.26, -1.31, 0.54],
  [0.58, -1.31, 0.44],
  // Inner promenade partner row
  [-1.52, -1.31, -0.02],
  [-1.24, -1.31, 0.14],
  [-0.94, -1.31, 0.28],
  [-0.62, -1.31, 0.36],
  [-0.28, -1.31, 0.38],
  [0.06, -1.31, 0.36],
  // Stage audience arc bollards
  [0.35, -1.31, 0.88],
  [0.68, -1.31, 0.96],
  [1.02, -1.31, 0.96],
  [1.34, -1.31, 0.86],
  [1.62, -1.31, 0.68],
  // Back polo lawn & palm grove uplights
  [-1.88, -1.31, -0.48],
  [-0.42, -1.31, -0.82],
  [0.12, -1.31, -0.86],
  [1.72, -1.31, 0.16],
  [2.02, -1.31, -0.18],
  [1.78, -1.31, -0.56],
  [-0.22, -1.31, -0.96],
  [0.44, -1.31, -0.92],
  [-2.05, -1.31, -0.12],
];

const _m = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _c = new THREE.Color();
const _dim = new THREE.Color('#b8c8ff');
const _lit = new THREE.Color('#2e4bff').multiplyScalar(2.2);
const _hot = new THREE.Color('#e8f0ff').multiplyScalar(2.8);

/**
 * EmpirePlinth — Architectural vitrine base of the Empire Polo Club grounds
 * in Indio, framed by the faceted Coachella Valley mountain ridge, engraved
 * polo-lawn field lines, promenade bollards, and bass-wave rings.
 */
const EmpirePlinth = React.forwardRef<EmpirePlinthHandle, object>(function EmpirePlinth(_, ref) {
  const lanternsRef = useRef<THREE.InstancedMesh>(null);
  const waveRefs = useRef<(THREE.Mesh | null)[]>([]);
  const shadowTex = useMemo(() => contactShadowTexture(), []);

  /* Faceted desert mountain backdrop (Santa Rosa / Little San Bernardino ridges) */
  const { mountainGeo, mountainLines } = useMemo(() => {
    const ridgeProfile = (x: number, layer: number) => {
      const u = x / 2.85;
      const envelope = Math.max(0, 1 - u * u * 0.88);
      if (layer === 0) {
        // Main back range with twin desert peaks
        const p1 = Math.exp(-Math.pow((u + 0.42) * 2.4, 2)) * 0.82;
        const p2 = Math.exp(-Math.pow((u - 0.38) * 2.1, 2)) * 0.94;
        const p3 = Math.exp(-Math.pow((u - 0.02) * 3.2, 2)) * 0.56;
        const crag = Math.sin(u * 14) * 0.04 + Math.cos(u * 23) * 0.025;
        return (0.14 + p1 + p2 + p3 + crag) * envelope;
      }
      // Foreground foothill ridge
      const f1 = Math.exp(-Math.pow((u + 0.25) * 2.6, 2)) * 0.46;
      const f2 = Math.exp(-Math.pow((u - 0.52) * 2.8, 2)) * 0.52;
      const crag = Math.cos(u * 17) * 0.028;
      return (0.08 + f1 + f2 + crag) * envelope;
    };

    const cols = 36;
    const baseY = -1.325;
    const pos: number[] = [];
    const lines: number[] = [];

    const pushTri = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number,
    ) => {
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    };

    for (let layer = 0; layer < 2; layer++) {
      const zCrest = layer === 0 ? -1.42 : -1.18;
      const zFront = layer === 0 ? -1.16 : -0.96;
      const zBack = layer === 0 ? -1.66 : -1.36;
      for (let i = 0; i < cols; i++) {
        const u0 = -1 + (2 * i) / cols;
        const u1 = -1 + (2 * (i + 1)) / cols;
        const x0 = u0 * 2.65;
        const x1 = u1 * 2.65;
        const xm = (x0 + x1) * 0.5;
        const h0 = ridgeProfile(x0, layer);
        const h1 = ridgeProfile(x1, layer);
        const hm = (h0 + h1) * 0.5 + (i % 2 === 0 ? 0.02 : -0.015);

        const y0 = baseY + h0;
        const y1 = baseY + h1;
        const ym = baseY + hm * 0.52;
        const zf0 = zFront - Math.abs(u0) * 0.18;
        const zf1 = zFront - Math.abs(u1) * 0.18;
        const zfm = (zf0 + zf1) * 0.5 + 0.04;
        const zc0 = zCrest - Math.abs(u0) * 0.14;
        const zc1 = zCrest - Math.abs(u1) * 0.14;

        // Upper faceted slope
        pushTri(x0, y0, zc0, xm, ym, zfm, x1, y1, zc1);
        // Left lower facet
        pushTri(x0, y0, zc0, x0, baseY, zf0, xm, ym, zfm);
        // Right lower facet
        pushTri(xm, ym, zfm, x1, baseY, zf1, x1, y1, zc1);
        // Base filler triangle
        pushTri(x0, baseY, zf0, x1, baseY, zf1, xm, ym, zfm);
        // Back slope
        pushTri(x0, y0, zc0, x1, y1, zc1, x1, baseY, zBack);
        pushTri(x0, y0, zc0, x1, baseY, zBack, x0, baseY, zBack);

        // Crest line + facet ribs
        lines.push(x0, y0, zc0 + 0.003, x1, y1, zc1 + 0.003);
        if (i % 2 === 0) {
          lines.push(x0, y0, zc0 + 0.003, xm, ym, zfm + 0.003);
          lines.push(xm, ym, zfm + 0.003, x0, baseY, zf0 + 0.003);
        }
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();

    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    return { mountainGeo: g, mountainLines: lg };
  }, []);

  /* Polo lawn architectural hairlines: perimeter, polo field, center line, promenade & contour rings */
  const lawnLines = useMemo(() => {
    const pts: number[] = [];
    const y = -1.322;

    const addEllipse = (rx: number, rz: number, yPos: number, segs = 96) => {
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        pts.push(
          Math.cos(a0) * rx, yPos, Math.sin(a0) * rz,
          Math.cos(a1) * rx, yPos, Math.sin(a1) * rz,
        );
      }
    };

    // Outer architectural rim rings
    addEllipse(2.92, 1.88, -1.39);
    addEllipse(2.82, 1.80, y);
    addEllipse(2.68, 1.68, y);

    // Empire Polo Field rectangle Markings (center-back lawn)
    const fx0 = -1.75, fx1 = 0.85, fz0 = -0.88, fz1 = 0.18;
    pts.push(
      fx0, y, fz0, fx1, y, fz0,
      fx1, y, fz0, fx1, y, fz1,
      fx1, y, fz1, fx0, y, fz1,
      fx0, y, fz1, fx0, y, fz0,
    );
    // Polo field center line & 60-yard safety lines
    const fmx = (fx0 + fx1) * 0.5;
    pts.push(
      fmx, y, fz0, fmx, y, fz1,
      fx0 + 0.55, y, fz0, fx0 + 0.55, y, fz1,
      fx1 - 0.55, y, fz0, fx1 - 0.55, y, fz1,
    );
    // Center polo throw-in circle
    const fmz = (fz0 + fz1) * 0.5;
    const cr = 0.22;
    for (let i = 0; i < 32; i++) {
      const a0 = (i / 32) * Math.PI * 2;
      const a1 = ((i + 1) / 32) * Math.PI * 2;
      pts.push(
        fmx + Math.cos(a0) * cr, y, fmz + Math.sin(a0) * cr,
        fmx + Math.cos(a1) * cr, y, fmz + Math.sin(a1) * cr,
      );
    }
    // Miniature polo goal posts at both ends of the field
    for (const gx of [fx0, fx1]) {
      for (const gz of [fmz - 0.11, fmz + 0.11]) {
        pts.push(gx, y, gz, gx, y + 0.14, gz);
      }
    }

    // Diagonal festival promenade path lines connecting Wheel Plaza to Stage Arena
    const segs = 28;
    for (const offsetZ of [-0.11, 0.11]) {
      for (let i = 0; i < segs; i++) {
        const t0 = i / segs;
        const t1 = (i + 1) / segs;
        const x0 = -1.6 + t0 * 2.35;
        const x1 = -1.6 + t1 * 2.35;
        const z0 = 0.08 + Math.sin(t0 * Math.PI) * 0.42 + offsetZ;
        const z1 = 0.08 + Math.sin(t1 * Math.PI) * 0.42 + offsetZ;
        pts.push(x0, y, z0, x1, y, z1);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#4c6bff', transparent: true, opacity: 0.45 }),
    [],
  );
  const mountainLineMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#6b87ff', transparent: true, opacity: 0.55 }),
    [],
  );
  const lanternMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const waveGeos = useMemo(() => {
    return [0, 1, 2, 3].map(() => new THREE.RingGeometry(0.45, 0.475, 48));
  }, []);
  const waveMats = useMemo(() => {
    return [0, 1, 2, 3].map(
      () =>
        new THREE.MeshBasicMaterial({
          color: '#2e4bff',
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
    );
  }, []);

  useEffect(() => {
    const mesh = lanternsRef.current;
    if (!mesh) return;
    for (let i = 0; i < LANTERN_POSITIONS.length; i++) {
      const [x, y, z] = LANTERN_POSITIONS[i];
      _pos.set(x, y + 0.025, z);
      _quat.identity();
      _scl.setScalar(1);
      _m.compose(_pos, _quat, _scl);
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _dim);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useEffect(
    () => () => {
      mountainGeo.dispose();
      mountainLines.dispose();
      lawnLines.dispose();
      lineMat.dispose();
      mountainLineMat.dispose();
      lanternMat.dispose();
      waveGeos.forEach((g) => g.dispose());
      waveMats.forEach((m) => m.dispose());
    },
    [mountainGeo, mountainLines, lawnLines, lineMat, mountainLineMat, lanternMat, waveGeos, waveMats],
  );

  useImperativeHandle(
    ref,
    () => ({
      update(time: number, beat: number, beatPulse: number, reveal: number, anim: boolean) {
        const mesh = lanternsRef.current;
        if (mesh) {
          const n = LANTERN_POSITIONS.length;
          for (let i = 0; i < n; i++) {
            const thresh = i / n;
            const on = anim ? Math.min(1, Math.max(0, (reveal * 1.35 - thresh) / 0.25)) : 1;
            const wave = anim ? 0.5 + 0.5 * Math.sin(beat * Math.PI - i * 0.45) : 0.6;
            _c.copy(_dim)
              .lerp(_lit, on)
              .lerp(_hot, on * (0.25 * beatPulse + 0.25 * wave));
            mesh.setColorAt(i, _c);
          }
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }

        // Expand concentric sound-wave rings across the polo lawn from the stage
        for (let i = 0; i < 4; i++) {
          const w = waveRefs.current[i];
          if (!w) continue;
          const phase = anim ? ((beat * 0.5 + i * 0.25) % 1) : (i + 1) * 0.22;
          const s = 0.65 + phase * 2.15;
          w.scale.set(s, s, 1);
          const mat = waveMats[i];
          mat.opacity = anim
            ? Math.sin(phase * Math.PI) * (0.28 + 0.22 * beatPulse)
            : 0.18 * (1 - i * 0.2);
        }
      },
    }),
    [waveMats],
  );

  return (
    <group>
      {/* Soft radial contact shadow under the entire plinth */}
      <mesh position={[0, -1.62, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[7.4, 4.9]} />
        <meshBasicMaterial map={shadowTex} transparent opacity={0.62} depthWrite={false} />
      </mesh>

      {/* Lower refractive glass architectural plinth */}
      <mesh position={[0, -1.48, 0]} scale={[1.48, 1, 0.96]}>
        <cylinderGeometry args={[2.0, 2.06, 0.16, 72]} />
        <GlassMaterial kind="pane" />
      </mesh>

      {/* Upper matte porcelain polo-grounds terrace */}
      <mesh position={[0, -1.365, 0]} scale={[1.48, 1, 0.96]}>
        <cylinderGeometry args={[1.94, 1.98, 0.075, 72]} />
        <meshStandardMaterial color="#f2f6ff" roughness={0.28} metalness={0.04} />
      </mesh>

      {/* Recessed azure-ice glass polo field inlay */}
      <mesh position={[-0.45, -1.325, -0.35]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2.6, 1.06]} />
        <GlassMaterial kind="ice" />
      </mesh>

      {/* Coachella Valley mountain backdrop (Santa Rosa / San Jacinto range) */}
      <mesh geometry={mountainGeo}>
        <GlassMaterial kind="ice" />
      </mesh>
      <lineSegments geometry={mountainLines} material={mountainLineMat} />

      {/* Engraved polo field & promenade architectural lines */}
      <lineSegments geometry={lawnLines} material={lineMat} />

      {/* Promenade ground lanterns & uplights */}
      <instancedMesh
        ref={lanternsRef}
        args={[undefined, undefined, LANTERN_POSITIONS.length]}
        material={lanternMat}
      >
        <cylinderGeometry args={[0.022, 0.028, 0.055, 10]} />
      </instancedMesh>

      {/* Concentric sound-wave rings radiating from the Festival Stage across the lawn */}
      {waveGeos.map((geo, i) => (
        <mesh
          key={i}
          ref={(el) => {
            waveRefs.current[i] = el;
          }}
          geometry={geo}
          material={waveMats[i]}
          position={[0.88, -1.318, 0.28]}
          rotation-x={-Math.PI / 2}
        />
      ))}
    </group>
  );
});

export default EmpirePlinth;
