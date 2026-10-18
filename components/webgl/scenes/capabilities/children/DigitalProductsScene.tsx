'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, type GlassKind } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';

/**
 * DigitalProductsScene — "The Drafting Table".
 *
 * Four thin glass panes float stage-right at slight angles, like screens
 * being designed. Fine blue construction hairlines run from every pane
 * corner to a single vanishing point — the draft becoming real.
 *
 * Scroll choreography (transient reads, never state):
 *   hero/feature — panes drift at their drafting angles
 *   studio       — panes align into a crisp stack: the page ships
 *   vibe         — the stack scatters gently, then reassembles: regeneration
 * Reduced motion → aligned static composition, no drift.
 */

const PANE_W = 2;
const PANE_H = 2.6;
const PANE_D = 0.05;

interface PaneSpec {
  draftP: readonly [number, number, number];
  draftR: readonly [number, number, number];
  alignP: readonly [number, number, number];
  alignR: readonly [number, number, number];
  kind: GlassKind;
  /** unit-ish direction the pane drifts during the vibe "regeneration" echo */
  scatter: readonly [number, number, number];
}

const PANES: PaneSpec[] = [
  {
    draftP: [3.35, 0.62, -0.6],
    draftR: [0.05, -0.38, 0.03],
    alignP: [3.1, 0, -0.7],
    alignR: [0, -0.16, 0],
    kind: 'deep',
    scatter: [1, 0.55, 0.35],
  },
  {
    draftP: [4.2, -0.55, -1.5],
    draftR: [-0.04, -0.2, -0.02],
    alignP: [3.1, 0, -1.05],
    alignR: [0, -0.16, 0],
    kind: 'azure',
    scatter: [0.6, -0.85, 0.25],
  },
  {
    draftP: [2.5, -1.2, -2.2],
    draftR: [0.06, -0.52, 0.04],
    alignP: [3.1, 0, -1.4],
    alignR: [0, -0.16, 0],
    kind: 'pane',
    scatter: [-0.75, -0.4, -0.2],
  },
  {
    draftP: [4.65, 1.3, -2.8],
    draftR: [-0.05, -0.12, -0.03],
    alignP: [3.1, 0, -1.75],
    alignR: [0, -0.16, 0],
    kind: 'ice',
    scatter: [0.9, 0.85, -0.15],
  },
];

/** the single vanishing point every construction line runs to */
const VP = new THREE.Vector3(-3.6, 0.35, -7);

/** pane corner locals (z = 0 face), matched to PANE_W / PANE_H */
const CORNERS = [
  new THREE.Vector3(-PANE_W / 2, -PANE_H / 2, 0),
  new THREE.Vector3(PANE_W / 2, -PANE_H / 2, 0),
  new THREE.Vector3(PANE_W / 2, PANE_H / 2, 0),
  new THREE.Vector3(-PANE_W / 2, PANE_H / 2, 0),
];

