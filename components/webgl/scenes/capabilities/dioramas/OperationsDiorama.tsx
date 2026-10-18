'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { GradientGlassMaterial } from '@/components/webgl/lib/materials';
import type { DioramaProps } from './types';

const CUBES = 8;

/**
 * 06 Operations & Automation — a glass torus knot turning steadily,
 * ringed by micro-cubes on a circular orbit, counter-rotating.
 * The machine that never sleeps.
 */
export default function OperationsDiorama({ visible, q }: DioramaProps) {
  const root = useRef<THREE.Group>(null);
  const knot = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Group>(null);
  const cubes = useRef<(THREE.Mesh | null)[]>([]);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);

  /* all satellite cubes share one material — one opacity write per frame */
  const cubeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#b4c6ff',
        roughness: 0.32,
        metalness: 0.05,
        transparent: true,
        opacity: 0,
      }),
    []
  );

  useEffect(() => () => cubeMat.dispose(), [cubeMat]);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const w = visible.current;
    const t = state.clock.elapsedTime;

    g.visible = w > 0.01;
    g.position.y = (1 - w) * -1.5;
    g.scale.setScalar(0.82 + w * 0.18);

    cubeMat.opacity = 0.95 * w;
    if (coreMat.current) {
      coreMat.current.opacity = w;
      coreMat.current.emissiveIntensity =
        (q.animate ? 1.7 + Math.sin(t * 2.2) * 0.7 : 1.7) * w;
    }

    if (q.animate) {
      /* knot and ring counter-rotate — perpetual motion */
      if (knot.current) {
        knot.current.rotation.y += delta * 0.32 * w;
        knot.current.rotation.x = Math.sin(t * 0.22) * 0.35;
      }
      if (ring.current) ring.current.rotation.y -= delta * 0.5 * w;
      for (let i = 0; i < CUBES; i++) {
        const c = cubes.current[i];
        if (c) {
          c.rotation.x += delta * (0.6 + i * 0.07) * w;
          c.rotation.y += delta * 0.4 * w;
        }
      }
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh ref={knot}>
        <torusKnotGeometry args={[0.58, 0.17, 180, 24]} />
        <GradientGlassMaterial />
      </mesh>
      <group ref={ring} rotation={[0.5, 0, 0.22]}>
        {Array.from({ length: CUBES }, (_, i) => {
          const a = (i / CUBES) * Math.PI * 2;
          return (
            <RoundedBox
              key={i}
              ref={(m) => {
                cubes.current[i] = m;
              }}
              args={[0.15, 0.15, 0.15]}
              radius={0.035}
              smoothness={3}
              position={[Math.cos(a) * 1.55, 0, Math.sin(a) * 1.55]}
              material={i === 0 ? undefined : cubeMat}
            >
              {i === 0 && (
                <meshStandardMaterial
                  ref={coreMat}
                  color="#93a9ff"
                  emissive="#2e4bff"
                  emissiveIntensity={1.7}
                  roughness={0.25}
                  transparent
                  opacity={0}
                />
              )}
            </RoundedBox>
          );
        })}
      </group>
    </group>
  );
}
