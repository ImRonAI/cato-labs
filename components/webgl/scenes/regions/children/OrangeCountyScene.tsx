'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, GradientGlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import { getSectionProgress, pointer, sectionRange, smooth } from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { mulberry32, hashString } from '../../../kit/lib/samplePath';
import { createStageState, damp, readStage } from '../lib-a/dwell';
import { contactShadowTexture } from '../lib-a/place';
import {
  OCEAN_Y,
  RIB_COUNT,
  TUBE_Z_END,
  TUBE_Z_START,
  buildBarrelWaveGeometries,
  buildCoastalHorizonGeometries,
} from './orange-county/waveGeometries';

/**
 * OrangeCountyScene — "The Crystalline Barrel & Coastal Horizon"
 *
 * A sculptural refractive glass ocean swell builds into a hollow crystalline
 * curling barrel wave composed of 44 articulated 3-part glass hydrofoil ribs
 * (azure base wall + crystal pocket + dispersive prism lip), united by a
 * translucent spiral refraction veil and luminous crest-spray particles.
 *
 * During the sticky `moment` dwell (0 → 1), the swell jacks up and pitches
 * overhead down the reef while the camera drops to water level and glides
 * straight through the hollow glass barrel, emerging through the open almond
 * eye onto the Huntington/Newport architectural pier and terraced Laguna
 * coastal headlands.
 *
 * Hotspot 'oc-skyline' rides the crystalline pier-end pavilion.
 * Zero allocations inside useFrame; < 20 draw calls; full reduced-motion support.
 */

/* ---------------- Custom GLSL Shaders ---------------- */

const oceanVertex = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uCurl;
  varying vec2 vUv;
  varying float vElev;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec3 p = position;
    float swellA = sin(p.x * 2.3 + uTime * 1.15 * uMotion + p.y * 0.9) * 0.036;
    float swellB = cos(p.y * 2.9 - uTime * 0.85 * uMotion) * 0.024;
    float troughDraw = -0.06 * uCurl * exp(-pow((p.x - 0.15) * 1.4, 2.0)) * smoothstep(-3.2, 2.5, p.y);
    float elev = swellA + swellB + troughDraw;
    p.z += elev;
    vElev = elev;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const oceanFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uCurl;
  varying vec2 vUv;
  varying float vElev;
  varying vec3 vWorldPos;

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    float edgeMask = 1.0 - smoothstep(0.68, 1.0, length(centered * vec2(0.88, 0.92)));
    if (edgeMask < 0.004) discard;

    vec3 shallow = vec3(0.85, 0.90, 1.0);
    vec3 midBlue = vec3(0.46, 0.60, 1.0);
    vec3 electric = vec3(0.18, 0.29, 1.0);

    float shimmer = smoothstep(-0.03, 0.045, vElev);
    float caustic = 0.5 + 0.5 * sin(vWorldPos.x * 9.0 + vWorldPos.z * 5.5 + uTime * 1.6);
    vec3 col = mix(shallow, midBlue, 0.42 + 0.35 * shimmer);
    col = mix(col, electric, 0.22 * caustic * (0.4 + 0.6 * uCurl));

    /* Subtle horizon sun reflection path */
    float sunLane = exp(-pow((vWorldPos.x + 0.35) * 1.45, 2.0)) * smoothstep(2.0, -4.2, vWorldPos.z);
    col = mix(col, vec3(0.95, 0.97, 1.0), sunLane * 0.55);

    gl_FragColor = vec4(col, edgeMask * 0.56 * uOpacity);
  }
