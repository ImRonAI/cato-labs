'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { DioramaProps } from './types';
import { seededRandom } from './util';

const LAYERS = [-1.35, 0, 1.35];
const PER_LAYER = 4;
const NODE_TOTAL = LAYERS.length * PER_LAYER;
const PULSE_COUNT = 8;

/* module-level temps — zero allocations inside useFrame */
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

/**
 * 02 AI & Agent Systems — a neural lattice.
 * Three layers of nodes wired with hairline edges; bright pulses of
 * electric blue travel the edges — context moving through the system.
 */
export default function AgentsDiorama({ visible, q }: DioramaProps) {
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const nodes = useRef<THREE.InstancedMesh>(null);
  const pulses = useRef<THREE.InstancedMesh>(null);
  const lineMat = useRef<THREE.LineBasicMaterial>(null);
  const nodeMat = useRef<THREE.MeshStandardMaterial>(null);
  const pulseMat = useRef<THREE.MeshBasicMaterial>(null);

  const { pts, edges, edgeGeometry } = useMemo(() => {
    const rand = seededRandom(23);
    const pts: THREE.Vector3[] = [];
    LAYERS.forEach((x) => {
      for (let i = 0; i < PER_LAYER; i++) {
        const y = (i - (PER_LAYER - 1) / 2) * 0.72 + (rand() - 0.5) * 0.28;
        pts.push(
          new THREE.Vector3(x + (rand() - 0.5) * 0.2, y, (rand() - 0.5) * 0.55)
        );
      }
    });

    /* each node wires to its two nearest neighbors in the next layer */
    const edges: Array<[number, number]> = [];
    for (let li = 0; li < LAYERS.length - 1; li++) {
      for (let i = 0; i < PER_LAYER; i++) {
        const a = li * PER_LAYER + i;
        const order: Array<{ b: number; d: number }> = [];
        for (let j = 0; j < PER_LAYER; j++) {
          const b = (li + 1) * PER_LAYER + j;
          order.push({ b, d: pts[a].distanceToSquared(pts[b]) });
        }
        order.sort((x, y) => x.d - y.d);
        edges.push([a, order[0].b], [a, order[1].b]);
      }
    }

    const pos = new Float32Array(edges.length * 6);
    edges.forEach(([a, b], e) => {
      pts[a].toArray(pos, e * 6);
      pts[b].toArray(pos, e * 6 + 3);
    });
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { pts, edges, edgeGeometry };
  }, []);

  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry]);

  /* pulse assignments — deterministic so SSR and client agree */
  const pulseCfg = useMemo(() => {
    const rand = seededRandom(41);
    return Array.from({ length: PULSE_COUNT }, () => ({
      edge: Math.floor(rand() * edges.length),
      speed: 0.26 + rand() * 0.34,
      phase: rand(),
    }));
  }, [edges]);

  /* static node instances */
  useEffect(() => {
    const inst = nodes.current;
    if (!inst) return;
    pts.forEach((p, i) => {
      _m.compose(_p.copy(p), _q, _s.set(1, 1, 1));
      inst.setMatrixAt(i, _m);
    });
    inst.instanceMatrix.needsUpdate = true;
  }, [pts]);

  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    const w = visible.current;
    const t = state.clock.elapsedTime;

    g.visible = w > 0.01;
    g.position.y = (1 - w) * -1.5;
    g.scale.setScalar(0.8 + w * 0.2);

    /* the lattice sways gently rather than spinning — a thinking machine */
    if (spin.current) {
      const target = q.animate ? Math.sin(t * 0.16) * 0.45 : 0;
      spin.current.rotation.y += (target - spin.current.rotation.y) * 0.04;
    }

    if (lineMat.current) lineMat.current.opacity = 0.38 * w;
    if (nodeMat.current) nodeMat.current.opacity = 0.95 * w;
    if (pulseMat.current) pulseMat.current.opacity = w;

    /* pulses travel along edges, swelling mid-journey */
    const inst = pulses.current;
    if (inst) {
      for (let i = 0; i < PULSE_COUNT; i++) {
        const cfg = pulseCfg[i];
        const [a, b] = edges[cfg.edge];
        const f = q.animate ? (t * cfg.speed + cfg.phase) % 1 : cfg.phase % 1;
        _p.lerpVectors(pts[a], pts[b], f);
        const s = Math.max(Math.sin(f * Math.PI) * w, 0.0001);
        _m.compose(_p, _q, _s.set(s, s, s));
        inst.setMatrixAt(i, _m);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={root} visible={false}>
      <group ref={spin}>
        <instancedMesh
          ref={nodes}
          args={[undefined, undefined, NODE_TOTAL]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.075, 20, 20]} />
          <meshStandardMaterial
            ref={nodeMat}
            color="#9db2ff"
            emissive="#2e4bff"
            emissiveIntensity={0.35}
            roughness={0.3}
            transparent
          />
        </instancedMesh>
        <lineSegments geometry={edgeGeometry}>
          <lineBasicMaterial ref={lineMat} color="#4d63ff" transparent opacity={0} />
        </lineSegments>
        <instancedMesh
          ref={pulses}
          args={[undefined, undefined, PULSE_COUNT]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.045, 14, 14]} />
          <meshBasicMaterial
            ref={pulseMat}
            color={[0.5, 0.65, 2.6]}
            transparent
            toneMapped={false}
          />
        </instancedMesh>
      </group>
    </group>
  );
}
