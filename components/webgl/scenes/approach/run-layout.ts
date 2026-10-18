import type { Rapier, PhysicsWorld, PhysicsBody } from '../../lib/physics-bake';

/**
 * Marble-run geometry — the single source of truth shared by the Rapier
 * bake (colliders) and the render tree (glass rails, panes, gates), so what
 * the marble rolls on is exactly what you see.
 *
 * Five ramps zig-zag down a narrow glass tower, one per Approach move.
 * Ramp i descends toward side d = +1 (right) or -1 (left); at its low end
 * the floor stops short of a glass backstop, the marble drops through the
 * gap onto the next ramp, which runs back the other way. Each ramp carries
 * a glass ring gate just before its drop. The last ramp drops into a
 * shallow V cradle where the marble comes to rest.
 */

export const BALL_R = 0.2;
export const SLOPE = (8.5 * Math.PI) / 180;
export const TAN = Math.tan(SLOPE);
/** vertical distance between ramp centre lines */
export const GAP = 1.5;
/** inner face of the side walls / backstops */
export const EDGE = 1.95;
/** width of the drop opening at each ramp's low end */
export const HOLE = 0.62;
export const WALL_T = 0.05;
export const FLOOR_T = 0.05;
export const RAMPS = 5;
/** gate ring x-offset (towards the low end) */
export const RING_X = 0.92;
export const RING_R = 0.36;
/** cradle */
export const CRADLE_SLOPE = (6 * Math.PI) / 180;
export const CRADLE_Y = -RAMPS * GAP + 0.28;
/** world height the tower spans (top of ramp 0 to cradle) */
export const TOWER_TOP = 0.6;
export const TOWER_BOTTOM = CRADLE_Y - 0.2;

export interface RampSpec {
  index: number;
  /** +1 descends to the right, -1 to the left */
  d: 1 | -1;
  /** y of the floor surface at x = 0 */
  yc: number;
  /** floor extent in x (min, max) */
  x0: number;
  x1: number;
  /** gate ring centre */
  ring: [number, number, number];
}

export function floorY(r: RampSpec, x: number): number {
  return r.yc - r.d * x * TAN;
}

export const ramps: RampSpec[] = Array.from({ length: RAMPS }, (_, i) => {
  const d = (i % 2 === 0 ? 1 : -1) as 1 | -1;
  const yc = -i * GAP;
  /* high end runs all the way to the wall; low end stops short (drop hole) */
  const hi = -d * EDGE;
  const lo = d * (EDGE - HOLE);
  const x0 = Math.min(hi, lo);
  const x1 = Math.max(hi, lo);
  const rx = d * RING_X;
  const spec: RampSpec = { index: i, d, yc, x0, x1, ring: [rx, 0, 0] };
  spec.ring[1] = floorY(spec, rx) + BALL_R;
  return spec;
});

export interface PaneSpec {
  /** centre */
  x: number;
  y: number;
  /** full height */
  h: number;
}

/** vertical glass panes: the start wall, one backstop per drop, the cradle's far wall */
export const panes: PaneSpec[] = (() => {
  const out: PaneSpec[] = [];
  const r0 = ramps[0];
  const sx = -r0.d * (EDGE + WALL_T / 2);
  const sTop = floorY(r0, -r0.d * EDGE) + 0.5;
  const sBot = floorY(r0, -r0.d * EDGE) - FLOOR_T;
  out.push({ x: sx, y: (sTop + sBot) / 2, h: sTop - sBot });
  for (let i = 0; i < RAMPS; i++) {
    const r = ramps[i];
    const x = r.d * (EDGE + WALL_T / 2);
    const top = floorY(r, r.d * EDGE) + 0.62;
    const next = ramps[i + 1];
    const bot = next ? floorY(next, r.d * EDGE) - FLOOR_T : CRADLE_Y - 0.12;
    out.push({ x, y: (top + bot) / 2, h: top - bot });
  }
  /* cradle far wall — opposite the last backstop */
  const last = ramps[RAMPS - 1];
  const fx = -last.d * (EDGE + WALL_T / 2);
  out.push({ x: fx, y: CRADLE_Y + 0.12, h: 0.48 });
  return out;
})();

/** the cradle: two shallow slabs meeting at x = 0 */
export const cradle = [-1, 1].map((side) => {
  const half = EDGE / 2;
  const cx = side * half;
  const cy = CRADLE_Y + half * Math.tan(CRADLE_SLOPE);
  return { cx, cy, rot: side * CRADLE_SLOPE, len: EDGE };
});

export const BALL_START: [number, number, number] = (() => {
  const r = ramps[0];
  const x = -r.d * (EDGE - BALL_R - 0.02);
  return [x, floorY(r, x) + BALL_R + 0.002, 0];
})();

/** quaternion for a rotation about z (no allocation, plain object) */
function zq(a: number) {
  return { x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) };
}

/** Build the run in a Rapier world; returns [ball]. */
export function buildRun(R: Rapier, world: PhysicsWorld): PhysicsBody[] {
  const fixed = world.createRigidBody(R.RigidBodyDesc.fixed());

  for (const r of ramps) {
    const len = (r.x1 - r.x0) / Math.cos(SLOPE);
    const mx = (r.x0 + r.x1) / 2;
    const ang = -r.d * SLOPE;
    /* collider centre sits half a thickness below the surface, along the normal */
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    world.createCollider(
      R.ColliderDesc.cuboid(len / 2, FLOOR_T / 2, 0.5)
        .setTranslation(mx - nx * (FLOOR_T / 2), floorY(r, mx) - ny * (FLOOR_T / 2), 0)
        .setRotation(zq(ang))
        .setFriction(0.9)
        .setRestitution(0.05),
      fixed,
    );
  }

  for (const p of panes) {
    world.createCollider(
      R.ColliderDesc.cuboid(WALL_T / 2, p.h / 2, 0.5)
        .setTranslation(p.x, p.y, 0)
        .setFriction(0.1)
        .setRestitution(0),
      fixed,
    );
  }

  for (const c of cradle) {
    const nx = -Math.sin(c.rot);
    const ny = Math.cos(c.rot);
    world.createCollider(
      R.ColliderDesc.cuboid(c.len / 2 / Math.cos(CRADLE_SLOPE), FLOOR_T / 2, 0.5)
        .setTranslation(c.cx - nx * (FLOOR_T / 2), c.cy - ny * (FLOOR_T / 2), 0)
        .setRotation(zq(c.rot))
        .setFriction(0.9)
        .setRestitution(0.05),
      fixed,
    );
  }

  const ball = world.createRigidBody(
    R.RigidBodyDesc.dynamic()
      .setTranslation(BALL_START[0], BALL_START[1], BALL_START[2])
      .enabledTranslations(true, true, false)
      .enabledRotations(false, false, true)
      .setCcdEnabled(true)
      .setCanSleep(false)
      .setLinearDamping(0.04)
      .setAngularDamping(0.05),
  );
  world.createCollider(
    R.ColliderDesc.ball(BALL_R).setDensity(1).setFriction(0.9).setRestitution(0.18),
    ball,
  );
  return [ball];
}

/** felt-lined cradle: once the marble is down, damp it so it settles calmly */
export function runBeforeStep(
  _step: number,
  _time: number,
  _R: Rapier,
  _world: PhysicsWorld,
  bodies: PhysicsBody[],
) {
  const b = bodies[0];
  if (b.translation().y < CRADLE_Y + 0.6) {
    b.setLinearDamping(1.5);
    b.setAngularDamping(1.5);
  }
}

export const RUN_STEPS = 1200;
export const RUN_DT = 1 / 60;
