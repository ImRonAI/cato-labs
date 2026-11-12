'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import { getSectionProgress, pointer, sectionRange, smooth } from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { createStageState, damp, readStage } from '../lib-a/dwell';
import { contactShadowTexture } from '../lib-a/place';
import {
  LAKE_Y,
  LATTICE_COLS,
  LATTICE_NODE_COUNT,
  LATTICE_ROWS,
  buildWasatchAndSlopesGeometries,
  latticeNodeCoord,
} from './salt-lake-city/geometries';

/**
 * SaltLakeCityScene — "The Wasatch Alpenglow & Silicon Slopes Lattice"
 *
 * Steep faceted Wasatch Front alpine peaks in refractive crystal soar above
 * the glassy Great Salt Lake mirror plane and the triangulated Silicon Slopes
 * corridor lattice.
 *
 * During `moment` (0 → 1), an ice-to-electric-blue alpenglow sweep washes
 * across the angular alpine facets (and mirrors in the Great Salt Lake below)
 * while the camera ascends up the mountain face from the lake mirror toward
 * the dispersive Summit Spire, revealing the glowing Silicon Slopes light
 * lattice stretching south along the corridor.
 *
 * Hotspot 'slc-skyline' rides the Summit Spire apex.
 * Zero allocations inside useFrame; < 20 draw calls; full reduced-motion support.
 */

const alpenglowVertex = /* glsl */ `
  varying vec3 vNormalL;
  varying vec3 vLocalPos;
  varying vec3 vViewDir;

  void main() {
    vLocalPos = position;
    vNormalL = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const alpenglowFragment = /* glsl */ `
  uniform float uSweep;
  uniform float uOpacity;
  uniform float uLakeY;
  varying vec3 vNormalL;
  varying vec3 vLocalPos;
  varying vec3 vViewDir;

  void main() {
    vec3 n = normalize(vNormalL);
    vec3 v = normalize(vViewDir);
    float fres = pow(1.0 - abs(dot(n, v)), 1.6);

    float elev = clamp((vLocalPos.y - uLakeY) / 2.08, 0.0, 1.0);
    /* Facet directional catch from western Great Salt Lake sun */
    float westCatch = clamp(dot(n, normalize(vec3(-0.65, 0.55, 0.52))), 0.0, 1.0);

    /* Sweeping alpenglow wave traveling along X (-1.6 -> +1.8) and ascending Y */
    float sweepCenter = mix(-1.45, 1.65, uSweep);
    float horizBand = exp(-pow((vLocalPos.x - sweepCenter) * 1.15, 2.0));
    float snowLine = smoothstep(0.32 - 0.15 * uSweep, 0.88, elev);
    float alpen = clamp((0.35 + 0.65 * horizBand) * snowLine * (0.45 + 0.55 * westCatch), 0.0, 1.0);

    vec3 baseShadow = vec3(0.56, 0.69, 0.99);
    vec3 iceSnow = vec3(0.93, 0.96, 1.0);
    vec3 electricGlow = vec3(0.18, 0.29, 1.0);
    vec3 deepSapphire = vec3(0.07, 0.15, 0.78);

    vec3 col = mix(baseShadow, iceSnow, smoothstep(0.18, 0.72, elev));
    /* Ice-to-electric-blue alpenglow wash across high facets */
    col = mix(col, electricGlow, alpen * 0.78);
    col = mix(col, vec3(0.97, 0.99, 1.0), pow(alpen, 2.2) * 0.65);
    col = mix(col, deepSapphire, smoothstep(0.72, 1.0, fres) * 0.45);

    gl_FragColor = vec4(col, 0.94 * uOpacity);
  }
