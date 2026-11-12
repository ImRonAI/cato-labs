'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { GlassMaterial } from '../../lib/materials';
import { useQuality } from '../../lib/quality';
import { getSectionProgress, sectionRange, smooth, pointer } from '../../scroll-store';
import Monolith from './Monolith';
import Constellation from './Constellation';
import StreamField from './StreamField';
import { WRECK, range } from './timeline';

const FLAGSHIP_COUNT = 10;

/* Module-scope scratch math objects — zero allocations inside useFrame */
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _col = new THREE.Color();
const _colIce = new THREE.Color('#dce4ff');
const _colAzure = new THREE.Color('#8ba2ff');
const _colElectric = new THREE.Color('#2e4bff');
const _colDeep = new THREE.Color('#1226c8');

/**
 * GalleryAperture — refractive glass gallery architecture that rises around
 * the perimeter during the pinned `flagships` showcase (01 / 10 → 10 / 10)
 * and framing halo for the hero/CTA monolith, without competing behind copy
 * or the framed studio viewport.
 */
function GalleryAperture() {
  const q = useQuality();
  const rootRef = useRef<THREE.Group>(null);
  const leftSteleRef = useRef<THREE.Mesh>(null);
  const skyLouverRef = useRef<THREE.Mesh>(null);
  const crownRingRef = useRef<THREE.Mesh>(null);
  const beaconsRef = useRef<THREE.InstancedMesh>(null);
  const datumMatRef = useRef<THREE.LineBasicMaterial>(null);

  const dVis = useRef(0);
  const dScrub = useRef(0);
  const dCrown = useRef(1);

  const { beaconGeo, datumGeo } = useMemo(() => {
    const beaconGeo = new THREE.OctahedronGeometry(0.085, 0);

    // Subtle architectural horizon + 10 vertical index ticks along the lower gallery plinth
    const verts: number[] = [-3.6, -2.18, -1.75, 3.6, -2.18, -1.75];
    for (let i = 0; i < FLAGSHIP_COUNT; i++) {
      const x = -2.9 + (i / (FLAGSHIP_COUNT - 1)) * 5.8;
      verts.push(x, -2.24, -1.75, x, -2.12, -1.75);
    }
    const datumGeo = new THREE.BufferGeometry();
    datumGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));

    return { beaconGeo, datumGeo };
  }, []);

  useEffect(() => {
    return () => {
      beaconGeo.dispose();
      datumGeo.dispose();
    };
  }, [beaconGeo, datumGeo]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const fp = q.animate ? getSectionProgress('flagships') : 0;
    const mp = q.animate ? getSectionProgress('manifesto') : 0;
    const cp = q.animate ? smooth(sectionRange(getSectionProgress('cta'), 0.08, 0.62)) : 0;
    const ap = q.animate ? smooth(sectionRange(getSectionProgress('approach-teaser'), 0.04, 0.45)) : 0;

    // Sticky phase of 420vh track spans roughly [100/520 ≈ 0.19, 420/520 ≈ 0.81]
    const fIn = smooth(sectionRange(fp, 0.05, 0.19));
    const fOut = smooth(sectionRange(fp, 0.82, 0.97));
    const targetVis = fIn * (1 - fOut) * (1 - ap);
    const targetScrub = sectionRange(fp, 0.19, 0.81);

    // Refractive orbital ring frames the hero monolith at rest and returns for the CTA reassembly
    const heroCalm = 1 - smooth(range(mp, 0.04, 0.2));
    const targetCrown = Math.max(heroCalm * (1 - fIn), cp);

    const damp = q.animate ? 0.08 : 1;
    dVis.current += (targetVis - dVis.current) * damp;
    dScrub.current += (targetScrub - dScrub.current) * 0.1;
    dCrown.current += (targetCrown - dCrown.current) * 0.06;

    const vis = dVis.current;
    const scrub = dScrub.current;
    const crown = dCrown.current;

    // 1. Hero / CTA refractive orbital halo behind the glass monolith
    const ring = crownRingRef.current;
    if (ring) {
      ring.visible = crown > 0.01;
      if (ring.visible) {
        const heroX = q.compact ? 0 : 2.35;
        const rx = heroX * (1 - cp);
        const ry = (q.compact ? 0.68 : 0.42) * (1 - cp) + cp * 0.25;
        const rz = -1.65 - cp * 1.1;
        ring.position.set(rx, ry, rz);
        ring.rotation.x = 1.12 + (q.animate ? Math.sin(t * 0.24) * 0.06 : 0);
        ring.rotation.y = -0.28 + (q.animate ? pointer.x * 0.1 : 0) + cp * 0.35;
        ring.rotation.z = q.animate ? t * 0.08 : 0;
        ring.scale.setScalar((q.compact ? 0.72 : 1) * Math.max(0.001, crown));
      }
    }

    // 2. Gallery perimeter prisms & 10-flagship index beacons
    const root = rootRef.current;
    if (!root) return;
    root.visible = vis > 0.004;
    if (!root.visible) return;

    const stele = leftSteleRef.current;
    if (stele) {
      const lift = (1 - vis) * -1.4;
      stele.position.set(
        q.compact ? -1.85 : -3.55,
        0.12 + lift + (q.animate ? Math.sin(t * 0.38) * 0.06 : 0),
        -1.85,
      );
      stele.rotation.y = -0.35 + scrub * Math.PI * 1.35 + (q.animate ? pointer.x * 0.08 : 0);
      stele.rotation.z = 0.04 + (q.animate ? Math.cos(t * 0.3) * 0.02 : 0);
      stele.scale.setScalar(Math.max(0.001, vis * (q.compact ? 0.65 : 1)));
    }

    const louver = skyLouverRef.current;
    if (louver) {
      louver.position.set(
        1.55 - scrub * 0.65,
        2.32 + (1 - vis) * 1.1,
        -2.55,
      );
      louver.rotation.x = 0.42 + scrub * 0.35 + (q.animate ? -pointer.y * 0.05 : 0);
      louver.rotation.y = -0.22 + scrub * 0.28;
      louver.scale.setScalar(Math.max(0.001, vis * (q.compact ? 0.6 : 1)));
    }

    if (datumMatRef.current) {
      datumMatRef.current.opacity = vis * 0.24;
    }

    const mesh = beaconsRef.current;
    if (mesh) {
      const activeFloat = scrub * (FLAGSHIP_COUNT - 1);
      for (let i = 0; i < FLAGSHIP_COUNT; i++) {
        const x = -2.9 + (i / (FLAGSHIP_COUNT - 1)) * 5.8;
        const prox = Math.max(0, 1 - Math.abs(i - activeFloat));
        const y =
          -2.02 +
          prox * 0.22 +
          (1 - vis) * -0.8 +
          (q.animate ? Math.sin(t * 0.8 + i * 0.55) * 0.025 : 0);
        const z = -1.75 + prox * 0.28;

        _pos.set(x, y, z);
        _euler.set(0.3 + prox * 0.5, (q.animate ? t * 0.35 : 0) + i * 0.32, 0);
        _quat.setFromEuler(_euler);
        const s = Math.max(0.001, vis * (0.68 + prox * 0.72));
        _scale.set(s, s * (1 + prox * 0.45), s);
        _mat4.compose(_pos, _quat, _scale);
        mesh.setMatrixAt(i, _mat4);

        if (prox > 0.65) {
          _col.copy(_colElectric).lerp(_colDeep, (prox - 0.65) / 0.35);
        } else {
          _col.copy(_colIce).lerp(_colAzure, prox / 0.65);
        }
        mesh.setColorAt(i, _col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Refractive halo ring behind the Hero & CTA Monolith */}
      <mesh ref={crownRingRef} position={[2.35, 0.42, -1.65]}>
        <torusGeometry args={[1.68, 0.026, 20, 96]} />
        <GlassMaterial kind="prism" />
      </mesh>

      {/* Gallery framing assembly active during the pinned 10-flagship reel */}
      <group ref={rootRef} visible={false}>
        {/* Stage-left dispersive prism stele */}
        <RoundedBox
          ref={leftSteleRef}
          args={[0.34, 2.75, 0.34]}
          radius={0.055}
          smoothness={4}
          position={[-3.55, 0.12, -1.85]}
        >
          <GlassMaterial kind="prism" />
        </RoundedBox>

        {/* Upper-stage museum louver prism */}
        <RoundedBox
          ref={skyLouverRef}
          args={[2.6, 0.16, 0.32]}
          radius={0.04}
          smoothness={4}
          position={[1.55, 2.32, -2.55]}
        >
          <GlassMaterial kind="crystal" />
        </RoundedBox>

        {/* 10 instanced flagship index beacons */}
        <instancedMesh
          ref={beaconsRef}
          args={[beaconGeo, undefined, FLAGSHIP_COUNT]}
          frustumCulled={false}
        >
          <GlassMaterial kind="azure" color="#ffffff" />
        </instancedMesh>

        {/* Precision datum horizon + 10 index ticks */}
        <lineSegments geometry={datumGeo}>
          <lineBasicMaterial
            ref={datumMatRef}
            color="#2e4bff"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </lineSegments>
      </group>
    </>
  );
}

/**
 * HomeScene — "The boundaries were never real."
 *
 * Hero: a calm glass monolith framed by a dispersive prism halo holds stage right.
 * Manifesto (sticky dwell): the camera settles into a wide, low observational
 * frame; a glass wrecking ball swings in on a hairline cable and strikes the
 * tower as "So we removed them." lands.
 * Practices: six shards rise into a constellation.
 * Flagships (sticky showcase): camera glides into a poised gallery stance while
 * perimeter dispersive prisms and ten glass index beacons track 01 / 10 → 10 / 10.
 * Approach: the dust streams across a horizontal corridor.
 * CTA: the debris re-assembles into a calm monolith at centre.
 *
 * Every driver is damped; nothing allocates per frame; no React state.
 * Reduced motion renders the composed hero (the monolith at rest).
 */
export default function HomeScene() {
  const q = useQuality();
  const startAt = useRef<number | null>(null);
  const staticFramed = useRef(false);
  const look = useRef(new THREE.Vector3(0.9, 0, 0));
  const shake = useRef(0);

  useFrame((state, delta) => {
    const cam = state.camera;
    const k = q.compact ? 1 : 0;

    if (!q.animate) {
      if (!staticFramed.current) {
        cam.position.set(0.9, 0.35, 8.95 + k * 3.2);
        look.current.set(1.05, -0.05, 0);
        cam.lookAt(look.current);
        staticFramed.current = true;
      }
      return;
    }
    staticFramed.current = false;

    const t = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = t;
    const intro = smooth(Math.min((t - startAt.current) / 1.6, 1));

    const hp = smooth(sectionRange(getSectionProgress('hero'), 0.05, 0.95));
    const mp = getSectionProgress('manifesto');
    const mIn = smooth(range(mp, 0.06, 0.27));
    const mOut = smooth(range(mp, WRECK.exit[0], 0.98));
    const p = smooth(sectionRange(getSectionProgress('practices'), 0.1, 0.65));

    const fp = getSectionProgress('flagships');
    const fIn = smooth(sectionRange(fp, 0.05, 0.2));
    const fOut = smooth(sectionRange(fp, 0.82, 0.97));
    const fVis = fIn * (1 - fOut);
    const fScrub = sectionRange(fp, 0.19, 0.81);

    const a = smooth(sectionRange(getSectionProgress('approach-teaser'), 0.1, 0.7));
    const c = smooth(sectionRange(getSectionProgress('cta'), 0.05, 0.62));

    /* hero: right-weighted, slight dolly in + subtle living breath */
    let cx = (1 - hp) * 0.92 + Math.sin(t * 0.22) * 0.035 * (1 - mIn);
    let cy = 0.35 - hp * 0.3 + Math.cos(t * 0.18) * 0.025 * (1 - mIn);
    let cz = 8.92 - hp * 0.8 + k * 3.2;

    /* manifesto: a wide, low, observational frame for the strike */
    cx += mIn * (0.25 - cx) * (1 - mOut);
    cy += mIn * (0.55 - cy) * (1 - mOut);
    cz += mIn * (10.8 + k * 3.4 - cz) * (1 - mOut);

    /* slow push-in across the wreck dwell */
    cz -= smooth(range(mp, WRECK.strike - 0.06, WRECK.swingTo)) * 0.9 * (1 - mOut);
    cy += mOut * 0.4;

    /* practices: elevated overview above the 6-shard constellation */
    cz += p * 0.75;
    cy += p * 0.46;

    /* flagships: calm gallery glide framing the showcase without competing */
    cx += (-0.36 + (fScrub - 0.5) * 0.42) * fVis * (1 - c);
    cy += (-0.22 + (0.5 - fScrub) * 0.14) * fVis * (1 - c);
    cz += 0.68 * fVis * (1 - c);

    /* approach-teaser: gentle pullback across the streaming corridor */
    cz += a * 0.32;
    cx += a * 0.16 * (1 - c);

    /* cta: calm and wide around the reassembled monolith */
    cz += c * 1.2;
    cy += c * 0.1;
    cx -= c * cx;

    /* mount condensation from light + pointer parallax */
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

    /* gaze: monolith → stage centre → constellation → gallery glide → cta */
    let lx = (1 - hp) * 1.05;
    let ly = -0.05;
    lx += mIn * (0.55 - lx) * (1 - mOut);
    ly += mIn * (0.15 - ly) * (1 - mOut);
    lx += (-0.2 + (fScrub - 0.5) * 0.3) * fVis * (1 - c);
    lx += a * 0.18 * (1 - c);
    lx *= 1 - c;
    ly += (-p * 0.35 + fVis * 0.12) * (1 - c) + c * 0.05;

    look.current.x += (lx - look.current.x) * 0.05;
    look.current.y += (ly - look.current.y) * 0.05;
    look.current.z += (0 - look.current.z) * 0.05;
    cam.lookAt(look.current);
  });

  return (
    <group>
      <SceneLightRig intensity={1.18} accent={1.12} />
      <Monolith />
      <GalleryAperture />
      <ParticleField
        count={Math.floor(2100 * q.particles)}
        drift={q.animate ? 0.12 : 0}
        parallax={q.animate ? 1 : 0}
        opacity={0.42}
      />
      <Constellation />
      <StreamField />
    </group>
  );
}