`;

const veilVertex = /* glsl */ `
  uniform float uTime;
  uniform float uCurl;
  uniform float uPeel;
  uniform float uOceanY;
  uniform float uZStart;
  uniform float uZEnd;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    /* position.x in [0..1] = arc u; position.y in [0..1] = tube progress s */
    float u = position.x;
    float s = position.y;
    vUv = vec2(u, s);

    float z = mix(uZStart, uZEnd, s);
    /* Progressive peel wave along the reef */
    float localCurl = clamp(uCurl * (1.18 - s * 0.34) + 0.08 * sin(s * 5.0 - uPeel * 3.0), 0.08, 1.08);

    /* Parametric spiral matching the 3-segment glass hydrofoil ribs */
    float totalAngle = mix(1.05, 2.86, localCurl);
    float theta0 = mix(-1.15, -0.45, localCurl);
    float theta = theta0 + u * totalAngle;
    float r = mix(1.12, 0.64, u * (0.55 + 0.45 * localCurl));
    float heightScale = mix(0.54, 1.04, localCurl);

    float cx = 0.78 - 0.14 * s;
    float cy = uOceanY + 0.08 + r * 0.62 * heightScale;

    float x = cx + cos(theta) * r * 0.92 - (1.0 - localCurl) * u * 0.55;
    float y = uOceanY + 0.02 + (sin(theta - theta0) * 0.82 + u * (1.0 - u) * 1.25) * (0.52 + 0.78 * localCurl);
    /* Blend cleanly with true circular barrel arch at high curl */
    float archX = (0.12 - 0.10 * s) + cos(theta - 0.22) * mix(0.86, 0.66, u);
    float archY = (uOceanY + 0.68) + sin(theta - 0.22) * mix(0.70, 0.66, u);
    x = mix(x, archX, smoothstep(0.25, 0.95, localCurl));
    y = mix(y, archY, smoothstep(0.25, 0.95, localCurl));

    vec3 p = vec3(x, y, z);
    vec3 tangU = normalize(vec3(-sin(theta - 0.22), cos(theta - 0.22), 0.0));
    vec3 nrm = normalize(cross(vec3(0.0, 0.0, -1.0), tangU));

    vec4 wp = modelMatrix * vec4(p, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * nrm);
    vec4 mv = viewMatrix * wp;
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const veilFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uCurl;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 1.7);
    /* Ribbed water-vein striations running up the wave face */
    float striation = 0.5 + 0.5 * sin(vUv.y * 88.0 - vUv.x * 14.0 + uTime * 2.2);
    float lipFoam = smoothstep(0.76, 1.0, vUv.x) * smoothstep(0.2, 0.9, uCurl);
    float endFade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.90, vUv.y);

    vec3 ice = vec3(0.90, 0.94, 1.0);
    vec3 azure = vec3(0.50, 0.64, 1.0);
    vec3 electric = vec3(0.18, 0.29, 1.0);

    vec3 col = mix(azure, electric, smoothstep(0.15, 0.85, fres));
    col = mix(col, ice, lipFoam * 0.72 + striation * 0.22);

    float alpha = (0.14 + fres * 0.34 + lipFoam * 0.28 + striation * 0.06) * endFade * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

const sprayVertex = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uCurl;
  uniform float uPixelRatio;
  uniform float uOceanY;
  uniform float uZStart;
  uniform float uZEnd;
  attribute float aSeed;
  attribute float aScale;
  attribute float aAlong;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vSeed = aSeed;
    float s = fract(aAlong + uTime * 0.06 * uMotion);
    float z = mix(uZStart, uZEnd, s);
    float localCurl = clamp(uCurl * (1.18 - s * 0.32), 0.05, 1.05);

    /* Lip launch point */
    float theta = mix(0.65, 2.42, localCurl);
    float lipX = (0.12 - 0.10 * s) + cos(theta - 0.22) * 0.66;
    float lipY = (uOceanY + 0.68) + sin(theta - 0.22) * 0.66;

    /* Ballistic spray plume thrown off the pitching lip */
    float burst = fract(aSeed * 7.13 + uTime * (0.55 + aSeed * 0.35) * uMotion);
    float throwDir = theta + 1.35;
    float vx = cos(throwDir) * (0.28 + 0.35 * aSeed) * localCurl;
    float vy = sin(throwDir) * (0.18 + 0.26 * aSeed) + 0.16;

    vec3 p = vec3(
      lipX + vx * burst + sin(aSeed * 31.0) * 0.06,
      lipY + vy * burst - 0.52 * burst * burst,
      z + cos(aSeed * 19.0) * 0.08
    );

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float life = sin(3.14159 * burst);
    vAlpha = life * smoothstep(0.08, 0.55, localCurl);
    gl_PointSize = (3.4 * aScale * (0.65 + 0.55 * life)) * uPixelRatio * (12.0 / max(-mv.z, 0.6));
  }
`;

const sprayFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.46, 0.05, d);
    float a = core * vAlpha * uOpacity;
    if (a < 0.004) discard;
    vec3 c = mix(vec3(0.86, 0.92, 1.0), vec3(0.18, 0.29, 1.0), vSeed * 0.55);
    gl_FragColor = vec4(c, a);
  }
`;

