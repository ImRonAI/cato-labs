'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { GlassMaterial, type GlassKind } from '../../lib/materials';
import { useQuality } from '../../lib/quality';
import { getSectionProgress, sectionRange, smooth, pointer } from '../../scroll-store';
import { useHotspotReporter } from '../../kit/ProximityType';
import { DEAL_DUR, DEAL_FROM, DEAL_STAGGER } from './deal';

/**
 * WorkScene — "The Deal".
 *
 * Five glass case cards — one per engagement — rest face-down in a squared
 * deck beside the hero. Through the pinned `deal` dwell they are dealt one
 * by one: each card lifts off the deck, arcs toward the lens, turns face-up
 * mid-flight and lands in a fanned hand. Resting Art is dealt first, into
 * the centre, and at the last beat rises out of the hand — the documented
 * case. Fully scrubbed by section progress, so scrolling up gathers the hand
 * back into the deck. While the index is read (`feature`) the hand recedes
 * into the fog.
 *
 * Face print: an opaque merged hairline layout per card (meta, headline,
 * text lines, metric block) — opaque so it refracts through the glass when
 * the card is face-down. Zero allocations in useFrame; reduced motion shows
 * the finished hand.
 */

const CARD_W = 1.3;
const CARD_H = 1.9;
const CARD_D = 0.05;

/** deal order k (= case order) → fan slot; fills the centre then outward */
const SLOT_OF = [2, 1, 3, 0, 4] as const;
const KINDS: readonly GlassKind[] = ['deep', 'ice', 'azure', 'crystal', 'pane'];
const FAN_STEP = 0.22;
const FAN_R = 3.2;


/** pinned window of a 300vh dwell with a 100vh sticky stage */
const PIN_FROM = 0.25;
const PIN_TO = 0.75;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);


/* deterministic deck jitter */
const DECK_ROT = [0.012, -0.028, 0.021, -0.016, 0.031];
const DECK_OFF = [0.0, 0.025, -0.018, 0.03, -0.022];

/* module-scope temps */
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();

