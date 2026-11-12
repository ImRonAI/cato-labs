'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import {
  GlassMaterial,
  GradientGlassMaterial,
  type GlassKind,
} from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';

/**
 * DigitalProductsScene — "The Flagship Product Atelier".
 *
 * Five layered refractive product planes (IA blueprint chassis, structural
 * interface deck, navigation chrome, editorial component cards, and a central
 * 3D sapphire-prism hero jewel) float stage-right, tethered by perspective
 * construction rays to a luminous vanishing point.
 *
 * Scroll choreography across all page sections:
 *   hero    — isometric drafting spread, construction rays active
 *   feature — layers organize into discipline hierarchy
 *   studio  — all layers snap coaxially into a shipped flagship viewport
 *   detail  — pivots into an architectural exploded cutaway to reveal stack
 *   faq/cta — re-locks in calm gallery elevation
 *
 * Hotspot 'design-panes' rides the flagship viewport jewel.
 * Zero allocations in useFrame; reduced motion renders the shipped stack.
 */

const PANE_W = 2.24;
const PANE_H = 2.84;

interface LayerSpec {
  w: number;
  h: number;
  d: number;
  kind: GlassKind;
  draftP: readonly [number, number, number];
  draftR: readonly [number, number, number];
  shipP: readonly [number, number, number];
  shipR: readonly [number, number, number];
  cutawayZ: number;
}

const LAYERS: readonly LayerSpec[] = [
  /* 0: IA blueprint chassis */
  {
    w: PANE_W,
    h: PANE_H,
    d: 0.048,
    kind: 'ice',
    draftP: [3.45, -0.45, -2.35],
    draftR: [-0.05, -0.46, -0.03],
    shipP: [2.72, 0.02, -1.52],
    shipR: [0, -0.22, 0],
    cutawayZ: -0.68,
  },
  /* 1: Structural UI deck */
  {
    w: PANE_W * 0.94,
    h: PANE_H * 0.94,
    d: 0.044,
    kind: 'pane',
    draftP: [2.42, -0.82, -1.72],
    draftR: [0.06, -0.54, 0.04],
    shipP: [2.72, 0.02, -1.28],
    shipR: [0, -0.22, 0],
    cutawayZ: -0.28,
  },
  /* 2: Top navigation bar chrome */
  {
    w: PANE_W * 0.86,
    h: 0.22,
    d: 0.045,
    kind: 'azure',
    draftP: [3.85, 1.42, -1.25],
    draftR: [-0.04, -0.18, -0.02],
    shipP: [2.72, 1.12, -1.06],
    shipR: [0, -0.22, 0],
    cutawayZ: 0.14,
  },
  /* 3: Editorial hero surface card */
  {
    w: PANE_W * 0.86,
    h: 1.18,
    d: 0.05,
    kind: 'crystal',
    draftP: [3.15, 0.42, -0.78],
    draftR: [0.05, -0.36, 0.03],
    shipP: [2.72, 0.28, -1.02],
    shipR: [0, -0.22, 0],
    cutawayZ: 0.26,
  },
  /* 4: Conversion & metric bento strip */
  {
    w: PANE_W * 0.86,
    h: 0.72,
    d: 0.05,
    kind: 'deep',
    draftP: [3.75, -0.95, -0.62],
    draftR: [0.04, -0.26, -0.03],
    shipP: [2.72, -0.82, -0.98],
    shipR: [0, -0.22, 0],
    cutawayZ: 0.42,
  },
];

const VP = new THREE.Vector3(-3.4, 0.32, -6.8);
const SPARK_COUNT = 8;

const CORNERS = [
  new THREE.Vector3(-PANE_W / 2, -PANE_H / 2, 0),
  new THREE.Vector3(PANE_W / 2, -PANE_H / 2, 0),
  new THREE.Vector3(PANE_W / 2, PANE_H / 2, 0),
  new THREE.Vector3(-PANE_W / 2, PANE_H / 2, 0),
];

const _v = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3(0.95, 0, -1.15);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

