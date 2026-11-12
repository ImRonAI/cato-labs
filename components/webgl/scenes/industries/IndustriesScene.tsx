'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { GlassMaterial } from '../../lib/materials';
import { useQuality } from '../../lib/quality';
import { getSectionProgress, sectionRange } from '../../scroll-store';
import { useHotspotReporter } from '../../kit/ProximityType';
import ShockRing, { useShockMaterial } from './lib-b/ShockRing';
import {
  createPhases,
  readPhases,
  stageCamera,
  resetCameraLook,
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
 * Twelve refractive glass tiles, one per industry, on a 4×3 optical board.
 * Eleven sit scrambled around a single hole; the twelfth (deep sapphire)
 * hovers off-board. Through the `moment` dwell (`MomentDwell`) the puzzle
 * solves itself one legal move at a time, the twelfth tile arcs home and
 * lands with a luminous shockwave, and a diagonal light wave crosses the
 * solved grid: one method, twelve markets.
 *
 * As `moment` exits into `feature`, `detail`, and `cta`, the solved board
 * recedes into a poised stage-right gallery backdrop:
 *   • `feature` (0 → 1): lights tiles 01 → 12 sequentially as each row passes
 *   • `detail`: illuminates the three market-truth triad tiles
 *   • `cta`: unifies all twelve tiles in a calm resonant glow
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

/* hero: scrambled board rests right of the headline; moment: dead-centre; rest: poised stage-right */
const HERO: Pose = { pos: [-4.1, 0.2, 15.8], look: [-4.1, -0.15, 0] };
const MOMENT: Pose = { pos: [0, 0.35, 8.9], look: [0, 0.12, 0] };
const REST: Pose = { pos: [-3.6, 0.25, 14.8], look: [-3.6, 0.05, 0] };

const HERO_C: Pose = { pos: [0, 4.6, 15.5], look: [0, 4.6, 0] };
const MOMENT_C: Pose = { pos: [0, 0, 11.8], look: [0, 0.15, 0] };
const REST_C: Pose = { pos: [0, 3.8, 16.5], look: [0, 3.8, 0] };

const TRUTH_TILES = [3, 7, 11] as const;

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
  const startAt = useRef<number | null>(null);

  const shockMat = useShockMaterial({
    speed: 1.35,
    width: 0.028,
    color: '#2e4bff',
    hot: '#dce4ff',
  });

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = now;
    const el = now - startAt.current;
    const anim = q.animate;

    const ph = readPhases('moment', q.compact, anim, phases);
    /* once the moment dwell has exited, keep the puzzle solved! */
    const play = anim ? (ph.exitLin > 0 ? 1 : ph.play) : 1;
    const intro = introT(el, anim);

    /* downstream section progress for row-by-row lighting & outro chord */
    const featRaw = getSectionProgress('feature');
    const featActive = featRaw > 0.02 && featRaw < 0.98 ? 1 : 0;
    const featIdx = sectionRange(featRaw, 0.05, 0.93) * (SLOTS - 1);
    const det = smooth(sectionRange(getSectionProgress('detail'), 0.08, 0.88));
    const cta = smooth(sectionRange(getSectionProgress('cta'), 0.08, 0.85));

    /* ---- the solve: playback runs the 24-move scramble backwards ---- */
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

      /* row-pass highlight in `feature` + triad highlight in `detail` */
      const rowFocus =
        featActive * Math.max(0, 1 - Math.abs(featIdx - i) * 0.95);
      const isTruth =
        i === TRUTH_TILES[0] || i === TRUTH_TILES[1] ? det * (1 - cta) : 0;

      m.position.x = lerp(a[0], b[0], t);
      m.position.y = lerp(a[1], b[1], t);
      m.position.z =
        (moving ? Math.sin(t * Math.PI) * 0.24 : 0) +
        rowFocus * 0.22 +
        isTruth * 0.26 +
        cta * 0.08;

      const pop = anim
        ? smooth(range(el, 0.12 + i * 0.045, 0.8 + i * 0.045))
        : 1;
      m.scale.setScalar(Math.max(pop, 0.001));

      const atHome =
        (moving ? (t > 0.5 ? to[i] : from[i]) : solve >= MOVES ? i : from[i]) ===
        i;
      const [hx, hy] = slotXY(i);
      const diag = (hx / PITCH + (ROWS - 1) / 2 - hy / PITCH + 1.5) / 6;
      const wave =
        ph.exitLin < 0.2
          ? Math.max(0, 1 - Math.abs(sweep * 1.4 - 0.2 - diag) * 5)
          : 0;
      const mat = m.material as THREE.MeshPhysicalMaterial;
      const target =
        (atHome ? 0.14 : 0) +
        wave * 0.72 +
        (moving ? 0.14 : 0) +
        rowFocus * 0.65 +
        isTruth * 0.68 +
        cta * 0.35;
      mat.emissiveIntensity +=
        (target - mat.emissiveIntensity) * (anim ? 0.12 : 1);
    }

    /* ---- the twelfth tile: hovers off-board, then arcs home and lands ---- */
    const lt = lastTile.current;
    const land = range(play, SOLVE_END + 0.02, 0.93);
    if (lt) {
      const arc = easeInOutCubic(land);
      const [hx, hy] = slotXY(HOLE);
      _home.set(hx + 1.25, hy + 1.85, 1.3);
      const hoverBob = anim ? Math.sin(el * 1.1) * 0.06 * (1 - arc) : 0;
      const rowFocus12 =
        featActive * Math.max(0, 1 - Math.abs(featIdx - HOLE) * 0.95);
      const truth12 = det * (1 - cta);

      lt.position.x = lerp(_home.x, hx, arc);
      lt.position.y = lerp(_home.y + hoverBob, hy, arc);
      const z = lerp(_home.z, 0, settle(land, 1.6, 6));
      lt.position.z =
        z +
        Math.sin(arc * Math.PI) * 0.6 +
        rowFocus12 * 0.22 +
        truth12 * 0.28 +
        cta * 0.12;
      lt.rotation.x =
        lerp(-0.5, 0, arc) +
        (anim ? Math.sin(el * 0.7) * 0.05 * (1 - arc) : 0);
      lt.rotation.y = lerp(0.6, 0, arc);
      lt.rotation.z = lerp(-0.18, 0, arc);
      const pop = anim ? smooth(range(el, 0.75, 1.5)) : 1;
      lt.scale.setScalar(Math.max(pop, 0.001));

      const mat = lt.material as THREE.MeshPhysicalMaterial;
      const landFlash =
        ph.exitLin < 0.2 ? Math.max(0, 1 - Math.abs(land - 0.98) * 8) : 0;
      mat.emissiveIntensity =
        0.24 +
        0.55 * landFlash +
        rowFocus12 * 0.65 +
        truth12 * 0.7 +
        cta * 0.42;
      report(lt, state.camera, 0.5 + 0.4 * arc + 0.1 * cta);
    }

    /* shockwave ripple when the twelfth tile seats into the corner */
    const tau = play > 0.91 && ph.exitLin < 0.5 ? (play - 0.91) * 8.5 : 0;
    shockMat.uniforms.uTau.value = anim ? tau : 0;

    /* ---- board: intro rise, pointer tilt, gallery rest poise ---- */
    const g = board.current;
    if (g) {
      g.position.y = -0.9 * (1 - intro) + cta * 0.22;
      g.position.z = -ph.exit * 1.4 + cta * 0.6;
      g.rotation.z = q.compact ? Math.PI / 2 : 0;
    }
    const tg = tilt.current;
    if (tg) {
      const baseY = lerp(lerp(-0.32, 0, ph.approach), -0.28 + cta * 0.12, ph.exit);
      const baseX = lerp(lerp(-0.1, 0, ph.approach), 0.06, ph.exit);
      if (anim) pointerTilt(tg, 0.14, 0.05, baseX, baseY);
      else tg.rotation.set(baseX, baseY, 0);
    }

    /* ---- camera ---- */
    if (first.current) {
      resetCameraLook();
      first.current = false;
    }
    const hero = q.compact ? HERO_C : HERO;
    const mom = q.compact ? MOMENT_C : MOMENT;
    const rest = q.compact ? REST_C : REST;
    stageCamera(
      state.camera,
      hero,
      mom,
      rest,
      ph.approach,
      ph.exit,
      anim ? 0.35 : 0,
      anim ? 0.05 : 1,
    );
  });

  return (
    <>
      <SceneLightRig />
      <group ref={board}>
        <group ref={tilt}>
          {/* optical glass board chassis */}
          <RoundedBox
            args={[COLS * PITCH + 0.36, ROWS * PITCH + 0.36, 0.12]}
            radius={0.1}
            smoothness={4}
            position={[0, 0, -0.2]}
          >
            <GlassMaterial kind="ice" transmission={0.9} roughness={0.2} />
          </RoundedBox>

          {/* eleven sliding industry tiles */}
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

          {/* the twelfth deep-sapphire tile */}
          <RoundedBox
            ref={lastTile}
            args={[TILE, TILE, 0.2]}
            radius={0.07}
            smoothness={4}
          >
            <GlassMaterial kind="deep" emissive={_blue} emissiveIntensity={0.22} />
          </RoundedBox>

          {/* shockwave across board plane when the twelfth tile lands */}
          <group rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.12]}>
            <ShockRing material={shockMat} radius={3.4} position={[0, 0, 0]} />
          </group>
        </group>
      </group>

      <ParticleField
        count={Math.floor(1150 * q.particles)}
        drift={q.animate ? 0.1 : 0}
        opacity={0.28}
      />
    </>
  );
}
