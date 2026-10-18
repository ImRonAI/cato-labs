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
  useScrollStore,
} from '../../../scroll-store';

/**
 * GrowthDistributionScene — "The ribbon of light".
 *
 * An ascending CatmullRom ribbon (echoing the page's revenue curve) drawn as
 * a glowing azure tube, with small glass milestone shards at its inflection
 * points. The ambient dust rises as the 'chart' section travels through the
 * viewport. Camera: slow observational drift + pointer parallax. The final
 * shard reports the 'growth-ribbon' hotspot. Reduced motion renders the
 * composition static.
 *
 * Section ids: hero · feature · chart · levers · social · detail · faq · cta
 */

/* module-scope temps — reused every frame, never allocated per-frame */
const _proj = new THREE.Vector3();
const _look = new THREE.Vector3();

/** inflections along the ribbon where milestone shards sit (arc-length t) */
const MILESTONE_T = [0.2, 0.44, 0.67, 1];

export default function GrowthDistributionScene() {
  const q = useQuality();
  const startAt = useRef<number | null>(null);
  const lookCur = useRef(new THREE.Vector3(0.4, -0.1, 0));
  const dustRef = useRef<THREE.Group>(null);
  const shardRefs = useRef<(THREE.Group | null)[]>([]);
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const hotspot = useRef({ x: 0, y: 0, i: 0, has: false });

  /* ---- the ascending curve + glowing tube ---- */
  const { coreGeo, haloGeo, shardBases } = useMemo(() => {
    const pts = [
      new THREE.Vector3(-8.6, -2.6, -1.2),
      new THREE.Vector3(-5.6, -2.0, -0.4),
      new THREE.Vector3(-2.8, -2.5, 0.6),
      new THREE.Vector3(-0.4, -0.9, 0.1),
      new THREE.Vector3(2.2, -1.3, -0.7),
      new THREE.Vector3(4.6, 0.5, -0.2),
      new THREE.Vector3(6.6, 1.5, 0.5),
      new THREE.Vector3(8.4, 2.4, 0.9),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    const coreGeo = new THREE.TubeGeometry(curve, 240, 0.035, 12, false);
    const haloGeo = new THREE.TubeGeometry(curve, 240, 0.11, 12, false);
    const shardBases = MILESTONE_T.map((t) => curve.getPointAt(t));
    return { coreGeo, haloGeo, shardBases };
  }, []);

  /* free imperative GPU resources on unmount / route-hop */
  useEffect(() => {
    return () => {
      coreGeo.dispose();
      haloGeo.dispose();
      useScrollStore.getState().setHotspot('growth-ribbon', null);
    };
  }, [coreGeo, haloGeo]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = t;
    const intro = q.animate
      ? smooth(Math.min((t - startAt.current) / 1.6, 1))
      : 1;

    const chart = smooth(sectionRange(getSectionProgress('chart'), 0.08, 0.85));
    const social = smooth(sectionRange(getSectionProgress('social'), 0.1, 0.85));

    /* ribbon glow — brightens as the chart section owns the viewport */
    const coreMat = coreMatRef.current;
    const haloMat = haloMatRef.current;
    if (coreMat) coreMat.opacity = (0.82 + chart * 0.18) * intro;
    if (haloMat)
      haloMat.opacity =
        (0.16 + chart * 0.12 + (q.animate ? Math.sin(t * 0.9) * 0.03 : 0)) * intro;

    /* dust rises with the chart's progress */
    if (dustRef.current) dustRef.current.position.y = chart * 1.4;

    /* milestone shards — staggered assembly, gentle bob */
    for (let i = 0; i < shardBases.length; i++) {
      const g = shardRefs.current[i];
      if (!g) continue;
      const sIn = q.animate
        ? smooth(Math.min(Math.max((t - startAt.current - 0.5 - i * 0.22) / 0.9, 0), 1))
        : 1;
      const s = (i === shardBases.length - 1 ? 0.46 : 0.32) * sIn;
      g.scale.setScalar(Math.max(s, 0.0001));
      if (q.animate) {
        g.position.y = shardBases[i].y + Math.sin(t * 0.7 + i * 1.7) * 0.06;
        g.rotation.y += delta * 0.18 * (i % 2 === 0 ? 1 : -1);
        g.rotation.x = Math.sin(t * 0.4 + i) * 0.12;
      }
    }

    const cam = state.camera;
    if (!q.animate) {
      /* reduced motion — static composition */
      cam.position.set(0, 0.3, 9);
      cam.lookAt(0.4, -0.1, 0);
    } else {
      /* slow observational drift + pointer parallax */
      const cx =
        pointer.x * 0.3 + chart * 0.9 - social * 0.4 + Math.sin(t * 0.05) * 0.25;
      const cy =
        0.3 + pointer.y * 0.2 + chart * 0.7 - social * 0.2 + Math.cos(t * 0.04) * 0.15;
      const cz = 9 - chart * 0.6 + social * 0.9 + (1 - intro) * 1.8;

      cam.position.x += (cx - cam.position.x) * 0.05;
      cam.position.y += (cy - cam.position.y) * 0.05;
      cam.position.z += (cz - cam.position.z) * 0.05;

      _look.set(0.4 + chart * 0.8, -0.1 + chart * 0.6, 0);
      lookCur.current.lerp(_look, 0.05);
      cam.lookAt(lookCur.current);
    }

    /* report the 'growth-ribbon' hotspot from the final shard (throttled) */
    const last = shardRefs.current[shardBases.length - 1];
    if (last) {
      last.getWorldPosition(_proj).project(cam);
      if (_proj.z < 1) {
        const hx = _proj.x * 0.5 + 0.5;
        const hy = _proj.y * 0.5 + 0.5;
        const hi = (0.5 + chart * 0.5) * intro;
        const h = hotspot.current;
        if (
          !h.has ||
          Math.abs(hx - h.x) + Math.abs(hy - h.y) > 0.003 ||
          Math.abs(hi - h.i) > 0.04
        ) {
          hotspot.current = { x: hx, y: hy, i: hi, has: true };
          useScrollStore
            .getState()
            .setHotspot('growth-ribbon', { x: hx, y: hy, intensity: hi });
        }
      }
    }
  });

  return (
    <group>
      <SceneLightRig />

      {/* the ascending ribbon of light — azure core + soft halo */}
      <mesh geometry={coreGeo} renderOrder={1}>
        <meshBasicMaterial ref={coreMatRef} color="#5f7dff" transparent opacity={0} />
      </mesh>
      <mesh geometry={haloGeo} renderOrder={0}>
        <meshBasicMaterial
          ref={haloMatRef}
          color="#93a9ff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* glass milestone shards at the inflection points */}
      {shardBases.map((base, i) => (
        <group
          key={i}
          position={base}
          ref={(el) => {
            shardRefs.current[i] = el;
          }}
        >
          <RoundedBox args={[1, 1, 1]} radius={0.08} smoothness={4}>
            <GlassMaterial kind={i === shardBases.length - 1 ? 'core' : i % 2 === 0 ? 'azure' : 'ice'} />
          </RoundedBox>
        </group>
      ))}

      {/* ambient dust — rises as the chart section advances */}
      <group ref={dustRef}>
        <ParticleField
          count={Math.floor(2000 * q.particles)}
          drift={q.animate ? 0.12 : 0}
          parallax={q.animate ? 1 : 0}
          opacity={0.42}
        />
      </group>
    </group>
  );
}
