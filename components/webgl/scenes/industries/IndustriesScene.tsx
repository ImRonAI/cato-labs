'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { GlassMaterial } from '../../lib/materials';
import { useQuality } from '../../lib/quality';
import { useHotspotReporter } from '../../kit/ProximityType';
import {
  createPhases,
  readPhases,
  stageCamera,
  resetCameraLook,
  liftFor,
  pointerTilt,
  introT,
  range,
  smooth,
  easeInOutCubic,
  settle,
  lerp,
  rng,
  type Pose,
} from './lib-a/stage';

/**
 * IndustriesScene — "The Sliding Puzzle".
 *
 * Twelve glass tiles, one per industry, on a 4×3 glass board. Eleven sit
 * scrambled around a single hole; the twelfth (deep blue) hovers off the
 * board. Through the `moment` dwell the puzzle solves itself, one slide at
 * a time — the real inverse of a random scramble, so every move is legal —
 * and each tile warms as it reaches home. The last tile arcs in and lands,
 * a light sweep crosses the solved board: one method, twelve markets.
 * Scrubbed by scroll, so scrolling up re-scrambles exactly. As the dwell
 * releases, the solved board lifts away with the page so the index below
 * reads on clean paper.
 */

const COLS = 4;
const ROWS = 3;
const SLOTS = COLS * ROWS;
const HOLE = SLOTS - 1;
const PITCH = 1.1;
const TILE = 1;
const MOVES = 24;
const SOLVE_END = 0.8;

function slotXY(slot: number): [number, number] {
  const c = slot % COLS;
  const r = Math.floor(slot / COLS);
  return [(c - (COLS - 1) / 2) * PITCH, ((ROWS - 1) / 2 - r) * PITCH];
}

/** states[m][tile] = slot after m scramble moves from solved (tiles 0..10). */
function buildScramble(): number[][] {
  const r = rng(41);
  const slotOf = Array.from({ length: HOLE }, (_, i) => i);
  let hole = HOLE;
  let prev = -1;
  const states: number[][] = [slotOf.slice()];
  for (let m = 0; m < MOVES; m++) {
    const c = hole % COLS;
    const row = Math.floor(hole / COLS);
    const nbrs: number[] = [];
    if (c > 0) nbrs.push(hole - 1);
    if (c < COLS - 1) nbrs.push(hole + 1);
    if (row > 0) nbrs.push(hole - COLS);
    if (row < ROWS - 1) nbrs.push(hole + COLS);
    const options = nbrs.filter((n) => n !== prev);
    const next = options[Math.floor(r() * options.length)];
    const tile = slotOf.indexOf(next);
    slotOf[tile] = hole;
    prev = hole;
    hole = next;
    states.push(slotOf.slice());
  }
  return states;
}

/* hero: the scrambled board rests right of the headline, whole and small */
const HERO: Pose = { pos: [-4.3, 0.2, 16], look: [-4.3, -0.15, 0] };
const MOMENT: Pose = { pos: [0, 0.35, 8.9], look: [0, 0.12, 0] };
const HERO_C: Pose = { pos: [0, 4.6, 15.5], look: [0, 4.6, 0] };
const MOMENT_C: Pose = { pos: [0, 0, 11.8], look: [0, 0.15, 0] };

const _home = new THREE.Vector3();
const _blue = new THREE.Color('#2e4bff');

