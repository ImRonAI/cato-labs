'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { DioramaProps } from './types';
import { seededRandom } from './util';

const NODE_COUNT = 10;

/* module-level temps — zero allocations inside useFrame */
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _one = new THREE.Vector3(1, 1, 1);

/**
 * 01 Strategy — a constellation map.
 * Glowing nodes at varied heights, connected by thin luminous threads,
 * turning slowly like an orrery. One node burns with a blue core:
 * the decision everything else orbits.
 */
export default function StrategyDiorama({ visible, q }: DioramaProps) {
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const nodes = useRef<THREE.InstancedMesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const lineMat = useRef<THREE.LineBasicMaterial>(null);
  const nodeMat = useRef<THREE.MeshStandardMaterial>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringMatA = useRef<THREE.MeshBasicMaterial>(null);
  const ringMatB = useRef<THREE.MeshBasicMaterial>(null);

  const { points, edgeGeometry } = useMemo(() => {
    const rand = seededRandom(11);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const a = rand() * Math.PI * 2;
      const r = 0.5 + rand() * 1.2;
      pts.push(
        new THREE.Vector3(Math.cos(a) * r, (rand() - 0.5) * 2.4, Math.sin(a) * r)
      );
    }
    pts[0].set(0.12, 0.3, 0.08); // the highlighted node — near the heart

    /* threads: each node to its two nearest neighbors */
    const pairs: Array<[number, number]> = [];
    const seen = new Set<string>();
    for (let i = 0; i < NODE_COUNT; i++) {
      const order = pts
        .map((p, j) => ({ j, d: pts[i].distanceToSquared(p) }))
        .filter((e) => e.j !== i)
        .sort((a, b) => a.d - b.d);
      for (let k = 0; k < 2; k++) {
        const j = order[k].j;
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push([i, j]);
        }
      }
    }
    const pos = new Float32Array(pairs.length * 6);
    pairs.forEach(([a, b], e) => {
      pts[a].toArray(pos, e * 6);
      pts[b].toArray(pos, e * 6 + 3);
    });
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { points: pts, edgeGeometry };
  }, []);

  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry]);

  /* static instance matrices — nodes 1..N (node 0 is the separate blue core) */
  useEffect(() => {
    const inst = nodes.current;
    if (!inst) return;
    for (let i = 1; i < NODE_COUNT; i++) {
      _m.compose(_p.copy(points[i]), _q, _one);
      inst.setMatrixAt(i - 1, _m);
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [points]);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const w = visible.current;
    const t = state.clock.elapsedTime;

    g.visible = w > 0.01;
    g.position.y = (1 - w) * -1.5;
    g.scale.setScalar(0.8 + w * 0.2);

    if (spin.current && q.animate) spin.current.rotation.y += delta * 0.14 * w;

    if (lineMat.current) lineMat.current.opacity = 0.5 * w;
    if (nodeMat.current) nodeMat.current.opacity = 0.95 * w;
    if (coreMat.current) coreMat.current.opacity = w;
    if (ringMatA.current) ringMatA.current.opacity = 0.2 * w;
    if (ringMatB.current) ringMatB.current.opacity = 0.13 * w;

    /* the core breathes */
    if (core.current) {
      const pulse = q.animate ? 1 + Math.sin(t * 1.6) * 0.18 : 1;
      core.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={root} visible={false}>
      <group ref={spin}>
        <instancedMesh
          ref={nodes}
          args={[undefined, undefined, NODE_COUNT - 1]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.06, 20, 20]} />
          <meshStandardMaterial
            ref={nodeMat}
            color="#a9bcff"
            emissive="#2e4bff"
            emissiveIntensity={0.25}
            roughness={0.35}
            transparent
          />
        </instancedMesh>
        <mesh ref={core} position={points[0]}>
          <sphereGeometry args={[0.085, 24, 24]} />
          <meshBasicMaterial
            ref={coreMat}
            color={[0.45, 0.6, 2.6]}
            transparent
            toneMapped={false}
          />
        </mesh>
        <lineSegments geometry={edgeGeometry}>
          <lineBasicMaterial ref={lineMat} color="#2e4bff" transparent opacity={0} />
        </lineSegments>
        <mesh rotation={[1.15, 0, 0.3]}>
          <torusGeometry args={[1.8, 0.004, 8, 160]} />
          <meshBasicMaterial ref={ringMatA} color="#2e4bff" transparent opacity={0} />
        </mesh>
        <mesh rotation={[1.45, 0.4, -0.2]}>
          <torusGeometry args={[1.45, 0.003, 8, 140]} />
          <meshBasicMaterial ref={ringMatB} color="#7a92ff" transparent opacity={0} />
        </mesh>
      </group>
    </group>
  );
}