`;

const lakeMirrorVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vLocalPos;

  void main() {
    vUv = uv;
    vLocalPos = vec3(position.x, 0.0, -position.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lakeMirrorFragment = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uSweep;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vLocalPos;

  void main() {
    vec2 c = (vUv - 0.5) * 2.0;
    float outerMask = 1.0 - smoothstep(0.68, 1.0, length(c * vec2(0.88, 0.92)));
    if (outerMask < 0.004) discard;

    /* Great Salt Lake occupies the western basin (vLocalPos.x < -0.15);
       eastern half is the porcelain Salt Lake / Utah Valley floor */
    float lakeEdge = -0.22 + 0.18 * sin(vLocalPos.z * 2.1);
    float inLake = 1.0 - smoothstep(lakeEdge - 0.18, lakeEdge + 0.12, vLocalPos.x);

    /* Ultra-fine glassy saline ripples on the lake */
    float ripple = sin(vLocalPos.z * 22.0 + uTime * 0.9 * uMotion) * 0.5 + 0.5;
    float sweepCenter = mix(-1.45, 1.65, uSweep);
    float reflBand = exp(-pow((vLocalPos.x + 0.55 - sweepCenter * 0.45) * 1.2, 2.0));

    /* Salt-flat shoreline crystalline frost band */
    float saltRim = exp(-pow((vLocalPos.x - lakeEdge) * 6.5, 2.0));

    vec3 valleyFloor = vec3(0.94, 0.96, 1.0);
    vec3 mirrorIce = vec3(0.84, 0.90, 1.0);
    vec3 mirrorElectric = vec3(0.24, 0.38, 1.0);

    vec3 lakeCol = mix(mirrorIce, mirrorElectric, 0.28 + 0.52 * reflBand + 0.08 * ripple);
    lakeCol = mix(lakeCol, vec3(0.98, 0.99, 1.0), saltRim * 0.75);

    vec3 col = mix(valleyFloor, lakeCol, inLake);
    float alpha = outerMask * mix(0.46, 0.72, inLake) * uOpacity;
    gl_FragColor = vec4(col, alpha);
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

const _colRest = new THREE.Color('#9db2ff');
const _colGlow = new THREE.Color('#2e4bff');
const _colHot = new THREE.Color('#eef4ff');

export default function SaltLakeCityScene() {
  const q = useQuality();

  const rigRef = useRef<THREE.Group>(null);
  const mountainGroupRef = useRef<THREE.Group>(null);
  const spireAnchorRef = useRef<THREE.Object3D>(null);
  const spireBeaconRef = useRef<THREE.Mesh>(null);
  const slopesNodeInstRef = useRef<THREE.InstancedMesh>(null);

  const stage = useMemo(createStageState, []);
  const reportHotspot = useHotspotReporter('slc-skyline');

  const live = useRef({
    px: 0,
    py: 0,
    rigX: 1.92,
    rigY: -0.18,
    rigZ: -0.22,
    rigScale: 0.80,
    rigRotY: -0.24,
    rigRotX: 0.16,
    sweep: 0.35,
    latticePulse: 0.4,
    camX: 0,
    camY: 0.22,
    camZ: 9.0,
    lookX: 0,
    lookY: 0,
    lookZ: 0,
  });

  const geos = useMemo(() => buildWasatchAndSlopesGeometries(), []);

  /* Precompute 168 Silicon Slopes lattice coordinates once */
  const latticeTable = useMemo(() => {
    const coords = new Float32Array(LATTICE_NODE_COUNT * 3);
    const corridorProgress = new Float32Array(LATTICE_NODE_COUNT);
    const tmp = new THREE.Vector3();
    let idx = 0;
    for (let r = 0; r < LATTICE_ROWS; r++) {
      for (let c = 0; c < LATTICE_COLS; c++) {
        latticeNodeCoord(c, r, tmp);
        coords[idx * 3] = tmp.x;
        coords[idx * 3 + 1] = tmp.y;
        coords[idx * 3 + 2] = tmp.z;
        corridorProgress[idx] = c / (LATTICE_COLS - 1);
        idx++;
      }
    }
    return { coords, corridorProgress };
  }, []);

  const materials = useMemo(() => {
    const porcelainMat = new THREE.MeshPhysicalMaterial({
      color: '#edf2ff',
      roughness: 0.20,
      metalness: 0.04,
      clearcoat: 0.68,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.3,
    });
    const enamelMat = new THREE.MeshPhysicalMaterial({
      color: '#223feb',
      emissive: '#0d1cb0',
      emissiveIntensity: 0.24,
      roughness: 0.16,
      metalness: 0.26,
      clearcoat: 0.92,
      envMapIntensity: 1.48,
    });
    const ridgeEdgeMat = new THREE.LineBasicMaterial({
      color: '#2e4bff',
      transparent: true,
      opacity: 0.38,
    });
    const latticeLineMat = new THREE.LineBasicMaterial({
      color: '#4f6dff',
      transparent: true,
      opacity: 0.32,
    });
    const nodeMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      emissive: '#2e4bff',
      emissiveIntensity: 0.44,
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
    const alpenglowFacetMat = new THREE.ShaderMaterial({
      vertexShader: alpenglowVertex,
      fragmentShader: alpenglowFragment,
      transparent: true,
      depthWrite: true,
      uniforms: {
        uSweep: { value: 0.35 },
        uOpacity: { value: 1 },
        uLakeY: { value: LAKE_Y },
      },
    });
    const lakeMirrorMat = new THREE.ShaderMaterial({
      vertexShader: lakeMirrorVertex,
      fragmentShader: lakeMirrorFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uMotion: { value: 1 },
        uSweep: { value: 0.35 },
        uOpacity: { value: 1 },
      },
    });

    return {
      porcelainMat,
      enamelMat,
      ridgeEdgeMat,
      latticeLineMat,
      nodeMat,
      shadowMat,
      alpenglowFacetMat,
      lakeMirrorMat,
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
    let targetY = q.compact ? -0.80 : -0.20;
    let targetZ = q.compact ? -0.58 : -0.24;
    let targetScale = q.compact ? 0.48 : 0.80;
    let targetRotY = q.compact ? -0.18 : -0.24;
    let targetRotX = 0.16;

    if (anim) {
      const preX = q.compact ? 0.0 : 1.94 + 0.22 * statsBeat;
      const preY = q.compact ? -0.80 + 0.28 * statsBeat : -0.20 + 0.46 * statsBeat;
      const preZ = q.compact ? -0.58 : -0.24 - 0.36 * statsBeat;
      const preScale = q.compact ? 0.48 : 0.80 - 0.05 * statsBeat;
      const preRotY = -0.24 - 0.10 * statsBeat;

      const momX = 0.0;
      const momY = q.compact ? -0.18 : -0.14;
      const momZ = q.compact ? -0.10 : 0.28;
      const momScale = q.compact ? 0.62 : 0.98;
      const momRotY = -0.16 + 0.32 * smooth(stage.t);

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
        ? -0.70 + 0.14 * ctaBeat
        : 0.12 - 0.34 * featureActive + 0.42 * gridLift + 0.22 * faqBeat + 0.12 * ctaBeat;
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
      targetRotX = THREE.MathUtils.lerp(0.16, 0.10, focus);
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

    if (mountainGroupRef.current) {
      const mIntro = anim ? smooth(sectionRange(intro, 0.0, 0.9)) : 1;
      mountainGroupRef.current.scale.y = Math.max(0.001, mIntro);
      mountainGroupRef.current.position.y = (1 - mIntro) * -0.42;
    }

    /* --------------------------------------------------------------------
       2. ALPENGLOW SWEEP, GREAT SALT LAKE MIRROR & SILICON SLOPES LATTICE
       -------------------------------------------------------------------- */
    const momentSweep = smooth(sectionRange(stage.t, 0.04, 0.95));
    const desiredSweep = anim
      ? THREE.MathUtils.lerp(0.28 + 0.58 * anglesBeat + 0.14 * outM, momentSweep, focus)
      : 0.56;
    const desiredLattice = anim
      ? THREE.MathUtils.lerp(0.35 + 0.55 * outM + 0.10 * buildBeat, 0.20 + 0.80 * momentSweep, focus)
      : 0.88;

    L.sweep = anim ? damp(L.sweep, desiredSweep, 5.5, dt) : 0.56;
    L.latticePulse = anim ? damp(L.latticePulse, desiredLattice, 5.5, dt) : 0.88;

    materials.alpenglowFacetMat.uniforms.uSweep.value = L.sweep;
    materials.alpenglowFacetMat.uniforms.uOpacity.value = intro;

    materials.lakeMirrorMat.uniforms.uTime.value = anim ? el : 1.5;
    materials.lakeMirrorMat.uniforms.uMotion.value = anim ? 1 : 0;
    materials.lakeMirrorMat.uniforms.uSweep.value = L.sweep;
    materials.lakeMirrorMat.uniforms.uOpacity.value = intro;

    materials.latticeLineMat.opacity = (0.18 + 0.34 * L.latticePulse) * intro;

    /* Update 168 Instanced Silicon Slopes Light Lattice Nodes */
    const slopesInst = slopesNodeInstRef.current;
    if (slopesInst) {
      _quat.identity();
      for (let i = 0; i < LATTICE_NODE_COUNT; i++) {
        const nx = latticeTable.coords[i * 3];
        const ny = latticeTable.coords[i * 3 + 1];
        const nz = latticeTable.coords[i * 3 + 2];
        const corr = latticeTable.corridorProgress[i];

        const reach = THREE.MathUtils.clamp((L.latticePulse * 1.42 - corr * 0.65) / 0.45, 0, 1);
        const wave = Math.exp(-Math.pow((L.sweep - corr) * 3.4, 2));
        const pulse = anim ? 0.10 * Math.sin(el * 2.2 + i * 0.35) * reach : 0;

        const sXZ = (0.42 + 0.62 * reach + 0.24 * wave) * intro;
        const sY = (0.40 + 0.95 * reach + 0.55 * wave + pulse) * intro;

        _pos.set(nx, ny + sY * 0.016, nz);
        _scale.set(sXZ, sY, sXZ);
        _mat4.compose(_pos, _quat, _scale);
        slopesInst.setMatrixAt(i, _mat4);

        _color.copy(_colRest).lerp(_colGlow, reach).lerp(_colHot, wave * 0.7);
        slopesInst.setColorAt(i, _color);
      }
      slopesInst.instanceMatrix.needsUpdate = true;
      if (slopesInst.instanceColor) slopesInst.instanceColor.needsUpdate = true;
    }

    if (spireBeaconRef.current) {
      spireBeaconRef.current.rotation.y = anim ? el * 0.6 : 0.4;
    }

    if (spireAnchorRef.current) {
      reportHotspot(spireAnchorRef.current, state.camera, 0.55 + 0.35 * focus);
    }

    /* --------------------------------------------------------------------
       3. CAMERA ASCENT UP THE WASATCH FACE TOWARD THE SUMMIT SPIRE
       -------------------------------------------------------------------- */
    const climb = smooth(sectionRange(stage.t, 0.05, 0.96));
    /* Start low above the Great Salt Lake mirror plane on the west (-X),
       ascending steeply up the Wasatch alpine face toward the Summit Spire
       and tilting to frame the Silicon Slopes light lattice along the corridor! */
    const momCamX = THREE.MathUtils.lerp(-0.82, 0.24, climb) + L.px * 0.22;
    const momCamY = THREE.MathUtils.lerp(-0.18, 1.38, climb) + L.py * 0.14;
    const momCamZ = THREE.MathUtils.lerp(5.25, 4.45, climb);

    const momLookX = THREE.MathUtils.lerp(-0.10, 0.22, climb);
    const momLookY = THREE.MathUtils.lerp(0.08, 0.38, climb);
    const momLookZ = THREE.MathUtils.lerp(-0.65, -0.35, climb);

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
        {/* Soft contact shadow & Great Salt Lake mirror plane + valley plinth */}
        <mesh
          material={materials.shadowMat}
          position={[0, LAKE_Y - 0.10, 0.10]}
          rotation-x={-Math.PI / 2}
          renderOrder={-2}
        >
          <planeGeometry args={[6.4, 5.0]} />
        </mesh>

        <mesh
          material={materials.lakeMirrorMat}
          position={[0, LAKE_Y, 0.12]}
          rotation-x={-Math.PI / 2}
          renderOrder={-1}
        >
          <planeGeometry args={[6.0, 4.6, 36, 36]} />
        </mesh>

        <group ref={mountainGroupRef}>
          {/* Steep Faceted Wasatch Alpine Peaks: Alpenglow Core + Refractive Crystal Shell */}
          <mesh geometry={geos.wasatchAlpenglowGeo} material={materials.alpenglowFacetMat} />
          <mesh geometry={geos.wasatchCrystalGeo}>
            <GlassMaterial kind="crystal" flatShading />
          </mesh>
          <lineSegments geometry={geos.wasatchEdgesGeo} material={materials.ridgeEdgeMat} />

          {/* Summit Spire, Downtown SLC & Point-of-the-Mountain Campuses */}
          <mesh geometry={geos.downtownPorcelainGeo} material={materials.porcelainMat} />
          <mesh geometry={geos.spireEnamelGeo} material={materials.enamelMat} />
          <mesh geometry={geos.spireGlassGeo}>
            <GlassMaterial kind="prism" />
          </mesh>

          {/* Orbiting Crystalline Beacon Ring at Summit Spire */}
          <mesh
            ref={spireBeaconRef}
            position={geos.summitSpirePos}
            rotation-x={Math.PI / 2.6}
            material={materials.enamelMat}
          >
            <torusGeometry args={[0.12, 0.006, 8, 32]} />
          </mesh>

          {/* Hotspot anchor at the Summit Spire apex */}
          <object3D ref={spireAnchorRef} position={geos.summitSpirePos} />

          {/* Silicon Slopes Geodesic Fiber Lattice + 168 Instanced Light Nodes */}
          <lineSegments geometry={geos.slopesLatticeLinesGeo} material={materials.latticeLineMat} />
          <instancedMesh
            ref={slopesNodeInstRef}
            args={[geos.nodeGeo, materials.nodeMat, LATTICE_NODE_COUNT]}
            frustumCulled={false}
          />
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
