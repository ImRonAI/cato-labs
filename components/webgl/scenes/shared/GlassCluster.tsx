'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { GlassMaterial, type GlassKind } from '../../lib/materials';import { pointer } from '../../scroll-store';

export interface ShardSpec {
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * Deterministic monolith layout — a tower of offset glass blocks with
 * one deep-blue core. Feels architectural, echoes the Cato cube motif.
 */
export function monolithLayout(seed = 1): ShardSpec[] {
  // simple deterministic PRNG so every render matches SSR/client
  let s = seed * 9973;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const specs: ShardSpec[] = [];
  const cols = 3;
  for (let i = 0; i < 9; i++) {
    const col = (i % cols) - 1;
    const row = Math.floor(i / cols) - 1;
    const h = 0.9 + rand() * 1.6;
    specs.push({
      position: [
        col * (0.9 + rand() * 0.35) + (rand() - 0.5) * 0.3,
        row * 1.7 + (rand() - 0.5) * 0.5,
        (rand() - 0.5) * 1.2,
      ],
      scale: [0.7 + rand() * 0.5, h, 0.7 + rand() * 0.4],
      rotation: [0, (rand() - 0.5) * 0.5, 0],
    });
  }
  return specs;
}

export interface GlassClusterProps {
  specs?: ShardSpec[];
  kind?: GlassKind;
  /** index of the shard rendered in the deep-blue "core" glass (-1 = none) */
  coreIndex?: number;
  /** idle rotation speed (rad/s) */
  idleSpeed?: number;
  /** pointer parallax strength on rotation */
  parallax?: number;
  children?: React.ReactNode;
}

/**
 * GlassCluster — a formation of refractive glass shards sharing one
 * material preset, idling in space with buttery pointer parallax.
 * Scenes animate this group's transform via their own useFrame + refs.
 */
export default function GlassCluster({
  specs,
  kind = 'azure',
  coreIndex = 4,
  idleSpeed = 0.06,
  parallax = 0.3,
  children,
}: GlassClusterProps) {
  const group = useRef<THREE.Group>(null);
  const layout = useMemo(() => specs ?? monolithLayout(7), [specs]);

  /* per-shard kind rotation — the cluster reads as VARYING SHADES OF BLUE */
  const shardKinds = useMemo(() => {
    const cycle: GlassKind[] = ['ice', 'azure', 'crystal', 'pane', 'azure', 'ice'];
    return layout.map((_, i) => cycle[i % cycle.length]);
  }, [layout]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += delta * idleSpeed;
    const targetX = pointer.y * parallax * 0.35;
    const targetZ = pointer.x * parallax * 0.18;
    g.rotation.x += (targetX - g.rotation.x) * 0.045;
    g.rotation.z += (targetZ - g.rotation.z) * 0.045;
  });

  return (
    <group ref={group}>
      {layout.map((s, i) => (
        <RoundedBox
          key={i}
          args={[1, 1, 1]}
          radius={0.045}
          smoothness={6}
          position={s.position}
          scale={s.scale}
          rotation={s.rotation ?? [0, 0, 0]}
        >
          <GlassMaterial kind={i === coreIndex ? 'deep' : shardKinds[i]} />
        </RoundedBox>
      ))}
      {children}
    </group>
  );
}
