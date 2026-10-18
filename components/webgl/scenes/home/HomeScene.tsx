'use client';

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { useQuality } from '../../lib/quality';
import { getSectionProgress, sectionRange, smooth, pointer } from '../../scroll-store';
import Monolith from './Monolith';
import Constellation from './Constellation';
import StreamField from './StreamField';
import { WRECK, range } from './timeline';

/**
 * HomeScene — "The boundaries were never real."
 *
 * Hero: a calm glass monolith stands on a hairline floor, stage right.
 * Manifesto (sticky dwell): the camera settles into a wide, low
 * observational frame; a glass wrecking ball swings in on a hairline
 * cable and strikes the tower as "So we removed them." lands. The topple
 * is baked Rapier physics, scrubbed by scroll. Practices: six shards rise
 * into a constellation. Approach: the dust streams. CTA: the debris
 * re-assembles into a calm monolith at centre.
 *
 * Every driver is damped; nothing allocates per frame; no React state.
 * Reduced motion renders the composed hero (the monolith at rest).
 */
export default function HomeScene() {
  const q = useQuality();
  const startAt = useRef<number | null>(null);
  const look = useRef(new THREE.Vector3(0.9, 0, 0));
  const shake = useRef(0);

  useFrame((state, delta) => {
    if (!q.animate) return;
    const cam = state.camera;
    const t = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = t;
    const intro = smooth(Math.min((t - startAt.current) / 1.6, 1));

    const hp = smooth(sectionRange(getSectionProgress('hero'), 0.05, 0.95));
    const mp = getSectionProgress('manifesto');
    const mIn = smooth(range(mp, 0.06, 0.27));
    const mOut = smooth(range(mp, WRECK.exit[0], 0.98));
    const p = smooth(sectionRange(getSectionProgress('practices'), 0.1, 0.65));
    const a = smooth(sectionRange(getSectionProgress('approach-teaser'), 0.1, 0.7));
    const c = smooth(sectionRange(getSectionProgress('cta'), 0.05, 0.62));
    const k = q.compact ? 1 : 0;

    /* hero: right-weighted, slight dolly in */
    let cx = (1 - hp) * 0.9;
    let cy = 0.35 - hp * 0.3;
    let cz = 9 - hp * 0.8 + k * 3.2;
    /* manifesto: a wide, low, observational frame for the strike */
    cx += mIn * (0.25 - cx) * (1 - mOut);
    cy += mIn * (0.55 - cy) * (1 - mOut);
    cz += mIn * (10.8 + k * 3.4 - cz) * (1 - mOut);
    /* slow push-in across the wreck dwell */
    cz -= smooth(range(mp, WRECK.strike - 0.06, WRECK.swingTo)) * 0.9 * (1 - mOut);
    cy += mOut * 0.4;
    cz += p * 0.8;
    cy += p * 0.5;
    cz += a * 0.3;
    /* cta: calm and wide around the reassembled monolith */
    cz += c * 1.2;
    cy += c * 0.1;
    cx -= c * cx;
    cz += (1 - intro) * 2.2;
    cy += (1 - intro) * 0.5;
    cx += pointer.x * 0.28;
    cy += pointer.y * 0.18;

    /* a single, brief camera tremor on contact — scroll-scrubbed, so it rewinds too */
    const hitDist = (mp - WRECK.strike) / 0.03;
    const tremor = hitDist > 0 && hitDist < 1 ? Math.sin(hitDist * Math.PI) * (1 - hitDist) : 0;
    shake.current += (tremor - shake.current) * Math.min(delta * 30, 1);
    cy += Math.sin(t * 57) * shake.current * 0.035;
    cx += Math.cos(t * 43) * shake.current * 0.025;

    cam.position.x += (cx - cam.position.x) * 0.05;
    cam.position.y += (cy - cam.position.y) * 0.05;
    cam.position.z += (cz - cam.position.z) * 0.05;

    /* gaze: monolith → stage centre → constellation → cta */
    let lx = (1 - hp) * 1.05;
    let ly = -0.05;
    lx += mIn * (0.55 - lx) * (1 - mOut);
    ly += mIn * (0.15 - ly) * (1 - mOut);
    lx *= 1 - c;
    ly += -p * 0.35 * (1 - c) + c * 0.05;
    look.current.x += (lx - look.current.x) * 0.05;
    look.current.y += (ly - look.current.y) * 0.05;
    look.current.z += (0 - look.current.z) * 0.05;
    cam.lookAt(look.current);
  });

  return (
    <group>
      <SceneLightRig intensity={1.1} />
      <Monolith />
      <ParticleField
        count={Math.floor(2000 * q.particles)}
        drift={q.animate ? 0.12 : 0}
        parallax={q.animate ? 1 : 0}
        opacity={0.4}
      />
      <Constellation />
      <StreamField />
    </group>
  );
}