/* Module-scope temporaries — zero allocation inside useFrame */
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

/* Precomputed rib cross-section endpoints in local XY */
const END1_X = 1.08 * (Math.cos(0.68) - 1);
const END1_Y = 1.08 * Math.sin(0.68);
const END2_X = 0.88 * (Math.cos(0.92) - 1);
const END2_Y = 0.88 * Math.sin(0.92);

export default function OrangeCountyScene() {
  const q = useQuality();
  const { viewport } = useThree();

  const rigRef = useRef<THREE.Group>(null);
  const horizonGroupRef = useRef<THREE.Group>(null);
  const sunGroupRef = useRef<THREE.Group>(null);
  const pavilionAnchorRef = useRef<THREE.Object3D>(null);

  const baseRibsRef = useRef<THREE.InstancedMesh>(null);
  const wallRibsRef = useRef<THREE.InstancedMesh>(null);
  const lipRibsRef = useRef<THREE.InstancedMesh>(null);

  const stage = useMemo(createStageState, []);
  const reportHotspot = useHotspotReporter('oc-skyline');

  const live = useRef({
    px: 0,
    py: 0,
    rigX: 1.95,
    rigY: -0.18,
    rigZ: -0.25,
    rigScale: 0.82,
    rigRotY: -0.64,
    rigRotX: 0.12,
    curl: 0.36,
    camX: 0,
    camY: 0.22,
    camZ: 9,
    lookX: 0,
    lookY: 0,
    lookZ: 0,
  });

  const waveGeos = useMemo(() => buildBarrelWaveGeometries(), []);
  const horizonGeos = useMemo(() => buildCoastalHorizonGeometries(), []);

  const materials = useMemo(() => {
    const porcelainMat = new THREE.MeshPhysicalMaterial({
      color: '#eef3ff',
      roughness: 0.2,
      metalness: 0.04,
      clearcoat: 0.7,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.3,
    });
    const enamelMat = new THREE.MeshPhysicalMaterial({
      color: '#2340eb',
      emissive: '#0e1eb5',
      emissiveIntensity: 0.22,
      roughness: 0.16,
      metalness: 0.24,
      clearcoat: 0.92,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.45,
    });
    const contourLineMat = new THREE.LineBasicMaterial({
      color: '#2e4bff',
      transparent: true,
      opacity: 0.34,
    });
    const subtleLineMat = new THREE.LineBasicMaterial({
      color: '#7d97ff',
      transparent: true,
      opacity: 0.32,
    });
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    const oceanMat = new THREE.ShaderMaterial({
      vertexShader: oceanVertex,
      fragmentShader: oceanFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uMotion: { value: 1 },
        uCurl: { value: 0.36 },
        uOpacity: { value: 1 },
      },
    });
    const veilMat = new THREE.ShaderMaterial({
      vertexShader: veilVertex,
      fragmentShader: veilFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uCurl: { value: 0.36 },
        uPeel: { value: 0 },
        uOceanY: { value: OCEAN_Y },
        uZStart: { value: TUBE_Z_START },
        uZEnd: { value: TUBE_Z_END },
        uOpacity: { value: 1 },
      },
    });
    return {
      porcelainMat,
      enamelMat,
      contourLineMat,
      subtleLineMat,
      shadowMat,
      oceanMat,
      veilMat,
    };
  }, []);

  const sprayCount = Math.max(90, Math.floor(960 * q.particles));
  const spray = useMemo(() => {
    const rng = mulberry32(hashString('oc-crest-spray'));
    const positions = new Float32Array(sprayCount * 3);
    const seeds = new Float32Array(sprayCount);
    const scales = new Float32Array(sprayCount);
    const along = new Float32Array(sprayCount);
    for (let i = 0; i < sprayCount; i++) {
      seeds[i] = rng();
      scales[i] = 0.55 + rng() * 1.15;
      along[i] = rng();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: sprayVertex,
      fragmentShader: sprayFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uMotion: { value: 1 },
        uCurl: { value: 0.36 },
        uPixelRatio: { value: 1 },
        uOceanY: { value: OCEAN_Y },
        uZStart: { value: TUBE_Z_START },
        uZEnd: { value: TUBE_Z_END },
        uOpacity: { value: 0.82 },
      },
    });
    return { geo, mat };
  }, [sprayCount]);

  useEffect(() => {
    spray.mat.uniforms.uPixelRatio.value = viewport.dpr;
  }, [spray, viewport.dpr]);

  useEffect(() => {
    return () => {
      Object.values(waveGeos).forEach((g) => g.dispose());
      Object.values(horizonGeos).forEach((v) => {
        if (v instanceof THREE.BufferGeometry) v.dispose();
      });
      Object.values(materials).forEach((m) => m.dispose());
      spray.geo.dispose();
      spray.mat.dispose();
    };
  }, [waveGeos, horizonGeos, materials, spray]);

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

    const intro = anim ? smooth(Math.min(el / 1.45, 1)) : 1;
    const L = live.current;

    L.px = anim ? damp(L.px, pointer.x * 0.14, 3.2, dt) : 0;
    L.py = anim ? damp(L.py, pointer.y * 0.09, 3.2, dt) : 0;

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
       1. STAGE PLACEMENT ACROSS HERO -> MOMENT -> POST-MOMENT SECTIONS
       -------------------------------------------------------------------- */
    let targetX = q.compact ? 0.0 : 1.95;
    let targetY = q.compact ? -0.78 : -0.16;
    let targetZ = q.compact ? -0.55 : -0.25;
    let targetScale = q.compact ? 0.48 : 0.82;
    let targetRotY = q.compact ? -0.42 : -0.62;
    let targetRotX = 0.12;

    if (anim) {
      /* Pre-moment: sculptural coastal oblique framing beside hero/stats copy */
      const preX = q.compact ? 0.0 : 1.95 + 0.22 * statsBeat;
      const preY = q.compact ? -0.78 + 0.28 * statsBeat : -0.16 + 0.42 * statsBeat;
      const preZ = q.compact ? -0.55 : -0.25 - 0.35 * statsBeat;
      const preScale = q.compact ? 0.48 : 0.82 - 0.05 * statsBeat;
      const preRotY = (q.compact ? -0.42 : -0.62) + 0.18 * statsBeat;

      /* Moment dwell: align the hollow crystalline barrel right down the Z axis
         so the camera glides cleanly inside the tube and out toward the pier */
      const momX = 0.0;
      const momY = q.compact ? -0.08 : -0.04;
      const momZ = 0.0;
      const momScale = q.compact ? 0.78 : 1.0;
      const momRotY = -0.06 + 0.10 * smooth(stage.t);

      /* Post-moment: graceful coastal horizon & curled wave framing editorial columns */
      const gridLift = Math.max(anglesBeat, buildBeat);
      const postX = q.compact
        ? 0.0
        : 2.15 -
          0.14 * featureActive -
          4.15 * featureMidSway +
          0.18 * gridLift +
          0.14 * detailBeat +
          0.16 * faqBeat +
          0.28 * ctaBeat;
      const postY = q.compact
        ? -0.68 + 0.14 * ctaBeat
        : 0.12 - 0.32 * featureActive + 0.40 * gridLift + 0.22 * faqBeat + 0.12 * ctaBeat;
      const postZ = q.compact ? -0.55 : -0.45 + 0.28 * featureActive - 0.12 * gridLift;
      const postScale = q.compact
        ? 0.44
        : 0.74 + 0.06 * featureActive - 0.05 * gridLift - 0.06 * ctaBeat;
      const postRotY =
        -0.52 + 0.12 * featureActive + 0.86 * featureMidSway + 0.12 * buildBeat + 0.08 * ctaBeat;

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
      targetRotX = THREE.MathUtils.lerp(0.13, 0.02, focus);
    }

    L.rigX = anim ? damp(L.rigX, targetX, 5.5, dt) : targetX;
    L.rigY = anim ? damp(L.rigY, targetY - (1 - intro) * 0.48, 5.5, dt) : targetY;
    L.rigZ = anim ? damp(L.rigZ, targetZ, 5.5, dt) : targetZ;
    L.rigScale = anim ? damp(L.rigScale, targetScale * (0.9 + 0.1 * intro), 5.5, dt) : targetScale;
    L.rigRotY = anim ? damp(L.rigRotY, targetRotY + L.px * (1 - focus * 0.65) * 0.28, 5.0, dt) : -0.54;
    L.rigRotX = anim ? damp(L.rigRotX, targetRotX - L.py * (1 - focus * 0.65) * 0.16, 5.0, dt) : 0.12;

    if (rigRef.current) {
      rigRef.current.position.set(L.rigX, L.rigY, L.rigZ);
      rigRef.current.scale.setScalar(L.rigScale);
      rigRef.current.rotation.set(L.rigRotX, L.rigRotY, 0);
    }

    /* --------------------------------------------------------------------
       2. ARTICULATED 3-PART GLASS BARREL RIBS (ZERO-ALLOCATION MATRIX LOOP)
       -------------------------------------------------------------------- */
    const swellBuild = smooth(sectionRange(stage.t, 0.0, 0.42));
    const desiredCurl = anim
      ? THREE.MathUtils.lerp(
          0.34 + 0.10 * statsBeat + 0.36 * outM + 0.04 * Math.sin(el * 0.7),
          0.26 + 0.76 * swellBuild,
          focus,
        )
      : 0.76;
    L.curl = anim ? damp(L.curl, desiredCurl, 6.0, dt) : 0.76;

    const baseInst = baseRibsRef.current;
    const wallInst = wallRibsRef.current;
    const lipInst = lipRibsRef.current;

    if (baseInst && wallInst && lipInst) {
      for (let i = 0; i < RIB_COUNT; i++) {
        const s = i / (RIB_COUNT - 1);
        const z = THREE.MathUtils.lerp(TUBE_Z_START, TUBE_Z_END, s);
        /* Progressive reef peel: near-entrance jacked up first, peeling smoothly toward exit */
        const peelWave = anim ? 0.045 * Math.sin(s * 5.2 - el * 1.4 - stage.t * 4.2) : 0;
        const ribCurl = THREE.MathUtils.clamp(
          L.curl * (1.16 - s * 0.28) + peelWave,
          0.10,
          1.06,
        );
        const taperEnd = Math.sin(Math.PI * THREE.MathUtils.clamp(0.08 + s * 0.84, 0.08, 0.95));
        const ribScale = (0.76 + 0.28 * taperEnd) * intro;

        const baseX = 0.78 - 0.12 * s;
        const baseY = OCEAN_Y + 0.02 - (1 - intro) * 0.25;
        const rot0 = THREE.MathUtils.lerp(-1.12, -0.44, ribCurl);
        const sY0 = (0.56 + 0.46 * ribCurl) * ribScale;
        const sX0 = (0.82 + 0.20 * ribCurl) * ribScale;

        /* Base foil instance */
        _pos.set(baseX, baseY, z);
        _euler.set(0, 0, rot0);
        _quat.setFromEuler(_euler);
        _scale.set(sX0, sY0, 1);
        _mat4.compose(_pos, _quat, _scale);
        baseInst.setMatrixAt(i, _mat4);

        /* Compute exact tip of Base foil */
        const c0 = Math.cos(rot0);
        const sn0 = Math.sin(rot0);
        const lx1 = END1_X * sX0;
        const ly1 = END1_Y * sY0;
        const p1x = baseX + c0 * lx1 - sn0 * ly1;
        const p1y = baseY + sn0 * lx1 + c0 * ly1;

        /* Wall crystal foil instance */
        const rot1 = rot0 + 0.68 * THREE.MathUtils.lerp(0.38, 1.02, ribCurl);
        const sX1 = (0.78 + 0.24 * ribCurl) * ribScale;
        const sY1 = (0.58 + 0.44 * ribCurl) * ribScale;
        _pos.set(p1x, p1y, z);
        _euler.set(0, 0, rot1);
        _quat.setFromEuler(_euler);
        _scale.set(sX1, sY1, 1);
        _mat4.compose(_pos, _quat, _scale);
        wallInst.setMatrixAt(i, _mat4);

        /* Compute exact tip of Wall foil */
        const c1 = Math.cos(rot1);
        const sn1 = Math.sin(rot1);
        const lx2 = END2_X * sX1;
        const ly2 = END2_Y * sY1;
        const p2x = p1x + c1 * lx2 - sn1 * ly2;
        const p2y = p1y + sn1 * lx2 + c1 * ly2;

        /* Dispersive prism lip foil instance */
        const rot2 = rot1 + 0.92 * THREE.MathUtils.lerp(0.28, 1.24, ribCurl);
        const sX2 = (0.72 + 0.36 * ribCurl) * ribScale;
        const sY2 = (0.52 + 0.52 * ribCurl) * ribScale;
        _pos.set(p2x, p2y, z);
        _euler.set(0, 0, rot2);
        _quat.setFromEuler(_euler);
        _scale.set(sX2, sY2, 1);
        _mat4.compose(_pos, _quat, _scale);
        lipInst.setMatrixAt(i, _mat4);
      }

      baseInst.instanceMatrix.needsUpdate = true;
      wallInst.instanceMatrix.needsUpdate = true;
      lipInst.instanceMatrix.needsUpdate = true;
    }

    /* --------------------------------------------------------------------
       3. SHADERS, COASTAL HORIZON SUN & HOTSPOT
       -------------------------------------------------------------------- */
    materials.oceanMat.uniforms.uTime.value = anim ? el : 1.8;
    materials.oceanMat.uniforms.uMotion.value = anim ? 1 : 0.35;
    materials.oceanMat.uniforms.uCurl.value = L.curl;
    materials.oceanMat.uniforms.uOpacity.value = intro;

    materials.veilMat.uniforms.uTime.value = anim ? el : 1.8;
    materials.veilMat.uniforms.uCurl.value = L.curl;
    materials.veilMat.uniforms.uPeel.value = stage.t;
    materials.veilMat.uniforms.uOpacity.value = intro;

    spray.mat.uniforms.uTime.value = anim ? el : 2.1;
    spray.mat.uniforms.uMotion.value = anim ? 1 : 0;
    spray.mat.uniforms.uCurl.value = L.curl;
    spray.mat.uniforms.uOpacity.value = 0.85 * intro;

    if (horizonGroupRef.current) {
      const hScale = 0.88 + 0.12 * intro;
      horizonGroupRef.current.scale.setScalar(hScale);
    }

    if (sunGroupRef.current) {
      const sunLift = 0.25 + 0.45 * smooth(stage.t) + 0.2 * anglesBeat;
      sunGroupRef.current.position.set(-0.42 + L.px * 0.35, OCEAN_Y + 0.52 + sunLift * 0.58, -4.45);
      sunGroupRef.current.rotation.z = anim ? el * 0.18 : 0.3;
    }

    if (pavilionAnchorRef.current) {
      reportHotspot(pavilionAnchorRef.current, state.camera, 0.55 + 0.35 * focus);
    }

    /* --------------------------------------------------------------------
       4. CAMERA GLIDE THROUGH THE HOLLOW BARREL ON `MOMENT` (0 → 1)
       -------------------------------------------------------------------- */
    const glide = smooth(sectionRange(stage.t, 0.06, 0.98));
    /* During moment: camera drops to water level and flies from barrel entrance (z=5.4)
       through the refractive crystal throat down to the open almond exit (z=-0.55),
       revealing the Huntington Pier and Laguna headlands across the horizon! */
    const barrelCamX = THREE.MathUtils.lerp(0.08, -0.06, glide) + L.px * 0.18;
    const barrelCamY = THREE.MathUtils.lerp(0.02, 0.08, glide) + L.py * 0.12;
    const barrelCamZ = THREE.MathUtils.lerp(5.6, -0.45, glide);

    const barrelLookX = THREE.MathUtils.lerp(0.02, -0.22, glide) + L.px * 0.22;
    const barrelLookY = THREE.MathUtils.lerp(-0.04, 0.02, glide) + L.py * 0.14;
    const barrelLookZ = -3.85;

    const restCamX = anim ? pointer.x * 0.24 : 0;
    const restCamY = anim ? 0.22 + pointer.y * 0.14 : 0.22;
    const restCamZ = 9.0;

    const targetCamX = anim ? THREE.MathUtils.lerp(restCamX, barrelCamX, focus) : 0;
    const targetCamY = anim ? THREE.MathUtils.lerp(restCamY, barrelCamY, focus) : 0.22;
    const targetCamZ = anim ? THREE.MathUtils.lerp(restCamZ, barrelCamZ, focus) : 9.0;

    const targetLookX = anim ? THREE.MathUtils.lerp(0, barrelLookX, focus) : 0;
    const targetLookY = anim ? THREE.MathUtils.lerp(0, barrelLookY, focus) : 0;
    const targetLookZ = anim ? THREE.MathUtils.lerp(0, barrelLookZ, focus) : 0;

    L.camX = anim ? damp(L.camX, targetCamX, 6.5, dt) : targetCamX;
    L.camY = anim ? damp(L.camY, targetCamY, 6.5, dt) : targetCamY;
    L.camZ = anim ? damp(L.camZ, targetCamZ, 6.5, dt) : targetCamZ;
    L.lookX = anim ? damp(L.lookX, targetLookX, 6.5, dt) : targetLookX;
    L.lookY = anim ? damp(L.lookY, targetLookY, 6.5, dt) : targetLookY;
    L.lookZ = anim ? damp(L.lookZ, targetLookZ, 6.5, dt) : targetLookZ;

    _camTarget.set(L.camX, L.camY, L.camZ);
    _lookTarget.set(L.lookX, L.lookY, L.lookZ);
    state.camera.position.copy(_camTarget);
    state.camera.lookAt(_lookTarget);
  });

  return (
    <>
      <SceneLightRig />

      <group ref={rigRef}>
        {/* Soft contact shadow & Pacific ocean surface */}
        <mesh
          material={materials.shadowMat}
          position={[0.2, OCEAN_Y - 0.08, -0.8]}
          rotation-x={-Math.PI / 2}
          renderOrder={-2}
        >
          <planeGeometry args={[7.2, 8.4]} />
        </mesh>

        <mesh
          material={materials.oceanMat}
          position={[0.1, OCEAN_Y, -1.0]}
          rotation-x={-Math.PI / 2}
          renderOrder={-1}
        >
          <planeGeometry args={[7.6, 9.2, 64, 72]} />
        </mesh>

        {/* Continuous liquid-crystal spiral barrel veil */}
        <mesh geometry={waveGeos.veilGeo} material={materials.veilMat} />

        {/* 44 Articulated 3-Part Refractive Glass Barrel Ribs */}
        <instancedMesh
          ref={baseRibsRef}
          args={[waveGeos.baseRibGeo, undefined, RIB_COUNT]}
          frustumCulled={false}
        >
          <GlassMaterial kind="azure" />
        </instancedMesh>

        <instancedMesh
          ref={wallRibsRef}
          args={[waveGeos.wallRibGeo, undefined, RIB_COUNT]}
          frustumCulled={false}
        >
          <GlassMaterial kind="crystal" />
        </instancedMesh>

        <instancedMesh
          ref={lipRibsRef}
          args={[waveGeos.lipRibGeo, undefined, RIB_COUNT]}
          frustumCulled={false}
        >
          <GlassMaterial kind="prism" />
        </instancedMesh>

        {/* Luminous crest spray cascading off the curling lip */}
        <points geometry={spray.geo} material={spray.mat} frustumCulled={false} />

        {/* Coastal Horizon Geometry — Huntington Pier, Laguna Bluffs & Horizon Sun */}
        <group ref={horizonGroupRef}>
          <mesh geometry={horizonGeos.bluffGeo}>
            <GradientGlassMaterial
              ice="#e8eeff"
              azure="#8ba4ff"
              electric="#2e4bff"
              deep="#1226c8"
              opacity={0.92}
              sheen={0.7}
            />
          </mesh>
          <lineSegments geometry={horizonGeos.bluffContoursGeo} material={materials.contourLineMat} />

          <mesh geometry={horizonGeos.pierPorcelainGeo} material={materials.porcelainMat} />
          <mesh geometry={horizonGeos.pierEnamelGeo} material={materials.enamelMat} />
          <mesh geometry={horizonGeos.pierGlassGeo}>
            <GlassMaterial kind="crystal" />
          </mesh>
          <lineSegments geometry={horizonGeos.pierLinesGeo} material={materials.subtleLineMat} />

          {/* Hotspot anchor at the pier-end pavilion */}
          <object3D ref={pavilionAnchorRef} position={horizonGeos.pavilionPos} />

          {/* Pacific Horizon Sun & Azimuth Ring */}
          <group ref={sunGroupRef} position={[-0.42, OCEAN_Y + 0.72, -4.45]}>
            <mesh>
              <sphereGeometry args={[0.24, 32, 24]} />
              <GlassMaterial kind="deep" emissive="#2e4bff" emissiveIntensity={0.58} />
            </mesh>
            <mesh rotation-x={Math.PI / 2.4} material={materials.enamelMat}>
              <torusGeometry args={[0.38, 0.008, 8, 40]} />
            </mesh>
          </group>
        </group>
      </group>

      <ParticleField
        count={Math.floor(880 * q.particles)}
        drift={q.animate ? 0.09 : 0}
        opacity={0.24}
      />
    </>
  );
}
