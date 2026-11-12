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
  CLUSTERS_PER_STATION,
  STATIONS_PER_ROW,
  TOTAL_CLUSTERS,
  TOTAL_STATIONS,
  VALLEY_Y,
  VINE_ROWS,
  buildNapaValleyGeometries,
  vineStationTransform,
} from './napa/geometries';

/**
 * NapaScene — "Dawn Over the Contour Rows"
 *
 * Rolling Napa Valley contour terraces (Mayacamas & Vaca ridges cradling the
 * alluvial valley floor) and 176 instanced vineyard trellises in refractive
 * crystal with 352 luminous cluster nodes.
 *
 * During `moment` (0 → 1), low morning San Pablo Bay mist layers part outward
 * and recede up-valley while a raking dawn directional light rises over the
 * eastern ridge, illuminating the sculpted crystal vine rows and emerging
 * sapphire cluster nodes across the valley floor.
 *
 * Hotspot 'napa-skyline' rides the Rutherford bench tasting estate crest.
 * Zero allocations inside useFrame; < 20 draw calls; full reduced-motion support.
 */

const mistVertex = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uSeed;
  varying vec2 vUv;
  varying vec3 vLocalPos;

  void main() {
    vUv = uv;
    vec3 p = position;
    float w = sin(p.x * 1.6 + uTime * 0.35 * uMotion + uSeed * 6.0) * 0.025
            + cos(p.y * 1.4 - uTime * 0.28 * uMotion + uSeed * 4.2) * 0.022;
    p.z += w;
    vLocalPos = vec3(p.x, 0.0, -p.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const mistFragment = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uSeed;
  uniform float uPart;
  uniform float uBaseDensity;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vLocalPos;

  float h21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x),
      mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.54;
    for (int i = 0; i < 4; i++) {
      s += a * vnoise(p);
      p = p * 2.04 + vec2(3.1, 7.4);
      a *= 0.5;
    }
    return s;
  }

  void main() {
    vec2 c = (vUv - 0.5) * 2.0;
    /* Confine mist naturally to the central valley trough between the hills */
    float valleyMask = 1.0 - smoothstep(0.38, 0.96, abs(c.x));
    float endMask = 1.0 - smoothstep(0.62, 1.0, abs(c.y));
    float mask = valleyMask * endMask;
    if (mask < 0.004) discard;

    /* As uPart goes 0 -> 1, the morning mist parts outward from the central vine rows
       and recedes northward (-Z -> c.y > 0) down-valley */
    float corridorWidth = uPart * 0.72;
    float partLateral = smoothstep(corridorWidth * 0.45, corridorWidth + 0.24, abs(c.x));
    float recedeZ = smoothstep(-0.85 + uPart * 1.45, -0.15 + uPart * 1.45, c.y);
    float mistPresence = mix(1.0, max(partLateral * 0.48, recedeZ * 0.55), uPart);

    vec2 drift = vec2(0.02 * uTime * uMotion, 0.055 * uTime * uMotion);
    float n = fbm(vUv * vec2(3.8, 3.2) + drift + uSeed * 5.0);
    float wisp = smoothstep(0.28, 0.78, n);

    /* Subtle dawn light tint along eastern (+X) edge as sun rises */
    vec3 coolFog = vec3(0.82, 0.88, 1.0);
    vec3 luminousIce = vec3(0.96, 0.98, 1.0);
    vec3 electricRim = vec3(0.45, 0.60, 1.0);
    vec3 col = mix(coolFog, luminousIce, smoothstep(0.35, 0.82, n));
    col = mix(col, electricRim, smoothstep(-0.2, 0.8, c.x) * uPart * 0.25);

    float alpha = mask * wisp * mistPresence * uBaseDensity * uOpacity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const VALLEY_MIST_LAYERS = [
  { y: VALLEY_Y + 0.09, seed: 0.14, density: 0.48, w: 3.4, d: 4.5 },
  { y: VALLEY_Y + 0.17, seed: 0.31, density: 0.44, w: 3.6, d: 4.6 },
  { y: VALLEY_Y + 0.25, seed: 0.52, density: 0.38, w: 3.8, d: 4.6 },
  { y: VALLEY_Y + 0.34, seed: 0.73, density: 0.30, w: 4.0, d: 4.7 },
  { y: VALLEY_Y + 0.43, seed: 0.91, density: 0.20, w: 4.2, d: 4.8 },
];

/* Module-scope temporaries — zero allocation inside useFrame */
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

export default function NapaScene() {
  const q = useQuality();

  const rigRef = useRef<THREE.Group>(null);
  const valleyGroupRef = useRef<THREE.Group>(null);
  const sunGroupRef = useRef<THREE.Group>(null);
  const dawnLightRef = useRef<THREE.DirectionalLight>(null);
  const estateAnchorRef = useRef<THREE.Object3D>(null);

  const postInstRef = useRef<THREE.InstancedMesh>(null);
  const canopyInstRef = useRef<THREE.InstancedMesh>(null);
  const clusterInstRef = useRef<THREE.InstancedMesh>(null);

  const stage = useMemo(createStageState, []);
  const reportHotspot = useHotspotReporter('napa-skyline');

  const live = useRef({
    px: 0,
    py: 0,
    rigX: 1.90,
    rigY: -0.18,
    rigZ: -0.22,
    rigScale: 0.80,
    rigRotY: -0.26,
    rigRotX: 0.16,
    emergence: 0.48,
    mistPart: 0.25,
    camX: 0,
    camY: 0.22,
    camZ: 9.0,
    lookX: 0,
    lookY: 0,
    lookZ: 0,
  });

  const geos = useMemo(() => buildNapaValleyGeometries(), []);

  /* Precompute all 176 vine station coordinates & yaws once so useFrame never recomputes trig */
  const stationTable = useMemo(() => {
    const coords = new Float32Array(TOTAL_STATIONS * 3);
    const yaws = new Float32Array(TOTAL_STATIONS);
    const norms = new Float32Array(TOTAL_STATIONS * 2); // [rowNorm01, s01]
    const tmp = new THREE.Vector3();
    let idx = 0;
    for (let r = 0; r < VINE_ROWS; r++) {
      for (let s = 0; s < STATIONS_PER_ROW; s++) {
        const yaw = vineStationTransform(r, s, tmp);
        coords[idx * 3] = tmp.x;
        coords[idx * 3 + 1] = tmp.y;
        coords[idx * 3 + 2] = tmp.z;
        yaws[idx] = yaw;
        norms[idx * 2] = r / (VINE_ROWS - 1); // 0 (west) .. 1 (east, dawn side!)
        norms[idx * 2 + 1] = s / (STATIONS_PER_ROW - 1); // 0 (foreground) .. 1 (horizon)
        idx++;
      }
    }
    return { coords, yaws, norms };
  }, []);

  const materials = useMemo(() => {
    const porcelainMat = new THREE.MeshPhysicalMaterial({
      color: '#edf2ff',
      roughness: 0.22,
      metalness: 0.04,
      clearcoat: 0.66,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.28,
    });
    const enamelMat = new THREE.MeshPhysicalMaterial({
      color: '#223feb',
      emissive: '#0e1eb5',
      emissiveIntensity: 0.20,
      roughness: 0.18,
      metalness: 0.24,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.45,
    });
    const contourLineMat = new THREE.LineBasicMaterial({
      color: '#5f7dff',
      transparent: true,
      opacity: 0.34,
    });
    const wireLineMat = new THREE.LineBasicMaterial({
      color: '#2e4bff',
      transparent: true,
      opacity: 0.38,
    });
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    const mistMats = VALLEY_MIST_LAYERS.map(
      (l) =>
        new THREE.ShaderMaterial({
          vertexShader: mistVertex,
          fragmentShader: mistFragment,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          uniforms: {
            uTime: { value: 0 },
            uMotion: { value: 1 },
            uSeed: { value: l.seed },
            uPart: { value: 0.25 },
            uBaseDensity: { value: l.density },
            uOpacity: { value: 1 },
          },
        }),
    );
    return {
      porcelainMat,
      enamelMat,
      contourLineMat,
      wireLineMat,
      shadowMat,
      mistMats,
    };
  }, []);

  /* Populate static trellis posts once on mount */
  useEffect(() => {
    const postInst = postInstRef.current;
    if (!postInst) return;
    for (let i = 0; i < TOTAL_STATIONS; i++) {
      _pos.set(
        stationTable.coords[i * 3],
        stationTable.coords[i * 3 + 1],
        stationTable.coords[i * 3 + 2],
      );
      _euler.set(0, stationTable.yaws[i], 0);
      _quat.setFromEuler(_euler);
      _scale.set(1, 1, 1);
      _mat4.compose(_pos, _quat, _scale);
      postInst.setMatrixAt(i, _mat4);
    }
    postInst.instanceMatrix.needsUpdate = true;
  }, [stationTable]);

  useEffect(() => {
    return () => {
      Object.values(geos).forEach((v) => {
        if (v instanceof THREE.BufferGeometry) v.dispose();
      });
      materials.porcelainMat.dispose();
      materials.enamelMat.dispose();
      materials.contourLineMat.dispose();
      materials.wireLineMat.dispose();
      materials.shadowMat.dispose();
      materials.mistMats.forEach((m) => m.dispose());
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
    let targetX = q.compact ? 0.0 : 1.92;
    let targetY = q.compact ? -0.78 : -0.18;
    let targetZ = q.compact ? -0.58 : -0.22;
    let targetScale = q.compact ? 0.48 : 0.80;
    let targetRotY = q.compact ? -0.18 : -0.28;
    let targetRotX = 0.17;

    if (anim) {
      const preX = q.compact ? 0.0 : 1.92 + 0.24 * statsBeat;
      const preY = q.compact ? -0.78 + 0.28 * statsBeat : -0.18 + 0.46 * statsBeat;
      const preZ = q.compact ? -0.58 : -0.22 - 0.36 * statsBeat;
      const preScale = q.compact ? 0.48 : 0.80 - 0.05 * statsBeat;
      const preRotY = -0.28 - 0.08 * statsBeat;

      /* Moment dwell: centered vineyard valley corridor */
      const momX = 0.0;
      const momY = q.compact ? -0.14 : -0.08;
      const momZ = q.compact ? -0.10 : 0.28;
      const momScale = q.compact ? 0.64 : 0.98;
      const momRotY = -0.12 + 0.24 * smooth(stage.t);

      /* Post-moment: frames right/left editorial layout */
      const gridLift = Math.max(anglesBeat, buildBeat);
      const postX = q.compact
        ? 0.0
        : 2.16 -
          0.14 * featureActive -
          4.18 * featureMidSway +
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
        -0.30 + 0.12 * featureActive + 0.60 * featureMidSway + 0.12 * buildBeat + 0.08 * ctaBeat;

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
      targetRotX = THREE.MathUtils.lerp(0.17, 0.08, focus);
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

    if (valleyGroupRef.current) {
      const vIntro = anim ? smooth(sectionRange(intro, 0.0, 0.9)) : 1;
      valleyGroupRef.current.scale.y = Math.max(0.001, vIntro);
      valleyGroupRef.current.position.y = (1 - vIntro) * -0.35;
    }

    /* --------------------------------------------------------------------
       2. MIST PARTING, DAWN LIGHT SWEEP & VINE / CLUSTER EMERGENCE
       -------------------------------------------------------------------- */
    const momentSweep = smooth(sectionRange(stage.t, 0.04, 0.94));
    const desiredMistPart = anim
      ? THREE.MathUtils.lerp(0.22 + 0.45 * outM + 0.25 * anglesBeat, momentSweep, focus)
      : 0.85;
    const desiredEmergence = anim
      ? THREE.MathUtils.lerp(0.55 + 0.40 * outM, 0.12 + 0.88 * momentSweep, focus)
      : 1.0;

    L.mistPart = anim ? damp(L.mistPart, desiredMistPart, 5.0, dt) : 0.85;
    L.emergence = anim ? damp(L.emergence, desiredEmergence, 5.5, dt) : 1.0;

    for (let i = 0; i < VALLEY_MIST_LAYERS.length; i++) {
      const mat = materials.mistMats[i];
      const spec = VALLEY_MIST_LAYERS[i];
      mat.uniforms.uTime.value = anim ? el : 2.0;
      mat.uniforms.uMotion.value = anim ? 1 : 0;
      mat.uniforms.uPart.value = L.mistPart;
      mat.uniforms.uBaseDensity.value = spec.density * (1 - L.mistPart * 0.38);
      mat.uniforms.uOpacity.value = intro;
    }

    /* Instanced crystal vine canopies + luminous cluster nodes emerging down-valley
       as the raking eastern dawn light sweeps from east (rowNorm=1) to west (rowNorm=0) */
    const canopyInst = canopyInstRef.current;
    const clusterInst = clusterInstRef.current;
    if (canopyInst && clusterInst) {
      for (let i = 0; i < TOTAL_STATIONS; i++) {
        const bx = stationTable.coords[i * 3];
        const by = stationTable.coords[i * 3 + 1];
        const bz = stationTable.coords[i * 3 + 2];
        const yaw = stationTable.yaws[i];
        const eastWeight = 1 - stationTable.norms[i * 2]; // 0 on east dawn ridge -> 1 on west
        const depthWeight = stationTable.norms[i * 2 + 1]; // 0 foreground -> 1 horizon

        const threshold = eastWeight * 0.34 + depthWeight * 0.36;
        const localGrow = THREE.MathUtils.clamp((L.emergence * 1.38 - threshold) / 0.48, 0.08, 1.0);
        const easedGrow = localGrow * localGrow * (3 - 2 * localGrow) * intro;

        const breeze = anim ? Math.sin(el * 1.4 + i * 0.37) * 0.035 : 0;
        _pos.set(bx, by, bz);
        _euler.set(0, yaw, breeze);
        _quat.setFromEuler(_euler);
        _scale.set(0.45 + 0.55 * easedGrow, 0.35 + 0.65 * easedGrow, 0.65 + 0.35 * easedGrow);
        _mat4.compose(_pos, _quat, _scale);
        canopyInst.setMatrixAt(i, _mat4);

        /* Two luminous sapphire cluster nodes beneath each cordon */
        const clusterScale = Math.max(0.001, THREE.MathUtils.clamp((easedGrow - 0.18) / 0.82, 0.02, 1.0));
        const sinY = Math.sin(yaw);
        const cosY = Math.cos(yaw);
        for (let c = 0; c < CLUSTERS_PER_STATION; c++) {
          const along = c === 0 ? -0.052 : 0.052;
          const bob = anim ? Math.sin(el * 1.8 + i * 0.9 + c * 2.1) * 0.004 : 0;
          _pos.set(bx + sinY * along, by + 0.088 + bob, bz + cosY * along);
          _euler.set(0, yaw + c * 0.8, 0);
          _quat.setFromEuler(_euler);
          _scale.setScalar(clusterScale);
          _mat4.compose(_pos, _quat, _scale);
          clusterInst.setMatrixAt(i * CLUSTERS_PER_STATION + c, _mat4);
        }
      }
      canopyInst.instanceMatrix.needsUpdate = true;
      clusterInst.instanceMatrix.needsUpdate = true;
    }

    /* Raking eastern dawn directional light & prism sun orb */
    const dawnArc = anim
      ? THREE.MathUtils.clamp(0.18 + 0.68 * L.mistPart + 0.14 * anglesBeat, 0.15, 0.95)
      : 0.72;
    const sunX = THREE.MathUtils.lerp(2.45, 1.45, dawnArc);
    const sunY = VALLEY_Y + 0.72 + Math.sin(dawnArc * Math.PI * 0.72) * 1.05;
    const sunZ = -2.25;

    if (sunGroupRef.current) {
      sunGroupRef.current.position.set(sunX, sunY, sunZ);
      sunGroupRef.current.rotation.y = anim ? el * 0.2 : 0.3;
    }
    if (dawnLightRef.current) {
      dawnLightRef.current.position.set(sunX * 2.2, sunY * 1.8 + 0.6, sunZ);
      dawnLightRef.current.intensity = 0.85 + 0.95 * dawnArc;
    }

    if (estateAnchorRef.current) {
      reportHotspot(estateAnchorRef.current, state.camera, 0.55 + 0.35 * focus);
    }

    /* --------------------------------------------------------------------
       3. CAMERA GLIDE OVER THE VINEYARD CORRIDOR DURING `MOMENT`
       -------------------------------------------------------------------- */
    const glide = smooth(sectionRange(stage.t, 0.04, 0.96));
    const momCamX = THREE.MathUtils.lerp(-0.18, 0.16, glide) + L.px * 0.22;
    const momCamY = THREE.MathUtils.lerp(0.16, 0.64, glide) + L.py * 0.14;
    const momCamZ = THREE.MathUtils.lerp(5.35, 3.85, glide);

    const momLookX = THREE.MathUtils.lerp(0.08, 0.24, glide);
    const momLookY = THREE.MathUtils.lerp(-0.32, -0.14, glide);
    const momLookZ = THREE.MathUtils.lerp(-0.45, -1.35, glide);

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
      {/* Raking eastern dawn light grazing the contour terraces and crystal trellises */}
      <directionalLight ref={dawnLightRef} position={[4.5, 1.4, -2.2]} intensity={1.4} color="#dce6ff" />

      <group ref={rigRef}>
        <mesh
          material={materials.shadowMat}
          position={[0, VALLEY_Y - 0.14, -0.32]}
          rotation-x={-Math.PI / 2}
          renderOrder={-2}
        >
          <planeGeometry args={[6.4, 5.4]} />
        </mesh>

        <group ref={valleyGroupRef}>
          {/* Rolling Napa Valley Topographic Bowl & Flanking Ridge Terraces */}
          <mesh geometry={geos.terrainGeo}>
            <GradientGlassMaterial
              ice="#eef3ff"
              azure="#94acff"
              electric="#2e4bff"
              deep="#1226c8"
              opacity={0.94}
              sheen={0.72}
            />
          </mesh>
          <lineSegments geometry={geos.contourLinesGeo} material={materials.contourLineMat} />
          <lineSegments geometry={geos.trellisWiresGeo} material={materials.wireLineMat} />

          {/* Rutherford Bench Glass Tasting Estate */}
          <mesh geometry={geos.estatePorcelainGeo} material={materials.porcelainMat} />
          <mesh geometry={geos.estateEnamelGeo} material={materials.enamelMat} />
          <mesh geometry={geos.estateGlassGeo}>
            <GlassMaterial kind="crystal" />
          </mesh>
          <object3D ref={estateAnchorRef} position={geos.estateCrestPos} />

          {/* 176 Instanced Vineyard Trellis Posts + Crystal Vine Canopies + 352 Cluster Nodes */}
          <instancedMesh
            ref={postInstRef}
            args={[geos.postGeo, materials.enamelMat, TOTAL_STATIONS]}
            frustumCulled={false}
          />
          <instancedMesh
            ref={canopyInstRef}
            args={[geos.canopyGeo, undefined, TOTAL_STATIONS]}
            frustumCulled={false}
          >
            <GlassMaterial kind="crystal" />
          </instancedMesh>
          <instancedMesh
            ref={clusterInstRef}
            args={[geos.clusterGeo, undefined, TOTAL_CLUSTERS]}
            frustumCulled={false}
          >
            <GlassMaterial kind="deep" emissive="#2e4bff" emissiveIntensity={0.48} />
          </instancedMesh>
        </group>

        {/* Low Morning Mist Strata Parting & Receding Down-Valley */}
        {VALLEY_MIST_LAYERS.map((l, i) => (
          <mesh
            key={l.seed}
            material={materials.mistMats[i]}
            position={[0, l.y, -0.32]}
            rotation-x={-Math.PI / 2}
            renderOrder={2 + i}
          >
            <planeGeometry args={[l.w, l.d, 24, 24]} />
          </mesh>
        ))}

        {/* Raking Dawn Sun Rising Over the Vaca Ridge */}
        <group ref={sunGroupRef} position={[1.85, 0.85, -2.25]}>
          <mesh>
            <sphereGeometry args={[0.21, 32, 24]} />
            <GlassMaterial kind="prism" emissive="#2e4bff" emissiveIntensity={0.42} />
          </mesh>
          <mesh rotation-x={Math.PI / 2.6} material={materials.enamelMat}>
            <torusGeometry args={[0.34, 0.007, 8, 36]} />
          </mesh>
        </group>
      </group>

      <ParticleField
        count={Math.floor(820 * q.particles)}
        drift={q.animate ? 0.07 : 0}
        opacity={0.22}
      />
    </>
  );
}