export default function DigitalProductsScene() {
  const q = useQuality();
  const groupRef = useRef<THREE.Group>(null);
  const layerRefs = useRef<(THREE.Group | null)[]>([]);
  const jewelGroupRef = useRef<THREE.Group>(null);
  const jewelMeshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null);
  const gridMatRef = useRef<THREE.LineBasicMaterial>(null);
  const sparksRef = useRef<THREE.InstancedMesh>(null);
  const startAt = useRef<number | null>(null);

  const report = useHotspotReporter('design-panes');

  /* column blueprint hairlines on Layer 0 + dynamic construction rays to VP */
  const { gridGeo, rayGeo, rayPositions } = useMemo(() => {
    const gSegs: number[] = [];
    const cols = 6;
    for (let c = 0; c <= cols; c++) {
      const x = -PANE_W * 0.44 + (PANE_W * 0.88 * c) / cols;
      gSegs.push(x, -PANE_H * 0.45, 0.028, x, PANE_H * 0.45, 0.028);
    }
    for (let r = 0; r <= 4; r++) {
      const y = -PANE_H * 0.45 + (PANE_H * 0.9 * r) / 4;
      gSegs.push(-PANE_W * 0.44, y, 0.028, PANE_W * 0.44, y, 0.028);
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(gSegs), 3),
    );

    /* 4 rays from chassis + 4 from editorial hero card + 4 from bento strip = 12 rays */
    const rayPositions = new Float32Array(12 * 2 * 3);
    const rayGeo = new THREE.BufferGeometry();
    rayGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(rayPositions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    return { gridGeo, rayGeo, rayPositions };
  }, []);

  const sparkColor = useMemo(() => new THREE.Color(0.75, 1.05, 2.85), []);

  useEffect(
    () => () => {
      gridGeo.dispose();
      rayGeo.dispose();
    },
    [gridGeo, rayGeo],
  );

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = now;
    const el = now - startAt.current;
    const anim = q.animate;

    const intro = anim ? smooth(Math.min(1, el / 1.55)) : 1;

    /* scroll choreography across all real sections on /capabilities/digital-products */
    const feat = smooth(sectionRange(getSectionProgress('feature'), 0.04, 0.92));
    const studio = smooth(sectionRange(getSectionProgress('studio'), 0.04, 0.72));
    const det = smooth(sectionRange(getSectionProgress('detail'), 0.08, 0.86));
    const faq = smooth(sectionRange(getSectionProgress('faq'), 0.06, 0.9));
    const cta = smooth(sectionRange(getSectionProgress('cta'), 0.06, 0.85));

    /* progressive alignment: partial in feature, crisp lock in studio & below */
    const align = anim ? Math.min(1, feat * 0.42 + studio * 0.88) : 1;
    /* architectural exploded cutaway through `detail`, re-locking by `faq` */
    const cutaway = anim ? det * (1 - faq * 0.85) : 0;

    const g = groupRef.current;
    if (g) {
      const compactShiftX = q.compact ? -2.45 : 0;
      const idleY = anim ? Math.sin(el * 0.09) * 0.06 : 0;
      const targetRY =
        idleY +
        (anim ? pointer.x * 0.075 : 0) -
        cutaway * 0.28 +
        cta * 0.08;
      const targetRX = (anim ? -pointer.y * 0.045 : 0) + cutaway * 0.08;
      if (anim) {
        g.rotation.y += (targetRY - g.rotation.y) * 0.05;
        g.rotation.x += (targetRX - g.rotation.x) * 0.05;
      } else {
        g.rotation.set(0.02, -0.05, 0);
      }
      g.position.set(compactShiftX, -0.45 * (1 - intro), 0);
      g.scale.setScalar((q.compact ? 0.74 : 1) * (0.9 + 0.1 * intro));
    }

    /* update 5 refractive product layers */
    for (let i = 0; i < LAYERS.length; i++) {
      const node = layerRefs.current[i];
      if (!node) continue;
      const spec = LAYERS[i];
      const a = smooth(sectionRange(align, i * 0.06, 0.76 + i * 0.05));
      const floatY = anim ? Math.sin(el * 0.45 + i * 1.4) * 0.055 * (1 - a) : 0;

      node.position.set(
        spec.draftP[0] + (spec.shipP[0] - spec.draftP[0]) * a + cutaway * (i - 2) * 0.12,
        spec.draftP[1] + (spec.shipP[1] - spec.draftP[1]) * a + floatY,
        spec.draftP[2] + (spec.shipP[2] - spec.draftP[2]) * a + cutaway * spec.cutawayZ,
      );
      node.rotation.set(
        spec.draftR[0] * (1 - a) + spec.shipR[0] * a,
        spec.draftR[1] * (1 - a) + spec.shipR[1] * a,
        spec.draftR[2] * (1 - a) + spec.shipR[2] * a,
      );
      node.updateWorldMatrix(true, false);
    }

    /* 3D hero jewel + orbital prism halo riding Layer 3 */
    const jg = jewelGroupRef.current;
    if (jg) {
      const a = smooth(sectionRange(align, 0.18, 0.92));
      jg.position.set(
        3.25 + (2.72 - 3.25) * a + cutaway * 0.24,
        0.58 + (0.28 - 0.58) * a,
        -0.32 + (-0.76 - -0.32) * a + cutaway * 0.58,
      );
      const pop = Math.max(0.001, intro * (0.78 + 0.22 * a));
      jg.scale.setScalar(pop);
    }
    if (jewelMeshRef.current) {
      if (anim) {
        jewelMeshRef.current.rotation.y = el * 0.36 + studio * 0.8;
        jewelMeshRef.current.rotation.x = 0.25 + Math.sin(el * 0.5) * 0.12;
      } else {
        jewelMeshRef.current.rotation.set(0.28, 0.65, 0);
      }
      report(jewelMeshRef.current, state.camera, 0.58 + 0.36 * align);
    }
    if (haloRef.current) {
      if (anim) {
        haloRef.current.rotation.x = Math.PI / 2 + Math.sin(el * 0.65) * 0.28 * (1 - align * 0.5);
        haloRef.current.rotation.z = el * 0.42;
      } else {
        haloRef.current.rotation.set(Math.PI / 2 + 0.14, 0, 0.4);
      }
    }

    /* update 12 construction rays from layers [0, 3, 4] corners → VP */
    const rayLayers = [0, 3, 4];
    let o = 0;
    for (let rIdx = 0; rIdx < rayLayers.length; rIdx++) {
      const node = layerRefs.current[rayLayers[rIdx]];
      const spec = LAYERS[rayLayers[rIdx]];
      if (!node) continue;
      for (let c = 0; c < 4; c++) {
        _v.set(
          (c === 1 || c === 2 ? 0.5 : -0.5) * spec.w,
          (c >= 2 ? 0.5 : -0.5) * spec.h,
          0,
        ).applyMatrix4(node.matrixWorld);
        rayPositions[o++] = _v.x;
        rayPositions[o++] = _v.y;
        rayPositions[o++] = _v.z;
        rayPositions[o++] = VP.x;
        rayPositions[o++] = VP.y;
        rayPositions[o++] = VP.z;
      }
    }
    (rayGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

    if (lineMatRef.current) {
      lineMatRef.current.opacity =
        intro * (0.28 * (1 - align * 0.55) + cutaway * 0.22);
    }
    if (gridMatRef.current) {
      gridMatRef.current.opacity = intro * (0.16 + cutaway * 0.24 + align * 0.08);
    }

    /* 8 instanced light sparks streaming from VP along the construction rays */
    const sInst = sparksRef.current;
    if (sInst) {
      _q.identity();
      for (let i = 0; i < SPARK_COUNT; i++) {
        const segBase = (i % 12) * 6;
        const u = anim ? (((el * 0.34 + i * 0.13) % 1) + 1) % 1 : (i + 1) / 10;
        /* rayPositions stores [corner -> VP], so 1-u travels VP -> corner */
        const f = 1 - u;
        _v.set(
          rayPositions[segBase] + (VP.x - rayPositions[segBase]) * f,
          rayPositions[segBase + 1] + (VP.y - rayPositions[segBase + 1]) * f,
          rayPositions[segBase + 2] + (VP.z - rayPositions[segBase + 2]) * f,
        );
        const env = anim ? Math.sin(u * Math.PI) * (1 - align * 0.35) : 0.4;
        _s.setScalar(Math.max(intro * env, 0.0001));
        _m.compose(_v, _q, _s);
        sInst.setMatrixAt(i, _m);
      }
      sInst.instanceMatrix.needsUpdate = true;
    }

    /* full 3-axis camera choreography (fixes missing camera.z!) */
    const baseZ = q.compact ? 10.4 : 8.6;
    const cx =
      (anim ? pointer.x * 0.34 + Math.sin(el * 0.06) * 0.14 : 0.18) -
      studio * 0.22 +
      cutaway * 0.38;
    const cy =
      0.14 +
      (anim ? pointer.y * 0.2 : 0) +
      studio * 0.08 +
      cta * 0.28 +
      (1 - intro) * 0.35;
    const cz =
      baseZ -
      feat * 0.35 -
      studio * 0.45 -
      cutaway * 0.3 +
      cta * 0.65 +
      (1 - intro) * 1.4;

    _cam.set(cx, cy, cz);
    const lx = q.compact ? 0 : 0.95 - studio * 0.15 + cutaway * 0.2;
    const ly = 0.02 + cta * 0.08;
    const lz = -1.15;

    if (anim) {
      state.camera.position.lerp(_cam, 0.05);
      _look.x += (lx - _look.x) * 0.05;
      _look.y += (ly - _look.y) * 0.05;
      _look.z += (lz - _look.z) * 0.05;
    } else {
      state.camera.position.copy(_cam);
      _look.set(lx, ly, lz);
    }
    state.camera.lookAt(_look);
  });

  /* unused CORNERS kept out of hot loop; clean reference */
  void CORNERS;

  return (
    <group>
      <SceneLightRig />

      <group ref={groupRef}>
        {/* 5 layered refractive product viewport planes */}
        {LAYERS.map((spec, i) => (
          <group
            key={i}
            ref={(el) => {
              layerRefs.current[i] = el;
            }}
            position={spec.draftP as [number, number, number]}
            rotation={spec.draftR as [number, number, number]}
          >
            <RoundedBox args={[spec.w, spec.h, spec.d]} radius={0.03} smoothness={4}>
              <GlassMaterial kind={spec.kind} />
            </RoundedBox>
            {i === 0 ? (
              <lineSegments geometry={gridGeo}>
                <lineBasicMaterial
                  ref={gridMatRef}
                  color="#6b87ff"
                  transparent
                  opacity={0.2}
                  depthWrite={false}
                />
              </lineSegments>
            ) : null}
          </group>
        ))}

        {/* 3D flagship hero jewel + dispersive prism halo */}
        <group ref={jewelGroupRef} position={[3.25, 0.58, -0.32]}>
          <mesh ref={jewelMeshRef}>
            <icosahedronGeometry args={[0.28, 0]} />
            <GradientGlassMaterial />
          </mesh>
          <mesh ref={haloRef}>
            <torusGeometry args={[0.46, 0.016, 16, 72]} />
            <GlassMaterial kind="prism" />
          </mesh>
        </group>

        {/* perspective vanishing point beacon */}
        <mesh position={VP}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshBasicMaterial color="#2e4bff" toneMapped={false} />
        </mesh>
        <mesh position={VP}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshBasicMaterial color="#2e4bff" transparent opacity={0.11} depthWrite={false} />
        </mesh>

        {/* 12 perspective construction hairlines */}
        <lineSegments geometry={rayGeo} frustumCulled={false}>
          <lineBasicMaterial
            ref={lineMatRef}
            color="#2e4bff"
            transparent
            opacity={0.26}
            depthWrite={false}
          />
        </lineSegments>

        {/* 8 instanced light sparks streaming along the drafting rays */}
        <instancedMesh
          ref={sparksRef}
          args={[undefined, undefined, SPARK_COUNT]}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.028, 10, 10]} />
          <meshBasicMaterial
            color={sparkColor}
            toneMapped={false}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </instancedMesh>
      </group>

      <ParticleField
        count={Math.floor(1300 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.34}
        position={[1.1, 0, -1]}
      />
    </group>
  );
}
