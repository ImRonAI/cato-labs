'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, type GlassKind } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';

/**
 * RealEstateScene — "The Skyline Ascending".
 *
 * A city block of seven glass towers rising from a frosted base plane, each
 * at its own height. Towers hold a low stub silhouette at hero, then rise
 * floor by floor with a left-to-right stagger as `feature` scrolls (value
 * being built). The tallest tower is deep blue and carries a tiny beacon
 * light at its roof — reported to ProximityType as hotspot
 * 'realestate-beacon'. Thin azure lines connect the rooftops like a
 * comparables graph; as `detail` arrives the graph and the beacon brighten.
 *
 * Camera: slow ±6° orbit + pointer parallax. Zero allocations in useFrame;
 * reduced motion renders the finished skyline as a still.
 */

interface TowerSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  /** full height at completion */
  h: number;
  kind: GlassKind;
  deep?: boolean;
}

const BASE_TOP = -1.64;
/** silhouette fraction shown before the feature section drives the rise */
const STUB = 0.12;

/* left-to-right — the stagger wave and the rooftop graph share this order */
const TOWERS: readonly TowerSpec[] = [
  { x: -2.3, z: -0.5, w: 0.62, d: 0.7, h: 1.2, kind: 'ice' },
  { x: -1.5, z: 0.35, w: 0.7, d: 0.62, h: 1.9, kind: 'azure' },
  { x: -0.7, z: -0.35, w: 0.58, d: 0.66, h: 1.45, kind: 'ice' },
  { x: 0.15, z: 0.25, w: 0.66, d: 0.7, h: 2.15, kind: 'azure' },
  { x: 0.95, z: -0.3, w: 0.74, d: 0.74, h: 2.85, kind: 'deep', deep: true },
  { x: 1.85, z: 0.3, w: 0.6, d: 0.62, h: 1.6, kind: 'ice' },
  { x: 2.55, z: -0.4, w: 0.5, d: 0.58, h: 1.05, kind: 'azure' },
];

const DEEP_INDEX = 4;

