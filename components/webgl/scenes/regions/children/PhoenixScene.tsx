'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, GradientGlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import { getSectionProgress, pointer, sectionRange, smooth } from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { createStageState, damp, readStage } from '../lib-a/dwell';
import { contactShadowTexture } from '../lib-a/place';
import {
  DESERT_Y,
  GRID_COLS,
  GRID_ROWS,
  METRO_NODE_COUNT,
  buildPhoenixMonolithsAndGrid,
} from './phoenix/geometries';

/**
 * PhoenixScene — "Heat Shimmer to Monsoon Grid"
 *
 * Sculpted faceted Camelback Mountain & multi-armed Sonoran saguaro monoliths
 * in refractive crystal glass overlook the Valley of the Sun basin.
 *
 * During `moment` (0 → 1):
 *   Beat 1 (0.00 → 0.44): Shimmering convective heat-haze refraction waves rise
 *     off the desert bajada before the rising prism sun.
 *   Beat 2 (0.36 → 0.80): The heat-haze gives way to an electric-blue monsoon
 *     anvil deck and branching 3D monsoon arc filaments striking Camelback and
 *     the basin substations.
 *   Beat 3 (0.48 → 1.00): Radial shockwaves ignite a crisp metropolitan grid
 *     of 252 instanced light nodes across the Valley floor as the camera rises
 *     to an elevated metro vista.
 *
 * Hotspot 'phx-skyline' rides the Camelback Head crest.
 * Zero allocations inside useFrame; < 20 draw calls; full reduced-motion support.
 */

const plinthFragment = /* glsl */ `
  uniform float uOpacity;
  uniform float uGridWake;
  varying vec2 vUv;

  void main() {
    vec2 c = (vUv - 0.5) * 2.0;
    float mask = 1.0 - smoothstep(0.68, 1.0, length(c * vec2(0.88, 0.92)));
    if (mask < 0.004) discard;
    vec3 paper = vec3(0.95, 0.97, 1.0);
    vec3 metroTint = vec3(0.82, 0.88, 1.0);
    vec3 col = mix(paper, metroTint, uGridWake * 0.65 * (1.0 - length(c) * 0.45));
    gl_FragColor = vec4(col, mask * 0.56 * uOpacity);
  }
`;

const plinthVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const heatHazeVertex = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 p = position;
    float shimmer = sin(p.y * 14.0 - uTime * 3.4 * uMotion + sin(p.x * 4.5) * 1.5) * 0.032 * uIntensity;
    p.x += shimmer;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const heatHazeFragment = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uIntensity;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    if (uIntensity < 0.005) discard;
    vec2 c = (vUv - 0.5) * 2.0;
    float horizMask = 1.0 - smoothstep(0.45, 0.98, abs(c.x));
    float vertMask = smoothstep(-0.98, -0.45, c.y) * (1.0 - smoothstep(0.25, 0.95, c.y));

    /* Rising convective mirage ribbons */
    float wave1 = sin(vUv.y * 28.0 - uTime * 4.2 * uMotion + sin(vUv.x * 11.0 + uTime * 0.8) * 2.2);
    float wave2 = cos(vUv.y * 19.0 - uTime * 3.1 * uMotion - vUv.x * 8.0);
    float ribbon = smoothstep(0.25, 0.95, 0.5 + 0.28 * wave1 + 0.22 * wave2);

    vec3 ice = vec3(0.92, 0.96, 1.0);
    vec3 mirageBlue = vec3(0.48, 0.63, 1.0);
    vec3 col = mix(mirageBlue, ice, ribbon);

    float alpha = horizMask * vertMask * (0.08 + 0.24 * ribbon) * uIntensity * uOpacity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const monsoonArcVertex = /* glsl */ `
  attribute float aProgress;
  attribute float aBoltId;
  attribute float aWeight;
  varying float vProgress;
  varying float vBoltId;
  varying float vWeight;

  void main() {
    vProgress = aProgress;
    vBoltId = aBoltId;
    vWeight = aWeight;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const monsoonArcFragment = /* glsl */ `
  uniform float uStrikePhase;
  uniform float uTime;
  uniform float uMotion;
  uniform float uOpacity;
  varying float vProgress;
  varying float vBoltId;
  varying float vWeight;

  void main() {
    if (uStrikePhase < 0.01) discard;
    /* Stagger each of the 5 bolts across the monsoon window, plus subtle re-flicker */
    float boltStart = vBoltId * 0.13;
    float local = clamp((uStrikePhase - boltStart) / 0.42, 0.0, 1.4);
    if (local <= 0.0) discard;

    /* Downward stepped leader reach */
    float reach = smoothstep(vProgress - 0.08, vProgress + 0.02, local * 1.35);
    /* Return stroke & subtle high-frequency plasma flicker */
    float decay = 1.0 - smoothstep(0.65, 1.38, local);
    float flicker = 0.78 + 0.22 * sin(uTime * 26.0 * uMotion + vBoltId * 9.0);
    float a = (1.0 - reach) * decay * flicker * vWeight * uOpacity;

    /* Note: smoothstep(a, b, x) is 1 when x > b; so visible where local*1.35 >= vProgress */
    float revealed = smoothstep(vProgress - 0.04, vProgress + 0.03, local * 1.35);
    float finalAlpha = revealed * decay * flicker * vWeight * uOpacity;
    if (finalAlpha < 0.005) discard;

    vec3 coreWhite = vec3(0.94, 0.97, 1.0);
    vec3 electric = vec3(0.18, 0.29, 1.0);
    float headGlow = exp(-pow((local * 1.25 - vProgress) * 6.0, 2.0));
    vec3 col = mix(electric, coreWhite, 0.45 * vWeight + 0.55 * headGlow);
    gl_FragColor = vec4(col, finalAlpha);
  }