export default function IndustriesScene() {
  const q = useQuality();
  const board = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const tiles = useRef<(THREE.Mesh | null)[]>([]);
  const lastTile = useRef<THREE.Mesh>(null);
  const report = useHotspotReporter('ind-grid');
  const phases = useMemo(createPhases, []);
  const states = useMemo(buildScramble, []);
  const first = useRef(true);

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    const ph = readPhases('moment', q.compact, anim, phases);
    const play = ph.play;
    const intro = introT(el, anim);

    /* ---- the solve: playback runs the scramble backwards ---- */
    const solve = range(play, 0, SOLVE_END) * MOVES;
    const k = Math.min(Math.floor(solve), MOVES - 1);
    const f = easeInOutCubic(range(solve - k, 0.08, 0.92));
    const from = states[MOVES - k];
    const to = states[MOVES - k - 1];
    const sweep = range(play, 0.9, 1);

    for (let i = 0; i < HOLE; i++) {
      const m = tiles.current[i];
      if (!m) continue;
      const a = slotXY(solve >= MOVES ? i : from[i]);
      const b = slotXY(solve >= MOVES ? i : to[i]);
      const moving = solve < MOVES && from[i] !== to[i];
      const t = moving ? f : 0;
      m.position.x = lerp(a[0], b[0], t);
      m.position.y = lerp(a[1], b[1], t);
      m.position.z = moving ? Math.sin(t * Math.PI) * 0.22 : 0;

      const pop = anim ? smooth(range(el, 0.2 + i * 0.05, 0.9 + i * 0.05)) : 1;
      m.scale.setScalar(Math.max(pop, 0.001));

      /* home glow: a tile at its own slot warms; the final sweep runs diagonally */
      const atHome = (moving ? (t > 0.5 ? to[i] : from[i]) : solve >= MOVES ? i : from[i]) === i;
      const [hx, hy] = slotXY(i);
      const diag = (hx / PITCH + (ROWS - 1) / 2 - hy / PITCH + 1.5) / 6;
      const wave = Math.max(0, 1 - Math.abs(sweep * 1.4 - 0.2 - diag) * 5);
      const mat = m.material as THREE.MeshPhysicalMaterial;
      const target =
        (atHome ? 0.16 : 0) + wave * 0.7 + (moving ? 0.12 : 0);
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * (anim ? 0.12 : 1);
    }

    /* ---- the twelfth tile: hovers off-board, then arcs home and lands ---- */
    const lt = lastTile.current;
    if (lt) {
      const land = range(play, SOLVE_END + 0.02, 0.93);
      const arc = easeInOutCubic(land);
      const [hx, hy] = slotXY(HOLE);
      _home.set(hx + 1.25, hy + 1.85, 1.3);
      const hoverBob = anim ? Math.sin(el * 1.1) * 0.06 * (1 - arc) : 0;
      lt.position.x = lerp(_home.x, hx, arc);
      lt.position.y = lerp(_home.y + hoverBob, hy, arc);
      /* drops onto the board with a small settle */
      const z = lerp(_home.z, 0, settle(land, 1.6, 6));
      lt.position.z = z + Math.sin(arc * Math.PI) * 0.6;
      lt.rotation.x = lerp(-0.5, 0, arc) + (anim ? Math.sin(el * 0.7) * 0.05 * (1 - arc) : 0);
      lt.rotation.y = lerp(0.6, 0, arc);
      lt.rotation.z = lerp(-0.18, 0, arc);
      const pop = anim ? smooth(range(el, 0.9, 1.7)) : 1;
      lt.scale.setScalar(Math.max(pop, 0.001));
      const mat = lt.material as THREE.MeshPhysicalMaterial;
      mat.emissiveIntensity = 0.22 + 0.5 * Math.max(0, 1 - Math.abs(land - 0.98) * 8);
      report(lt, state.camera, 0.5 + 0.4 * arc);
    }

    /* ---- board: intro rise, pointer tilt, mobile turns portrait ---- */
    const mom = q.compact ? MOMENT_C : MOMENT;
    const g = board.current;
    if (g) {
      /* page-locked lift as the dwell scrolls away */
      const lift = liftFor(mom.pos[2], q.compact ? 2.4 : 1.8, ph.exitLin);
      g.position.y = -0.9 * (1 - intro) + lift;
      g.rotation.z = q.compact ? Math.PI / 2 : 0;
    }
    const tg = tilt.current;
    if (tg) {
      const baseY = lerp(-0.32, 0, ph.approach);
      const baseX = lerp(-0.1, 0, ph.approach);
      if (anim) pointerTilt(tg, 0.14, 0.05, baseX, baseY);
      else tg.rotation.set(baseX, baseY, 0);
    }

    /* ---- camera ---- */
    if (first.current) {
      resetCameraLook();
      first.current = false;
    }
    const hero = q.compact ? HERO_C : HERO;
    stageCamera(state.camera, hero, mom, mom, ph.approach, 0, anim ? 0.35 : 0, anim ? 0.05 : 1);
  });

  return (
    <>
      <SceneLightRig />
      <group ref={board}>
        <group ref={tilt}>
          {/* the board */}
          <RoundedBox
            args={[COLS * PITCH + 0.32, ROWS * PITCH + 0.32, 0.12]}
            radius={0.1}
            smoothness={4}
            position={[0, 0, -0.2]}
          >
            <GlassMaterial kind="ice" transmission={0.9} roughness={0.22} />
          </RoundedBox>

          {/* eleven tiles */}
          {Array.from({ length: HOLE }, (_, i) => (
            <RoundedBox
              key={i}
              ref={(m: THREE.Mesh | null) => {
                tiles.current[i] = m;
              }}
              args={[TILE, TILE, 0.2]}
              radius={0.07}
              smoothness={4}
            >
              <GlassMaterial
                kind={i % 3 === 1 ? 'azure' : 'crystal'}
                emissive={_blue}
                emissiveIntensity={0}
              />
            </RoundedBox>
          ))}

          {/* the twelfth */}
          <RoundedBox ref={lastTile} args={[TILE, TILE, 0.2]} radius={0.07} smoothness={4}>
            <GlassMaterial kind="deep" emissive={_blue} emissiveIntensity={0.22} />
          </RoundedBox>
        </group>
      </group>

      <ParticleField
        count={Math.floor(1100 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.28}
      />
    </>
  );
}
