'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { GlassMaterial } from '../../lib/materials';
import { useQuality } from '../../lib/quality';
import { useBakedSimulation, type BakedSimulation } from '../../lib/physics-bake';
import { getSectionProgress, sectionRange, smooth, pointer } from '../../scroll-store';
import {
  BALL_R,
  BALL_START,
  CRADLE_SLOPE,
  CRADLE_Y,
  EDGE,
  FLOOR_T,
  GAP,
  RAMPS,
  RING_R,
  RUN_DT,
  RUN_STEPS,
  SLOPE,
  buildRun,
  cradle,
  floorY,
  panes,
  ramps,
  runBeforeStep,
} from './run-layout';

/**
 * ApproachScene — "The Marble Run".
 *
 * Five moves, in order, every time: a glass cat's-eye marble rolls down a
 * tower of five glass ramps, one per move. Each ramp ends in a drop to the
 * next and carries a glass gate that lights electric blue as the marble
 * passes through it. The roll is a real Rapier simulation baked once and
 * scrubbed by each move's section, so scrolling up rolls it back uphill
 * exactly. A fine thread records the path taken; in the outro the camera
 * pulls back to show the whole run, the marble resting in its cradle.
 */

const STAGE_IDS = ['evidence', 'truth', 'decision', 'implementation', 'tradeoff'] as const;
const RAIL_Z = 0.15;
const RAIL_R = 0.026;
/** rail centre height above the physics floor so the marble sits on both rails */
const RAIL_LIFT = BALL_R - Math.sqrt((BALL_R + RAIL_R) ** 2 - RAIL_Z ** 2);
const TOWER_MID = (0.6 + CRADLE_Y) / 2;

/* module temps — no allocation in useFrame */
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _look = new THREE.Vector3();
const _cIce = new THREE.Color('#dfe7ff');
const _cBlue = new THREE.Color('#2e4bff');
const _bounds = new Float32Array(RAMPS + 1);
const _ringLit = new Float32Array(RAMPS);

/** frame where the marble first lands on ramp k (k ≥ 1); last = settle */
function computeBounds(sim: BakedSimulation, out: Float32Array) {
  out[0] = 0;
  let k = 1;
  for (let f = 0; f < sim.frames && k < RAMPS; f++) {
    const y = sim.positions[f * 3 + 1];
    const r = ramps[k];
    if (y < floorY(r, -r.d * EDGE) + BALL_R + 0.06) out[k++] = f;
  }
  for (; k < RAMPS; k++) out[k] = sim.frames - 1;
  out[RAMPS] = sim.frames - 1;
}

/* ------------------------------------------------------------------ */
/*  The cat's-eye vane — a twisted electric ribbon inside the marble.   */
/* ------------------------------------------------------------------ */
function useVaneGeometry() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(BALL_R * 1.25, BALL_R * 0.5, 24, 4);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      /* lens taper + helical twist */
      const u = x / (BALL_R * 0.625);
      const taper = Math.sqrt(Math.max(1 - u * u, 0));
      const a = u * 1.4;
      const yy = y * taper;
      p.setXYZ(i, x, yy * Math.cos(a), yy * Math.sin(a));
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