export default function DigitalProductsScene() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const paneRefs = useRef<(THREE.Group | null)[]>([]);
  const lineMat = useRef<THREE.LineBasicMaterial>(null);
  const startT = useRef(-1);
  const report = useHotspotReporter('design-panes');

  /* geometry + the pre-allocated hairline position buffer (16 segments) */
  const { boxGeo, edgeGeo, lineGeo, linePositions } = useMemo(() => {
    const boxGeo = new THREE.BoxGeometry(PANE_W, PANE_H, PANE_D);
    const edgeGeo = new THREE.EdgesGeometry(boxGeo, 20);
    const linePositions = new Float32Array(PANES.length * 4 * 2 * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    return { boxGeo, edgeGeo, lineGeo, linePositions };
  }, []);

  useEffect(
    () => () => {
      boxGeo.dispose();
      edgeGeo.dispose();
      lineGeo.dispose();
    },
    [boxGeo, edgeGeo, lineGeo],
  );

  const tmp = useMemo(() => ({ v: new THREE.Vector3(), look: new THREE.Vector3() }), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (startT.current < 0) startT.current = t;
    const local = t - startT.current;
    const animate = q.animate;

    const studio = getSectionProgress('studio');
    const vibe = getSectionProgress('vibe');
    /* studio → align into a crisp stack; vibe → scatter & reassemble echo */
    const align = animate ? smooth(sectionRange(studio, 0.08, 0.62)) : 1;
    const echo = animate ? Math.sin(smooth(sectionRange(vibe, 0.02, 0.92)) * Math.PI) : 0;
    const intro = animate ? smooth(Math.min(1, local / 1.5)) : 1;

    const g = group.current;
    if (g) {
      const idleY = animate ? Math.sin(t * 0.08) * 0.1 : 0;
      const targetRY = idleY + (animate ? pointer.x * 0.05 : 0);
      const targetRX = animate ? pointer.y * 0.03 : 0;
      g.rotation.y += (targetRY - g.rotation.y) * 0.045;
      g.rotation.x += (targetRX - g.rotation.x) * 0.045;
      g.scale.setScalar(0.94 + 0.06 * intro);
      g.position.y = -0.35 * (1 - intro);
    }

    /* panes: draft pose → aligned stack, plus the vibe echo */
    for (let i = 0; i < PANES.length; i++) {
      const pane = paneRefs.current[i];
      if (!pane) continue;
      const spec = PANES[i];
      const a = smooth(sectionRange(align, i * 0.05, 1 - (PANES.length - 1 - i) * 0.05));
      const ex = spec.scatter[0] * echo * 0.7 * a;
      const ey = spec.scatter[1] * echo * 0.7 * a;
      const ez = spec.scatter[2] * echo * 0.7 * a;
      const floatY = animate ? Math.sin(t * 0.35 + i * 1.7) * 0.05 * (1 - a) : 0;
      pane.position.set(
        spec.draftP[0] + (spec.alignP[0] - spec.draftP[0]) * a + ex,
        spec.draftP[1] + (spec.alignP[1] - spec.draftP[1]) * a + ey + floatY,
        spec.draftP[2] + (spec.alignP[2] - spec.draftP[2]) * a + ez,
      );
      pane.rotation.set(
        spec.draftR[0] * (1 - a) + spec.alignR[0] * a + echo * 0.12 * a * spec.scatter[1],
        spec.draftR[1] * (1 - a) + spec.alignR[1] * a + echo * 0.15 * a * spec.scatter[0],
        spec.draftR[2] * (1 - a) + spec.alignR[2] * a,
      );
      pane.updateWorldMatrix(true, false);
    }

    /* construction hairlines: every pane corner → the vanishing point */
    let o = 0;
    for (let i = 0; i < PANES.length; i++) {
      const pane = paneRefs.current[i];
      if (!pane) continue;
      for (let c = 0; c < 4; c++) {
        tmp.v.copy(CORNERS[c]).applyMatrix4(pane.matrixWorld);
        linePositions[o++] = tmp.v.x;
        linePositions[o++] = tmp.v.y;
        linePositions[o++] = tmp.v.z;
        linePositions[o++] = VP.x;
        linePositions[o++] = VP.y;
        linePositions[o++] = VP.z;
      }
    }
    const attr = lineGeo.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
    /* the draft lines fade as the page ships, and return while regenerating */
    if (lineMat.current) {
      lineMat.current.opacity = Math.min(0.5, 0.26 * (1 - align * 0.55) + echo * 0.18);
    }

    /* hotspot for ProximityType, reported on the lead (deep-blue) pane */
    const lead = paneRefs.current[0];
    if (lead) report(lead, state.camera, 0.85);

    /* camera: gentle drift, gaze resting stage-right on the table */
    const cam = state.camera;
    cam.position.x += ((animate ? pointer.x * 0.35 : 0.25) - cam.position.x) * 0.03;
    cam.position.y += ((animate ? pointer.y * 0.22 : 0) - cam.position.y) * 0.03;
    tmp.look.set(0.9, 0, -1.2);
    cam.lookAt(tmp.look);
  });

  return (
    <group>
      <SceneLightRig />

      <group ref={group}>
        {/* the four screens being designed */}
        {PANES.map((spec, i) => (
          <group
            key={i}
            ref={(el) => {
              paneRefs.current[i] = el;
            }}
            position={spec.draftP as [number, number, number]}
            rotation={spec.draftR as [number, number, number]}
          >
            <mesh geometry={boxGeo}>
              <GlassMaterial kind={spec.kind} />
            </mesh>
            {/* crisp drafting edges — the screen's outline */}
            <lineSegments geometry={edgeGeo}>
              <lineBasicMaterial color="#2e4bff" transparent opacity={0.3} />
            </lineSegments>
          </group>
        ))}

        {/* the vanishing point: where the draft becomes real */}
        <mesh position={VP}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color="#2e4bff" />
        </mesh>
        <mesh position={VP}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshBasicMaterial color="#2e4bff" transparent opacity={0.09} />
        </mesh>

        {/* construction hairlines, one lineSegments for all 16 */}
        <lineSegments geometry={lineGeo} frustumCulled={false}>
          <lineBasicMaterial ref={lineMat} color="#2e4bff" transparent opacity={0.26} />
        </lineSegments>
      </group>

      <ParticleField
        count={Math.floor(1300 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.35}
        position={[1.2, 0, -1]}
      />
    </group>
  );
}
