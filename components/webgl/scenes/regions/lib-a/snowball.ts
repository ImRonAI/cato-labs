import type { Rapier, PhysicsWorld, PhysicsBody } from '../../../lib/physics-bake';

/**
 * Big Bear snowball — the physical set piece, as plain data + Rapier setup.
 * Shared by BigBearScene (render) and the bake; no React, no three.
 * The ball's collider grows with distance rolled; the radius of every
 * recorded frame lands in `radii` so the render can scrub it with the pose.
 */

/* ---------- the mountain (shared by physics and render) ---------- */
export const THETA = 0.4; // slope angle
export const SLOPE_HX = 3.4;
export const SLOPE_HZ = 1.5;
export const SLAB = 0.1;
export const RUN_HX = 1.9;
export const RUN_TILT = 0; // run-out rises gently
export const R0 = 0.07;
export const GROW = 0.062; // radius gained per unit rolled
export const R_MAX = 0.48;
export const STEPS = 300;
export const SUBSTEPS = 2;
export const TRAIL = 140;
export const FLAKES = 900;

export const sinT = Math.sin(THETA);
export const cosT = Math.cos(THETA);
/* the slope's foot, where the run-out begins (top surface) */
export const FOOT_X = SLOPE_HX * cosT + SLAB * sinT;
export const FOOT_Y = -SLOPE_HX * sinT + SLAB * cosT;
/* a point on the slope's top surface at local x */
export function slopeSurface(lx: number, out: { x: number; y: number }) {
  out.x = lx * cosT + SLAB * sinT;
  out.y = -lx * sinT + SLAB * cosT;
  return out;
}
export const _s2 = { x: 0, y: 0 };
export const START = slopeSurface(-SLOPE_HX + 0.35, { x: 0, y: 0 });
export const MOGULS: [number, number][] = [
  [-1.1, 0.12],
  [0.9, -0.18],
];

/* radius per recorded frame — written while baking, read while scrubbing */
export const radii = new Float32Array(STEPS + 1);

export function setup(R: Rapier, world: PhysicsWorld): PhysicsBody[] {
  const ground = world.createRigidBody(R.RigidBodyDesc.fixed());
  const rot = (a: number) => ({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) });
  world.createCollider(
    R.ColliderDesc.cuboid(SLOPE_HX, SLAB, SLOPE_HZ).setRotation(rot(-THETA)).setFriction(1).setRestitution(0.05),
    ground,
  );
  /* run-out: top surface continues from the foot, rising gently */
  const runCx = FOOT_X + RUN_HX * Math.cos(RUN_TILT) + SLAB * Math.sin(RUN_TILT);
  const runCy = FOOT_Y + RUN_HX * Math.sin(RUN_TILT) - SLAB * Math.cos(RUN_TILT);
  world.createCollider(
    R.ColliderDesc.cuboid(RUN_HX, SLAB, SLOPE_HZ)
      .setTranslation(runCx, runCy, 0)
      .setRotation(rot(RUN_TILT))
      .setFriction(1.2),
    ground,
  );
  /* a snowbank wall at the far end of the run-out */
  world.createCollider(
    R.ColliderDesc.cuboid(0.3, 0.8, SLOPE_HZ)
      .setTranslation(runCx + RUN_HX * Math.cos(RUN_TILT) + 0.3, runCy + 0.6, 0)
      .setFriction(1),
    ground,
  );
  /* buried moguls — low bumps that make the ball hop and veer */
  for (const [lx, z] of MOGULS) {
    slopeSurface(lx, _s2);
    world.createCollider(
      R.ColliderDesc.ball(0.32).setTranslation(_s2.x - sinT * 0.27, _s2.y - cosT * 0.27, z).setFriction(1),
      ground,
    );
  }

  const ball = world.createRigidBody(
    R.RigidBodyDesc.dynamic()
      .setTranslation(START.x + sinT * R0, START.y + cosT * R0, 0.06)
      .setLinearDamping(0.12)
      .setAngularDamping(0.5)
      .setCanSleep(false),
  );
  world.createCollider(R.ColliderDesc.ball(R0).setDensity(1.2).setFriction(1.4).setRestitution(0.08), ball);
  radii[0] = R0;
  last.x = START.x;
  last.y = START.y;
  last.z = 0.06;
  last.r = R0;
  last.onRun = false;
  return [ball];
}

export const last = { x: 0, y: 0, z: 0, r: R0, onRun: false };
export function beforeStep(step: number, _time: number, _R: Rapier, _w: PhysicsWorld, bodies: PhysicsBody[]) {
  const b = bodies[0];
  const p = b.translation();
  const d = Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z);
  last.x = p.x;
  last.y = p.y;
  last.z = p.z;
  const r = Math.min(R_MAX, last.r + d * GROW);
  if (r - last.r > 1e-4) {
    last.r = r;
    b.collider(0).setRadius(r);
    b.recomputeMassPropertiesFromColliders();
  }
  /* ploughing fresh snow on the flat: the drag that brings it to rest */
  if (p.x > FOOT_X && !last.onRun) {
    last.onRun = true;
    b.setLinearDamping(1.1);
    b.setAngularDamping(2.4);
  } else if (p.x <= FOOT_X && last.onRun) {
    last.onRun = false;
    b.setLinearDamping(0.12);
    b.setAngularDamping(0.5);
  }
  radii[Math.min(STEPS, Math.floor(step / SUBSTEPS) + 1)] = last.r;
}