/* ------------------------------------------------------------------ */
/*  Rails — one ramp = two thin glass rods the marble rides on.        */
/* ------------------------------------------------------------------ */
function Rail({
  x0,
  x1,
  yAt,
  ang,
}: {
  x0: number;
  x1: number;
  yAt: (x: number) => number;
  ang: number;
}) {
  const len = (x1 - x0) / Math.cos(ang);
  const mx = (x0 + x1) / 2;
  return (
    <group position={[mx, yAt(mx) + RAIL_LIFT, 0]} rotation={[0, 0, ang]}>
      {[-RAIL_Z, RAIL_Z].map((z) => (
        <mesh key={z} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[RAIL_R, RAIL_R, len, 14, 1]} />
          <GlassMaterial kind="azure" transmission={0.35} thickness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export default function ApproachScene() {
  const q = useQuality();
  const sim = useBakedSimulation({
    key: 'approach-marble-run-v1',
    steps: RUN_STEPS,
    dt: RUN_DT,
    substeps: 2,
    solverIterations: 12,
    setup: buildRun,
    beforeStep: runBeforeStep,
  });

  const towerRef = useRef<THREE.Group>(null);
  const marbleRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const ringMats = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const ringRefs = useRef<(THREE.Group | null)[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);
  const startRef = useRef<number | null>(null);
  const boundsReady = useRef(false);
  const lastFrame = useRef(-1);

  const vane = useVaneGeometry();

  /* thread: the path the marble has taken, revealed by drawRange */
  const thread = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * (RUN_STEPS + 1)), 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      color: '#2e4bff',
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.position.z = -0.42;
    return line;
  }, []);
  useEffect(
    () => () => {
      thread.geometry.dispose();
      (thread.material as THREE.Material).dispose();
    },
    [thread]
  );

  useFrame((state) => {
    const cam = state.camera;
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startRef.current;
    const intro = q.animate ? smooth(Math.min(Math.max(elapsed / 1.6, 0), 1)) : 1;
    const baked = sim.current;

    /* one-time: segment bounds + thread geometry from the recording */
    if (baked && !boundsReady.current) {
      computeBounds(baked, _bounds);
      const attr = thread.geometry.attributes.position as THREE.BufferAttribute;
      (attr.array as Float32Array).set(baked.positions.subarray(0, attr.array.length));
      attr.needsUpdate = true;
      boundsReady.current = true;
    }

    /* ---- scroll → simulation frame (each move scrubs its own ramp) ---- */
    let frame = 0;
    if (!q.animate) {
      frame = RUN_STEPS;
    } else if (boundsReady.current) {
      for (let i = 0; i < RAMPS; i++) {
        const k = sectionRange(getSectionProgress(STAGE_IDS[i]), 0.3, 0.74);
        frame += k * (_bounds[i + 1] - _bounds[i]);
      }
    }
    const t = frame / RUN_STEPS;

    /* ---- marble ---- */
    const m = marbleRef.current;
    let bx = BALL_START[0];
    let by = BALL_START[1];
    if (baked && boundsReady.current) {
      baked.sample(0, t, _pos, _quat);
      bx = _pos.x;
      by = _pos.y;
      if (spinRef.current) spinRef.current.quaternion.copy(_quat);
    }
    if (m) {
      /* intro: the marble settles onto the top ramp from just above */
      const drop = (1 - intro) * 0.9;
      m.position.set(bx, by + drop, 0);
    }
    if (q.animate && boundsReady.current && Math.round(frame) !== lastFrame.current) {
      lastFrame.current = Math.round(frame);
      thread.geometry.setDrawRange(0, Math.max(lastFrame.current + 1, 0));
    } else if (!q.animate && boundsReady.current) {
      thread.geometry.setDrawRange(0, RUN_STEPS + 1);
    }

    /* ---- gates: light as the marble passes through, stay lit after ---- */
    const level = Math.min(Math.max(Math.round(-by / GAP), 0), RAMPS - 1);
    for (let i = 0; i < RAMPS; i++) {
      const r = ramps[i];
      let lit = 0;
      let pulse = 0;
      if (!q.animate) {
        lit = 1;
      } else if (level > i || by < r.ring[1] - 0.8) {
        lit = 1;
      } else if (level === i) {
        const along = (bx - r.ring[0]) * r.d; /* + once through */
        lit = smooth(Math.min(Math.max((along + 0.25) / 0.4, 0), 1));
        pulse = Math.max(0, 1 - Math.abs(along) / 0.35);
      }
      _ringLit[i] += (lit - _ringLit[i]) * 0.12;
      const mat = ringMats.current[i];
      if (mat) {
        mat.emissive.copy(_cIce).lerp(_cBlue, _ringLit[i]);
        mat.emissiveIntensity = 0.12 + _ringLit[i] * 0.85 + pulse * 1.6;
      }
      const g = ringRefs.current[i];
      if (g) g.scale.setScalar(1 + pulse * 0.08);
    }

    /* ---- tower intro ---- */
    const tower = towerRef.current;
    if (tower) {
      tower.position.y = (1 - intro) * -0.35;
      tower.scale.setScalar(0.97 + 0.03 * intro);
    }

    /* ---- camera ---- */
    const outro = q.animate ? smooth(sectionRange(getSectionProgress('app-outro'), 0.1, 0.6)) : 1;
    const heroIn = q.animate ? smooth(sectionRange(getSectionProgress(STAGE_IDS[0]), 0.0, 0.4)) : 1;

    let cx: number;
    let cy: number;
    let cz: number;
    let lx: number;
    let ly: number;
    if (q.compact) {
      /* portrait: the whole run width in frame, marble in the upper third */
      const followY = THREE.MathUtils.lerp(-0.9, by - 1.2, heroIn);
      cy = THREE.MathUtils.lerp(followY, TOWER_MID, outro) + pointer.y * 0.15;
      cx = pointer.x * 0.25;
      cz = THREE.MathUtils.lerp(17.5, 25, outro);
      lx = 0;
      ly = cy;
    } else {
      /* the run owns the right half; during the hero it sits further out
         so the title reads clean, then the camera follows the marble down */
      const followY = THREE.MathUtils.lerp(-1.25, by - 0.25, heroIn);
      cy = THREE.MathUtils.lerp(followY, TOWER_MID, outro) + pointer.y * 0.22;
      lx = THREE.MathUtils.lerp(THREE.MathUtils.lerp(-3.6, -2.5, heroIn), -3.0, outro);
      cx = lx - 0.9 + pointer.x * 0.4;
      cz = THREE.MathUtils.lerp(11.5, 19.5, outro);
      ly = cy - 0.05;
    }
    if (!q.animate) {
      cam.position.set(q.compact ? 0 : -3.9, TOWER_MID, q.compact ? 25 : 19.5);
      _look.set(q.compact ? 0 : -3.0, TOWER_MID - 0.05, 0);
      cam.lookAt(_look);
    } else {
      cam.position.x += (cx - cam.position.x) * 0.05;
      cam.position.y += (cy - cam.position.y) * 0.05;
      cam.position.z += (cz - cam.position.z) * 0.05;
      _look.set(lx, cam.position.y + (ly - cy), 0);
      cam.lookAt(_look);
    }

    /* cursor light — a studio key that follows the pointer across the glass */
    const L = lightRef.current;
    if (L) {
      L.position.x += (pointer.x * 3.2 + 0.4 - L.position.x) * 0.06;
      L.position.y += (cam.position.y + pointer.y * 2.2 + 0.8 - L.position.y) * 0.06;
    }
  });

  const rings = ramps.map((r) => r.ring);

  return (
    <group>
      <SceneLightRig />
      <pointLight ref={lightRef} position={[0, 1, 3.2]} intensity={7} distance={9} decay={1.6} color="#ffffff" />

      <group ref={towerRef}>
        {/* ramps — twin glass rails each */}
        {ramps.map((r) => (
          <Rail key={r.index} x0={r.x0} x1={r.x1} yAt={(x) => floorY(r, x)} ang={-r.d * SLOPE} />
        ))}

        {/* cradle — two shallow rails meeting in a V */}
        {cradle.map((c, i) => {
          const half = c.len / 2;
          const x0 = c.cx - half;
          const x1 = c.cx + half;
          const side = i === 0 ? -1 : 1;
          return (
            <Rail
              key={`cradle-${i}`}
              x0={x0}
              x1={x1}
              yAt={(x) => CRADLE_Y + side * x * Math.tan(CRADLE_SLOPE)}
              ang={c.rot}
            />
          );
        })}

        {/* backstops — frosted glass panes at each drop */}
        {panes.map((p, i) => (
          <mesh key={`pane-${i}`} position={[p.x, p.y, 0]}>
            <boxGeometry args={[0.045, p.h, 0.62]} />
            <GlassMaterial kind="pane" transmission={0.55} thickness={0.25} roughness={0.28} />
          </mesh>
        ))}

        {/* gates — one glass ring per move */}
        {rings.map((ring, i) => (
          <group key={`ring-${i}`} position={ring} rotation={[0, 0, -ramps[i].d * SLOPE]}>
            <group
              ref={(g) => {
                ringRefs.current[i] = g;
              }}
            >
              <mesh rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[RING_R, 0.032, 18, 64]} />
                <GlassMaterial
                  ref={(mm) => {
                    ringMats.current[i] = mm;
                  }}
                  kind="crystal"
                  transmission={0.5}
                  emissive="#dfe7ff"
                  emissiveIntensity={0.12}
                  toneMapped={false}
                />
              </mesh>
            </group>
          </group>
        ))}

        {/* the floor line under each ramp — a hairline shadow on the glass */}
        {ramps.map((r) => {
          const len = (r.x1 - r.x0) / Math.cos(SLOPE);
          const mx = (r.x0 + r.x1) / 2;
          return (
            <mesh
              key={`floor-${r.index}`}
              position={[mx, floorY(r, mx) - FLOOR_T * 0.5, 0]}
              rotation={[0, 0, -r.d * SLOPE]}
            >
              <boxGeometry args={[len, 0.008, 0.42]} />
              <meshBasicMaterial color="#c8d4ff" transparent opacity={0.45} depthWrite={false} />
            </mesh>
          );
        })}

        <primitive object={thread} />
      </group>

      {/* the marble — clear glass, electric cat's-eye vane inside */}
      <group ref={marbleRef} position={BALL_START}>
        <group ref={spinRef}>
          <mesh>
            <sphereGeometry args={[BALL_R, 48, 32]} />
            <GlassMaterial kind="crystal" transmission={0.92} thickness={0.5} roughness={0.02} />
          </mesh>
          <mesh geometry={vane}>
            <meshStandardMaterial
              color="#2e4bff"
              emissive="#2e4bff"
              emissiveIntensity={0.9}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>

      <ParticleField
        count={Math.floor(1500 * q.particles)}
        spread={[7, 6.5, 4]}
        position={[0, TOWER_MID, -1.5]}
        size={0.032}
        drift={q.animate ? 0.1 : 0}
        opacity={0.32}
      />
    </group>
  );
}

