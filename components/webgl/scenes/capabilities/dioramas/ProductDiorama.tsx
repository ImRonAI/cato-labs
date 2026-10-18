'use client';

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { GlassMaterial } from '@/components/webgl/lib/materials';
import { smooth } from '@/components/webgl/scroll-store';
import type { DioramaProps } from './types';

const PANE_COUNT = 4;

interface PanePose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
}

/* the layered interface formation — panes stacked with offset depth */
const FORMATION: PanePose[] = [
  { x: -0.32, y: -0.58, z: 0.32, rx: 0.1, ry: -0.46 },
  { x: 0.04, y: -0.12, z: 0.06, rx: 0.12, ry: -0.43 },
  { x: 0.36, y: 0.34, z: -0.24, rx: 0.14, ry: -0.4 },
  { x: 0.68, y: 0.8, z: -0.54, rx: 0.16, ry: -0.37 },
];

/* where the panes arrive from while the weight is still 0 */
const SCATTER: PanePose[] = [
  { x: -1.7, y: -1.7, z: -1.1, rx: 0.5, ry: -1.0 },
  { x: 1.5, y: -1.9, z: -0.7, rx: -0.4, ry: 0.6 },
  { x: -1.2, y: 1.6, z: -1.4, rx: 0.35, ry: -0.7 },
  { x: 1.9, y: 1.8, z: -0.9, rx: -0.3, ry: 0.9 },
];

/**
 * 03 Digital Products — four glass panes sliding out of scatter into a
 * layered interface formation. One pane carries the blue core.
 */
export default function ProductDiorama({ visible, q }: DioramaProps) {
  const root = useRef<THREE.Group>(null);
  const panes = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    const w = visible.current;
    const t = state.clock.elapsedTime;
    const e = smooth(w);

    g.visible = w > 0.01;
    g.position.y = (1 - w) * -1.2;
    g.rotation.y = q.animate ? Math.sin(t * 0.14) * 0.12 : 0;

    for (let i = 0; i < PANE_COUNT; i++) {
      const m = panes.current[i];
      if (!m) continue;
      const a = SCATTER[i];
      const b = FORMATION[i];
      m.position.set(
        a.x + (b.x - a.x) * e,
        a.y +
          (b.y - a.y) * e +
          (q.animate ? Math.sin(t * 0.7 + i * 1.4) * 0.035 * w : 0),
        a.z + (b.z - a.z) * e
      );
      m.rotation.set(a.rx + (b.rx - a.rx) * e, a.ry + (b.ry - a.ry) * e, 0);
    }
  });

  return (
    <group ref={root} visible={false}>
      {FORMATION.map((_, i) => (
        <RoundedBox
          key={i}
          ref={(m) => {
            panes.current[i] = m;
          }}
          args={[2.05, 1.3, 0.05]}
          radius={0.07}
          smoothness={4}
        >
          <GlassMaterial kind={i === 1 ? 'core' : 'pane'} />
        </RoundedBox>
      ))}
    </group>
  );
}
