'use client';

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import ParticleField from '../shared/ParticleField';
import { useQuality } from '../../lib/quality';
import { getSectionProgress, sectionRange, smooth } from '../../scroll-store';

/**
 * StreamField — a wide, sparse band of dust that begins streaming
 * horizontally through the approach-teaser, suggesting motion toward
 * a corridor. The slide is bounded and slowly re-centers after the
 * section passes, so the field never leaves the stage.
 */
export default function StreamField() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const slide = useRef(0); // damped approach driver
  const drift = useRef(0); // integrated stream offset (bounded)

  useFrame((state, delta) => {
    if (!q.animate) return;
    const g = group.current;
    if (!g) return;

    const a =
      smooth(sectionRange(getSectionProgress('approach-teaser'), 0.08, 0.75)) *
      (1 - smooth(sectionRange(getSectionProgress('cta'), 0.1, 0.6)));
    slide.current += (a - slide.current) * 0.06;

    drift.current = Math.min(drift.current + delta * slide.current * 1.15, 16);
    if (slide.current < 0.01) drift.current *= 0.985;

    g.position.x = -(slide.current * 8 + drift.current);
  });

  return (
    <group ref={group}>
      <ParticleField
        count={Math.floor(850 * q.particles)}
        spread={[26, 4.5, 6]}
        size={0.045}
        opacity={0.3}
        drift={q.animate ? 0.05 : 0}
        parallax={q.animate ? 0.45 : 0}
        position={[0, -0.7, -2]}
      />
    </group>
  );
}
