'use client';

import React, { useEffect, useMemo, useRef } from 'react';
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
 * ArchitectureInteriorDesignScene — "The Composition".
 *
 * An abstract interior vignette floating in luminous space: a glass floor
 * plane, one wall, a plinth, and a single deep-azure sculptural form on
 * the plinth — gallery-grade quiet. As `feature` progresses the camera
 * orbits the composition very slowly while a pale window-light patch
 * (mullion gaps and all) sweeps across the floor like sun through a
 * window. The sculpture is reported to ProximityType as hotspot
 * 'ind-aid-sculpture'.
 *
 * Zero allocations in useFrame; reduced motion renders the final orbit
 * position with the light at rest as a still.
 */

const patchVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const patchFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    /* soft rounded falloff */
    vec2 c = abs(vUv - 0.5) * 2.0;
    float d = max(c.x, c.y);
    float a = smoothstep(1.0, 0.35, d);
    /* mullion gaps — the window frame riding inside the light */
    float g1 = smoothstep(0.012, 0.03, abs(vUv.x - 0.365));
    float g2 = smoothstep(0.012, 0.03, abs(vUv.x - 0.635));
    float g3 = smoothstep(0.012, 0.03, abs(vUv.y - 0.5));
    a *= 0.35 + 0.65 * g1 * g2 * g3;
    float alpha = a * uOpacity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/* module-scope temp — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();

export default function ArchitectureInteriorDesignScene() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const floorRef = useRef<THREE.Mesh>(null);
  const wallRef = useRef<THREE.Mesh>(null);
  const plinthRef = useRef<THREE.Mesh>(null);
  const sculptRef = useRef<THREE.Mesh>(null);
  const patchRef = useRef<THREE.Mesh>(null);
  const report = useHotspotReporter('ind-aid-sculpture');

  /* the window-light patch — soft shader plane, built once */
  const patch = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(2.5, 1.6);
    const material = new THREE.ShaderMaterial({
      vertexShader: patchVertex,
      fragmentShader: patchFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color('#93a9ff') },
        uOpacity: { value: 0 },
      },
    });
    return { geometry, material };
  }, []);
  useEffect(
    () => () => {
      patch.geometry.dispose();
      patch.material.dispose();
    },
    [patch],
  );

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const feature = anim ? getSectionProgress('feature') : 1;
    const detail = anim ? getSectionProgress('detail') : 1;
    const intro = anim ? smooth(Math.min(el / 1.8, 1)) : 1;

    const g = group.current;
    if (g) g.position.y = -0.55 - 0.9 * (1 - intro);

    /* staggered assembly — floor, wall, plinth, sculpture */
    const pop0 = anim ? smooth(Math.min(Math.max((el - 0.05) / 0.7, 0), 1)) : 1;
    const pop1 = anim ? smooth(Math.min(Math.max((el - 0.2) / 0.7, 0), 1)) : 1;
    const pop2 = anim ? smooth(Math.min(Math.max((el - 0.35) / 0.7, 0), 1)) : 1;
    const pop3 = anim ? smooth(Math.min(Math.max((el - 0.5) / 0.8, 0), 1)) : 1;
    if (floorRef.current) floorRef.current.scale.setScalar(Math.max(pop0, 0.001));
    if (wallRef.current) wallRef.current.scale.setScalar(Math.max(pop1, 0.001));
    if (plinthRef.current)
      plinthRef.current.scale.setScalar(Math.max(pop2, 0.001));

    const s = sculptRef.current;
    if (s) {
      s.scale.setScalar(Math.max(pop3, 0.001));
      if (anim) s.rotation.y = el * 0.18;
      report(s, state.camera, 0.6 + 0.35 * smooth(sectionRange(detail, 0.1, 0.7)));
    }

    /* the sun patch sweeps across the composition through feature */
    const sweep = smooth(sectionRange(feature, 0.08, 0.92));
    const p = patchRef.current;
    if (p) {
      p.position.set(-1.6 + 3.0 * sweep, 0.008, -0.5 + 0.6 * sweep);
      patch.material.uniforms.uOpacity.value = 0.42 * intro;
    }

    /* camera — a very slow orbit driven by feature, idle breathing on top */
    const orbit = smooth(sectionRange(feature, 0, 1));
    const az = anim
      ? -0.34 + 0.72 * orbit + Math.sin(el * 0.04) * 0.025 + pointer.x * 0.04
      : 0.38;
    const radius = 9.3 - intro * 0.7;
    _camTarget.set(
      0.3 + Math.sin(az) * radius,
      2.35 + (anim ? pointer.y * 0.2 : 0),
      -0.2 + Math.cos(az) * radius,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    state.camera.lookAt(0.25, 0.45, -0.3);
  });

  return (
    <group ref={group} position={[0.3, -0.55, -0.2]}>
      <SceneLightRig />

      {/* floor — one thin pane of structural glass */}
      <RoundedBox
        ref={floorRef}
        args={[4.3, 0.07, 3.1]}
        radius={0.03}
        smoothness={3}
        position={[0, -0.035, 0]}
      >
        <GlassMaterial kind="pane" />
      </RoundedBox>

      {/* the single wall */}
      <RoundedBox
        ref={wallRef}
        args={[4.3, 2.4, 0.07]}
        radius={0.03}
        smoothness={3}
        position={[0, 1.2, -1.515]}
      >
        <GlassMaterial kind="ice" />
      </RoundedBox>

      {/* the plinth */}
      <RoundedBox
        ref={plinthRef}
        args={[0.8, 0.52, 0.8]}
        radius={0.04}
        smoothness={3}
        position={[-0.75, 0.26, -0.35]}
      >
        <GlassMaterial kind="pane" />
      </RoundedBox>

      {/* the sculptural form — the singular deep-azure accent */}
      <mesh ref={sculptRef} position={[-0.75, 0.9, -0.35]}>
        <torusKnotGeometry args={[0.3, 0.105, 160, 24, 2, 3]} />
        <GlassMaterial kind="deep" />
      </mesh>

      {/* the window-light patch, sweeping like sun through a window */}
      <mesh
        ref={patchRef}
        geometry={patch.geometry}
        material={patch.material}
        rotation={[-Math.PI / 2, 0, 0.42]}
        position={[-1.6, 0.008, -0.5]}
        renderOrder={2}
      />

      <ParticleField
        count={Math.floor(1300 * q.particles)}
        drift={q.animate ? 0.08 : 0}
        opacity={0.28}
      />
    </group>
  );
}
