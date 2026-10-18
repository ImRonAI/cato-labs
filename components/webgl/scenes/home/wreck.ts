/**
 * The wrecking-ball set piece — pure data + Rapier world builder.
 *
 * Framework-free on purpose (no React, no three; types only) so the
 * simulation can be baked by `useBakedSimulation` and also tuned headlessly.
 * Everything is expressed in the Monolith group's local frame: the floor
 * plane sits at FLOOR_Y, the tower stands on the y axis, and the ball
 * swings along STRIKE_DIR: pulled back toward the front-right (it looms at
 * the edge of frame), it strikes the tower's right flank and the debris
 * falls back and away from the viewer, behind the copy column on the left.
 */

import type { PhysicsBody, PhysicsWorld, Rapier } from '../../lib/physics-bake';

export const FLOOR_Y = -1.95;

/** strike heading in the xz plane: from front-right toward back-left */
const PHI = 0.55;
export const STRIKE_DIR = { x: -Math.cos(PHI), z: -Math.sin(PHI) };

export interface BlockSpec {
  /** full extents */
  size: [number, number, number];
  /** extra yaw on top of the tower yaw — a slow twist up the stack */
  twist: number;
  /** material role */
  tone: 'clear' | 'ice' | 'core';
}

/* eight glass blocks, base → crown; the core block is the one the ball removes */
export const BLOCKS: BlockSpec[] = [
  { size: [1.34, 0.6, 1.24], twist: 0, tone: 'clear' },
  { size: [1.22, 0.46, 1.16], twist: 0.07, tone: 'ice' },
  { size: [1.16, 0.58, 1.08], twist: -0.04, tone: 'clear' },
  { size: [1.08, 0.44, 1.02], twist: 0.11, tone: 'core' },
  { size: [1.1, 0.54, 0.98], twist: 0.03, tone: 'clear' },
  { size: [1.0, 0.42, 0.94], twist: 0.15, tone: 'ice' },
  { size: [0.96, 0.5, 0.88], twist: 0.08, tone: 'clear' },
  { size: [0.86, 0.36, 0.82], twist: 0.2, tone: 'ice' },
];

export const BLOCK_RADIUS = 0.035;
export const GAP = 0.004;

export interface Pose {
  p: [number, number, number];
  q: [number, number, number, number];
}

const yawQuat = (a: number): [number, number, number, number] => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];

/** the calm, stacked monolith — rest pose of every block */
export const REST: Pose[] = (() => {
  let y = FLOOR_Y;
  return BLOCKS.map((b) => {
    const cy = y + b.size[1] / 2 + GAP;
    y = cy + b.size[1] / 2;
    return { p: [0, cy, 0] as [number, number, number], q: yawQuat(-PHI + b.twist) };
  });
})();

export const TOWER_TOP = REST[REST.length - 1].p[1] + BLOCKS[BLOCKS.length - 1].size[1] / 2;

/* ---- the ball and its cable ---- */
export const BALL_RADIUS = 0.5;
export const CABLE_LENGTH = 6.0;
/** block the ball is aimed at */
const TARGET = 3;
/** pull-back angle at release */
const RELEASE_ANGLE = 0.75;
const hitY = REST[TARGET].p[1] + 0.05;
/* lowest point of the arc sits just shy of the tower face, so contact lands at full speed */
const lowOffset = BLOCKS[TARGET].size[0] / 2 + BALL_RADIUS - 0.16;
export const ANCHOR: [number, number, number] = [
  -STRIKE_DIR.x * lowOffset,
  hitY + CABLE_LENGTH,
  -STRIKE_DIR.z * lowOffset,
];
export const BALL_START: [number, number, number] = [
  ANCHOR[0] - STRIKE_DIR.x * Math.sin(RELEASE_ANGLE) * CABLE_LENGTH,
  ANCHOR[1] - Math.cos(RELEASE_ANGLE) * CABLE_LENGTH,
  ANCHOR[2] - STRIKE_DIR.z * Math.sin(RELEASE_ANGLE) * CABLE_LENGTH,
];
/** where the ball finally hangs (plumb under the anchor) */
export const BALL_HANG: [number, number, number] = [ANCHOR[0], ANCHOR[1] - CABLE_LENGTH, ANCHOR[2]];

export const BAKE = {
  key: 'home-wrecking-ball-v2',
  steps: 330,
  dt: 1 / 60,
  substeps: 3,
  solverIterations: 14,
} as const;