/* module-scope temps — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

export default function RealEstateScene() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const baseRef = useRef<THREE.Mesh>(null);
  const towerRefs = useRef<(THREE.Mesh | null)[]>([]);
  const nodeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const beaconRef = useRef<THREE.Mesh>(null);
  const report = useHotspotReporter('realestate-beacon');

  const towers = useMemo(() => TOWERS, []);

  /* the rooftop comparables graph — one polyline through every roof,
     preallocated once and rewritten in place each frame */
  const roofLine = useMemo(() => {
    const positions = new Float32Array(TOWERS.length * 3);
    const attr = new THREE.BufferAttribute(positions, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', attr);
    const material = new THREE.LineBasicMaterial({
      color: '#7d97ff',
      transparent: true,
      opacity: 0.16,
    });
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    return { line, attr, positions };
  }, []);
  useEffect(() => {
    const { line } = roofLine;
    return () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    };
  }, [roofLine]);

  /* shared geometry/material for the rooftop graph nodes */
  const nodeGeo = useMemo(() => new THREE.SphereGeometry(0.032, 12, 10), []);
  const nodeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#8fa6ff',
        toneMapped: false,
        transparent: true,
        opacity: 0.35,
      }),
    [],
  );
  useEffect(
    () => () => {
      nodeGeo.dispose();
      nodeMat.dispose();
    },
    [nodeGeo, nodeMat],
  );

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const feature = anim ? getSectionProgress('feature') : 1;
    const detail = anim ? getSectionProgress('detail') : 1;
    const intro = anim ? smooth(Math.min(el / 1.6, 1)) : 1;

    /* the block assembles out of light — one soft lift */
    const g = group.current;
    if (g) g.position.y = -0.85 * (1 - intro);

    const base = baseRef.current;
    if (base) {
      const pop = anim ? smooth(Math.min(Math.max(el / 0.7, 0), 1)) : 1;
      base.scale.set(Math.max(pop, 0.001), 1, Math.max(pop, 0.001));
    }

    /* the market graph wakes as detail arrives */
    const wake = smooth(sectionRange(detail, 0.12, 0.7));
    (roofLine.line.material as THREE.LineBasicMaterial).opacity =
      0.16 + 0.5 * wake;
    nodeMat.opacity = 0.35 + 0.55 * wake;

    /* towers rise floor by floor, staggered left to right */
    for (let i = 0; i < towers.length; i++) {
      const s = towers[i];
      const t = smooth(sectionRange(feature, 0.04 + i * 0.07, 0.46 + i * 0.07));
      const pop = anim
        ? smooth(Math.min(Math.max((el - 0.25 - i * 0.09) / 0.85, 0), 1))
        : 1;
      const frac = (STUB + (1 - STUB) * t) * pop;
      const top = BASE_TOP + s.h * frac;

      const m = towerRefs.current[i];
      if (m) {
        m.scale.set(pop, Math.max(s.h * frac, 0.001), pop);
        m.position.y = BASE_TOP + (s.h * frac) / 2;
      }

      roofLine.positions[i * 3] = s.x;
      roofLine.positions[i * 3 + 1] = top + 0.03;
      roofLine.positions[i * 3 + 2] = s.z;

      const node = nodeRefs.current[i];
      if (node) {
        node.position.set(s.x, top + 0.03, s.z);
        node.scale.setScalar(Math.max(pop, 0.001));
      }

      /* the beacon rides the tallest roof, pulsing brighter as it wakes */
      if (s.deep) {
        const beacon = beaconRef.current;
        if (beacon) {
          const pulse = anim
            ? 1 + Math.sin(el * 2.2) * (0.12 + 0.22 * wake)
            : 1;
          beacon.position.set(s.x, top + 0.075, s.z);
          beacon.scale.setScalar(Math.max(pop, 0.001) * pulse);
          report(beacon, state.camera, 0.55 + 0.45 * wake);
        }
      }
    }
    roofLine.attr.needsUpdate = true;

    /* camera — slow ±6° orbit + pointer parallax, eased */
    const orbit = anim ? (Math.sin(el * 0.05) * 6 * Math.PI) / 180 : 0.2;
    const radius = 9.9 - intro * 0.7;
    _camTarget.set(
      Math.sin(orbit) * radius + (anim ? pointer.x * 0.42 : 0),
      4.5 + (anim ? pointer.y * 0.26 : 0),
      Math.cos(orbit) * radius,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    _lookTarget.set(0, -0.3, 0);
    state.camera.lookAt(_lookTarget);
  });

  return (
    <group ref={group}>
      <SceneLightRig />

      {/* the city block — one frosted base plane */}
      <RoundedBox
        ref={baseRef}
        args={[6.0, 0.12, 3.4]}
        radius={0.04}
        smoothness={4}
        position={[0, -1.7, 0]}
      >
        <GlassMaterial kind="pane" />
      </RoundedBox>

      {/* the skyline — unit-height columns scaled upward from the base */}
      {towers.map((s, i) => (
        <RoundedBox
          key={i}
          ref={(m) => {
            towerRefs.current[i] = m;
          }}
          args={[s.w, 1, s.d]}
          radius={0.035}
          smoothness={4}
          position={[s.x, BASE_TOP + (s.h * STUB) / 2, s.z]}
          scale={[1, s.h * STUB, 1]}
        >
          <GlassMaterial kind={s.kind} />
        </RoundedBox>
      ))}

      {/* the comparables graph — azure polyline + node dots on every roof */}
      <primitive object={roofLine.line} />
      {towers.map((s, i) => (
        <mesh
          key={`n${i}`}
          ref={(m) => {
            nodeRefs.current[i] = m;
          }}
          geometry={nodeGeo}
          material={nodeMat}
          position={[s.x, BASE_TOP + s.h * STUB + 0.03, s.z]}
        />
      ))}

      {/* the beacon — one small, certain light on the tallest tower */}
      <mesh
        ref={beaconRef}
        position={[
          TOWERS[DEEP_INDEX].x,
          BASE_TOP + TOWERS[DEEP_INDEX].h * STUB + 0.075,
          TOWERS[DEEP_INDEX].z,
        ]}
      >
        <sphereGeometry args={[0.055, 16, 12]} />
        <meshBasicMaterial color="#eaf1ff" toneMapped={false} />
      </mesh>

      <ParticleField
        count={Math.floor(1300 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.3}
        position={[0, 0.4, 0]}
      />
    </group>
  );
}
