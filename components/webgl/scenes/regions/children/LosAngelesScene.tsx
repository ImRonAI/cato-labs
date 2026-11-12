'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial } from '../../../lib/materials';
import { hashString, mulberry32 } from '../../../kit/lib/samplePath';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { useQuality } from '../../../lib/quality';
import CatoBody, { type CatoBodyHandle } from '../../../kit/cato/CatoBody';
import Clapperboard from '../lib-b/Clapperboard';
import { fadeTree } from '../lib-b/fade';
import { damp } from '../lib-b/moment';
import { driveCamera, makeStage, refreshMoment } from '../lib-b/stage';
import { contactShadowTexture } from '../lib-a/place';
import { buildLosAngelesArchitecture } from './los-angeles/geometries';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';

/**
 * LosAngelesScene — "The Basin of Light & Director's Soundstage".
 *
 * A crafted porcelain, frosted-crystal, and electric-blue architectural miniature
 * spanning the Los Angeles Basin:
 *   1. Hollywood Hills stepped topographic ridge + Griffith Observatory (three
 *      sapphire glass domes, Beaux-Arts wings, Astronomers Monument obelisk)
 *   2. Downtown Los Angeles (DTLA) skyline: U.S. Bank Tower, Wilshire Grand Center
 *      (curved diagonal sail crown + spire), LA City Hall stepped pyramid beacon,
 *      777 Tower, Aon Center, Gas Company Tower, and Disney Hall curved sails
 *   3. Sixth Street Viaduct ("Ribbon of Light") canted parabolic arches on the east
 *      and Santa Monica Pier extending over a Pacific Ocean cove on the west
 *   4. Sparse neighborhood BasinLights grid breathing across the avenues + twin
 *      counter-sweeping Premiere Searchlight beams rising from studio pedestals
 *   5. Foreground Director's Soundstage Terrace with a 3D 35mm Cinema Camera on
 *      dolly track, Fresnel key light, and Cato the robot directing the shot
 *   6. Signature `moment` dwell (`Clapperboard`): camera glides to the refractive
 *      glass clapperboard slate (which snaps shut with a shock ring) and 35mm
 *      projector rig throwing skyline frames onto a screen while the Basin glows
 *      softly behind it, then hands the camera back for the `angles` wide reveal.
 *
 * Hotspot `'la-skyline'` rides the Wilshire Grand spire anchor.
 */

const basinVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uIntro;
  uniform float uMotion;
  attribute float aScale;
  attribute float aSeed;
  varying float vSeed;
  varying float vFade;
  varying float vGlow;

  void main() {
    vSeed = aSeed;
    vec3 p = position;
    float stag = smoothstep(aSeed * 0.55, aSeed * 0.55 + 0.45, uIntro);
    p.y -= (1.0 - stag) * (0.18 + aSeed * 0.25);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float breath = 0.68 + 0.32 * sin(uTime * (0.4 + aSeed * 0.55) * uMotion + aSeed * 43.0);
    vGlow = breath * stag;
    gl_PointSize = uSize * aScale * (0.7 + 0.3 * breath) * uPixelRatio * (14.0 / -mv.z);
    vFade = smoothstep(26.0, 8.0, -mv.z);
  }
`;

const basinFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vSeed;
  varying float vFade;
  varying float vGlow;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.42, 0.06, d);
    float halo = smoothstep(0.5, 0.3, d) * 0.25;
    float a = (core + halo) * uOpacity * vFade * vGlow;
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uColorA, uColorB, vSeed), a);
  }
`;

/* module-scope temps — reused every frame, zero allocations */
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const STAGE = makeStage([0.75, 0.35, 9.5], [0.75, 0.15, 0.4]);

/**
 * BasinLights — seeded neighborhood street-light grid across the miniature basin plinth.
 */
