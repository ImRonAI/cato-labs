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
  BAY_Y,
  DECK_Y,
  buildHillSkylineAndCableCarGeometries,
  buildSuspensionBridgeGeometries,
  sampleCableCarHill,
} from './san-francisco/geometries';

/**
 * SanFranciscoScene — "Above the Marine Layer"
 *
 * Layered volumetric-feeling translucent mist planes drift through the Golden
 * Gate's twin stepped Art Deco suspension towers, catenary main cables, and
 * vertical suspenders in enamel/crystal blue, beside a sculpted Russian/Nob
 * Hill street grid and the Transamerica skyline cluster.
 *
 * During `moment` (0 → 1), the camera climbs vertically out of the swirling
 * marine fog layer past the twin Deco suspension towers into sunlit blue air
 * while a luminous dispersive glass cable-car prism climbs and crests the
 * steep street grid below.
 *
 * Hotspot 'sf-skyline' rides the Transamerica Pyramid crystal apex.
 * Zero allocations inside useFrame; < 25 draw calls; full reduced-motion support.
 */

const bayVertex = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vWave;

  void main() {
    vUv = uv;
    vec3 p = position;
    float w = sin(p.x * 3.4 + uTime * 0.9 * uMotion) * 0.018
            + cos(p.y * 4.1 - uTime * 0.7 * uMotion) * 0.014;
    p.z += w;
    vWave = w;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const bayFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vWave;

  void main() {
    vec2 c = (vUv - 0.5) * 2.0;
    float mask = 1.0 - smoothstep(0.68, 1.0, length(c * vec2(0.88, 0.92)));
    if (mask < 0.004) discard;

    vec3 pale = vec3(0.87, 0.91, 1.0);
    vec3 bayBlue = vec3(0.45, 0.59, 0.98);
    vec3 deep = vec3(0.16, 0.28, 0.92);

    float glint = smoothstep(-0.015, 0.022, vWave);
    float rip = 0.5 + 0.5 * sin(vWorldPos.x * 11.0 - vWorldPos.z * 7.0 + uTime * 1.4);
    vec3 col = mix(pale, bayBlue, 0.45 + 0.35 * glint);
    col = mix(col, deep, 0.18 * rip);

    gl_FragColor = vec4(col, mask * 0.50 * uOpacity);
  }
`;

const mistVertex = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uLayerSeed;
  varying vec2 vUv;
  varying vec3 vLocalPos;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec3 p = position;
    /* Gentle marine billow undulation per stratum */
    float heave = sin(p.x * 1.35 + uTime * 0.42 * uMotion + uLayerSeed * 5.1) * 0.045
                + cos(p.y * 1.15 - uTime * 0.34 * uMotion + uLayerSeed * 3.7) * 0.038;
    p.z += heave;
    vLocalPos = vec3(p.x, 0.0, -p.y);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const mistFragment = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uLayerSeed;
  uniform float uDensity;
  uniform float uCamY;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vLocalPos;
  varying vec3 vWorldPos;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.54;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += a * noise2(p);
      p = rot * p * 2.05 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 c = (vUv - 0.5) * 2.0;
    float radial = 1.0 - smoothstep(0.45, 0.98, length(c * vec2(0.88, 0.94)));
    if (radial < 0.004) discard;

    /* Wind advection streaming through the Golden Gate strait */
    vec2 drift = vec2(uTime * 0.085 * uMotion, -uTime * 0.035 * uMotion);
    vec2 q = vUv * vec2(3.6, 2.8) + drift + vec2(uLayerSeed * 4.3, uLayerSeed * 2.9);
    float warp = fbm(q * 0.85);
    float billow = fbm(q + vec2(warp * 1.1, -warp * 0.7));
    float wisp = smoothstep(0.30, 0.78, billow);

    /* Part organically around South Tower (-0.78, 0.35), North Tower (-1.56, -2.05) & Pyramid (1.56, -1.35) */
    vec2 xz = vec2(vLocalPos.x, vLocalPos.z);
    float wakeS = smoothstep(0.14, 0.52, length(xz - vec2(-0.78, 0.35)));
    float wakeN = smoothstep(0.14, 0.52, length(xz - vec2(-1.56, -2.05)));
    float wakeP = smoothstep(0.12, 0.46, length(xz - vec2(1.56, -1.35)));
    float wake = 0.35 + 0.65 * (wakeS * wakeN * wakeP);

    /* Smooth vertical proximity fade so climbing through a plane never hard-clips */
    float camClear = smoothstep(0.04, 0.28, abs(vWorldPos.y - uCamY));

    vec3 topMist = vec3(0.95, 0.97, 1.0);
    vec3 midMist = vec3(0.76, 0.84, 1.0);
    vec3 deepMist = vec3(0.44, 0.58, 0.98);
    vec3 col = mix(deepMist, midMist, smoothstep(0.25, 0.65, billow));
    col = mix(col, topMist, smoothstep(0.58, 0.90, billow) * (0.45 + 0.55 * uLayerSeed));

    float alpha = radial * wisp * wake * camClear * uDensity * uOpacity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const MIST_STRATA = [
  { y: BAY_Y + 0.30, seed: 0.12, baseDensity: 0.44, scale: 1.04 },
  { y: BAY_Y + 0.45, seed: 0.27, baseDensity: 0.42, scale: 1.02 },
  { y: BAY_Y + 0.60, seed: 0.41, baseDensity: 0.38, scale: 1.00 },
  { y: BAY_Y + 0.76, seed: 0.56, baseDensity: 0.34, scale: 0.98 },
  { y: BAY_Y + 0.92, seed: 0.71, baseDensity: 0.28, scale: 0.95 },
  { y: BAY_Y + 1.08, seed: 0.84, baseDensity: 0.22, scale: 0.92 },
  { y: BAY_Y + 1.24, seed: 0.96, baseDensity: 0.16, scale: 0.88 },
];

const TRAFFIC_COUNT = 18;

/* Module-scope temporaries — zero allocation inside useFrame */
const _carPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _tPos = new THREE.Vector3();
const _tQuat = new THREE.Quaternion();
const _tScale = new THREE.Vector3(1, 1, 1);

export default function SanFranciscoScene() {
  const q = useQuality();

  const rigRef = useRef<THREE.Group>(null);
  const bridgeGroupRef = useRef<THREE.Group>(null);
  const cityGroupRef = useRef<THREE.Group>(null);
  const cableCarRef = useRef<THREE.Group>(null);
  const sunGroupRef = useRef<THREE.Group>(null);
  const pyramidAnchorRef = useRef<THREE.Object3D>(null);
  const trafficInstRef = useRef<THREE.InstancedMesh>(null);

  const stage = useMemo(createStageState, []);
  const reportHotspot = useHotspotReporter('sf-skyline');

  const live = useRef({
    px: 0,
    py: 0,
    rigX: 1.92,
    rigY: -0.16,
    rigZ: -0.25,
    rigScale: 0.80,
    rigRotY: -0.22,
    rigRotX: 0.14,
    carU: 0.32,
    camX: 0,
    camY: 0.22,
    camZ: 9.0,
    lookX: 0,
    lookY: 0,
    lookZ: 0,
  });

  const bridgeGeos = useMemo(() => buildSuspensionBridgeGeometries(), []);
  const cityGeos = useMemo(() => buildHillSkylineAndCableCarGeometries(), []);
  const trafficBoxGeo = useMemo(() => new THREE.BoxGeometry(0.022, 0.014, 0.055), []);

  const materials = useMemo(() => {
    const porcelainMat = new THREE.MeshPhysicalMaterial({
      color: '#edf2ff',
      roughness: 0.22,
      metalness: 0.04,
      clearcoat: 0.68,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.28,
    });
    const enamelMat = new THREE.MeshPhysicalMaterial({
      color: '#223feb',
      emissive: '#0c1ca8',
      emissiveIntensity: 0.24,
      roughness: 0.16,
      metalness: 0.28,
      clearcoat: 0.92,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.5,
    });
    const carCoreMat = new THREE.MeshBasicMaterial({
      color: '#2e4bff',
      transparent: true,
      opacity: 0.72,
    });
    const trafficMat = new THREE.MeshBasicMaterial({
      color: '#dce6ff',
      transparent: true,
      opacity: 0.85,
    });
    const suspenderLineMat = new THREE.LineBasicMaterial({
      color: '#4c68ff',
      transparent: true,
      opacity: 0.46,
    });
    const streetGridLineMat = new THREE.LineBasicMaterial({
      color: '#2e4bff',
      transparent: true,
      opacity: 0.34,
    });
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const bayMat = new THREE.ShaderMaterial({
      vertexShader: bayVertex,
      fragmentShader: bayFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uMotion: { value: 1 },
        uOpacity: { value: 1 },
      },
    });
    const mistMats = MIST_STRATA.map(
      (s) =>
        new THREE.ShaderMaterial({
          vertexShader: mistVertex,
          fragmentShader: mistFragment,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          uniforms: {
            uTime: { value: 0 },
            uMotion: { value: 1 },
            uLayerSeed: { value: s.seed },
            uDensity: { value: s.baseDensity },
            uCamY: { value: 0.22 },
            uOpacity: { value: 1 },
          },
        }),
    );

    return {
      porcelainMat,
      enamelMat,
      carCoreMat,
      trafficMat,
      suspenderLineMat,
      streetGridLineMat,
      shadowMat,
      bayMat,
      mistMats,
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(bridgeGeos).forEach((g) => g.dispose());
      Object.values(cityGeos).forEach((v) => {
        if (v instanceof THREE.BufferGeometry) v.dispose();
      });
      trafficBoxGeo.dispose();
      materials.porcelainMat.dispose();
      materials.enamelMat.dispose();
      materials.carCoreMat.dispose();
      materials.trafficMat.dispose();
      materials.suspenderLineMat.dispose();
      materials.streetGridLineMat.dispose();
      materials.shadowMat.dispose();
      materials.bayMat.dispose();
      materials.mistMats.forEach((m) => m.dispose());
    };
  }, [bridgeGeos, cityGeos, trafficBoxGeo, materials]);

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
    let targetX = q.compact ? 0.0 : 1.92;
    let targetY = q.compact ? -0.82 : -0.18;
    let targetZ = q.compact ? -0.60 : -0.25;
    let targetScale = q.compact ? 0.45 : 0.80;
    let targetRotY = q.compact ? -0.16 : -0.24;
    let targetRotX = 0.14;

    if (anim) {
      const preX = q.compact ? 0.0 : 1.92 + 0.24 * statsBeat;
      const preY = q.compact ? -0.82 + 0.30 * statsBeat : -0.18 + 0.48 * statsBeat;
      const preZ = q.compact ? -0.60 : -0.25 - 0.38 * statsBeat;
      const preScale = q.compact ? 0.45 : 0.80 - 0.05 * statsBeat;
      const preRotY = -0.24 - 0.10 * statsBeat;

      /* Moment dwell: centered full-bay showcase */
      const momX = q.compact ? 0.0 : 0.06;
      const momY = q.compact ? -0.16 : -0.12;
      const momZ = q.compact ? -0.15 : 0.25;
      const momScale = q.compact ? 0.60 : 0.98;
      const momRotY = -0.18 + 0.34 * smooth(stage.t);

      /* Post-moment: clean right/left editorial framing */
      const gridLift = Math.max(anglesBeat, buildBeat);
      const postX = q.compact
        ? 0.0
        : 2.18 -
          0.16 * featureActive -
          4.20 * featureMidSway +
          0.18 * gridLift +
          0.12 * detailBeat +
          0.15 * faqBeat +
          0.28 * ctaBeat;
      const postY = q.compact
        ? -0.72 + 0.14 * ctaBeat
        : 0.14 - 0.34 * featureActive + 0.42 * gridLift + 0.24 * faqBeat + 0.12 * ctaBeat;
      const postZ = q.compact ? -0.60 : -0.48 + 0.30 * featureActive - 0.12 * gridLift;
      const postScale = q.compact
        ? 0.42
        : 0.72 + 0.06 * featureActive - 0.05 * gridLift - 0.06 * ctaBeat;
      const postRotY =
        -0.30 + 0.12 * featureActive + 0.62 * featureMidSway + 0.12 * buildBeat + 0.08 * ctaBeat;

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
      targetRotX = THREE.MathUtils.lerp(0.14, 0.05, focus);
    }

    L.rigX = anim ? damp(L.rigX, targetX, 5.5, dt) : targetX;
    L.rigY = anim ? damp(L.rigY, targetY - (1 - intro) * 0.46, 5.5, dt) : targetY;
    L.rigZ = anim ? damp(L.rigZ, targetZ, 5.5, dt) : targetZ;
    L.rigScale = anim ? damp(L.rigScale, targetScale * (0.9 + 0.1 * intro), 5.5, dt) : targetScale;
    L.rigRotY = anim ? damp(L.rigRotY, targetRotY + L.px * 0.28, 5.0, dt) : targetRotY;
    L.rigRotX = anim ? damp(L.rigRotX, targetRotX - L.py * 0.16, 5.0, dt) : targetRotX;

    if (rigRef.current) {
      rigRef.current.position.set(L.rigX, L.rigY, L.rigZ);
      rigRef.current.scale.setScalar(L.rigScale);
      rigRef.current.rotation.set(L.rigRotX, L.rigRotY, 0);
    }

    if (bridgeGroupRef.current) {
      const bIntro = anim ? smooth(sectionRange(intro, 0.0, 0.88)) : 1;
      bridgeGroupRef.current.scale.y = Math.max(0.001, bIntro);
      bridgeGroupRef.current.position.y = (1 - bIntro) * -0.45;
    }
    if (cityGroupRef.current) {
      const cIntro = anim ? smooth(sectionRange(intro, 0.12, 1.0)) : 1;
      cityGroupRef.current.scale.setScalar(Math.max(0.001, cIntro));
    }

    /* --------------------------------------------------------------------
       2. GLASS CABLE-CAR PRISM CLIMBING & CRESTING THE STEEP STREET GRID
       -------------------------------------------------------------------- */
    const idleLoop = 0.45 + 0.34 * Math.sin(el * 0.32);
    const momentClimb = THREE.MathUtils.lerp(0.12, 0.90, smooth(sectionRange(stage.t, 0.02, 0.92)));
    const desiredCarU = anim ? THREE.MathUtils.lerp(idleLoop, momentClimb, focus) : 0.78;
    L.carU = anim ? damp(L.carU, desiredCarU, 6.0, dt) : 0.78;

    if (cableCarRef.current) {
      const { pitch, yaw } = sampleCableCarHill(L.carU, _carPos);
      cableCarRef.current.position.copy(_carPos);
      cableCarRef.current.rotation.order = 'YXZ';
      cableCarRef.current.rotation.set(-pitch, yaw, 0);
    }

    /* Bridge deck traffic pulses */
    const trafficInst = trafficInstRef.current;
    if (trafficInst) {
      const p0x = -0.32;
      const p0z = 1.75;
      const p1x = -1.95;
      const p1z = -3.25;
      const yaw = Math.atan2(p1x - p0x, p1z - p0z);
      _tQuat.setFromAxisAngle(_tPos.set(0, 1, 0), yaw);

      for (let i = 0; i < TRAFFIC_COUNT; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const laneOffset = dir * 0.075;
        const raw = i / TRAFFIC_COUNT + (anim ? el * 0.055 * dir : 0);
        const s = ((raw % 1) + 1) % 1;
        const tx = THREE.MathUtils.lerp(p0x, p1x, s) + laneOffset * 0.95;
        const tz = THREE.MathUtils.lerp(p0z, p1z, s) - laneOffset * 0.31;
        _tPos.set(tx, DECK_Y + 0.046, tz);
        _mat4.compose(_tPos, _tQuat, _tScale);
        trafficInst.setMatrixAt(i, _mat4);
      }
      trafficInst.instanceMatrix.needsUpdate = true;
    }

    /* --------------------------------------------------------------------
       3. CAMERA ASCENDING OUT OF THE MARINE LAYER PAST TWIN DECO TOWERS
       -------------------------------------------------------------------- */
    const ascent = smooth(sectionRange(stage.t, 0.05, 0.96));
    /* Start inside/below the marine fog strata (y=-0.22, z=4.9) beside the steep street
       grade and suspension deck; climb vertically past the twin Art Deco tower portals
       into crisp sunlit air above the cloud deck (y=+1.42, z=6.1)! */
    const momCamX = THREE.MathUtils.lerp(0.28, -0.18, ascent) + L.px * 0.22;
    const momCamY = THREE.MathUtils.lerp(-0.22, 1.42, ascent) + L.py * 0.14;
    const momCamZ = THREE.MathUtils.lerp(4.85, 6.15, ascent);

    const momLookX = THREE.MathUtils.lerp(0.18, 0.05, ascent);
    const momLookY = THREE.MathUtils.lerp(-0.08, 0.34, ascent);
    const momLookZ = THREE.MathUtils.lerp(-0.25, -0.85, ascent);

    const restCamX = anim ? pointer.x * 0.24 : 0;
    const restCamY = anim ? 0.22 + pointer.y * 0.14 : 0.22;
    const restCamZ = 9.0;

    const targetCamX = anim ? THREE.MathUtils.lerp(restCamX, momCamX, focus) : 0;
    const targetCamY = anim ? THREE.MathUtils.lerp(restCamY, momCamY, focus) : 0.22;
    const targetCamZ = anim ? THREE.MathUtils.lerp(restCamZ, momCamZ, focus) : 9.0;

    const targetLookX = anim ? THREE.MathUtils.lerp(0, momLookX, focus) : 0;
    const targetLookY = anim ? THREE.MathUtils.lerp(0, momLookY, focus) : 0;
    const targetLookZ = anim ? THREE.MathUtils.lerp(0, momLookZ, focus) : 0;

    L.camX = anim ? damp(L.camX, targetCamX, 6.0, dt) : targetCamX;
    L.camY = anim ? damp(L.camY, targetCamY, 6.0, dt) : targetCamY;
    L.camZ = anim ? damp(L.camZ, targetCamZ, 6.0, dt) : targetCamZ;
    L.lookX = anim ? damp(L.lookX, targetLookX, 6.0, dt) : targetLookX;
    L.lookY = anim ? damp(L.lookY, targetLookY, 6.0, dt) : targetLookY;
    L.lookZ = anim ? damp(L.lookZ, targetLookZ, 6.0, dt) : targetLookZ;

    _camTarget.set(L.camX, L.camY, L.camZ);
    _lookTarget.set(L.lookX, L.lookY, L.lookZ);
    state.camera.position.copy(_camTarget);
    state.camera.lookAt(_lookTarget);

    /* --------------------------------------------------------------------
       4. LAYERED MARINE MIST SHADERS, SUN & SKYLINE HOTSPOT
       -------------------------------------------------------------------- */
    materials.bayMat.uniforms.uTime.value = anim ? el : 1.5;
    materials.bayMat.uniforms.uMotion.value = anim ? 1 : 0.3;
    materials.bayMat.uniforms.uOpacity.value = intro;

    /* Upper mist strata thin slightly as the camera breaks into clear sunlight
       and on the `angles` section beat */
    const clearFactor = Math.max(ascent * focus * 0.38, anglesBeat * 0.42);
    for (let i = 0; i < MIST_STRATA.length; i++) {
      const mat = materials.mistMats[i];
      const spec = MIST_STRATA[i];
      const upperWeight = i / (MIST_STRATA.length - 1);
      mat.uniforms.uTime.value = anim ? el : 2.4;
      mat.uniforms.uMotion.value = anim ? 1 : 0;
      mat.uniforms.uCamY.value = L.camY;
      mat.uniforms.uDensity.value = spec.baseDensity * (1 - clearFactor * (0.35 + 0.65 * upperWeight));
      mat.uniforms.uOpacity.value = intro;
    }

    if (sunGroupRef.current) {
      sunGroupRef.current.position.set(
        -0.35 + L.px * 0.35,
        1.48 + 0.28 * ascent * focus,
        -3.15,
      );
      sunGroupRef.current.rotation.y = anim ? el * 0.22 : 0.4;
    }

    if (pyramidAnchorRef.current) {
      reportHotspot(pyramidAnchorRef.current, state.camera, 0.55 + 0.35 * focus);
    }
  });

  return (
    <>
      <SceneLightRig />

      <group ref={rigRef}>
        {/* Soft contact shadow & San Francisco Bay water sheet */}
        <mesh
          material={materials.shadowMat}
          position={[0.1, BAY_Y - 0.08, -0.55]}
          rotation-x={-Math.PI / 2}
          renderOrder={-2}
        >
          <planeGeometry args={[7.2, 7.6]} />
        </mesh>

        <mesh
          material={materials.bayMat}
          position={[0.05, BAY_Y, -0.65]}
          rotation-x={-Math.PI / 2}
          renderOrder={-1}
        >
          <planeGeometry args={[7.4, 8.0, 48, 48]} />
        </mesh>

        {/* --- 1. Twin Art Deco Suspension Towers, Catenary Cables & Marin Headlands --- */}
        <group ref={bridgeGroupRef}>
          <mesh geometry={bridgeGeos.marinHeadlandsGeo}>
            <GradientGlassMaterial
              ice="#e8eeff"
              azure="#859fff"
              electric="#2e4bff"
              deep="#1226c8"
              opacity={0.88}
              sheen={0.65}
            />
          </mesh>
          <mesh geometry={bridgeGeos.bridgePorcelainGeo} material={materials.porcelainMat} />
          <mesh geometry={bridgeGeos.bridgeEnamelGeo} material={materials.enamelMat} />
          <mesh geometry={bridgeGeos.bridgeCrystalGeo}>
            <GlassMaterial kind="crystal" />
          </mesh>
          <lineSegments
            geometry={bridgeGeos.suspenderLinesGeo}
            material={materials.suspenderLineMat}
          />
          <instancedMesh
            ref={trafficInstRef}
            args={[trafficBoxGeo, materials.trafficMat, TRAFFIC_COUNT]}
            frustumCulled={false}
          />
        </group>

        {/* --- 2. Steep SF Street Grid, Transamerica Skyline & Luminous Glass Cable-Car --- */}
        <group ref={cityGroupRef}>
          <mesh geometry={cityGeos.hillGeo}>
            <GradientGlassMaterial
              ice="#eef3ff"
              azure="#94abff"
              electric="#2e4bff"
              deep="#1226c8"
              opacity={0.94}
              sheen={0.7}
            />
          </mesh>
          <lineSegments
            geometry={cityGeos.streetGridGeo}
            material={materials.streetGridLineMat}
          />

          <mesh geometry={cityGeos.skylinePorcelainGeo} material={materials.porcelainMat} />
          <mesh geometry={cityGeos.skylineGlassGeo}>
            <GlassMaterial kind="crystal" />
          </mesh>

          {/* Hotspot anchor at the Transamerica Pyramid apex */}
          <object3D ref={pyramidAnchorRef} position={cityGeos.pyramidApexPos} />

          {/* Luminous Dispersive Prism Cable Car */}
          <group ref={cableCarRef}>
            <mesh geometry={cityGeos.carEnamelGeo} material={materials.enamelMat} />
            <mesh geometry={cityGeos.carGlassGeo}>
              <GlassMaterial kind="prism" />
            </mesh>
            <mesh position={[0, 0.068, 0]} material={materials.carCoreMat}>
              <boxGeometry args={[0.068, 0.048, 0.19]} />
            </mesh>
          </group>
        </group>

        {/* --- 3. Layered Volumetric-Feeling Translucent Marine Mist Strata --- */}
        {MIST_STRATA.map((s, i) => (
          <mesh
            key={s.seed}
            material={materials.mistMats[i]}
            position={[-0.12, s.y, -0.55]}
            rotation-x={-Math.PI / 2}
            scale={[s.scale, s.scale, 1]}
            renderOrder={2 + i}
          >
            <planeGeometry args={[6.8, 6.8, 28, 28]} />
          </mesh>
        ))}

        {/* --- 4. Clear-Sky Sun Orb Above the Fog Bank --- */}
        <group ref={sunGroupRef} position={[-0.35, 1.56, -3.15]}>
          <mesh>
            <sphereGeometry args={[0.20, 32, 24]} />
            <GlassMaterial kind="deep" emissive="#2e4bff" emissiveIntensity={0.55} />
          </mesh>
          <mesh rotation-x={Math.PI / 2.5} material={materials.enamelMat}>
            <torusGeometry args={[0.32, 0.007, 8, 36]} />
          </mesh>
        </group>
      </group>

      <ParticleField
        count={Math.floor(860 * q.particles)}
        drift={q.animate ? 0.08 : 0}
        opacity={0.22}
      />
    </>
  );
}
