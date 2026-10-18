'use client';

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GradientGlassMaterial } from '@/components/webgl/lib/materials';
import { smooth } from '@/components/webgl/scroll-store';
import type { DioramaProps } from './types';

/* the spectral fan — blue refracting out through azure to ice */
const FAN = [
  { color: '#2e4bff', angle: -0.05, z: 0.06, opacity: 0.5 },
  { color: '#7d96ff', angle: 0.22, z: 0.02, opacity: 0.42 },
  { color: '#bcccff', angle: 0.49, z: -0.02, opacity: 0.38 },
  { color: '#e4ebff', angle: 0.76, z: -0.06, opacity: 0.34 },
];

/**
 * 04 Brand & Creative Systems — a glass prism splitting light into a
 * spectral fan: one input, a system of expressions. The fan opens as the
 * diorama takes the stage.
 */
export default function BrandDiorama({ visible, q }: DioramaProps) {
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const fans = useRef<(THREE.Group | null)[]>([]);
  const fanMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const w = visible.current;
    const t = state.clock.elapsedTime;
    const e = smooth(w);

    g.visible = w > 0.01;
    g.position.y =
      (1 - w) * -1.5 + (q.animate ? Math.sin(t * 0.5) * 0.06 * w : 0);
    g.scale.setScalar(0.82 + w * 0.18);

    if (spin.current && q.animate) spin.current.rotation.y += delta * 0.3 * w;

    /* the fan opens with the weight */
    for (let i = 0; i < FAN.length; i++) {
      const pivot = fans.current[i];
      if (pivot) pivot.rotation.z = FAN[i].angle * e;
      const mat = fanMats.current[i];
      if (mat) mat.opacity = FAN[i].opacity * w;
    }
  });

  return (
    <group ref={root} visible={false}>
      <group ref={spin}>
        {/* the prism — three-sided glass */}
        <mesh position={[-0.35, 0, 0]} rotation={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.52, 0.52, 1.6, 3]} />
          <GradientGlassMaterial />
        </mesh>

        {/* refracted spectrum, fanning from the prism's far edge */}
        {FAN.map((f, i) => (
          <group
            key={i}
            ref={(pivot) => {
              fans.current[i] = pivot;
            }}
            position={[0.1, 0, f.z]}
          >
            <mesh position={[0.87, 0, 0]}>
              <planeGeometry args={[1.7, 0.4]} />
              <meshBasicMaterial
                ref={(m) => {
                  fanMats.current[i] = m;
                }}
                color={f.color}
                transparent
                opacity={0}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
