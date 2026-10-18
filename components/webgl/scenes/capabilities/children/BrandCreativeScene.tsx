'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, GradientGlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';

/**
 * BrandCreativeScene — "The Prism".
 *
 * A triangular glass prism stage-right catches the SceneLightRig; from its
 * far face a spectral fan of five thin translucent blades (blue spectrum,
 * staggered opacity) spreads and slowly opens/closes — driven by the
 * `machine` section's scroll progress plus an idle sine. One deep-blue
 * shard orbits the prism lazily. The prism reports the `brand-prism`
 * hotspot so ProximityType glints when the machine section is near.
 *
 * Reduced motion: fan open, everything static. Zero allocations per frame.
 */

/* the spectral fan — electric out to ice, opacity staggered */
const FAN = [
  { color: '#2e4bff', angle: -0.34, z: 0.08, opacity: 0.5 },
  { color: '#6b87ff', angle: -0.12, z: 0.04, opacity: 0.44 },
  { color: '#93a9ff', angle: 0.1, z: 0, opacity: 0.38 },
  { color: '#b9c9ff', angle: 0.32, z: -0.04, opacity: 0.33 },
  { color: '#dce4ff', angle: 0.54, z: -0.08, opacity: 0.27 },
] as const;

/* module-level temps — zero allocations inside useFrame */
const _look = new THREE.Vector3();

export default function BrandCreativeScene() {
  const q = useQuality();
  const start = useRef<number | null>(null);
  const lookCur = useRef(new THREE.Vector3(0.4, 0, 0));
  const fanCur = useRef(0);

  const floatG = useRef<THREE.Group>(null);
  const prismGroup = useRef<THREE.Group>(null);
  const prismMesh = useRef<THREE.Mesh>(null);
  const shard = useRef<THREE.Mesh>(null);
  const fanPivots = useRef<(THREE.Group | null)[]>([]);
  const fanMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  const report = useHotspotReporter('brand-prism');

  /* stage placement — prism stage-right on desktop, lifted back on compact */
  const stage = useMemo(
    () =>
      q.compact
        ? { pos: [0, 1.4, -2.4] as [number, number, number], scale: 0.72 }
        : { pos: [0, 0, 0] as [number, number, number], scale: 1 },
    [q.compact],
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (start.current === null) start.current = t;
    const intro = q.animate ? smooth(Math.min((t - start.current) / 2, 1)) : 1;

    const machineW = smooth(sectionRange(getSectionProgress('machine'), 0.08, 0.5));
    const calm = smooth(sectionRange(getSectionProgress('cta'), 0.05, 0.55));

    /* the fan: half-open at rest, opens with the machine, settles at the cta.
       Reduced motion → fan open, static. */
    const fanTarget = q.animate ? (0.5 + 0.5 * machineW) * (1 - 0.3 * calm) : 1;
    fanCur.current += (fanTarget - fanCur.current) * (q.animate ? 0.07 : 1);
    const fan = fanCur.current * intro;

    for (let i = 0; i < FAN.length; i++) {
      const pivot = fanPivots.current[i];
      if (pivot) {
        const wobble = q.animate ? Math.sin(t * 0.45 + i * 1.3) * 0.05 : 0;
        pivot.rotation.z = FAN[i].angle * (fan + wobble * fan);
      }
      const mat = fanMats.current[i];
      if (mat) mat.opacity = FAN[i].opacity * intro * (0.55 + 0.45 * fan);
    }

    /* the float rig — bob + mount assembly */
    const fg = floatG.current;
    if (fg) {
      fg.position.y = 0.05 + (q.animate ? Math.sin(t * 0.5) * 0.07 : 0);
      fg.scale.setScalar((q.animate ? 0.7 + 0.3 * intro : 1) * stage.scale);
    }

    /* the prism — slow confident rotation, gentle pointer parallax */
    const pg = prismGroup.current;
    if (pg) {
      if (q.animate) {
        pg.rotation.y += delta * 0.14;
        pg.rotation.x += (pointer.y * 0.06 - pg.rotation.x) * 0.05;
        pg.rotation.z += (pointer.x * 0.04 - pg.rotation.z) * 0.05;
      } else {
        pg.rotation.set(0.1, 0.6, 0);
      }
    }

    /* the shard — one deep-blue satellite, orbiting lazily */
    const sh = shard.current;
    if (sh) {
      const a = q.animate ? t * 0.24 : 0.9;
      sh.position.set(
        2.35 + Math.cos(a) * 1.55,
        q.animate ? Math.sin(t * 0.6) * 0.3 : 0.2,
        -0.3 + Math.sin(a) * 0.85,
      );
      if (q.animate) {
        sh.rotation.y += delta * 0.5;
        sh.scale.setScalar(0.5 + 0.5 * intro);
      }
    }

    /* camera — drifts toward the prism as the machine takes the stage */
    const cam = state.camera;
    const px = q.animate ? pointer.x * 0.4 : 0;
    const py = q.animate ? pointer.y * 0.24 : 0;
    const tx = px;
    const ty = 0.05 + py;
    const tz = 9 - machineW * 0.7 + (1 - intro) * 1.6;
    if (q.animate) {
      cam.position.x += (tx - cam.position.x) * 0.05;
      cam.position.y += (ty - cam.position.y) * 0.05;
      cam.position.z += (tz - cam.position.z) * 0.05;
      _look.set(0.4 + machineW * 0.7, 0, 0);
      lookCur.current.lerp(_look, 0.06);
    } else {
      cam.position.set(tx, ty, tz);
      lookCur.current.set(1.1, 0, 0);
    }
    cam.lookAt(lookCur.current);

    /* hotspot for ProximityType */
    if (prismMesh.current) report(prismMesh.current, cam, 0.9 * intro);
  });

  return (
    <group position={stage.pos}>
      <SceneLightRig />

      <group ref={floatG} position={[0, 0.05, 0]}>
        {/* the prism — three-sided crystal catching the rig */}
        <group ref={prismGroup} position={[2.35, 0, -0.3]}>
          <mesh ref={prismMesh}>
            <cylinderGeometry args={[0.95, 0.95, 2.5, 3]} />
            <GradientGlassMaterial />
          </mesh>
        </group>

        {/* the spectral fan — five blades spreading from the prism's far face */}
        <group position={[3.3, 0, -0.3]}>
          {FAN.map((f, i) => (
            <group
              key={i}
              ref={(p) => {
                fanPivots.current[i] = p;
              }}
              position={[0, 0, f.z]}
            >
              <mesh position={[1.2, 0, 0]}>
                <planeGeometry args={[2.4, 0.34]} />
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

        {/* the satellite shard */}
        <mesh ref={shard} position={[3.9, 0.3, -0.3]}>
          <octahedronGeometry args={[0.22, 0]} />
          <GlassMaterial kind="deep" />
        </mesh>
      </group>

      <ParticleField
        count={Math.floor(1600 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.38}
      />
    </group>
  );
}