`;

const anvilFragment = /* glsl */ `
  uniform float uStorm;
  uniform float uFlash;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    if (uStorm < 0.005) discard;
    vec2 c = (vUv - 0.5) * 2.0;
    float mask = 1.0 - smoothstep(0.35, 0.98, length(c * vec2(0.82, 0.95)));
    if (mask < 0.004) discard;
    vec3 stormBlue = vec3(0.38, 0.52, 0.96);
    vec3 flashIce = vec3(0.88, 0.93, 1.0);
    vec3 col = mix(stormBlue, flashIce, uFlash * (1.0 - length(c) * 0.5));
    gl_FragColor = vec4(col, mask * (0.24 + 0.22 * uFlash) * uStorm * uOpacity);
  }
`;

/* Module-scope temporaries — zero allocation inside useFrame */
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

const _colIdle = new THREE.Color('#9db2ff');
const _colActive = new THREE.Color('#2e4bff');
const _colPeak = new THREE.Color('#eef4ff');

export default function PhoenixScene() {
  const q = useQuality();

  const rigRef = useRef<THREE.Group>(null);
  const ridgeGroupRef = useRef<THREE.Group>(null);
  const sunGroupRef = useRef<THREE.Group>(null);
  const flashLightRef = useRef<THREE.PointLight>(null);
  const camelbackAnchorRef = useRef<THREE.Object3D>(null);
  const nodeInstRef = useRef<THREE.InstancedMesh>(null);

  const stage = useMemo(createStageState, []);
  const reportHotspot = useHotspotReporter('phx-skyline');

  const live = useRef({
    px: 0,
    py: 0,
    rigX: 1.92,
    rigY: -0.16,
    rigZ: -0.22,
    rigScale: 0.80,
    rigRotY: -0.22,
    rigRotX: 0.16,
    heatIntensity: 0.85,
    strikePhase: 0,
    gridWake: 0.35,
    camX: 0,
    camY: 0.22,
    camZ: 9.0,
    lookX: 0,
    lookY: 0,
    lookZ: 0,
  });

  const geos = useMemo(() => buildPhoenixMonolithsAndGrid(), []);

  /* Precompute 252 Valley metropolitan grid coordinates & radial distances from central Phoenix */
  const gridTable = useMemo(() => {
    const coords = new Float32Array(METRO_NODE_COUNT * 3);
    const radii = new Float32Array(METRO_NODE_COUNT);
    const heights = new Float32Array(METRO_NODE_COUNT);
    const xMin = -2.25;
    const xMax = 2.25;
    const zMin = -0.25;
    const zMax = 1.65;
    let idx = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const gx = THREE.MathUtils.lerp(xMin, xMax, c / (GRID_COLS - 1));
        const gz = THREE.MathUtils.lerp(zMin, zMax, r / (GRID_ROWS - 1));
        const distCenter = Math.hypot(gx + 0.28, gz - 0.35);
        const distScottsdale = Math.hypot(gx - 0.88, gz - 0.38);
        const urbanDensity =
          Math.exp(-distCenter * distCenter * 1.4) +
          0.65 * Math.exp(-distScottsdale * distScottsdale * 1.8);

        coords[idx * 3] = gx;
        coords[idx * 3 + 1] = DESERT_Y + 0.018;
        coords[idx * 3 + 2] = gz;
        radii[idx] = Math.min(1, distCenter / 2.65);
        heights[idx] = 0.65 + 1.45 * urbanDensity;
        idx++;
      }
    }
    return { coords, radii, heights };
  }, []);

  const materials = useMemo(() => {
    const porcelainMat = new THREE.MeshPhysicalMaterial({
      color: '#edf2ff',
      roughness: 0.22,
      metalness: 0.04,
      clearcoat: 0.65,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.28,
    });
    const enamelMat = new THREE.MeshPhysicalMaterial({
      color: '#223feb',
      emissive: '#0d1db2',
      emissiveIntensity: 0.24,
      roughness: 0.16,
      metalness: 0.25,
      clearcoat: 0.9,
      envMapIntensity: 1.45,
    });
    const ridgeEdgeMat = new THREE.LineBasicMaterial({
      color: '#2e4bff',
      transparent: true,
      opacity: 0.38,
    });
    const gridLineMat = new THREE.LineBasicMaterial({
      color: '#5f7dff',
      transparent: true,
      opacity: 0.28,
    });
    const nodeMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      emissive: '#2e4bff',
      emissiveIntensity: 0.42,
      roughness: 0.14,
      metalness: 0.12,
      clearcoat: 0.9,
    });
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    const plinthMat = new THREE.ShaderMaterial({
      vertexShader: plinthVertex,
      fragmentShader: plinthFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uOpacity: { value: 1 },
        uGridWake: { value: 0.35 },
      },
    });
    const heatHazeMat = new THREE.ShaderMaterial({
      vertexShader: heatHazeVertex,
      fragmentShader: heatHazeFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uMotion: { value: 1 },
        uIntensity: { value: 0.85 },
        uOpacity: { value: 1 },
      },
    });
    const monsoonArcMat = new THREE.ShaderMaterial({
      vertexShader: monsoonArcVertex,
      fragmentShader: monsoonArcFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uStrikePhase: { value: 0 },
        uTime: { value: 0 },
        uMotion: { value: 1 },
        uOpacity: { value: 1 },
      },
    });
    const anvilMat = new THREE.ShaderMaterial({
      vertexShader: plinthVertex,
      fragmentShader: anvilFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uStorm: { value: 0 },
        uFlash: { value: 0 },
        uOpacity: { value: 1 },
      },
    });

    return {
      porcelainMat,
      enamelMat,
      ridgeEdgeMat,
      gridLineMat,
      nodeMat,
      shadowMat,
      plinthMat,
      heatHazeMat,
      monsoonArcMat,
      anvilMat,
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(geos).forEach((v) => {
        if (v instanceof THREE.BufferGeometry) v.dispose();
      });
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [geos, materials]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    readStage(stage, q);

    const pStats = getSectionProgress('stats');
    const pAngles = getSectionProgress('angles');
    const pFeature = getSectionProgress('feature');
    const pBuild = getSectionProgress('build');
    const pDetail = getSectionProgress('detail');
    const pFaq = getSectionProgress('faq');
    const pCta = getSectionProgress('cta');

    const intro = anim ? smooth(Math.min(el / 1.5, 1)) : 1;
    const L = live.current;

    L.px = anim ? damp(L.px, pointer.x * 0.14, 3.0, dt) : 0;
    L.py = anim ? damp(L.py, pointer.y * 0.09, 3.0, dt) : 0;

    const statsBeat = smooth(sectionRange(pStats, 0.08, 0.72));
    const anglesBeat = smooth(sectionRange(pAngles, 0.05, 0.85));
    const featureActive =
      smooth(sectionRange(pFeature, 0.05, 0.25)) * (1 - smooth(sectionRange(pFeature, 0.82, 0.98)));
    const featureMidSway =
      smooth(sectionRange(pFeature, 0.44, 0.54)) * (1 - smooth(sectionRange(pFeature, 0.66, 0.78)));
    const buildBeat = smooth(sectionRange(pBuild, 0.05, 0.85));
    const detailBeat = smooth(sectionRange(pDetail, 0.05, 0.85));
    const faqBeat = smooth(sectionRange(pFaq, 0.05, 0.85));
    const ctaBeat = smooth(sectionRange(pCta, 0.05, 0.8));

    const intoM = stage.into;
    const outM = stage.out;
    const focus = stage.focus;

    /* --------------------------------------------------------------------
       1. STAGE PLACEMENT ACROSS ALL SECTIONS
       -------------------------------------------------------------------- */
    let targetX = q.compact ? 0.0 : 1.94;
    let targetY = q.compact ? -0.78 : -0.16;
    let targetZ = q.compact ? -0.58 : -0.22;
    let targetScale = q.compact ? 0.48 : 0.80;
    let targetRotY = q.compact ? -0.16 : -0.22;
    let targetRotX = 0.16;

    if (anim) {
      const preX = q.compact ? 0.0 : 1.94 + 0.22 * statsBeat;
      const preY = q.compact ? -0.78 + 0.28 * statsBeat : -0.16 + 0.46 * statsBeat;
      const preZ = q.compact ? -0.58 : -0.22 - 0.36 * statsBeat;
      const preScale = q.compact ? 0.48 : 0.80 - 0.05 * statsBeat;
      const preRotY = -0.22 - 0.10 * statsBeat;

      const momX = 0.0;
      const momY = q.compact ? -0.14 : -0.10;
      const momZ = q.compact ? -0.08 : 0.30;
      const momScale = q.compact ? 0.62 : 0.98;
      const momRotY = -0.18 + 0.36 * smooth(stage.t);

      const gridLift = Math.max(anglesBeat, buildBeat);
      const postX = q.compact
        ? 0.0
        : 2.18 -
          0.14 * featureActive -
          4.20 * featureMidSway +
          0.18 * gridLift +
          0.12 * detailBeat +
          0.15 * faqBeat +
          0.28 * ctaBeat;
      const postY = q.compact
        ? -0.68 + 0.14 * ctaBeat
        : 0.14 - 0.34 * featureActive + 0.42 * gridLift + 0.22 * faqBeat + 0.12 * ctaBeat;
      const postZ = q.compact ? -0.58 : -0.46 + 0.28 * featureActive - 0.12 * gridLift;
      const postScale = q.compact
        ? 0.44
        : 0.72 + 0.06 * featureActive - 0.05 * gridLift - 0.06 * ctaBeat;
      const postRotY =
        -0.28 + 0.12 * featureActive + 0.58 * featureMidSway + 0.12 * buildBeat + 0.08 * ctaBeat;

      targetX = THREE.MathUtils.lerp(THREE.MathUtils.lerp(preX, momX, intoM), postX, outM);
      targetY = THREE.MathUtils.lerp(THREE.MathUtils.lerp(preY, momY, intoM), postY, outM);
      targetZ = THREE.MathUtils.lerp(THREE.MathUtils.lerp(preZ, momZ, intoM), postZ, outM);
      targetScale = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(preScale, momScale, intoM),
        postScale,
        outM,
      );
      targetRotY = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(preRotY, momRotY, intoM),
        postRotY,
        outM,
      );
      targetRotX = THREE.MathUtils.lerp(0.16, 0.10 + 0.14 * smooth(stage.t), focus);
    }

    L.rigX = anim ? damp(L.rigX, targetX, 5.5, dt) : targetX;
    L.rigY = anim ? damp(L.rigY, targetY - (1 - intro) * 0.45, 5.5, dt) : targetY;
    L.rigZ = anim ? damp(L.rigZ, targetZ, 5.5, dt) : targetZ;
    L.rigScale = anim ? damp(L.rigScale, targetScale * (0.9 + 0.1 * intro), 5.5, dt) : targetScale;
    L.rigRotY = anim ? damp(L.rigRotY, targetRotY + L.px * 0.28, 5.0, dt) : targetRotY;
    L.rigRotX = anim ? damp(L.rigRotX, targetRotX - L.py * 0.16, 5.0, dt) : targetRotX;

    if (rigRef.current) {
      rigRef.current.position.set(L.rigX, L.rigY, L.rigZ);
      rigRef.current.scale.setScalar(L.rigScale);
      rigRef.current.rotation.set(L.rigRotX, L.rigRotY, 0);
    }

    if (ridgeGroupRef.current) {
      const rIntro = anim ? smooth(sectionRange(intro, 0.0, 0.88)) : 1;
      ridgeGroupRef.current.scale.y = Math.max(0.001, rIntro);
      ridgeGroupRef.current.position.y = (1 - rIntro) * -0.4;
    }

    /* --------------------------------------------------------------------
       2. THREE-ACT MOMENT: HEAT HAZE -> MONSOON ARCS -> METRO GRID WAKE
       -------------------------------------------------------------------- */
    const stormRise = smooth(sectionRange(stage.t, 0.32, 0.56));
    const strikeWindow = sectionRange(stage.t, 0.36, 0.88);
    const gridSweep = smooth(sectionRange(stage.t, 0.46, 0.96));

    const desiredHeat = anim
      ? THREE.MathUtils.lerp(0.78 - 0.35 * outM, 1.0 - stormRise * 0.92, focus)
      : 0.22;
    const desiredStrike = anim ? strikeWindow * focus : 0.62;
    const desiredGridWake = anim
      ? THREE.MathUtils.lerp(0.32 + 0.58 * outM + 0.10 * buildBeat, 0.18 + 0.82 * gridSweep, focus)
      : 0.92;

    L.heatIntensity = anim ? damp(L.heatIntensity, desiredHeat, 6.0, dt) : 0.22;
    L.strikePhase = anim ? damp(L.strikePhase, desiredStrike, 9.0, dt) : 0.62;
    L.gridWake = anim ? damp(L.gridWake, desiredGridWake, 5.5, dt) : 0.92;

    materials.heatHazeMat.uniforms.uTime.value = anim ? el : 1.5;
    materials.heatHazeMat.uniforms.uMotion.value = anim ? 1 : 0;
    materials.heatHazeMat.uniforms.uIntensity.value = L.heatIntensity;
    materials.heatHazeMat.uniforms.uOpacity.value = intro;

    materials.monsoonArcMat.uniforms.uStrikePhase.value = L.strikePhase;
    materials.monsoonArcMat.uniforms.uTime.value = anim ? el : 1.2;
    materials.monsoonArcMat.uniforms.uMotion.value = anim ? 1 : 0;
    materials.monsoonArcMat.uniforms.uOpacity.value = intro;

    const flashEnvelope =
      Math.sin(Math.min(1, L.strikePhase * 1.25) * Math.PI) *
      (anim ? 0.72 + 0.28 * Math.sin(el * 18.0) : 0.65);

    materials.anvilMat.uniforms.uStorm.value = anim ? stormRise * focus : 0.55;
    materials.anvilMat.uniforms.uFlash.value = flashEnvelope;
    materials.anvilMat.uniforms.uOpacity.value = intro;

    materials.plinthMat.uniforms.uOpacity.value = intro;
    materials.plinthMat.uniforms.uGridWake.value = L.gridWake;
    materials.gridLineMat.opacity = (0.18 + 0.34 * L.gridWake) * intro;

    if (flashLightRef.current) {
      flashLightRef.current.intensity = flashEnvelope * 3.2;
    }

    /* Update 252 Instanced Metropolitan Grid Light Nodes */
    const nodeInst = nodeInstRef.current;
    if (nodeInst) {
      _quat.identity();
      for (let i = 0; i < METRO_NODE_COUNT; i++) {
        const gx = gridTable.coords[i * 3];
        const gy = gridTable.coords[i * 3 + 1];
        const gz = gridTable.coords[i * 3 + 2];
        const rad = gridTable.radii[i];
        const hWeight = gridTable.heights[i];

        /* Radial shockwave ignition outward from central Phoenix */
        const waveReach = THREE.MathUtils.clamp((L.gridWake * 1.45 - rad * 0.68) / 0.48, 0, 1);
        const pulse = Math.exp(-Math.pow((L.gridWake * 1.25 - rad) * 4.2, 2));
        const shimmer = anim ? 0.08 * Math.sin(el * 2.4 + i * 0.43) * waveReach : 0;

        const sXZ = (0.35 + 0.68 * waveReach + 0.28 * pulse) * intro;
        const sY = (0.28 + (0.85 * waveReach + 0.55 * pulse + shimmer) * hWeight) * intro;

        _pos.set(gx, gy + sY * 0.018, gz);
        _scale.set(sXZ, sY, sXZ);
        _mat4.compose(_pos, _quat, _scale);
        nodeInst.setMatrixAt(i, _mat4);

        _color.copy(_colIdle).lerp(_colActive, waveReach).lerp(_colPeak, pulse * 0.75);
        nodeInst.setColorAt(i, _color);
      }
      nodeInst.instanceMatrix.needsUpdate = true;
      if (nodeInst.instanceColor) nodeInst.instanceColor.needsUpdate = true;
    }

    /* Desert Sun rising in Beat 1, haloed behind Echo Canyon saddle */
    if (sunGroupRef.current) {
      const sunClimb = smooth(sectionRange(stage.t, 0.0, 0.46));
      sunGroupRef.current.position.set(
        -0.46 + L.px * 0.3,
        0.52 + 0.56 * sunClimb + 0.24 * anglesBeat,
        -1.55,
      );
      const sunDim = 1 - 0.25 * stormRise * focus;
      sunGroupRef.current.scale.setScalar(sunDim);
      sunGroupRef.current.rotation.y = anim ? el * 0.2 : 0.3;
    }

    if (camelbackAnchorRef.current) {
      reportHotspot(camelbackAnchorRef.current, state.camera, 0.55 + 0.35 * focus);
    }

    /* --------------------------------------------------------------------
       3. CAMERA SWEEP: SAGUARO BAJADA TO ELEVATED METRO GRID VISTA
       -------------------------------------------------------------------- */
    const sweep = smooth(sectionRange(stage.t, 0.05, 0.96));
    const momCamX = THREE.MathUtils.lerp(-0.28, 0.18, sweep) + L.px * 0.22;
    const momCamY = THREE.MathUtils.lerp(-0.08, 1.08, sweep) + L.py * 0.14;
    const momCamZ = THREE.MathUtils.lerp(5.15, 5.75, sweep);

    const momLookX = THREE.MathUtils.lerp(-0.18, 0.02, sweep);
    const momLookY = THREE.MathUtils.lerp(0.08, -0.22, sweep);
    const momLookZ = THREE.MathUtils.lerp(-0.55, 0.15, sweep);

    const restCamX = anim ? pointer.x * 0.24 : 0;
    const restCamY = anim ? 0.22 + pointer.y * 0.14 : 0.22;
    const restCamZ = 9.0;

    L.camX = anim ? damp(L.camX, THREE.MathUtils.lerp(restCamX, momCamX, focus), 6.0, dt) : 0;
    L.camY = anim ? damp(L.camY, THREE.MathUtils.lerp(restCamY, momCamY, focus), 6.0, dt) : 0.22;
    L.camZ = anim ? damp(L.camZ, THREE.MathUtils.lerp(restCamZ, momCamZ, focus), 6.0, dt) : 9.0;
    L.lookX = anim ? damp(L.lookX, THREE.MathUtils.lerp(0, momLookX, focus), 6.0, dt) : 0;
    L.lookY = anim ? damp(L.lookY, THREE.MathUtils.lerp(0, momLookY, focus), 6.0, dt) : 0;
    L.lookZ = anim ? damp(L.lookZ, THREE.MathUtils.lerp(0, momLookZ, focus), 6.0, dt) : 0;

    _camTarget.set(L.camX, L.camY, L.camZ);
    _lookTarget.set(L.lookX, L.lookY, L.lookZ);
    state.camera.position.copy(_camTarget);
    state.camera.lookAt(_lookTarget);
  });

  return (
    <>
      <SceneLightRig />

      <group ref={rigRef}>
        <mesh
          material={materials.shadowMat}
          position={[0, DESERT_Y - 0.10, 0.15]}
          rotation-x={-Math.PI / 2}
          renderOrder={-2}
        >
          <planeGeometry args={[6.2, 4.8]} />
        </mesh>

        <mesh
          material={materials.plinthMat}
          position={[0, DESERT_Y - 0.02, 0.15]}
          rotation-x={-Math.PI / 2}
          renderOrder={-1}
        >
          <planeGeometry args={[5.8, 4.4]} />
        </mesh>

        <group ref={ridgeGroupRef}>
          {/* Faceted Camelback Mountain Crystal Monolith */}
          <mesh geometry={geos.camelbackCoreGeo}>
            <GradientGlassMaterial
              ice="#dce6ff"
              azure="#7a95ff"
              electric="#2e4bff"
              deep="#1226c8"
              opacity={0.92}
              sheen={0.75}
            />
          </mesh>
          <mesh geometry={geos.camelbackGeo}>
            <GlassMaterial kind="crystal" flatShading />
          </mesh>
          <lineSegments geometry={geos.camelbackEdgesGeo} material={materials.ridgeEdgeMat} />

          {/* Sculpted Saguaro Cactus Monoliths & Metro Prisms */}
          <mesh geometry={geos.saguaroGeo}>
            <GlassMaterial kind="azure" flatShading />
          </mesh>
          <mesh geometry={geos.bajadaPorcelainGeo} material={materials.porcelainMat} />

          {/* Valley of the Sun Arterial Grid + 252 Instanced Light Nodes */}
          <lineSegments geometry={geos.metroGridLinesGeo} material={materials.gridLineMat} />
          <instancedMesh
            ref={nodeInstRef}
            args={[geos.nodeGeo, materials.nodeMat, METRO_NODE_COUNT]}
            frustumCulled={false}
          />

          {/* Hotspot anchor at Camelback Head / Praying Monk */}
          <object3D ref={camelbackAnchorRef} position={geos.camelbackHeadPos} />
        </group>

        {/* Beat 1: Shimmering Convective Desert Heat-Haze Curtain */}
        <mesh
          material={materials.heatHazeMat}
          position={[0, DESERT_Y + 0.68, -0.35]}
          renderOrder={3}
        >
          <planeGeometry args={[4.4, 1.45, 32, 24]} />
        </mesh>

        {/* Beat 2: Monsoon Anvil Stratum & Branching Electric-Blue Arc Filaments */}
        <mesh
          material={materials.anvilMat}
          position={[0, 1.58, -0.45]}
          rotation-x={Math.PI / 2}
          renderOrder={4}
        >
          <planeGeometry args={[5.2, 3.4]} />
        </mesh>
        <lineSegments
          geometry={geos.monsoonArcsGeo}
          material={materials.monsoonArcMat}
          frustumCulled={false}
          renderOrder={5}
        />
        <pointLight ref={flashLightRef} position={[0, 1.25, -0.35]} intensity={0} color="#4d6bff" distance={6} />

        {/* Desert Solar Prism */}
        <group ref={sunGroupRef} position={[-0.46, 0.82, -1.55]}>
          <mesh>
            <sphereGeometry args={[0.23, 32, 24]} />
            <GlassMaterial kind="deep" emissive="#2e4bff" emissiveIntensity={0.62} />
          </mesh>
          <mesh rotation-x={Math.PI / 2.5} material={materials.enamelMat}>
            <torusGeometry args={[0.36, 0.008, 8, 36]} />
          </mesh>
        </group>
      </group>

      <ParticleField
        count={Math.floor(840 * q.particles)}
        drift={q.animate ? 0.08 : 0}
        opacity={0.22}
      />
    </>
  );
}
