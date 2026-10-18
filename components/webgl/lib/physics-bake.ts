'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type RapierModule from '@dimforge/rapier3d-compat';

/**
 * Baked physics for scroll-scrubbed set pieces.
 *
 * A real Rapier rigid-body simulation runs ONCE (deterministically, off the
 * render loop) and every body's pose is recorded per frame. Scenes then map a
 * section's scroll progress to simulation time and `sample()` the recording —
 * so scrolling down plays the event and scrolling up rewinds it exactly.
 *
 *   const sim = useBakedSimulation({ key: 'home-wreck', steps: 240, setup, beforeStep });
 *   useFrame(() => {
 *     const baked = sim.current; if (!baked) return;          // still baking: hold rest pose
 *     const t = smooth(sectionRange(getSectionProgress('manifesto'), 0.1, 0.8));
 *     for (let i = 0; i < baked.count; i++) { baked.sample(i, t, tmpPos, tmpQuat); ... }
 *   });
 *
 * Rapier (wasm, ~1 MB) is loaded lazily on first bake, so scenes that never
 * bake never pay for it. Recordings are cached by `key` for the page lifetime.
 */

export type Rapier = typeof RapierModule;
export type PhysicsWorld = InstanceType<Rapier['World']>;
export type PhysicsBody = ReturnType<PhysicsWorld['createRigidBody']>;

export interface BakeOptions {
  /** cache key — unique per set piece (e.g. 'home-wrecking-ball') */
  key: string;
  /** number of recorded frames after the initial pose */
  steps: number;
  /** seconds per recorded frame (default 1/60) */
  dt?: number;
  /** world.step() calls per recorded frame, for stiffer stacks (default 2) */
  substeps?: number;
  /** default [0, -9.81, 0] */
  gravity?: [number, number, number];
  /** solver iterations (default 8; raise for tall stacks) */
  solverIterations?: number;
  /** build the world; return the bodies to record, in your render order */
  setup: (R: Rapier, world: PhysicsWorld) => PhysicsBody[];
  /** runs before every world.step — drive kinematic bodies, apply impulses */
  beforeStep?: (
    step: number,
    time: number,
    R: Rapier,
    world: PhysicsWorld,
    bodies: PhysicsBody[],
  ) => void;
}

export interface BakedSimulation {
  /** recorded frames (steps + 1, frame 0 = initial pose) */
  frames: number;
  /** recorded bodies */
  count: number;
  /** simulated seconds covered by the recording */
  duration: number;
  /** frames * count * 3 */
  positions: Float32Array;
  /** frames * count * 4 (x, y, z, w) */
  quaternions: Float32Array;
  /** interpolated pose of body `i` at normalized time t ∈ [0,1]; writes into out params, allocates nothing */
  sample: (i: number, t: number, outPosition: THREE.Vector3, outQuaternion: THREE.Quaternion) => void;
  /** linear speed of body `i` at t (units/sec) — handy for impact flashes, dust bursts, sound */
  speed: (i: number, t: number) => number;
}

let rapierPromise: Promise<Rapier> | null = null;

/** Lazily import + initialise the wasm module once per page. */
export function loadRapier(): Promise<Rapier> {
  if (!rapierPromise) {
    rapierPromise = import('@dimforge/rapier3d-compat').then(async (mod) => {
      const R = ((mod as unknown as { default?: Rapier }).default ?? mod) as Rapier;
      await R.init();
      return R;
    });
    rapierPromise.catch(() => {
      rapierPromise = null;
    });
  }
  return rapierPromise;
}

const cache = new Map<string, Promise<BakedSimulation>>();

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();

