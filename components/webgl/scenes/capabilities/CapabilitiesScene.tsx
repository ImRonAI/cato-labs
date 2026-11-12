'use client';

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { GlassMaterial } from '../../lib/materials';
import { useQuality } from '../../lib/quality';
import { pointer, smooth } from '../../scroll-store';
import NewtonsCradle, { type CradleState } from './dioramas/NewtonsCradle';

/* module-level temps — zero allocations inside useFrame */
const _look = new THREE.Vector3();

/**
 * CapabilitiesScene — "Newton's cradle of six practices".
 *
 * Six glass spheres, one per practice (`strategy`, `agents`, `product`,
 * `brand`, `growth`, `operations`), framed by an architectural orbital datum
 * arc. Every practice section triggers a physical strike and shifts camera
 * elevation, azimuth, and focal distance subtly toward that practice's seat,
 * before ascending into a unified chord on `cap-outro`.
 */
export default function CapabilitiesScene() {
  const q = useQuality();
  const start = useRef<number | null>(null);
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const arcRef = useRef<THREE.Mesh>(null);
  const cradle = useRef<CradleState>({
    hero: 1,
    outro: 0,
    focusIdx: 2.5,
    focusStrength: 0,
  });

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (start.current === null) start.current = t;
    const since = t - start.current;
    const intro = q.animate ? smooth(Math.min(since / 1.8, 1)) : 1;
    const { hero, outro, focusIdx, focusStrength } = cradle.current;
    const mid = Math.max(0, 1 - hero - outro);

    /* subtle distant architectural datum ring framing the cradle */
    if (arcRef.current) {
      const arcScale = (q.compact ? 0.72 : 1) * (0.85 + 0.15 * intro);
      arcRef.current.scale.setScalar(arcScale);
      arcRef.current.position.set(
        q.compact ? 0 : 2.15 * (1 - outro * 0.8),
        -0.15 + outro * 1.15,
        -2.8 - outro * 1.2,
      );
      if (q.animate) {
        arcRef.current.rotation.z = t * 0.035;
        arcRef.current.rotation.x = 0.22 + Math.sin(t * 0.08) * 0.05 + outro * 0.35;
      } else {
        arcRef.current.rotation.set(0.25, -0.2, 0.2);
      }
    }

    const cam = state.camera;
    const px = q.animate ? pointer.x * 0.34 : 0;
    const py = q.animate ? pointer.y * 0.2 : 0;

    /* per-practice subtle azimuth & elevation shift across the 6 sections */
    const practiceNorm = (focusIdx - 2.5) / 2.5; // -1 .. +1
    const tx = px + practiceNorm * 0.42 * mid;
    const ty =
      0.16 +
      py +
      mid * (0.12 - practiceNorm * 0.14) +
      outro * 0.55 +
      (1 - intro) * 0.35;
    const tz =
      9.1 -
      mid * (0.65 + focusStrength * 0.32) +
      outro * 0.45 +
      (q.animate ? (1 - intro) * 1.5 : 0);

    _look.set(
      (q.compact ? 0 : 0.32 * hero + 0.45 * mid * (1 + practiceNorm * 0.18)),
      outro * 0.38 - hero * 0.06,
      0,
    );

    if (q.animate) {
      cam.position.x += (tx - cam.position.x) * 0.05;
      cam.position.y += (ty - cam.position.y) * 0.05;
      cam.position.z += (tz - cam.position.z) * 0.05;
      look.current.lerp(_look, 0.055);
    } else {
      cam.position.set(tx, ty, tz);
      look.current.copy(_look);
    }
    cam.lookAt(look.current);
  });

  return (
    <group>
      <SceneLightRig />
      {/* distant architectural datum halo behind the six-practice cradle */}
      <mesh ref={arcRef} position={[2.15, -0.15, -2.8]} rotation={[0.22, -0.24, 0]}>
        <torusGeometry args={[2.65, 0.014, 16, 128]} />
        <GlassMaterial kind="ice" />
      </mesh>
      <NewtonsCradle q={q} state={cradle} />
      <ParticleField
        count={Math.floor(1500 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.34}
      />
    </group>
  );
}