function buildPrint(featured: boolean) {
  const ink = new THREE.Color(featured ? '#1226c8' : '#2e4bff');
  const soft = new THREE.Color(featured ? '#6f88ff' : '#a9bbff');
  const faint = new THREE.Color(featured ? '#94a8ff' : '#c5d2ff');
  const bars: [number, number, number, number, THREE.Color][] = [
    // x (left edge), y, w, h, colour
    [-0.5, 0.74, 0.36, 0.03, soft],
    [-0.5, 0.5, 0.86, 0.085, ink],
    [-0.5, 0.37, 0.58, 0.085, ink],
    [-0.5, 0.12, 1.0, 0.022, faint],
    [-0.5, 0.03, 0.94, 0.022, faint],
    [-0.5, -0.06, 0.7, 0.022, faint],
    [-0.5, -0.56, 0.3, 0.15, ink],
    [-0.12, -0.6, 0.42, 0.022, soft],
  ];
  const parts = bars.map(([x, y, w, h, c]) => {
    const g = new THREE.BoxGeometry(w, h, 0.008);
    g.translate(x + w / 2, y, CARD_D / 2 + 0.006);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

export default function WorkScene() {
  const q = useQuality();
  const hand = useRef<THREE.Group>(null);
  const cardRefs = useRef<(THREE.Group | null)[]>([]);
  const report = useHotspotReporter('work-featured');

  const { prints, edges } = useMemo(() => {
    const prints = SLOT_OF.map((_, k) => buildPrint(k === 0));
    const box = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D);
    const edges = new THREE.EdgesGeometry(box, 30);
    box.dispose();
    return { prints, edges };
  }, []);
  useEffect(
    () => () => {
      prints.forEach((p) => p.dispose());
      edges.dispose();
    },
    [prints, edges],
  );

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const g = hand.current;
    if (!g) return;

    const dealP = anim ? sectionRange(getSectionProgress('deal'), PIN_FROM, PIN_TO) : 1;
    const recede = anim ? smooth(sectionRange(getSectionProgress('feature'), 0.02, 0.4)) : 0;
    const intro = anim ? smooth(Math.min(el / 2.0, 1)) : 1;
    const lift = smooth(sectionRange(dealP, 0.84, 0.98));

    /* hand placement — right of the copy; recede into the fog for the index */
    const compact = q.compact;
    const baseX = compact ? 0 : 2.05 - smooth(sectionRange(dealP, 0, 0.3)) * 0.2 + (1 - smooth(sectionRange(dealP, 0, 0.3))) * 0.35;
    const baseY = compact ? -1.05 : -0.05;
    g.position.x += (baseX + recede * (compact ? 0 : 0.7) - g.position.x) * 0.06;
    g.position.y = baseY + recede * 1.3 - (1 - intro) * 1.2;
    g.position.z = -recede * 4.2;
    g.scale.setScalar(compact ? 0.64 : 1);
    g.rotation.x += ((anim ? -0.1 - pointer.y * 0.06 : -0.1) - g.rotation.x) * 0.05;
    g.rotation.y += ((anim ? -0.12 + pointer.x * 0.12 : -0.12) - g.rotation.y) * 0.05;

    for (let k = 0; k < SLOT_OF.length; k++) {
      const c = cardRefs.current[k];
      if (!c) continue;
      const j = SLOT_OF[k];
      const u = clamp01((dealP - (DEAL_FROM + k * DEAL_STAGGER)) / DEAL_DUR);
      const e = easeInOut(u);
      const arc = Math.sin(Math.PI * u);

      /* deck pose — face-down, top card nearest the lens */
      const breath = anim ? Math.sin(el * 0.6 + k * 0.7) * 0.012 * (1 - e) : 0;
      const dx = DECK_OFF[k];
      const dy = 0.55 + DECK_OFF[(k + 2) % 5] * 0.6 + breath;
      const dz = 0.32 - k * 0.07;

      /* fan slot */
      const a = (j - 2) * FAN_STEP;
      const fx = FAN_R * Math.sin(a);
      const fy = -FAN_R + FAN_R * Math.cos(a) + 0.2;
      const fz = 0.03 * j + (k === 0 ? 0.14 + lift * 0.5 : 0);

      c.position.set(
        lerp(dx, fx, e),
        lerp(dy, fy, e) + arc * 0.6 + (k === 0 ? lift * 0.5 : 0),
        lerp(dz, fz, e) + arc * 1.1,
      );
      const flip = Math.PI * (1 - smooth(sectionRange(u, 0.12, 0.82)));
      c.rotation.set(
        arc * -0.18 + (k === 0 ? lift * 0.06 : 0),
        flip,
        lerp(DECK_ROT[k], -a, e) * (k === 0 ? 1 - lift : 1),
        'ZYX',
      );
      const pop = anim ? smooth(clamp01((el - 0.2 - (4 - k) * 0.12) / 0.9)) : 1;
      c.scale.setScalar(Math.max(pop, 0.001));
    }

    const featured = cardRefs.current[0];
    if (featured) report(featured, state.camera, (0.5 + 0.4 * lift) * intro * (1 - recede * 0.7));

    /* camera — a quiet push-in through the deal, pointer parallax */
    const push = smooth(dealP);
    _cam.set(
      anim ? pointer.x * 0.35 : 0,
      0.2 + (anim ? pointer.y * 0.22 : 0),
      (compact ? 10.8 : 9.4) - push * 0.7 - intro * 0.3,
    );
    state.camera.position.lerp(_cam, 0.05);
    _look.set(compact ? 0 : 0.7, compact ? -0.5 : 0, 0);
    state.camera.lookAt(_look);
  });

  return (
    <group>
      <SceneLightRig />
      <group ref={hand}>
        {SLOT_OF.map((_, k) => (
          <group
            key={k}
            ref={(m: THREE.Group | null) => {
              cardRefs.current[k] = m;
            }}
          >
            <RoundedBox args={[CARD_W, CARD_H, CARD_D]} radius={0.022} smoothness={4}>
              <GlassMaterial kind={KINDS[k]} />
            </RoundedBox>
            <mesh geometry={prints[k]}>
              <meshBasicMaterial vertexColors toneMapped={false} />
            </mesh>
            <lineSegments geometry={edges}>
              <lineBasicMaterial
                color={k === 0 ? '#1226c8' : '#2e4bff'}
                transparent
                opacity={k === 0 ? 0.42 : 0.22}
              />
            </lineSegments>
          </group>
        ))}
      </group>
      <ParticleField
        count={Math.floor(1400 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.32}
      />
    </group>
  );
}