/** Build the world. Returns bodies in render order: blocks 0..n-1, then the ball. */
export function setupWreck(R: Rapier, w: PhysicsWorld): PhysicsBody[] {
  const ground = w.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, FLOOR_Y - 0.5, 0));
  w.createCollider(R.ColliderDesc.cuboid(30, 0.5, 30).setFriction(0.75).setRestitution(0.05), ground);

  const bodies: PhysicsBody[] = [];
  BLOCKS.forEach((b, i) => {
    const r = REST[i];
    const body = w.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(r.p[0], r.p[1], r.p[2])
        .setRotation({ x: r.q[0], y: r.q[1], z: r.q[2], w: r.q[3] })
        .setLinearDamping(0.08)
        .setAngularDamping(0.22)
        .setCanSleep(false),
    );
    w.createCollider(
      R.ColliderDesc.roundCuboid(
        b.size[0] / 2 - BLOCK_RADIUS,
        b.size[1] / 2 - BLOCK_RADIUS,
        b.size[2] / 2 - BLOCK_RADIUS,
        BLOCK_RADIUS,
      )
        .setDensity(1)
        .setFriction(0.62)
        .setRestitution(0.12),
      body,
    );
    bodies.push(body);
  });

  const anchor = w.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(ANCHOR[0], ANCHOR[1], ANCHOR[2]));
  const ball = w.createRigidBody(
    R.RigidBodyDesc.dynamic()
      .setTranslation(BALL_START[0], BALL_START[1], BALL_START[2])
      .setLinearDamping(0.12)
      .setAngularDamping(0.4)
      .setCcdEnabled(true)
      .setCanSleep(false),
  );
  w.createCollider(R.ColliderDesc.ball(BALL_RADIUS).setDensity(5).setFriction(0.3).setRestitution(0.2), ball);
  w.createImpulseJoint(R.JointData.rope(CABLE_LENGTH, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), anchor, ball, true);
  bodies.push(ball);
  return bodies;
}

/* ---------------------------------------------------------------- */
/*  Impact analysis — turns the recording into dust emitters.        */
/* ---------------------------------------------------------------- */

export interface ImpactEvent {
  /** simulated seconds */
  t: number;
  pos: [number, number, number];
  /** 0..1 */
  strength: number;
  /** true for contacts with the floor (dust spreads flat) */
  floor: boolean;
}

export interface WreckTimeline {
  /** normalized recording time of first contact */
  hit: number;
  /** strike point (group-local) */
  hitPos: [number, number, number];
  events: ImpactEvent[];
}

/**
 * Scan the recording: the first frame any block moves is the strike;
 * sudden velocity changes (beyond what gravity alone explains) are impacts.
 */
export function analyseWreck(
  positions: Float32Array,
  frames: number,
  count: number,
  dt: number,
  maxEvents = 22,
): WreckTimeline {
  const blocks = count - 1;
  const ballIdx = count - 1;
  const at = (f: number, i: number, k: number) => positions[(f * count + i) * 3 + k];

  /* first frame a block is shoved sideways (vertical settling of the stack doesn't count) */
  let hitFrame = frames - 1;
  outer: for (let f = 1; f < frames; f++) {
    for (let i = 0; i < blocks; i++) {
      const dx = at(f, i, 0) - at(f - 1, i, 0);
      const dz = at(f, i, 2) - at(f - 1, i, 2);
      if (Math.sqrt(dx * dx + dz * dz) / dt > 0.25) {
        hitFrame = f - 1;
        break outer;
      }
    }
  }

  const bx = at(hitFrame, ballIdx, 0);
  const by = at(hitFrame, ballIdx, 1);
  const bz = at(hitFrame, ballIdx, 2);
  const hitPos: [number, number, number] = [bx + STRIKE_DIR.x * BALL_RADIUS, by, bz + STRIKE_DIR.z * BALL_RADIUS];

  const raw: ImpactEvent[] = [];
  const lastEvent = new Array<number>(blocks).fill(-1);
  for (let f = hitFrame + 3; f < frames - 1; f++) {
    for (let i = 0; i < blocks; i++) {
      const v0x = (at(f, i, 0) - at(f - 1, i, 0)) / dt;
      const v0y = (at(f, i, 1) - at(f - 1, i, 1)) / dt;
      const v0z = (at(f, i, 2) - at(f - 1, i, 2)) / dt;
      const v1x = (at(f + 1, i, 0) - at(f, i, 0)) / dt;
      const v1y = (at(f + 1, i, 1) - at(f, i, 1)) / dt;
      const v1z = (at(f + 1, i, 2) - at(f, i, 2)) / dt;
      /* remove gravity's share of the change */
      const ax = v1x - v0x;
      const ay = v1y - v0y + 9.81 * dt;
      const az = v1z - v0z;
      const dv = Math.sqrt(ax * ax + ay * ay + az * az);
      if (dv < 0.9) continue;
      if (lastEvent[i] >= 0 && f - lastEvent[i] < 9) continue;
      lastEvent[i] = f;
      const y = at(f, i, 1);
      const half = BLOCKS[i].size[1] / 2;
      const floor = y - FLOOR_Y < half + 0.45;
      raw.push({
        t: f * dt,
        pos: [at(f, i, 0), floor ? FLOOR_Y + 0.04 : y, at(f, i, 2)],
        strength: Math.min(dv / 4.5, 1),
        floor,
      });
    }
  }
  raw.sort((a, b) => b.strength - a.strength);
  const events = raw.slice(0, maxEvents).sort((a, b) => a.t - b.t);
  return { hit: hitFrame / (frames - 1), hitPos, events };
}
