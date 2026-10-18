'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { GlassMaterial } from '../../lib/materials';
import { useQuality } from '../../lib/quality';
import { getSectionProgress, sectionRange, smooth } from '../../scroll-store';

/* deterministic PRNG so the layout is stable across renders */
function prng(seed: number) {
  let s = seed * 9973;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const COUNT = 6;

interface Star {
  home: [number, number, number];
  scale: [number, number, number];
  rotY: number;
  core: boolean;
  phase: number;
}

/* six shards in a horizontal row — one for each practice */
function buildStars(): Star[] {
  const rand = prng(23);
  return Array.from({ length: COUNT }, (_, i) => ({
    home: [
      (i - (COUNT - 1) / 2) * 1.6,
      i % 2 === 0 ? 0.1 : -0.12,
      (rand() - 0.5) * 0.5,
    ],
    scale: [0.4 + rand() * 0.14, 0.58 + rand() * 0.3, 0.4 + rand() * 0.1],
    rotY: rand() * Math.PI,
    core: i === 2,
    phase: rand() * Math.PI * 2,
  }));
}

/**
 * Constellation — as the practices index scrolls in, six small glass
 * shards rise into a horizontal row across the lower third, joined by
 * a hairline of electric blue, drifting on sine offsets. It dissolves
 * downward as the approach-teaser takes over.
 *
 * The connector is a native THREE.Line whose vertices are rewritten
 * in place each frame — zero allocation, on-brand 1px hairline.
 */
export default function Constellation() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const starRefs = useRef<Array<THREE.Mesh | null>>([]);
  const din = useRef(0); // damped practices driver
  const dout = useRef(0); // damped approach-teaser driver
  const stars = useMemo(buildStars, []);

  const { line, positions } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#2e4bff'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.renderOrder = -1;
    return { line, positions };
  }, []);

  /* primitives are not auto-disposed by R3F — clean up on unmount */
  useEffect(() => {
    return () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    };
  }, [line]);

  useFrame((state) => {
    if (!q.animate) return;
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    din.current += (smooth(sectionRange(getSectionProgress('practices'), 0.16, 0.6)) - din.current) * 0.06;
    dout.current += (smooth(sectionRange(getSectionProgress('approach-teaser'), 0.03, 0.45)) - dout.current) * 0.06;
    const inF = din.current;
    const outF = dout.current;
    const vis = inF * (1 - outF);

    g.visible = vis > 0.003;
    if (!g.visible) return;
    g.position.y += (-2.35 - outF * 2.2 - g.position.y) * 0.06;

    for (let i = 0; i < stars.length; i++) {
      const mesh = starRefs.current[i];
      if (!mesh) continue;
      const s = stars[i];
      const a = smooth(clamp01((inF - i * 0.07) / 0.6)) * (1 - outF);
      mesh.position.set(
        s.home[0] + Math.sin(t * 0.45 + s.phase) * 0.09,
        s.home[1] + (1 - a) * -1.4 + Math.sin(t * 0.62 + s.phase * 1.7) * 0.11,
        s.home[2]
      );
      const sc = Math.max(a, 0.0001);
      mesh.scale.set(s.scale[0] * sc, s.scale[1] * sc, s.scale[2] * sc);
      mesh.rotation.y = s.rotY + t * 0.14 * (i % 2 === 0 ? 1 : -1);

      positions[i * 3] = mesh.position.x;
      positions[i * 3 + 1] = mesh.position.y;
      positions[i * 3 + 2] = mesh.position.z;
    }
    (line.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (line.material as THREE.LineBasicMaterial).opacity = vis * 0.22;
  });

  return (
    <group ref={group} position={[0, -2.35, -1.2]} visible={false}>
      {stars.map((s, i) => (
        <RoundedBox
          key={i}
          args={[1, 1, 1]}
          radius={0.06}
          smoothness={5}
          position={s.home}
          scale={s.scale}
          rotation={[0, s.rotY, 0]}
          ref={(el) => {
            starRefs.current[i] = el;
          }}
        >
          <GlassMaterial kind={s.core ? 'core' : (['azure', 'pane', 'ice'] as const)[i % 3]} />
        </RoundedBox>
      ))}
      <primitive object={line} />
    </group>
  );
}
