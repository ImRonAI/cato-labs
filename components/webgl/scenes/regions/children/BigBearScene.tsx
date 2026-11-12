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
import CatoBody, { type CatoBodyHandle } from '../../../kit/cato/CatoBody';
import { createStageState, readStage, damp } from '../lib-a/dwell';
import { contactShadowTexture } from '../lib-a/place';
import {
  LAKE_Y,
  PLINTH_RX,
  PLINTH_RZ,
  buildChairliftData,
  buildMountainReliefGeo,
  buildPinePlacements,
  buildSnowboardRunCurve,
  buildTopoLinesGeo,
  terrainHeightAt,
} from './big-bear/AlpineGeometry';
import {
  createLakeMaterial,
  createSnowfallResources,
  createTerrainMaterial,
} from './big-bear/AlpineShaders';

/**
 * BigBearScene — "The Two-Season Alpine Basin: Twin Peaks, Big Air & Lakefront A-Frame".
 *
 * A crafted porcelain, frosted-crystal, and electric-blue architectural miniature
 * of Big Bear Valley:
 *   1. Snow Summit (8,200') & Bear Mountain (8,805') twin peaks in faceted slate-and-snow
 *      relief with exact marching-squares topographic contours and Summit Express chairlift.
 *   2. Big Bear Lake recessed in the foreground basin — frosted shoreline ice in winter,
 *      stone-skipping concentric ripples across deep sapphire water in summer (`uSeason`).
 *   3. Tiered alpine pine forest (instanced crystal-azure crowns) framing the shoreline
 *      and a glowing lakefront A-frame chalet, timber dock, and moored crystal skiff.
 *   4. Signature `moment` dwell (0 → 1): Cato the robot drops in from Snow Summit on a
 *      refractive crystal snowboard, carves an electric-blue track down the groomed piste,
 *      launches off the mid-slope kicker for a big-air 360° arc over the lake channel,
 *      and sticks the landing beside the glowing A-frame cabin.
 *   5. Multi-section choreography: shifts `uSeason` between winter snow and summer lake
 *      on `angles`, sways opposite alternating `feature` blocks, and warms the cabin
 *      hearth beacon across `build` and `detail`. Hotspot `'bb-skyline'` rides the cabin.
 */

const CHAIR_COUNT = 6;

const carveVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const carveFragment = /* glsl */ `
  uniform float uProgress;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    if (vUv.x > uProgress || uProgress <= 0.002) discard;
    float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
    float rails = smoothstep(0.55, 0.92, abs(vUv.y - 0.5) * 2.0);
    float head = smoothstep(uProgress - 0.12, uProgress, vUv.x);
    vec3 col = mix(vec3(0.38, 0.54, 1.0), vec3(0.11, 0.23, 0.96), rails);
    col = mix(col, vec3(0.92, 0.96, 1.0), head * 0.65);
    float alpha = (0.28 + 0.45 * rails + 0.25 * head) * smoothstep(0.0, 0.12, edge) * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

function mergeSimpleGeos(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalV = 0;
  let totalI = 0;
  for (const g of parts) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position as THREE.BufferAttribute;
    const idx = g.getIndex();
    totalV += pos.count;
    totalI += idx ? idx.count : pos.count;
  }
  const positions = new Float32Array(totalV * 3);
  const normals = new Float32Array(totalV * 3);
  const indices = new Uint32Array(totalI);
  let vOff = 0;
  let iOff = 0;
  for (const g of parts) {
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute;
    const idx = g.getIndex();
    for (let i = 0; i < pos.count; i++) {
      const o = (vOff + i) * 3;
      positions[o] = pos.getX(i);
      positions[o + 1] = pos.getY(i);
      positions[o + 2] = pos.getZ(i);
      if (nor) {
        normals[o] = nor.getX(i);
        normals[o + 1] = nor.getY(i);
        normals[o + 2] = nor.getZ(i);
      }
    }
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices[iOff + i] = idx.getX(i) + vOff;
      iOff += idx.count;
    } else {
      for (let i = 0; i < pos.count; i++) indices[iOff + i] = vOff + i;
      iOff += pos.count;
    }
    vOff += pos.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  return out;
}

function buildAlpineArchitecture(towerPositions: [number, number, number][]) {
  const porcelainParts: THREE.BufferGeometry[] = [];
  const enamelParts: THREE.BufferGeometry[] = [];
  const crystalParts: THREE.BufferGeometry[] = [];

  const box = (w: number, h: number, d: number, x: number, yBottom: number, z: number, ry = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry !== 0) g.rotateY(ry);
    g.translate(x, yBottom + h * 0.5, z);
    return g;
  };
  const cyl = (rt: number, rb: number, h: number, segs: number, x: number, yBottom: number, z: number) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, segs);
    g.translate(x, yBottom + h * 0.5, z);
    return g;
  };

  /* 1. Elliptical Porcelain Plinth & Bevel Rim */
  const baseSlab = new THREE.CylinderGeometry(1, 1, 0.14, 64);
  baseSlab.scale(PLINTH_RX, 1, PLINTH_RZ);
  baseSlab.translate(0, -0.07, 0);
  porcelainParts.push(baseSlab);

  const subRim = new THREE.CylinderGeometry(1, 1, 0.05, 64);
  subRim.scale(PLINTH_RX * 1.03, 1, PLINTH_RZ * 1.03);
  subRim.translate(0, -0.155, 0);
  enamelParts.push(subRim);

  /* 2. Summit Express Chairlift Towers & Terminals */
  for (let i = 0; i < towerPositions.length; i++) {
    const [tx, ty, tz] = towerPositions[i];
    // Tapered pylon mast
    enamelParts.push(cyl(0.014, 0.024, 0.35, 8, tx, ty - 0.02, tz));
    // Crossarm sheave assembly aligned perpendicular to lift line
    enamelParts.push(box(0.21, 0.018, 0.022, tx, ty + 0.33, tz, 0.68));
    porcelainParts.push(cyl(0.042, 0.052, 0.03, 10, tx, ty - 0.01, tz));
    if (i === 0 || i === towerPositions.length - 1) {
      // Bullwheel terminal station canopy
      const wheel = new THREE.CylinderGeometry(0.088, 0.088, 0.018, 20);
      wheel.translate(tx, ty + 0.34, tz);
      crystalParts.push(wheel);
    }
  }

  /* 3. Lakefront A-Frame Chalet Cabin at (1.16, z = 0.60) */
  const cx = 1.16;
  const cz = 0.60;
  const cy = terrainHeightAt(cx, cz);
  const cabRot = -0.52; // Angled toward Big Bear Lake & viewer

  // Timber/porcelain deck platform on piers
  porcelainParts.push(box(0.54, 0.045, 0.48, cx, cy - 0.01, cz, cabRot));

  // Steep-pitched A-frame triangular prism roof + recessed glass gable
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-0.21, 0);
  roofShape.lineTo(0, 0.36);
  roofShape.lineTo(0.21, 0);
  roofShape.lineTo(0.175, 0);
  roofShape.lineTo(0, 0.305);
  roofShape.lineTo(-0.175, 0);
  roofShape.closePath();

  const roofShell = new THREE.ExtrudeGeometry(roofShape, {
    depth: 0.38,
    bevelEnabled: false,
  });
  roofShell.translate(0, 0, -0.19);
  roofShell.rotateY(cabRot);
  roofShell.translate(cx, cy + 0.035, cz);
  enamelParts.push(roofShell);

  // Inner glass A-frame core
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-0.17, 0.01);
  glassShape.lineTo(0, 0.30);
  glassShape.lineTo(0.17, 0.01);
  glassShape.closePath();
  const glassCore = new THREE.ExtrudeGeometry(glassShape, {
    depth: 0.32,
    bevelEnabled: false,
  });
  glassCore.translate(0, 0, -0.16);
  glassCore.rotateY(cabRot);
  glassCore.translate(cx, cy + 0.035, cz);
  crystalParts.push(glassCore);

  // Chimney flue on east slope of roof
  porcelainParts.push(cyl(0.018, 0.022, 0.34, 8, cx + 0.11, cy + 0.08, cz - 0.04));

  /* 4. Shoreline Pier Dock & Moored Skiff on Big Bear Lake */
  const dockX = 0.44;
  const dockZ = 0.84;
  porcelainParts.push(box(0.42, 0.022, 0.11, dockX, LAKE_Y + 0.022, dockZ, -0.24));
  for (let p = -0.16; p <= 0.16; p += 0.16) {
    enamelParts.push(
      cyl(
        0.01,
        0.01,
        0.08,
        6,
        dockX + p * Math.cos(-0.24),
        LAKE_Y - 0.03,
        dockZ - p * Math.sin(-0.24),
      ),
    );
  }

  // Sculpted pine tree geometry for InstancedMesh (3 stacked crystal cones + trunk)
  const pineCones: THREE.BufferGeometry[] = [];
  const c1 = new THREE.ConeGeometry(0.11, 0.22, 7);
  c1.translate(0, 0.18, 0);
  pineCones.push(c1);
  const c2 = new THREE.ConeGeometry(0.088, 0.19, 7);
  c2.translate(0, 0.29, 0);
  pineCones.push(c2);
  const c3 = new THREE.ConeGeometry(0.062, 0.16, 7);
  c3.translate(0, 0.39, 0);
  pineCones.push(c3);

  const pineTrunk = new THREE.CylinderGeometry(0.014, 0.022, 0.11, 6);
  pineTrunk.translate(0, 0.055, 0);

  return {
    porcelainGeo: mergeSimpleGeos(porcelainParts),
    enamelGeo: mergeSimpleGeos(enamelParts),
    crystalGeo: mergeSimpleGeos(crystalParts),
    pineCrownGeo: mergeSimpleGeos(pineCones),
    pineTrunkGeo: pineTrunk,
    cabinPos: [cx, cy + 0.14, cz] as [number, number, number],
  };
}

/* Module-scope temporaries — zero allocation inside useFrame */
const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _curvePos = new THREE.Vector3();
const _curveTang = new THREE.Vector3();
const _curvePos2 = new THREE.Vector3();
const _curveTang2 = new THREE.Vector3();
const _cross = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _lookMat = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _spinQuat = new THREE.Quaternion();
const _bankQuat = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _dummyMat = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyScale = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();

export default function BigBearScene() {
  const q = useQuality();
  const rigRef = useRef<THREE.Group>(null);
  const catoRiderRef = useRef<THREE.Group>(null);
  const catoBodyRef = useRef<CatoBodyHandle>(null);
  const skiffRef = useRef<THREE.Group>(null);
  const cabinGlowRef = useRef<THREE.Mesh>(null);
  const cabinBeaconRef = useRef<THREE.Object3D>(null);
  const pineCrownInstRef = useRef<THREE.InstancedMesh>(null);
  const pineTrunkInstRef = useRef<THREE.InstancedMesh>(null);
  const chairRefs = useRef<(THREE.Group | null)[]>([]);

  const stage = useMemo(createStageState, []);
  const reportHotspot = useHotspotReporter('bb-skyline');

  const live = useRef({
    rx: 1.85,
    ry: -0.28,
    rz: 0.15,
    rs: 0.82,
    rotX: 0.24,
    rotY: -0.28,
    season: 0.86,
    riderU: 0.02,
    hearth: 0.35,
    svgHidden: false,
  });

  const geos = useMemo(() => {
    const mountainGeo = buildMountainReliefGeo(q.compact ? 64 : 88, q.compact ? 52 : 72);
    const topoLinesGeo = buildTopoLinesGeo();
    const run = buildSnowboardRunCurve();
    const chairlift = buildChairliftData();
    const pines = buildPinePlacements();
    const arch = buildAlpineArchitecture(chairlift.towerPositions);

    const lakePlaneGeo = new THREE.PlaneGeometry(3.1, 1.6, 1, 1);
    lakePlaneGeo.rotateX(-Math.PI / 2);
    lakePlaneGeo.translate(-0.48, LAKE_Y, 0.86);

    return {
      mountainGeo,
      topoLinesGeo,
      ...run,
      chairlift,
      pines,
      ...arch,
      lakePlaneGeo,
    };
  }, [q.compact]);

  const snowCount = Math.max(48, Math.floor((q.compact ? 320 : 620) * q.particles));
  const shaders = useMemo(() => {
    const terrainMat = createTerrainMaterial();
    const lakeMat = createLakeMaterial();
    const snowfall = createSnowfallResources(snowCount);
    const carveMat = new THREE.ShaderMaterial({
      vertexShader: carveVertex,
      fragmentShader: carveFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uProgress: { value: 0 },
        uOpacity: { value: 1 },
      },
    });
    return { terrainMat, lakeMat, snowfall, carveMat };
  }, [snowCount]);

  const mats = useMemo(() => {
    const shadowTex = typeof document !== 'undefined' ? contactShadowTexture() : null;
    return {
      porcelain: new THREE.MeshPhysicalMaterial({
        color: '#eef3ff',
        roughness: 0.22,
        metalness: 0.04,
        clearcoat: 0.7,
        clearcoatRoughness: 0.16,
      }),
      enamel: new THREE.MeshPhysicalMaterial({
        color: '#1e38db',
        emissive: '#0d1ba8',
        emissiveIntensity: 0.22,
        roughness: 0.2,
        metalness: 0.24,
        clearcoat: 0.85,
      }),
      pineCrown: new THREE.MeshPhysicalMaterial({
        color: '#2e4bff',
        emissive: '#1226c8',
        emissiveIntensity: 0.2,
        roughness: 0.26,
        metalness: 0.1,
        clearcoat: 0.7,
      }),
      pineTrunk: new THREE.MeshPhysicalMaterial({
        color: '#4e68e6',
        roughness: 0.34,
        metalness: 0.06,
      }),
      topoLine: new THREE.LineBasicMaterial({
        color: '#5f7dff',
        transparent: true,
        opacity: 0.32,
      }),
      arcLine: new THREE.LineBasicMaterial({
        color: '#2e4bff',
        transparent: true,
        opacity: 0.55,
      }),
      cableLine: new THREE.LineBasicMaterial({
        color: '#1226c8',
        transparent: true,
        opacity: 0.68,
      }),
      hearthGlow: new THREE.MeshBasicMaterial({
        color: new THREE.Color('#4a6bff').multiplyScalar(1.9),
        transparent: true,
        opacity: 0.55,
        toneMapped: false,
      }),
      shadow: new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
      }),
    };
  }, []);

  useEffect(() => {
    const crownMesh = pineCrownInstRef.current;
    const trunkMesh = pineTrunkInstRef.current;
    if (!crownMesh || !trunkMesh) return;
    for (let i = 0; i < geos.pines.length; i++) {
      const p = geos.pines[i];
      _dummyPos.set(p.x, p.y, p.z);
      _dummyQuat.setFromAxisAngle(_up, p.ry);
      _dummyScale.setScalar(p.s);
      _dummyMat.compose(_dummyPos, _dummyQuat, _dummyScale);
      crownMesh.setMatrixAt(i, _dummyMat);
      trunkMesh.setMatrixAt(i, _dummyMat);
    }
    crownMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.instanceMatrix.needsUpdate = true;
  }, [geos.pines]);

  useEffect(() => {
    return () => {
      geos.mountainGeo.dispose();
      geos.topoLinesGeo.dispose();
      geos.carveRibbonGeo.dispose();
      geos.jumpArcGeo.dispose();
      geos.chairlift.cableGeo.dispose();
      geos.porcelainGeo.dispose();
      geos.enamelGeo.dispose();
      geos.crystalGeo.dispose();
      geos.pineCrownGeo.dispose();
      geos.pineTrunkGeo.dispose();
      geos.lakePlaneGeo.dispose();
      shaders.terrainMat.dispose();
      shaders.lakeMat.dispose();
      shaders.snowfall.geo.dispose();
      shaders.snowfall.mat.dispose();
      shaders.carveMat.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [geos, shaders, mats]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const compact = q.compact;
    readStage(stage, q);

    const core = catoBodyRef.current?.core;
    if (core && !live.current.svgHidden) {
      core.svg.style.display = 'none';
      live.current.svgHidden = true;
    }

    const pStats = smooth(sectionRange(getSectionProgress('stats'), 0.08, 0.78));
    const pAngles = getSectionProgress('angles');
    const pFeature = getSectionProgress('feature');
    const pBuild = smooth(sectionRange(getSectionProgress('build'), 0.05, 0.85));
    const pDetail = smooth(sectionRange(getSectionProgress('detail'), 0.05, 0.85));
    const pFaq = smooth(sectionRange(getSectionProgress('faq'), 0.05, 0.85));
    const pCta = smooth(sectionRange(getSectionProgress('cta'), 0.05, 0.82));

    const anglesBeat = smooth(sectionRange(pAngles, 0.08, 0.82));
    const featureActive =
      smooth(sectionRange(pFeature, 0.05, 0.25)) *
      (1 - smooth(sectionRange(pFeature, 0.82, 0.98)));
    /* Feature 02 is right-aligned in bbr-feature:nth-child(even) -> sway scene left */
    const featureMidSway =
      smooth(sectionRange(pFeature, 0.34, 0.48)) *
      (1 - smooth(sectionRange(pFeature, 0.64, 0.78)));

    const intro = anim ? smooth(Math.min(el / 1.6, 1)) : 1;
    const L = live.current;

    /* ------------------------------------------------------------------
       1. MULTI-BEAT STAGE PLACEMENT ACROSS THE ENTIRE PAGE
       ------------------------------------------------------------------ */
    let wantX = compact ? 0.02 : 1.92;
    let wantY = compact ? -0.98 : -0.32;
    let wantZ = compact ? -0.55 : 0.10;
    let wantS = compact ? 0.44 : 0.84;
    let wantRotX = 0.24;
    let wantRotY = -0.28;

    if (anim) {
      const preX = compact ? 0.02 : 1.92 - 0.14 * pStats;
      const preY = compact ? -0.98 + 0.22 * pStats : -0.32 + 0.26 * pStats;
      const preZ = compact ? -0.55 : 0.10 - 0.15 * pStats;
      const preS = compact ? 0.44 : 0.84;
      const preRotY = -0.28 - 0.10 * pStats;

      /* Moment dwell: centered full-stage alpine basin showcase */
      const momX = compact ? 0.0 : -0.04;
      const momY = compact ? -0.26 : -0.38;
      const momZ = compact ? 0.05 : 0.72;
      const momS = compact ? 0.50 : 1.02;
      const momRotY = -0.34 + 0.44 * smooth(stage.t);

      /* Post-moment: right-column stage, swaying left for Feature 02, zooming cabin on Build/Detail */
      const gridLift = Math.max(anglesBeat, pBuild);
      const postX = compact
        ? 0.02
        : 1.96 -
          3.65 * featureMidSway +
          0.16 * gridLift +
          0.14 * pFaq +
          0.24 * pCta;
      const postY = compact
        ? -0.82 + 0.14 * pCta
        : -0.22 + 0.34 * gridLift - 0.12 * featureActive + 0.16 * pCta;
      const postZ = compact ? -0.52 : 0.05 + 0.22 * pDetail - 0.18 * gridLift;
      const postS = compact
        ? 0.43
        : 0.80 - 0.05 * gridLift + 0.04 * pDetail - 0.06 * pCta;
      const postRotY =
        -0.36 +
        0.16 * anglesBeat +
        0.62 * featureMidSway -
        0.12 * pDetail +
        0.08 * pCta;

      const into = stage.into;
      const out = stage.out;
      wantX = THREE.MathUtils.lerp(THREE.MathUtils.lerp(preX, momX, into), postX, out);
      wantY = THREE.MathUtils.lerp(THREE.MathUtils.lerp(preY, momY, into), postY, out);
      wantZ = THREE.MathUtils.lerp(THREE.MathUtils.lerp(preZ, momZ, into), postZ, out);
      wantS = THREE.MathUtils.lerp(THREE.MathUtils.lerp(preS, momS, into), postS, out);
      wantRotY = THREE.MathUtils.lerp(THREE.MathUtils.lerp(preRotY, momRotY, into), postRotY, out);
      wantRotX = 0.23 + 0.05 * stage.focus + 0.04 * anglesBeat;
    }

    L.rx = anim ? damp(L.rx, wantX, 5.5, dt) : wantX;
    L.ry = anim ? damp(L.ry, wantY - (1 - intro) * 0.45, 5.5, dt) : wantY;
    L.rz = anim ? damp(L.rz, wantZ, 5.5, dt) : wantZ;
    L.rs = anim ? damp(L.rs, wantS * (0.9 + 0.1 * intro), 5.5, dt) : wantS;
    L.rotY = anim ? damp(L.rotY, wantRotY + pointer.x * 0.12, 4.5, dt) : wantRotY;
    L.rotX = anim ? damp(L.rotX, wantRotX - pointer.y * 0.05, 4.5, dt) : wantRotX;

    if (rigRef.current) {
      rigRef.current.position.set(L.rx, L.ry, L.rz);
      rigRef.current.scale.setScalar(L.rs);
      rigRef.current.rotation.set(L.rotX, L.rotY, 0);
    }

    /* ------------------------------------------------------------------
       2. TWO-SEASON SHADER UNIFORMS (WINTER SNOW <-> SUMMER LAKE)
       ------------------------------------------------------------------ */
    // Winter (0.90) in Hero & Moment -> Summer Lake (0.16) in Angles -> Twilight Alpine (0.72) in Build/Detail
    const summerShift = anglesBeat * (1 - featureActive * 0.7) * (1 - pBuild);
    const targetSeason = anim
      ? THREE.MathUtils.clamp(0.88 - 0.72 * summerShift - 0.14 * pBuild, 0.14, 0.94)
      : 0.78;
    L.season = anim ? damp(L.season, targetSeason, 3.8, dt) : targetSeason;

    shaders.terrainMat.uniforms.uSeason.value = L.season;
    shaders.terrainMat.uniforms.uTime.value = anim ? el : 1.2;
    shaders.terrainMat.uniforms.uOpacity.value = intro;

    shaders.lakeMat.uniforms.uSeason.value = L.season;
    shaders.lakeMat.uniforms.uTime.value = anim ? el : 2.1;
    shaders.lakeMat.uniforms.uOpacity.value = intro;

    shaders.snowfall.mat.uniforms.uSeason.value = L.season;
    shaders.snowfall.mat.uniforms.uTime.value = anim ? el : 0.8;
    shaders.snowfall.mat.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    shaders.snowfall.mat.uniforms.uOpacity.value = intro;

    /* Cabin evening hearth glow warms up in Build & Detail */
    const wantHearth = anim ? 0.35 + 0.65 * Math.max(pBuild, pDetail, stage.t * stage.focus) : 0.55;
    L.hearth = anim ? damp(L.hearth, wantHearth, 4.0, dt) : wantHearth;
    if (cabinGlowRef.current) {
      mats.hearthGlow.opacity = L.hearth * 0.78 * intro;
    }

    /* ------------------------------------------------------------------
       3. SUMMIT EXPRESS CHAIRLIFT CARRIERS & MOORED LAKE SKIFF
       ------------------------------------------------------------------ */
    const { basePos, summitPos } = geos.chairlift;
    const perpX = -(summitPos[2] - basePos[2]);
    const perpZ = summitPos[0] - basePos[0];
    const pLen = Math.hypot(perpX, perpZ) || 1;
    const ox = (perpX / pLen) * 0.085;
    const oz = (perpZ / pLen) * 0.085;

    for (let i = 0; i < CHAIR_COUNT; i++) {
      const ch = chairRefs.current[i];
      if (!ch) continue;
      const loopU = anim ? ((el * 0.055 + i / CHAIR_COUNT) % 1) : i / CHAIR_COUNT;
      const goingUp = loopU < 0.5;
      const spanU = goingUp ? loopU * 2 : (1 - loopU) * 2;
      const side = goingUp ? -1 : 1;
      const cx = basePos[0] + (summitPos[0] - basePos[0]) * spanU + ox * side;
      const cz = basePos[2] + (summitPos[2] - basePos[2]) * spanU + oz * side;
      const cy = basePos[1] + (summitPos[1] - basePos[1]) * spanU + 0.26;
      ch.position.set(cx, cy, cz);
      ch.rotation.z = anim ? Math.sin(el * 1.8 + i * 1.4) * 0.05 : 0;
    }

    if (skiffRef.current) {
      const bob = anim ? Math.sin(el * 1.9) * 0.008 * (1.1 - L.season * 0.5) : 0;
      skiffRef.current.position.y = LAKE_Y + 0.016 + bob;
      skiffRef.current.rotation.z = anim ? Math.cos(el * 1.5) * 0.04 : 0;
    }

    /* ------------------------------------------------------------------
       4. CATO SNOWBOARD DOWNHILL CARVE & BIG-AIR JUMP (`moment` 0 -> 1)
       ------------------------------------------------------------------ */
    let wantU = 0.88;
    if (anim) {
      if (stage.into < 0.08) {
        wantU = 0.02 + 0.03 * pStats;
      } else if (stage.out < 0.5) {
        wantU = 0.02 + smooth(stage.t) * 0.96;
      } else {
        wantU = 0.98;
      }
      L.riderU = damp(L.riderU, wantU, 8.0, dt);
    } else {
      L.riderU = 0.96;
    }

    shaders.carveMat.uniforms.uProgress.value = L.riderU;
    shaders.carveMat.uniforms.uOpacity.value = intro;
    mats.arcLine.opacity = (0.18 + 0.55 * stage.focus) * intro;

    const rider = catoRiderRef.current;
    if (rider) {
      const u = THREE.MathUtils.clamp(L.riderU, 0.001, 0.999);
      geos.curve.getPointAt(u, _curvePos);
      geos.curve.getTangentAt(u, _curveTang);
      const uNext = Math.min(0.999, u + 0.02);
      geos.curve.getPointAt(uNext, _curvePos2);
      geos.curve.getTangentAt(uNext, _curveTang2);

      _cross.crossVectors(_curveTang, _curveTang2);
      const carveBank = THREE.MathUtils.clamp(_cross.y * 14, -0.45, 0.45);

      /* Airborne 360° spin between u = 0.45 and u = 0.76 */
      const airPhase =
        u > 0.45 && u < 0.76 ? smooth((u - 0.45) / 0.31) : 0;
      const spinAngle = airPhase > 0 && airPhase < 1 ? airPhase * Math.PI * 2 : 0;

      _lookMat.lookAt(_curvePos, _curvePos2.copy(_curvePos).add(_curveTang), _up);
      _quat.setFromRotationMatrix(_lookMat);
      _bankQuat.setFromAxisAngle(_zAxis, -carveBank);
      _spinQuat.setFromAxisAngle(_up, spinAngle);
      _quat.multiply(_bankQuat).multiply(_spinQuat);

      rider.position.copy(_curvePos);
      if (u > 0.92 && stage.out > 0.4) {
        // Face viewer cheerfully beside the A-frame cabin after run completion
        _dummyQuat.setFromAxisAngle(_up, 0.32);
        rider.quaternion.slerp(_dummyQuat, smooth((u - 0.92) / 0.08));
      } else {
        rider.quaternion.copy(_quat);
      }
      rider.scale.setScalar(0.38 * Math.max(intro, 0.01));

      if (core) {
        if (!anim) {
          core.scrub('cheer', 1.1);
        } else if (u > 0.44 && u < 0.78) {
          core.scrub('cheer', 0.55 + airPhase * 1.4);
        } else if (stage.focus > 0.25 && u <= 0.44) {
          core.scrub('scan', 0.8 + u * 2.0);
        } else if (u >= 0.90) {
          core.scrub('wave', 0.55 + ((el * 0.82) % 1.55));
        } else {
          core.scrub('wave', 0.55 + ((el * 0.75) % 1.5));
        }
      }
    }

    if (cabinBeaconRef.current) {
      reportHotspot(
        cabinBeaconRef.current,
        state.camera,
        0.52 + 0.38 * Math.max(stage.focus, pDetail),
      );
    }

    /* ------------------------------------------------------------------
       5. CAMERA HANDOFF (HERO -> MOMENT DOLLY -> DETAIL/CTA)
       ------------------------------------------------------------------ */
    const camZ = anim ? 9.05 - 0.58 * stage.focus + 0.12 * pCta : 9.0;
    const camY = anim ? 0.24 + pointer.y * 0.15 + 0.14 * stage.focus : 0.24;
    _camPos.set(anim ? pointer.x * 0.25 : 0, camY, camZ);
    state.camera.position.lerp(_camPos, 0.055);
    _camLook.set(0, -0.04 + 0.08 * stage.focus, 0);
    state.camera.lookAt(_camLook);
  });

  return (
    <>
      <SceneLightRig />
      <group ref={rigRef}>
        {/* Radial contact shadow beneath the elliptical plinth */}
        <mesh position={[0, -0.22, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.shadow}>
          <planeGeometry args={[6.4, 5.0]} />
        </mesh>

        {/* 1. Twin Peaks Relief (Snow Summit & Bear Mountain) + Marching-Squares Contours */}
        <mesh geometry={geos.mountainGeo} material={shaders.terrainMat} />
        <lineSegments geometry={geos.topoLinesGeo} material={mats.topoLine} />

        {/* 2. Big Bear Lake Two-Season Surface (Winter Frost <-> Summer Ripples) */}
        <mesh geometry={geos.lakePlaneGeo} material={shaders.lakeMat} renderOrder={1} />

        {/* 3. Plinth, Chairlift Towers, Lakefront A-Frame Cabin & Dock */}
        <mesh geometry={geos.porcelainGeo} material={mats.porcelain} />
        <mesh geometry={geos.enamelGeo} material={mats.enamel} />
        <mesh geometry={geos.crystalGeo}>
          <GlassMaterial kind="crystal" />
        </mesh>

        {/* Cabin Interior Warm-Sapphire Hearth Glow & Hotspot Anchor */}
        <mesh ref={cabinGlowRef} position={geos.cabinPos} material={mats.hearthGlow}>
          <octahedronGeometry args={[0.085, 1]} />
        </mesh>
        <object3D ref={cabinBeaconRef} position={geos.cabinPos} />

        {/* Moored Crystal Skiff beside the Dock */}
        <group ref={skiffRef} position={[0.26, LAKE_Y + 0.016, 0.94]} rotation={[0, 0.45, 0]}>
          <mesh scale={[1.9, 0.45, 0.72]}>
            <octahedronGeometry args={[0.065, 1]} />
            <GlassMaterial kind="prism" emissive="#2e4bff" emissiveIntensity={0.22} />
          </mesh>
        </group>

        {/* 4. Summit Express Chairlift Haul Cables & Moving Gondola Chairs */}
        <lineSegments geometry={geos.chairlift.cableGeo} material={mats.cableLine} />
        {Array.from({ length: CHAIR_COUNT }, (_, i) => (
          <group
            key={i}
            ref={(el) => {
              chairRefs.current[i] = el;
            }}
          >
            <mesh position={[0, 0.04, 0]} material={mats.enamel}>
              <cylinderGeometry args={[0.004, 0.004, 0.08, 6]} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.055, 0.042, 0.045]} />
              <GlassMaterial kind="core" emissive="#2e4bff" emissiveIntensity={0.2} />
            </mesh>
          </group>
        ))}

        {/* 5. Instanced Alpine Pine Forest (32 Pines in 2 Draw Calls) */}
        <instancedMesh
          ref={pineCrownInstRef}
          args={[geos.pineCrownGeo, mats.pineCrown, geos.pines.length]}
        />
        <instancedMesh
          ref={pineTrunkInstRef}
          args={[geos.pineTrunkGeo, mats.pineTrunk, geos.pines.length]}
        />

        {/* 6. Groomed Carve Track Ribbon, Big-Air Trajectory Arc & Cato on Crystal Snowboard */}
        <mesh geometry={geos.carveRibbonGeo} material={shaders.carveMat} renderOrder={2} />
        <lineSegments geometry={geos.jumpArcGeo} material={mats.arcLine} />

        <group ref={catoRiderRef} scale={0.38}>
          {/* Refractive Crystal Snowboard */}
          <mesh position={[0, 0.016, 0]} scale={[0.9, 0.12, 2.5]}>
            <cylinderGeometry args={[0.14, 0.14, 0.12, 20]} />
            <GlassMaterial kind="prism" emissive="#2e4bff" emissiveIntensity={0.32} />
          </mesh>
          {/* Cato the Robot */}
          <group position={[0, 0.03, 0]} rotation={[0, Math.PI, 0]}>
            <CatoBody ref={catoBodyRef} paused={!q.animate} />
          </group>
        </group>

        {/* 7. Alpine Basin Snowfall Dust */}
        <points
          geometry={shaders.snowfall.geo}
          material={shaders.snowfall.mat}
          frustumCulled={false}
        />
      </group>

      <ParticleField
        count={Math.floor(650 * q.particles)}
        drift={q.animate ? 0.08 : 0}
        opacity={0.2}
      />
    </>
  );
}