function BasinLights({ count }: { count: number }) {
  const q = useQuality();

  const sim = useMemo(() => {
    const rand = mulberry32(hashString('la-basin-grid-v2'));
    const cells: number[] = [];
    const NX = 52;
    const NZ = 26;
    for (let gz = 0; gz < NZ; gz++) {
      for (let gx = 0; gx < NX; gx++) {
        if (rand() < 0.44) continue;
        const x = -1.18 + (gx / (NX - 1)) * 3.35 + (rand() - 0.5) * 0.04;
        const z = -0.82 + (gz / (NZ - 1)) * 2.18 + (rand() - 0.5) * 0.05;
        cells.push(x, z);
      }
    }
    const total = cells.length / 2;
    const order = new Uint32Array(total);
    for (let i = 0; i < total; i++) order[i] = i;
    for (let i = total - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    const n = Math.max(48, Math.min(total, count));
    const positions = new Float32Array(n * 3);
    const scales = new Float32Array(n);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const c = order[i];
      positions[i * 3] = cells[c * 2];
      positions[i * 3 + 1] = 0.014 + rand() * 0.012;
      positions[i * 3 + 2] = cells[c * 2 + 1];
      scales[i] = 0.55 + rand() * 1.15;
      seeds[i] = rand();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: basinVertex,
      fragmentShader: basinFragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 2.8 },
        uPixelRatio: { value: 1 },
        uIntro: { value: 0 },
        uMotion: { value: 1 },
        uColorA: { value: new THREE.Color('#2e4bff') },
        uColorB: { value: new THREE.Color('#b9ccff') },
        uOpacity: { value: 0.72 },
      },
    });
    return { geometry, material };
  }, [count]);

  useEffect(() => {
    return () => {
      sim.geometry.dispose();
      sim.material.dispose();
    };
  }, [sim]);

  const start = useRef(-1);
  useFrame((state) => {
    const m = sim.material;
    const el = state.clock.elapsedTime;
    if (start.current < 0) start.current = el;
    m.uniforms.uTime.value = q.animate ? el : 3.7;
    m.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    m.uniforms.uMotion.value = q.animate ? 1 : 0;
    m.uniforms.uIntro.value = q.animate
      ? smooth(Math.min(Math.max((el - start.current - 0.25) / 1.35, 0), 1))
      : 1;
  });

  return <points geometry={sim.geometry} material={sim.material} frustumCulled={false} />;
}