function createRecording(frames: number, count: number, dt: number, positions: Float32Array, quaternions: Float32Array): BakedSimulation {
  const last = frames - 1;
  const locate = (t: number) => {
    const f = (t < 0 ? 0 : t > 1 ? 1 : t) * last;
    const f0 = Math.floor(f);
    const f1 = f0 < last ? f0 + 1 : last;
    return { f0, f1, a: f - f0 };
  };

  return {
    frames,
    count,
    duration: last * dt,
    positions,
    quaternions,
    sample(i, t, outPosition, outQuaternion) {
      const { f0, f1, a } = locate(t);
      const p0 = (f0 * count + i) * 3;
      const p1 = (f1 * count + i) * 3;
      outPosition.set(
        positions[p0] + (positions[p1] - positions[p0]) * a,
        positions[p0 + 1] + (positions[p1 + 1] - positions[p0 + 1]) * a,
        positions[p0 + 2] + (positions[p1 + 2] - positions[p0 + 2]) * a,
      );
      const q0 = (f0 * count + i) * 4;
      const q1 = (f1 * count + i) * 4;
      qa.set(quaternions[q0], quaternions[q0 + 1], quaternions[q0 + 2], quaternions[q0 + 3]);
      qb.set(quaternions[q1], quaternions[q1 + 1], quaternions[q1 + 2], quaternions[q1 + 3]);
      outQuaternion.slerpQuaternions(qa, qb, a);
    },
    speed(i, t) {
      const { f0 } = locate(t);
      const f1 = f0 < last ? f0 + 1 : f0;
      if (f1 === f0) return 0;
      const p0 = (f0 * count + i) * 3;
      const p1 = (f1 * count + i) * 3;
      const dx = positions[p1] - positions[p0];
      const dy = positions[p1 + 1] - positions[p0 + 1];
      const dz = positions[p1 + 2] - positions[p0 + 2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz) / dt;
    },
  };
}

/** Run (or reuse) a baked simulation. Deterministic for identical options. */
export function bakeSimulation(options: BakeOptions): Promise<BakedSimulation> {
  const hit = cache.get(options.key);
  if (hit) return hit;

  const job = loadRapier().then((R) => {
    const dt = options.dt ?? 1 / 60;
    const substeps = Math.max(1, Math.floor(options.substeps ?? 2));
    const [gx, gy, gz] = options.gravity ?? [0, -9.81, 0];
    const world = new R.World({ x: gx, y: gy, z: gz });
    try {
      world.timestep = dt / substeps;
      world.numSolverIterations = options.solverIterations ?? 8;

      const bodies = options.setup(R, world);
      const count = bodies.length;
      const frames = options.steps + 1;
      const positions = new Float32Array(frames * count * 3);
      const quaternions = new Float32Array(frames * count * 4);

      const record = (frame: number) => {
        for (let i = 0; i < count; i++) {
          const p = bodies[i].translation();
          const q = bodies[i].rotation();
          const pi = (frame * count + i) * 3;
          const qi = (frame * count + i) * 4;
          positions[pi] = p.x;
          positions[pi + 1] = p.y;
          positions[pi + 2] = p.z;
          quaternions[qi] = q.x;
          quaternions[qi + 1] = q.y;
          quaternions[qi + 2] = q.z;
          quaternions[qi + 3] = q.w;
        }
      };

      record(0);
      let tick = 0;
      for (let frame = 1; frame < frames; frame++) {
        for (let s = 0; s < substeps; s++) {
          options.beforeStep?.(tick, tick * world.timestep, R, world, bodies);
          world.step();
          tick++;
        }
        record(frame);
      }
      return createRecording(frames, count, dt, positions, quaternions);
    } finally {
      world.free();
    }
  });

  cache.set(options.key, job);
  job.catch(() => cache.delete(options.key));
  return job;
}

/**
 * React hook: bakes on mount and exposes the recording through a ref so
 * `useFrame` can read it transiently (null until ready — render the rest pose).
 * Options are read once per key; change `key` to re-bake.
 */
export function useBakedSimulation(options: BakeOptions) {
  const ref = useRef<BakedSimulation | null>(null);
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    let alive = true;
    bakeSimulation(latest.current)
      .then((baked) => {
        if (alive) ref.current = baked;
      })
      .catch((error: unknown) => {
        console.error(`[physics-bake] "${latest.current.key}" failed`, error);
      });
    return () => {
      alive = false;
    };
  }, [options.key]);

  return ref;
}
