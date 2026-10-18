'use client';

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';

/**
 * EcommerceRetailScene — "The Glass Vitrine".
 *
 * A tall glass shopping-bag form: an open-top box of four RoundedBox
 * panels (frosted pane front/back, azure sides) crowned by a thin
 * half-torus handle. Inside floats a small deep-blue product cube,
 * slowly tumbling. As the `market-truth` section scrolls, the cube
 * rises out of the bag and holds above it — the product elevated above
 * the commodity — reported to ProximityType as hotspot 'retail-vitrine'.
 *
 * Camera: slow ±5° drift + pointer parallax. Zero allocations in
 * useFrame; reduced motion renders the risen composition as a still.
 */

/* bag dimensions */
const BAG_W = 1.7;
const BAG_H = 2.3;
const BAG_D = 1.2;
const PANEL_T = 0.07;
const HANDLE_R = 0.55;
const HANDLE_TOP = BAG_H / 2;

/* the product cube */
const CUBE_REST_Y = -0.35;
const CUBE_RISEN_Y = 2.05;

/* module-scope temp — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();

export default function EcommerceRetailScene() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  /* 0 front · 1 back · 2 left · 3 right · 4 handle */
  const partRefs = useRef<(THREE.Mesh | null)[]>([]);
  const cubeRef = useRef<THREE.Mesh>(null);
  const report = useHotspotReporter('retail-vitrine');

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const truth = anim ? getSectionProgress('market-truth') : 1;
    const intro = anim ? smooth(Math.min(el / 1.6, 1)) : 1;

    const g = group.current;
    if (g) g.position.y = -1.15 * (1 - intro);

    /* panels + handle assemble in sequence */
    for (let i = 0; i < 5; i++) {
      const m = partRefs.current[i];
      if (!m) continue;
      const pop = anim
        ? smooth(Math.min(Math.max((el - 0.1 - i * 0.12) / 0.7, 0), 1))
        : 1;
      m.scale.setScalar(Math.max(pop, 0.001));
    }

    /* the product cube: floats inside, rises out on the market truth */
    const c = cubeRef.current;
    if (c) {
      const rise = smooth(sectionRange(truth, 0.12, 0.7));
      const bob = anim ? Math.sin(el * 1.2) * 0.06 * (1 - rise) : 0;
      const y =
        CUBE_REST_Y +
        (CUBE_RISEN_Y - CUBE_REST_Y) * rise +
        Math.sin(rise * Math.PI) * 0.35 +
        bob;
      c.position.y = y;
      if (anim) {
        c.rotation.y = 0.6 + el * 0.55 + rise * Math.PI * 0.5;
        c.rotation.x = 0.35 + Math.sin(el * 0.4) * 0.08 * (1 - rise);
      } else {
        c.rotation.y = 0.6;
        c.rotation.x = 0.35;
      }
      const pop = anim
        ? smooth(Math.min(Math.max((el - 0.7) / 0.8, 0), 1))
        : 1;
      const breathe = anim ? 1 + Math.sin(el * 1.6) * 0.02 * rise : 1;
      c.scale.setScalar(Math.max(pop, 0.001) * breathe);

      const mat = c.material as THREE.MeshPhysicalMaterial;
      mat.emissiveIntensity = 0.08 + 0.3 * rise;

      report(c, state.camera, 0.55 + 0.4 * rise);
    }

    /* camera — slow ±5° drift + pointer parallax, eased */
    const drift = anim ? (Math.sin(el * 0.05) * 5 * Math.PI) / 180 : 0.35;
    const radius = 8.2 - intro * 0.5;
    _camTarget.set(
      Math.sin(drift) * radius + (anim ? pointer.x * 0.45 : 0),
      0.45 + (anim ? pointer.y * 0.3 : 0),
      Math.cos(drift) * radius,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    state.camera.lookAt(0, 0.35, 0);
  });

  const setPart = (i: number) => (m: THREE.Mesh | null) => {
    partRefs.current[i] = m;
  };

  return (
    <group ref={group}>
      <SceneLightRig />

      {/* the vitrine — four panels, open at the top */}
      <RoundedBox
        ref={setPart(0)}
        args={[BAG_W, BAG_H, PANEL_T]}
        radius={0.03}
        smoothness={4}
        position={[0, 0, BAG_D / 2 - PANEL_T / 2]}
      >
        <GlassMaterial kind="pane" />
      </RoundedBox>
      <RoundedBox
        ref={setPart(1)}
        args={[BAG_W, BAG_H, PANEL_T]}
        radius={0.03}
        smoothness={4}
        position={[0, 0, -(BAG_D / 2 - PANEL_T / 2)]}
      >
        <GlassMaterial kind="pane" />
      </RoundedBox>
      <RoundedBox
        ref={setPart(2)}
        args={[PANEL_T, BAG_H, BAG_D - PANEL_T * 2]}
        radius={0.03}
        smoothness={4}
        position={[-(BAG_W / 2 - PANEL_T / 2), 0, 0]}
      >
        <GlassMaterial kind="azure" />
      </RoundedBox>
      <RoundedBox
        ref={setPart(3)}
        args={[PANEL_T, BAG_H, BAG_D - PANEL_T * 2]}
        radius={0.03}
        smoothness={4}
        position={[BAG_W / 2 - PANEL_T / 2, 0, 0]}
      >
        <GlassMaterial kind="azure" />
      </RoundedBox>

      {/* the handle — a thin half-torus arc */}
      <mesh ref={setPart(4)} position={[0, HANDLE_TOP, 0]}>
        <torusGeometry args={[HANDLE_R, 0.035, 16, 48, Math.PI]} />
        <GlassMaterial kind="azure" />
      </mesh>

      {/* the product — a deep-blue cube, elevated above the commodity */}
      <RoundedBox
        ref={cubeRef}
        args={[0.5, 0.5, 0.5]}
        radius={0.1}
        smoothness={4}
        position={[0, CUBE_REST_Y, 0]}
        rotation={[0.35, 0.6, 0]}
      >
        <GlassMaterial kind="deep" emissive="#2e4bff" emissiveIntensity={0.08} />
      </RoundedBox>

      <ParticleField
        count={Math.floor(1200 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.3}
      />
    </group>
  );
}