export default function LosAngelesScene() {
  const q = useQuality();
  const basinRig = useRef<THREE.Group>(null);
  const fadeGroup = useRef<THREE.Group>(null);
  const beaconWest = useRef<THREE.Group>(null);
  const beaconEast = useRef<THREE.Group>(null);
  const beamMatWest = useRef<THREE.MeshBasicMaterial>(null);
  const beamMatEast = useRef<THREE.MeshBasicMaterial>(null);
  const catoGroup = useRef<THREE.Group>(null);
  const catoBodyRef = useRef<CatoBodyHandle>(null);
  const anchor = useRef<THREE.Group>(null);
  const report = useHotspotReporter('la-skyline');

  const live = useRef({
    rx: 1.55,
    ry: -0.62,
    rz: 0.15,
    rs: 0.92,
    rotY: -0.24,
    rotX: 0.16,
    svgHidden: false,
  });

  const arch = useMemo(() => buildLosAngelesArchitecture(), []);
  const basinCount = Math.round(920 * q.particles);

  const mats = useMemo(() => {
    const shadowTex = typeof document !== 'undefined' ? contactShadowTexture() : null;
    return {
      porcelain: new THREE.MeshPhysicalMaterial({
        color: '#eef3ff',
        roughness: 0.22,
        metalness: 0.04,
        clearcoat: 0.68,
        clearcoatRoughness: 0.16,
        transparent: true,
        opacity: 1,
      }),
      enamel: new THREE.MeshPhysicalMaterial({
        color: '#1e38db',
        emissive: '#0c1ba6',
        emissiveIntensity: 0.24,
        roughness: 0.18,
        metalness: 0.26,
        clearcoat: 0.88,
        transparent: true,
        opacity: 1,
      }),
      lines: new THREE.LineBasicMaterial({
        color: '#4f6eff',
        transparent: true,
        opacity: 0.44,
      }),
      shadow: new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    };
  }, []);

  useEffect(() => {
    return () => {
      arch.porcelainGeo.dispose();
      arch.crystalGlassGeo.dispose();
      arch.coreGlassGeo.dispose();
      arch.paneGlassGeo.dispose();
      arch.enamelGeo.dispose();
      arch.liquidGeo.dispose();
      arch.lineGeo.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [arch, mats]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const compact = q.compact;

    const core = catoBodyRef.current?.core;
    if (core && !live.current.svgHidden) {
      core.svg.style.display = 'none';
      live.current.svgHidden = true;
    }

    const pStats = smooth(sectionRange(getSectionProgress('stats'), 0.08, 0.78));
    const pAngles = smooth(sectionRange(getSectionProgress('angles'), 0.08, 0.88));
    const pFeature = getSectionProgress('feature');
    const pBuild = smooth(sectionRange(getSectionProgress('build'), 0.06, 0.85));
    const pDetail = smooth(sectionRange(getSectionProgress('detail'), 0.06, 0.85));
    const pFaq = smooth(sectionRange(getSectionProgress('faq'), 0.06, 0.85));
    const pCta = smooth(sectionRange(getSectionProgress('cta'), 0.06, 0.82));

    /* Feature 02 is right-aligned in la-feature:nth-child(even) -> sway scene left */
    const featureMidSway =
      smooth(sectionRange(pFeature, 0.34, 0.48)) *
      (1 - smooth(sectionRange(pFeature, 0.64, 0.78)));

    const intro = anim ? smooth(Math.min(el / 1.65, 1)) : 1;
    const m = refreshMoment();
    const w = m.w;
    const L = live.current;

    /* ------------------------------------------------------------------
       1. MULTI-BEAT BASIN DIORAMA PLACEMENT
       ------------------------------------------------------------------ */
    let wantX = compact ? 0.04 : 1.56 - 0.16 * pStats - 0.55 * pAngles - 3.1 * featureMidSway + 0.18 * pCta;
    let wantY = compact ? -1.12 : -0.66 + 0.14 * pStats - 0.12 * pAngles + 0.12 * pBuild + 0.15 * pCta;
    let wantZ = compact ? -0.65 : 0.12 - 0.55 * pAngles + 0.25 * pDetail - 1.25 * w;
    let wantS = compact ? 0.48 : 0.94 - 0.06 * pAngles + 0.04 * pDetail - 0.08 * pCta;
    let wantRotY =
      (compact ? -0.2 : -0.26) +
      0.16 * pAngles +
      0.52 * featureMidSway -
      0.12 * pDetail +
      (anim ? Math.sin(el * 0.05) * 0.05 + pointer.x * 0.08 : 0);
    let wantRotX = 0.16 + 0.08 * pAngles - (anim ? pointer.y * 0.04 : 0);

    if (!anim) {
      wantX = compact ? 0.04 : 1.48;
      wantY = compact ? -1.08 : -0.64;
      wantZ = compact ? -0.6 : 0.08;
      wantS = compact ? 0.48 : 0.92;
      wantRotY = -0.22;
      wantRotX = 0.18;
    }

    L.rx = anim ? damp(L.rx, wantX, 5.2, dt) : wantX;
    L.ry = anim ? damp(L.ry, wantY - (1 - intro) * 0.48, 5.2, dt) : wantY;
    L.rz = anim ? damp(L.rz, wantZ, 5.2, dt) : wantZ;
    L.rs = anim ? damp(L.rs, wantS * (0.9 + 0.1 * intro), 5.2, dt) : wantS;
    L.rotY = anim ? damp(L.rotY, wantRotY, 4.5, dt) : wantRotY;
    L.rotX = anim ? damp(L.rotX, wantRotX, 4.5, dt) : wantRotX;

    if (basinRig.current) {
      basinRig.current.position.set(L.rx, L.ry, L.rz);
      basinRig.current.scale.setScalar(L.rs);
      basinRig.current.rotation.set(L.rotX, L.rotY, 0);
    }

    /* ------------------------------------------------------------------
       2. TWIN PREMIERE SEARCHLIGHTS SWEEPING THE BASIN
       ------------------------------------------------------------------ */
    if (beaconWest.current) {
      beaconWest.current.rotation.y = anim ? el * 0.42 : 0.85;
      if (beamMatWest.current) {
        beamMatWest.current.opacity = anim ? 0.16 + 0.05 * Math.sin(el * 0.9) : 0.16;
      }
    }
    if (beaconEast.current) {
      beaconEast.current.rotation.y = anim ? -el * 0.36 + 1.4 : -0.7;
      if (beamMatEast.current) {
        beamMatEast.current.opacity = anim ? 0.14 + 0.05 * Math.cos(el * 0.8) : 0.15;
      }
    }

    /* ------------------------------------------------------------------
       3. CATO THE DIRECTOR ON THE SOUNDSTAGE TERRACE
       ------------------------------------------------------------------ */
    if (catoGroup.current && core) {
      const catoVis = Math.max(0.001, (1 - w * 0.95) * intro);
      catoGroup.current.scale.setScalar(0.42 * catoVis);
      if (!anim) {
        core.scrub('wave', 1.1);
      } else if (pAngles > 0.35 && pBuild < 0.25) {
        core.scrub('scan', 0.6 + ((el * 0.65) % 2.1));
      } else if (pBuild > 0.3 || pDetail > 0.3) {
        core.scrub('cheer', 0.5 + ((el * 0.9) % 2.0));
      } else if (pFaq > 0.25) {
        core.scrub('bow', 0.8);
      } else {
        core.scrub('wave', 0.55 + ((el * 0.78) % 1.55));
      }
    }

    /* ------------------------------------------------------------------
       4. HOTSPOT REPORTER ('la-skyline' at Wilshire Grand spire)
       ------------------------------------------------------------------ */
    if (anchor.current) {
      report(
        anchor.current,
        state.camera,
        anim ? 0.58 + 0.22 * Math.max(w, pDetail) : 0.62,
      );
    }

    /* ------------------------------------------------------------------
       5. CAMERA — WIDE BASIN PULL-BACK ON ANGLES + MOMENT CLAPPERBOARD HANDOFF
       ------------------------------------------------------------------ */
    const radius = 9.2 + pAngles * 1.35 + (1 - intro) * 1.1;
    const camY = 1.65 + pAngles * 0.75 - 0.15 * pCta;
    const orbit = anim ? Math.sin(el * 0.042) * 0.08 : 0.04;
    _camTarget.set(
      Math.sin(orbit) * radius + (anim ? pointer.x * 0.32 : 0),
      camY + (anim ? pointer.y * 0.2 : 0),
      Math.cos(orbit) * radius,
    );
    _lookTarget.set(0.28, -0.22 - pAngles * 0.18, -0.15);

    driveCamera(
      state.camera,
      _camTarget,
      _lookTarget,
      STAGE,
      w,
      compact ? 1.88 : 1,
      anim ? pointer.x : 0,
      anim ? pointer.y : 0,
    );
    fadeTree(fadeGroup.current, 1 - w * 0.84);
  });

  return (
    <group>
      <SceneLightRig />

      {/* 1. The Los Angeles Basin Architectural Miniature */}
      <group ref={basinRig} position={[1.55, -0.62, 0.15]} scale={0.92}>
        <group ref={fadeGroup}>
          {/* Soft radial contact shadow beneath the vitrine plinth */}
          <mesh position={[-0.05, -0.22, -0.1]} rotation={[-Math.PI / 2, 0, 0]} material={mats.shadow}>
            <planeGeometry args={[5.8, 4.3]} />
          </mesh>

          {/*Hollywood Hills, Griffith Observatory, DTLA Skyline, 6th St Viaduct, Santa Monica Pier & Soundstage */}
          <mesh geometry={arch.porcelainGeo} material={mats.porcelain} />
          <mesh geometry={arch.enamelGeo} material={mats.enamel} />
          <mesh geometry={arch.crystalGlassGeo}>
            <GlassMaterial kind="crystal" transparent />
          </mesh>
          <mesh geometry={arch.coreGlassGeo}>
            <GlassMaterial kind="core" emissive="#2e4bff" emissiveIntensity={0.22} transparent />
          </mesh>
          <mesh geometry={arch.paneGlassGeo}>
            <GlassMaterial kind="pane" transparent />
          </mesh>
          <mesh geometry={arch.liquidGeo}>
            <GlassMaterial kind="liquid" transparent />
          </mesh>
          <lineSegments geometry={arch.lineGeo} material={mats.lines} />

          {/* Breathing neighborhood city-lights grid across the LA Basin */}
          <BasinLights count={basinCount} />

          {/* Premiere Searchlight 1 (West / Sunset pedestal at [-0.28, 0.105, 0.36]) */}
          <group ref={beaconWest} position={[-0.28, 0.105, 0.36]}>
            <group rotation={[0, 0, 0.46]}>
              <mesh position={[0, 1.35, 0]}>
                <cylinderGeometry args={[0.24, 0.03, 2.7, 20, 1, true]} />
                <meshBasicMaterial
                  ref={beamMatWest}
                  color="#9eb5ff"
                  transparent
                  opacity={0.16}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          </group>

          {/* Premiere Searchlight 2 (East / DTLA pedestal at [1.22, 0.105, 0.34]) */}
          <group ref={beaconEast} position={[1.22, 0.105, 0.34]}>
            <group rotation={[0, 0, -0.42]}>
              <mesh position={[0, 1.35, 0]}>
                <cylinderGeometry args={[0.22, 0.03, 2.7, 20, 1, true]} />
                <meshBasicMaterial
                  ref={beamMatEast}
                  color="#5f7dff"
                  transparent
                  opacity={0.15}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          </group>
        </group>

        {/* Cato the Robot on the Foreground Director's Soundstage Terrace */}
        <group ref={catoGroup} position={[0.72, 0.058, 1.04]} rotation={[0, -0.22, 0]} scale={0.42}>
          <CatoBody ref={catoBodyRef} paused={!q.animate} />
        </group>

        {/* Hotspot anchor — Wilshire Grand Spire crown */}
        <group ref={anchor} position={[0.41, 2.52, -0.22]} />
      </group>

      {/* 2. Signature `moment` Dwell — Glass Clapperboard Slate & 35mm Projector */}
      <Clapperboard position={[-0.4, 0, 0.6]} />

      {/* 3. Ambient Blue Atmospheric Dust */}
      <ParticleField
        count={Math.floor(1050 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.28}
        position={[0, 0.5, -2]}
      />
    </group>
  );
}
