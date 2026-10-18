'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import GlassCluster from '../shared/GlassCluster';
import { GlassMaterial } from '../../lib/materials';
import { getSectionProgress, smooth } from '../../scroll-store';
import { heroWeight, seededRandom } from './dioramas/util';
import type { Quality } from '../../lib/quality';

/**
 * HeroArc — the establishing shot for /capabilities.
 * Six glass miniatures standing in a wide, distant arc around a central
 * monolith — the six practices seen from far above. As cap-hero scrolls
 * away the whole arrangement recedes and the first diorama takes over.
 */
export default function HeroArc({ q }: { q: Quality }) {
  const root = useRef<THREE.Group>(null);
  const cluster = useRef<THREE.Group>(null);
  const minis = useRef<(THREE.Mesh | null)[]>([]);
  const start = useRef<number | null>(null);

  const specs = useMemo(() => {
    const rand = seededRandom(7);
    const spread = q.compact ? 5.2 : 8.4;
    return Array.from({ length: 6 }, (_, i) => {
      const t = i / 5 - 0.5;
      return {
        position: [
          t * spread,
          -1.15 + (rand() - 0.5) * 0.5,
          -2.6 - (1 - Math.cos(t * 1.15)) * 1.1,
        ] as [number, number, number],
        scale: [
          0.32 + rand() * 0.28,
          0.5 + rand() * 0.55,
          0.32 + rand() * 0.2,
        ] as [number, number, number],
        rot: rand() * Math.PI,
      };
    });
  }, [q.compact]);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    if (start.current === null) start.current = t;

    const w = heroWeight(getSectionProgress('cap-hero'));
    /* the scene assembles out of light on mount */
    const assemble = smooth(Math.min((t - start.current) / 2.2, 1));
    const e = q.animate ? assemble * w : w;

    g.visible = w > 0.01;
    g.position.y = (1 - e) * -2.2;
    g.scale.setScalar(0.85 + e * 0.15);
    g.rotation.y = q.animate ? Math.sin(t * 0.1) * 0.06 : 0;

    if (q.animate) {
      for (let i = 0; i < minis.current.length; i++) {
        const m = minis.current[i];
        if (m) m.rotation.y += delta * (0.12 + i * 0.02);
      }
      if (cluster.current) cluster.current.rotation.y -= delta * 0.05;
    }
  });

  return (
    <group ref={root} visible={false}>
      <group ref={cluster} position={[0, -0.05, -0.9]} scale={0.8}>
        <GlassCluster
          idleSpeed={q.animate ? 0.05 : 0}
          coreIndex={4}
          parallax={q.animate ? 0.25 : 0}
        />
      </group>
      {specs.map((s, i) => (
        <RoundedBox
          key={i}
          ref={(m) => {
            minis.current[i] = m;
          }}
          args={[1, 1, 1]}
          radius={0.05}
          smoothness={5}
          position={s.position}
          scale={s.scale}
          rotation={[0, s.rot, 0]}
        >
          <GlassMaterial kind={(['azure', 'ice', 'core', 'azure', 'crystal', 'ice'] as const)[i]} />
        </RoundedBox>
      ))}
    </group>
  );
}
