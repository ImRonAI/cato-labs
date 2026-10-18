'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial, type GlassKind } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';

/**
 * OperationsAutomationScene — "Clockwork".
 *
 * Three interlocking glass gears (true involute-ish spacing, meshed by tooth
 * count) stand behind a frosted glass machine. The gear train drives a glass
 * conveyor: raw, askew, pale blocks ride in from the left, pass through the
 * machine and leave as identical electric-blue units, squared to the line.
 *
 * Everything is a pure function of scroll (no time-based motion except the
 * mount intro), so scrolling up rewinds the machine exactly:
 *   machine (dwell) — the train spins up, the belt carries the work through
 *   feature/detail  — the train keeps turning slowly as the reader moves on
 * Reduced motion → a composed mid-run still (half raw, half finished).
 */

/* ---------- gear train ---------- */

const MODULE = 0.074;
const GEAR_DEPTH = 0.16;
const GEAR_Z = -1.35;

interface GearSpec {
  teeth: number;
  kind: GlassKind;
  windows: number;
}

const GEARS: readonly GearSpec[] = [
  { teeth: 30, kind: 'ice', windows: 5 },
  { teeth: 18, kind: 'pane', windows: 4 },
  { teeth: 12, kind: 'core', windows: 0 },
];

const pitchR = (n: number) => (MODULE * n) / 2;

/** gear centres: each meshes with the previous along a chosen line of centres */
const LINE_ANGLES = [0, -0.44, 0.72];
const GEAR_POS: [number, number][] = (() => {
  const out: [number, number][] = [[-0.95, 0.9]];
  for (let i = 1; i < GEARS.length; i++) {
    const d = pitchR(GEARS[i - 1].teeth) + pitchR(GEARS[i].teeth);
    const [px, py] = out[i - 1];
    out.push([px + Math.cos(LINE_ANGLES[i]) * d, py + Math.sin(LINE_ANGLES[i]) * d]);
  }
  return out;
})();

/** rotation of every gear given the driver angle — teeth stay meshed */
function gearAngles(theta: number, out: number[]) {
  out[0] = theta;
  for (let i = 1; i < GEARS.length; i++) {
    const n1 = GEARS[i - 1].teeth;
    const n2 = GEARS[i].teeth;
    const a = LINE_ANGLES[i];
    out[i] = -(n1 / n2) * (out[i - 1] - a) + a + Math.PI + Math.PI / n2;
  }
}

