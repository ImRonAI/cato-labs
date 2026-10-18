'use client';

import * as THREE from 'three';
import { readMoment, type MomentState } from './moment';

/**
 * Per-scene moment camera blend. Scenes compute their usual camera target,
 * then call `blendCamera` so the dwell smoothly takes the camera to the set
 * piece and hands it back. Everything is preallocated by the caller.
 */
export interface StageCamera {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

export function makeStage(
  pos: [number, number, number],
  look: [number, number, number],
): StageCamera {
  return { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look) };
}

const _p = new THREE.Vector3();
const _l = new THREE.Vector3();

/**
 * Lerp the camera toward (target, look) blended with the stage by `w`.
 * `compactPull` pushes the stage camera back along its view axis for
 * portrait screens.
 */
export function driveCamera(
  camera: THREE.Camera,
  target: THREE.Vector3,
  look: THREE.Vector3,
  stage: StageCamera,
  w: number,
  compactPull: number,
  pointerX: number,
  pointerY: number,
) {
  _p.copy(stage.pos).sub(stage.look).multiplyScalar(compactPull).add(stage.look);
  _p.x += pointerX * 0.25;
  _p.y += pointerY * 0.15;
  _p.lerp(target, 1 - w);
  _l.copy(stage.look).lerp(look, 1 - w);
  camera.position.lerp(_p, 0.05);
  camera.lookAt(_l);
}

/** module-shared moment read: one object, refreshed by whoever calls it */
export const moment: MomentState = { t: 0, w: 0, p: 0 };
export function refreshMoment(): MomentState {
  return readMoment(moment);
}
