'use client';

import * as THREE from 'three';
import type { StageState } from './dwell';

/**
 * Stage placement — where a region's set piece sits on screen.
 *
 *   hero    : beside the hero copy, at rest (the page opens on it)
 *   center  : centred and larger while the dwell is pinned (the moment)
 *   after   : lifted out of frame with the page once the dwell has passed
 *
 * Positions are world-space for the shared 32° camera at z≈9.
 * `compact` variants recompose for portrait.
 */
export interface Pose {
  x: number;
  y: number;
  z: number;
  s: number;
}

export interface Placement {
  hero: Pose;
  center: Pose;
  compactHero: Pose;
  compactCenter: Pose;
  /** world units the set piece travels upward as the dwell leaves */
  lift?: number;
  /** reduced-motion resting pose (defaults to hero) */
  still?: Pose;
  compactStill?: Pose;
}

export function placeStage(
  group: THREE.Object3D,
  stage: StageState,
  q: { animate: boolean; compact: boolean },
  place: Placement,
  intro: number,
) {
  const a = q.compact ? place.compactHero : place.hero;
  const b = q.compact ? place.compactCenter : place.center;
  if (!q.animate) {
    const s = (q.compact ? place.compactStill : place.still) ?? a;
    group.position.set(s.x, s.y, s.z);
    group.scale.setScalar(s.s);
    return;
  }
  const f = stage.into;
  const lift = (place.lift ?? 6) * stage.out;
  group.position.set(
    a.x + (b.x - a.x) * f,
    a.y + (b.y - a.y) * f + lift - (1 - intro) * 0.6,
    a.z + (b.z - a.z) * f,
  );
  group.scale.setScalar((a.s + (b.s - a.s) * f) * (0.92 + 0.08 * intro));
}

/** Clamp01 without allocation. */
export function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

let shadowTex: THREE.CanvasTexture | null = null;
/** A soft radial contact-shadow texture, built once per page. */
export function contactShadowTexture(): THREE.CanvasTexture {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(18,38,200,0.55)');
  grad.addColorStop(0.45, 'rgba(46,75,255,0.18)');
  grad.addColorStop(1, 'rgba(46,75,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  return shadowTex;
}
