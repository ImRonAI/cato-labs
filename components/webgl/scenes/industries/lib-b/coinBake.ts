import type { Rapier, PhysicsWorld, PhysicsBody } from '../../../lib/physics-bake';

/**
 * Coin-stack set piece for /industries/financial-services.
 * Pure (no React/three) so the same setup can be baked offline for tuning.
 *
 * Eight columns whose heights compound left → right. Row 0 already rests on
 * the ledger; every further coin is released row by row, column by column,
 * a short drop above its column, so the chart rises like rain gathering.
 */

export const COIN_R = 0.25;
export const COIN_HH = 0.042; // half-height
export const COIN_PITCH = COIN_HH * 2;
export const COLUMN_HEIGHTS = [2, 3, 4, 5, 7, 9, 11, 14];
export const COLUMN_GAP = 0.68;
export const FLOOR_Y = -1.45;
export const DROP = 0.95;

export const COIN_STEPS = 300;
export const COIN_SUBSTEPS = 4;
/** ticks between releases */
const RELEASE_EVERY = 13;
const FIRST_RELEASE = 12;

export interface CoinSpec {
  col: number;
  level: number;
  x: number;
  /** tick at which the coin is released (0 = resting from the start) */
  releaseTick: number;
  /** normalized recording time of release */
  releaseT: number;
}

function rand(seedStart: number) {
  let s = seedStart * 9973;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function columnX(col: number): number {
  return (col - (COLUMN_HEIGHTS.length - 1) / 2) * COLUMN_GAP;
}

export function buildCoins(): CoinSpec[] {
  const out: CoinSpec[] = [];
  const maxH = Math.max(...COLUMN_HEIGHTS);
  const totalTicks = COIN_STEPS * COIN_SUBSTEPS;
  let k = 0;
  for (let level = 0; level < maxH; level++) {
    for (let col = 0; col < COLUMN_HEIGHTS.length; col++) {
      if (level >= COLUMN_HEIGHTS[col]) continue;
      const releaseTick = level === 0 ? 0 : FIRST_RELEASE + k++ * RELEASE_EVERY;
      out.push({ col, level, x: columnX(col), releaseTick, releaseT: releaseTick / totalTicks });
    }
  }
  return out;
}

export const COINS = buildCoins();

export function coinRestY(level: number): number {
  return FLOOR_Y + COIN_HH + level * COIN_PITCH;
}

export function setupCoins(R: Rapier, world: PhysicsWorld): PhysicsBody[] {
  const r = rand(5);
  /* thin coins: tighten contact slop so tall columns don't sink */
  world.lengthUnit = 0.1;
  const ground = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, FLOOR_Y - 0.1, 0));
  world.createCollider(R.ColliderDesc.cuboid(8, 0.1, 4).setFriction(1).setRestitution(0), ground);

  return COINS.map((c) => {
    const y0 = c.level === 0 ? coinRestY(0) : coinRestY(c.level) + DROP;
    const tilt = c.level === 0 ? 0 : (r() - 0.5) * 0.12;
    const yaw = r() * Math.PI;
    const desc = R.RigidBodyDesc.dynamic()
      .setTranslation(c.x + (r() - 0.5) * 0.022, y0, (r() - 0.5) * 0.022)
      .setRotation({ x: Math.sin(tilt / 2) * Math.cos(yaw), y: 0, z: Math.sin(tilt / 2) * Math.sin(yaw), w: Math.cos(tilt / 2) })
      .setLinearDamping(0.15)
      .setAngularDamping(1.2)
      .setCanSleep(true)
      .setCcdEnabled(true)
      .setEnabled(c.level === 0);
    const body = world.createRigidBody(desc);
    world.createCollider(
      R.ColliderDesc.roundCylinder(COIN_HH - 0.008, COIN_R - 0.008, 0.008)
        .setDensity(8)
        .setFriction(0.95)
        .setRestitution(0.08),
      body,
    );
    return body;
  });
}

export function coinsBeforeStep(step: number, _time: number, _R: Rapier, _world: PhysicsWorld, bodies: PhysicsBody[]) {
  for (let i = 0; i < COINS.length; i++) {
    if (COINS[i].releaseTick === step && step > 0) {
      const b = bodies[i];
      b.setEnabled(true);
      b.setLinvel({ x: 0, y: -1.2, z: 0 }, true);
    }
  }
}
