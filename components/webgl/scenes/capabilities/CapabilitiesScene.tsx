'use client';

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { useQuality } from '../../lib/quality';
import { pointer, smooth } from '../../scroll-store';
import NewtonsCradle, { type CradleState } from './dioramas/NewtonsCradle';

/* module-level temps — zero allocations inside useFrame */
const _look = new THREE.Vector3();

/**
 * CapabilitiesScene — "Newton's cradle of six practices".
 *
 * One instrument for the whole page: six glass spheres, one per practice.
 * Every practice section that scrolls in is one strike, momentum passing
 * through all six (see NewtonsCradle). The camera only breathes: a slow
 * pointer parallax, a gentle push-in through the practices, a lift for
 * the outro where the cradle comes to rest.
 */
export default function CapabilitiesScene() {
  const q = useQuality();
  const start = useRef<number | null>(null);
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const cradle = useRef<CradleState>({ hero: 1, outro: 0 });

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (start.current === null) start.current = t;
    const intro = smooth(Math.min((t - start.current) / 2, 1));
    const { hero, outro } = cradle.current;
    const mid = Math.max(0, 1 - hero - outro);

    const cam = state.camera;
    const px = q.animate ? pointer.x * 0.32 : 0;
    const py = q.animate ? pointer.y * 0.2 : 0;
    const tx = px;
    const ty = 0.1 + py + outro * 0.4;
    const tz = 9 - mid * 0.35 + (q.animate ? (1 - intro) * 1.4 : 0);

    if (q.animate) {
      cam.position.x += (tx - cam.position.x) * 0.05;
      cam.position.y += (ty - cam.position.y) * 0.05;
      cam.position.z += (tz - cam.position.z) * 0.05;
      _look.set(0, outro * 0.3, 0);
      look.current.lerp(_look, 0.05);
    } else {
      cam.position.set(tx, ty, tz);
      look.current.set(0, outro * 0.3, 0);
    }
    cam.lookAt(look.current);
  });

  return (
    <group>
      <SceneLightRig />
      <NewtonsCradle q={q} state={cradle} />
      <ParticleField
        count={Math.floor(1500 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.34}
      />
    </group>
  );
}