function makeGearGeometry(spec: GearSpec) {
  const { teeth, windows } = spec;
  const r = pitchR(teeth);
  const ra = r + MODULE * 0.95;
  const rf = r - MODULE * 1.2;
  const p = Math.PI / teeth;
  const shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = (2 * Math.PI * i) / teeth;
    const pts: [number, number][] = [
      [a - p * 0.64, rf],
      [a - p * 0.34, ra],
      [a + p * 0.34, ra],
      [a + p * 0.64, rf],
      [a + p, rf * 0.998],
    ];
    pts.forEach(([ang, rad], k) => {
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad;
      if (i === 0 && k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();

  /* axle bore */
  const bore = new THREE.Path();
  bore.absarc(0, 0, Math.max(0.09, r * 0.12), 0, Math.PI * 2, true);
  shape.holes.push(bore);

  /* spoke windows — annular sectors between hub and rim */
  if (windows > 0) {
    const rIn = r * 0.34;
    const rOut = rf - MODULE * 1.5;
    const span = (Math.PI * 2) / windows;
    const gap = 0.32;
    for (let w = 0; w < windows; w++) {
      const a0 = w * span + gap / 2 + 0.3;
      const a1 = (w + 1) * span - gap / 2 + 0.3;
      const win = new THREE.Path();
      win.absarc(0, 0, rOut, a0, a1, false);
      win.absarc(0, 0, rIn, a1 - 0.08, a0 + 0.08, true);
      win.closePath();
      shape.holes.push(win);
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: GEAR_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.022,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.translate(0, 0, -GEAR_DEPTH / 2);
  geo.computeVertexNormals();
  return geo;
}

/* ---------- conveyor + machine ---------- */

const BELT_Y = -1.05;
const BELT_Z = 0.45;
const BELT_W = 1.25;
const HOUSING_X = 0.25;
const HOUSING_W = 1.7;
const HOUSING_H = 1.35;
const HOUSING_D = 1.65;
const BLOCK = 0.5;
const SLAT_GAP = 0.34;
/** belt advance (world units) per radian of the small gear */
const DRIVE = 0.062;

/* module-scope temps — reused every frame */
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _lookNow = new THREE.Vector3(0, 0.4, 0);
const _angles = [0, 0, 0];

/* camera framings: hero (machine sits low right, under the headline),
   dwell (machine centred, full stage), after (high, receding to the right) */
const CAM_A = new THREE.Vector3(-4.3, 2.6, 13.8);
const LOOK_A = new THREE.Vector3(-3.9, 1.75, 0);
const CAM_B = new THREE.Vector3(1.4, 1.5, 12.2);
const LOOK_B = new THREE.Vector3(0.35, 0.05, 0);
const CAM_C = new THREE.Vector3(-4.8, 4.6, 12.6);
const LOOK_C = new THREE.Vector3(-3.6, 0.1, 0);

function rand(i: number, k: number) {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export default function OperationsAutomationScene() {
  const q = useQuality();
  const compact = q.compact;
  const root = useRef<THREE.Group>(null);
  const gearRefs = useRef<(THREE.Mesh | null)[]>([]);
  const rawMesh = useRef<THREE.InstancedMesh>(null);
  const doneMesh = useRef<THREE.InstancedMesh>(null);
  const slatMesh = useRef<THREE.InstancedMesh>(null);
  const housing = useRef<THREE.Mesh>(null);
  const exitMat = useRef<THREE.LineBasicMaterial>(null);
  const entryMat = useRef<THREE.LineBasicMaterial>(null);
  const ledMat = useRef<THREE.MeshBasicMaterial>(null);
  const keyLight = useRef<THREE.PointLight>(null);
  const startT = useRef(-1);
  const report = useHotspotReporter('ops-current');

  const blockCount = compact ? 8 : 11;
  const spacing = 1.08;
  const beltLen = blockCount * spacing;
  const slatCount = Math.ceil(beltLen / SLAT_GAP);

  const gearGeos = useMemo(() => GEARS.map(makeGearGeometry), []);
  const blockGeo = useMemo(() => new RoundedBoxGeometry(BLOCK, BLOCK, BLOCK, 3, 0.07), []);
  const slatGeo = useMemo(() => new THREE.BoxGeometry(0.022, 0.006, BELT_W * 0.86), []);
  const housingGeo = useMemo(
    () => new RoundedBoxGeometry(HOUSING_W, HOUSING_H, HOUSING_D, 4, 0.12),
    [],
  );
  const hubGeo = useMemo(() => new THREE.CylinderGeometry(0.075, 0.075, 0.5, 24), []);

  /* portal outlines on the housing's entry and exit faces */
  const portalGeo = useMemo(() => {
    const hw = BELT_W * 0.5 + 0.04;
    const y0 = BELT_Y + 0.04;
    const y1 = BELT_Y + BLOCK + 0.32;
    const pts = [
      [-hw, y0], [-hw, y1],
      [-hw, y1], [hw, y1],
      [hw, y1], [hw, y0],
    ];
    const arr = new Float32Array(pts.length * 3);
    pts.forEach(([z, y], i) => {
      arr[i * 3] = 0;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  useEffect(
    () => () => {
      gearGeos.forEach((g) => g.dispose());
      blockGeo.dispose();
      slatGeo.dispose();
      hubGeo.dispose();
      housingGeo.dispose();
      portalGeo.dispose();
    },
    [gearGeos, blockGeo, slatGeo, hubGeo, housingGeo, portalGeo],
  );

  useEffect(() => {
    rawMesh.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    doneMesh.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    slatMesh.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [blockCount, slatCount]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (startT.current < 0) startT.current = t;
    const anim = q.animate;
    const intro = anim ? smooth(Math.min((t - startT.current) / 1.8, 1)) : 1;

    const mp = anim ? getSectionProgress('machine') : 0.5;
    const fp = anim ? getSectionProgress('feature') : 0;
    const dp = anim ? getSectionProgress('detail') : 0;

    /* the run: spin-up while the machine section is pinned */
    const run = anim ? sectionRange(mp, 0.24, 0.74) : 0.55;
    const spun = run < 0.35 ? (run * run) / 0.7 : run - 0.175; // accelerate, then cruise
    const theta =
      -(spun / 0.825) * Math.PI * 2 * 2.6 - (fp + dp) * Math.PI * 1.1;

    /* gears */
    gearAngles(theta, _angles);
    for (let i = 0; i < GEARS.length; i++) {
      const g = gearRefs.current[i];
      if (!g) continue;
      g.rotation.z = _angles[i];
      const pop = anim
        ? smooth(Math.min(Math.max((t - startT.current - 0.15 - i * 0.12) / 1.1, 0), 1))
        : 1;
      g.scale.setScalar(0.72 + 0.28 * pop);
    }

    /* belt advance is geared to the small gear */
    const advance = -theta * (GEARS[0].teeth / GEARS[2].teeth) * DRIVE;

    /* slats */
    const sm = slatMesh.current;
    if (sm) {
      for (let i = 0; i < slatCount; i++) {
        let x = (i * SLAT_GAP + advance) % beltLen;
        if (x < 0) x += beltLen;
        x -= beltLen / 2;
        const edge = smooth(sectionRange(beltLen / 2 - Math.abs(x), 0, 0.8));
        _p.set(x, BELT_Y + 0.045, BELT_Z);
        _s.set(1, 1, Math.max(edge * intro, 0.001));
        _m.compose(_p, _q.identity(), _s);
        sm.setMatrixAt(i, _m);
      }
      sm.instanceMatrix.needsUpdate = true;
    }

    /* blocks: raw before the machine, finished after it */
    const rm = rawMesh.current;
    const dm = doneMesh.current;
    let exitGlow = 0;
    let entryGlow = 0;
    if (rm && dm) {
      for (let i = 0; i < blockCount; i++) {
        let x = (i * spacing + advance) % beltLen;
        if (x < 0) x += beltLen;
        x -= beltLen / 2;
        const lx = x - HOUSING_X;
        const edge = smooth(sectionRange(beltLen / 2 - Math.abs(x), 0.05, 1.1));
        const pop = anim
          ? smooth(Math.min(Math.max((t - startT.current - 0.4 - i * 0.05) / 0.9, 0), 1))
          : 1;
        const vis = edge * pop;

        /* raw: askew, off-centre, uneven — shrinks away inside the machine */
        const rawK = 1 - smooth(sectionRange(lx, -0.35, 0.02));
        const size = 0.78 + rand(i, 1) * 0.3;
        _e.set(
          (rand(i, 2) - 0.5) * 0.9,
          (rand(i, 3) - 0.5) * 1.6,
          (rand(i, 4) - 0.5) * 0.7,
        );
        _q.setFromEuler(_e);
        _p.set(
          x,
          BELT_Y + 0.05 + (BLOCK * size) / 2 + 0.06,
          BELT_Z + (rand(i, 5) - 0.5) * 0.5,
        );
        _s.setScalar(Math.max(size * rawK * vis, 0.001));
        _m.compose(_p, _q, _s);
        rm.setMatrixAt(i, _m);

        /* finished: square to the line, centred, identical */
        const doneK = smooth(sectionRange(lx, -0.02, 0.36));
        _q.identity();
        _p.set(x, BELT_Y + 0.05 + BLOCK / 2, BELT_Z);
        _s.setScalar(Math.max(doneK * vis * 0.92, 0.001));
        _m.compose(_p, _q, _s);
        dm.setMatrixAt(i, _m);

        /* aperture glows as work crosses each face */
        const exitD = Math.abs(lx - HOUSING_W / 2 - 0.15);
        const entryD = Math.abs(lx + HOUSING_W / 2 + 0.1);
        exitGlow = Math.max(exitGlow, 1 - smooth(Math.min(exitD / 0.55, 1)));
        entryGlow = Math.max(entryGlow, 1 - smooth(Math.min(entryD / 0.55, 1)));
      }
      rm.instanceMatrix.needsUpdate = true;
      dm.instanceMatrix.needsUpdate = true;
    }

    /* the machine only glows while it's actually running */
    const running = anim ? sectionRange(run, 0.0, 0.08) * (1 - sectionRange(mp, 0.85, 1)) + 0.25 : 0.7;
    if (exitMat.current) exitMat.current.opacity = (0.22 + 0.7 * exitGlow * running) * intro;
    if (entryMat.current) entryMat.current.opacity = (0.14 + 0.36 * entryGlow * running) * intro;
    if (ledMat.current) ledMat.current.opacity = (0.35 + 0.65 * exitGlow * running) * intro;

    if (housing.current) report(housing.current, state.camera, 0.55 + 0.4 * running);

    /* root: rise out of light on mount */
    if (root.current) {
      root.current.position.y = -0.6 * (1 - intro);
      const sc = compact ? 0.62 : 1;
      root.current.scale.setScalar(sc);
    }

    /* camera choreography — A (hero) → B (dwell) → C (after) */
    const k1 = anim ? easeInOut(sectionRange(mp, 0.04, 0.27)) : 1;
    const k2 = anim ? easeInOut(sectionRange(mp, 0.74, 0.98)) : 0;
    _cam.copy(CAM_A).lerp(CAM_B, k1).lerp(CAM_C, k2);
    _look.copy(LOOK_A).lerp(LOOK_B, k1).lerp(LOOK_C, k2);
    if (compact) {
      /* portrait: centre the machine and pull back */
      _cam.x *= 0.15;
      _look.x *= 0.15;
      _cam.y += 0.2;
      _cam.z += 2.5;
      _look.y -= 0.35;
    }
    if (anim) {
      _cam.x += pointer.x * 0.45;
      _cam.y += pointer.y * 0.3;
    }
    state.camera.position.lerp(_cam, 0.05);
    _lookNow.lerp(_look, 0.05);
    state.camera.lookAt(_lookNow);

    /* a cool key light that follows the cursor across the glass */
    if (keyLight.current) {
      keyLight.current.position.set(
        HOUSING_X + pointer.x * 3.2,
        2.4 + pointer.y * 1.4,
        3.2,
      );
    }
  });

  return (
    <group>
      <SceneLightRig />
      <pointLight ref={keyLight} color="#dfe7ff" intensity={14} distance={12} decay={2} position={[0, 2.4, 3.2]} />

      <group ref={root}>
        {/* the gear train */}
        {GEARS.map((spec, i) => (
          <group key={i} position={[GEAR_POS[i][0], GEAR_POS[i][1], GEAR_Z]}>
            <mesh
              ref={(m) => {
                gearRefs.current[i] = m;
              }}
              geometry={gearGeos[i]}
            >
              <GlassMaterial kind={spec.kind} />
            </mesh>
            {/* axle */}
            <mesh geometry={hubGeo} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.05]}>
              <meshStandardMaterial color="#e8eeff" roughness={0.25} metalness={0.6} />
            </mesh>
          </group>
        ))}

        {/* the conveyor — a long ice-glass bed with moving slats */}
        <mesh position={[0, BELT_Y, BELT_Z]}>
          <boxGeometry args={[beltLen + 2, 0.08, BELT_W]} />
          <GlassMaterial kind="ice" />
        </mesh>
        <instancedMesh
          ref={slatMesh}
          args={[slatGeo, undefined, slatCount]}
          frustumCulled={false}
        >
          <meshBasicMaterial color="#93a9ff" transparent opacity={0.7} />
        </instancedMesh>

        {/* the machine */}
        <mesh
          ref={housing}
          position={[HOUSING_X, BELT_Y + HOUSING_H / 2 + 0.02, BELT_Z]}
        >
          <primitive object={housingGeo} attach="geometry" />
          <GlassMaterial kind="pane" roughness={0.32} transmission={0.72} />
        </mesh>
        {/* status light */}
        <mesh position={[HOUSING_X + HOUSING_W / 2 - 0.22, BELT_Y + HOUSING_H + 0.035, BELT_Z + HOUSING_D / 2 - 0.22]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial ref={ledMat} color="#2e4bff" transparent opacity={0.4} toneMapped={false} />
        </mesh>
        {/* apertures */}
        <lineSegments geometry={portalGeo} position={[HOUSING_X - HOUSING_W / 2 - 0.004, 0, BELT_Z]}>
          <lineBasicMaterial ref={entryMat} color="#6b87ff" transparent opacity={0.15} />
        </lineSegments>
        <lineSegments geometry={portalGeo} position={[HOUSING_X + HOUSING_W / 2 + 0.004, 0, BELT_Z]}>
          <lineBasicMaterial ref={exitMat} color="#2e4bff" transparent opacity={0.22} toneMapped={false} />
        </lineSegments>

        {/* the work: raw in, finished out */}
        <instancedMesh
          ref={rawMesh}
          args={[blockGeo, undefined, blockCount]}
          frustumCulled={false}
        >
          <GlassMaterial kind="ice" roughness={0.22} />
        </instancedMesh>
        <instancedMesh
          ref={doneMesh}
          args={[blockGeo, undefined, blockCount]}
          frustumCulled={false}
        >
          <GlassMaterial kind="core" />
        </instancedMesh>
      </group>

      <ParticleField
        count={Math.floor(900 * q.particles)}
        drift={q.animate ? 0.08 : 0}
        opacity={0.26}
      />
    </group>
  );
}
