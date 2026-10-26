'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { useQuality } from '../../../lib/quality';
import CatoBody, { type CatoBodyHandle } from '../../../kit/cato/CatoBody';
import { catoBus, setFallState } from '../../../kit/cato/bus';
import { journeyStops } from '@/lib/content/agentJourney';

/** Scene-only travel choreography; the original rig, tools, voice and music own Cato at every stop. */

const N = journeyStops.length;
const FALL_SECONDS = 6; // one fall, start to finish, on the clock
/* fall phases (k = 0..1 through the fall) */
const LEAP = 0.34;
const FREE = 0.74;
const TOUCH = 0.79; // Timmy's jump lands at t = 1.02s, reached at this k (see landT)
/* transitions, not performances: never interrupt them */
const TRANSIT = new Set(['home', 'turn', 'boot']);

const sat = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
type Point = [number, number, number];
const stopPositions: Point[] = [
  [0, 0, 0], [2, -12, -1], [-7, -9, 1], [9, -9, 1],
  [17, -2, -2], [3, -2, -4], [-7, 6, -1], [8, 6, 2], [18, 14, -2],
];
const journeys = [
  { kind: 'dive', leap: 'jump', free: 'flip', orbit: 1.8, lift: 2.2, wide: 3.2, bank: -0.08,
    via: [[0.4, 2.2, 1.2], [1.2, 1.6, 2.8], [2, -4, 3], [2.3, -10.8, 0.5]] },
  { kind: 'bungee', leap: 'jump', free: 'cheer', orbit: -2.5, lift: 1.2, wide: 4, bank: 0.1,
    via: [[0.5, -10.5, 1.8], [-2, -19, 3], [-4.5, -13, 2.5], [-6, -15, 2], [-7.3, -8.5, 1]] },
  { kind: 'run', leap: 'run', free: 'run', orbit: -1.7, lift: -0.2, wide: 1.2, bank: 0,
    via: [[-4, -9, 1], [1, -9, 1], [6, -9, 1]] },
  { kind: 'vault', leap: 'kungfu', free: 'flip', orbit: 2.8, lift: 1.5, wide: 3, bank: -0.12,
    via: [[10, -6, 2], [12, 0, 3], [15, 1, 0], [16.5, -1, -1.5]] },
  { kind: 'swing', leap: 'jump', free: 'spin', orbit: -3.2, lift: 0.8, wide: 2.8, bank: 0.12,
    via: [[14, -1, 0], [10, -5, 3], [6, -4, 1], [3.5, -1.3, -2]] },
  { kind: 'spiral', leap: 'spin', free: 'cheer', orbit: 3.5, lift: 1.8, wide: 3.2, bank: -0.1,
    via: [[1, 0, -1], [-3, 2, 2], [-8, 3, 1], [-10, 5, -2], [-8, 7, -3]] },
  { kind: 'slalom', leap: 'kungfu', free: 'spin', orbit: -2.8, lift: 0.4, wide: 2, bank: 0.1,
    via: [[-4, 7, 2], [0, 6, -2], [4, 7, 4], [6.5, 6.5, 3]] },
  { kind: 'bound', leap: 'flip', free: 'cheer', orbit: 2.5, lift: 1.6, wide: 3, bank: -0.08,
    via: [[10, 8, 3], [13, 15, 4], [16, 17, 1], [17.5, 15, -1]] },
].map((journey, i) => ({
  ...journey,
  path: new THREE.CatmullRomCurve3(
    [stopPositions[i], ...journey.via, stopPositions[i + 1]].map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    'centripetal',
  ),
}));

const _look = new THREE.Vector3();
const smoothstep = (t: number) => {
  t = sat(t);
  return t * t * (3 - 2 * t);
};
/* Timmy's jump: late air from t = .8, touchdown at 1.02, standing by 1.95 */
const landT = (k: number) => 0.8 + ((k - FREE) / (1 - FREE)) * 1.15;
const STREAKS = 70;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _travel = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _offset = new THREE.Vector3();
const _cameraPosition = new THREE.Vector3();
const _cameraLook = new THREE.Vector3();

let cachedWidth = 0;
let cachedNdcX = 0.58;

function getDesktopNdcX(width: number): number {
  if (width === cachedWidth) return cachedNdcX;
  cachedWidth = width;
  if (typeof document !== 'undefined') {
    const hero = document.querySelector('.child-hero');
    if (hero) {
      const range = document.createRange();
      let maxRight = 0;
      const walker = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.textContent && node.textContent.trim()) {
          range.selectNodeContents(node);
          const rect = range.getBoundingClientRect();
          if (rect.right > maxRight) maxRight = rect.right;
        }
      }
      if (maxRight > 0 && maxRight < width - 80) {
        const midPx = (maxRight + width) * 0.5;
        cachedNdcX = Math.max(0.45, Math.min(0.78, (midPx / width) * 2 - 1));
        return cachedNdcX;
      }
    }
  }
  cachedNdcX = 0.58;
  return cachedNdcX;
}

function getCatoX(cam: THREE.PerspectiveCamera, width: number, height: number, narrow: boolean): number {
  if (narrow) return 0;
  const halfW = 9 * Math.tan(THREE.MathUtils.degToRad(cam.fov * 0.5)) * (width / Math.max(1, height));
  return getDesktopNdcX(width) * halfW;
}

export default function AiAgentSystemsScene() {
  const q = useQuality();
  const body = useRef<CatoBodyHandle>(null);
  const cato = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Group>(null);
  const streaks = useRef<THREE.InstancedMesh>(null);
  const shock = useRef<THREE.Mesh>(null);
  const tether = useRef<THREE.Mesh>(null);
  const runway = useRef<THREE.Mesh>(null);
  const streakSeeds = useMemo(
    () =>
      Array.from({ length: STREAKS }, (_, n) => ({
        a: (n / STREAKS) * Math.PI * 2 + Math.sin(n * 12.9) * 0.3,
        r: 0.9 + ((n * 37) % 23) / 15,
        o: ((n * 53) % 97) / 97,
        len: 0.8 + ((n * 29) % 13) / 8,
      })),
    [],
  );
  const st = useRef({
    scrubbing: false, running: false, wind: 0, stop: -1, k: 0, wasSpeaking: false,
    camera: new THREE.Vector3(0, 1.35, 9), look: new THREE.Vector3(0, 1, 0), bank: 0,
  });

  useEffect(() => {
    catoBus.stopIndex = 0;
    catoBus.targetStop = 0;
    setFallState(0, false);
  }, []);

  useFrame((state, delta) => {
    const core = body.current?.core;
    if (!core) return;
    const dt = Math.min(delta, 0.05);
    const S = st.current;
    const cam = state.camera as THREE.PerspectiveCamera;
    const narrow = state.size.width < 760;

    /* destination stop is set ONLY by goToStop (Next/Previous button or voice agent tool) */
    const goal = Math.max(0, Math.min(N - 1, catoBus.targetStop));
    const snapCamera = S.stop < 0 || !q.animate || (S.k === 0 && S.stop !== catoBus.stopIndex);
    if (S.k === 0 && S.stop >= 0 && S.stop !== catoBus.stopIndex) {
      S.stop = catoBus.stopIndex;
    }

    if (S.stop < 0 || !q.animate) {
      S.stop = goal;
      S.k = 0;
      setFallState(S.stop, false);
    } else {
      const step = dt / FALL_SECONDS;
      if (S.k > 0) {
        S.k += goal > S.stop ? step : -step;
      } else if (goal > S.stop) {
        S.k = step;
        setFallState(S.stop, true);
      } else if (goal < S.stop) {
        S.stop -= 1;
        S.k = 1 - step;
        setFallState(S.stop, true);
      }
      if (S.k >= 1) {
        S.stop += 1;
        S.k = 0;
        setFallState(S.stop, S.stop !== goal);
      } else if (S.k < 0) {
        S.k = 0;
        setFallState(S.stop, S.stop !== goal);
      }
    }
    const i = S.stop;
    const trickOn = S.k > 0;
    const k = S.k;
    const journey = journeys[Math.min(i, journeys.length - 1)];
    const forward = goal > i;

    /* ---- what Cato is doing ---- */
    if (trickOn && journey.kind === 'run') {
      const progress = forward ? k : 1 - k;
      if (progress < 0.68 && !S.running) {
        core.release();
        core.play('run');
        S.running = true;
      } else if (progress >= 0.68 && S.running) {
        core.play('home');
        S.running = false;
      }
      S.scrubbing = false;
    } else if (trickOn) {
      const { leap, free } = journey;
      if (k < LEAP) core.scrub(leap, (k / LEAP) * core.duration(leap));
      else if (journey.kind === 'dive' && k < FREE) core.scrub('jump', 0.65);
      else if (k < FREE) core.scrub(free, ((k - LEAP) / (FREE - LEAP)) * core.duration(free));
      else core.scrub('jump', landT(k));
      S.scrubbing = true;
    } else {
      if (S.running) {
        core.play('home');
        S.running = false;
      }
      if (S.scrubbing) {
        core.release();
        S.scrubbing = false;
      }
      /* only a real event moves him: a tool in use, a track playing, a tool being built */
      const want = catoBus.toolMove ?? 'idle';
      const mode = core.mode();
      if (q.animate && mode !== want && !TRANSIT.has(mode)) core.play(want);
    }

    /* ---- a playing DJ track drives Timmy's beat clock ---- */
    const music = catoBus.music;
    if (music && !music.audio.paused) core.beat(music.bpm, (music.audio.currentTime * music.bpm) / 60);

    /* ---- voice: output frequency bands & level drive the viseme mouth ---- */
    const speakingNow =
      catoBus.activity === 'speaking' &&
      performance.now() - catoBus.mouthAt < 250 &&
      catoBus.mouth > 0.008;
    if (speakingNow) {
      core.viseme('aa', catoBus.visemes.aa);
      core.viseme('O', catoBus.visemes.O);
      core.viseme('E', catoBus.visemes.E);
      core.viseme('SS', catoBus.visemes.SS);
      S.wasSpeaking = true;
    } else if (S.wasSpeaking) {
      core.viseme('aa', 0);
      core.viseme('O', 0);
      core.viseme('E', 0);
      core.viseme('SS', 0);
      S.wasSpeaking = false;
    }

    /* The same curve is sampled in either direction; stops keep their original composition. */
    const x0 = getCatoX(cam, state.size.width, state.size.height, narrow);
    const scale = narrow ? 0.8 : 1.15;
    _travel.fromArray(stopPositions[i]);
    _tangent.set(0, -1, 0);
    let roll = 0;
    let pitch = 0;
    let fallV = 0;
    const envelope = trickOn ? Math.sin(Math.PI * sat(k / TOUCH)) ** 2 : 0;
    if (trickOn) {
      const t = smoothstep(k / TOUCH);
      journey.path.getPoint(t, _travel);
      journey.path.getTangent(t, _tangent);
      if (!forward) _tangent.negate();
      fallV = envelope;
      if (journey.kind === 'dive') {
        pitch = Math.PI * smoothstep((k - 0.18) / 0.18) * (1 - smoothstep((k - 0.6) / (FREE - 0.6)));
      } else if (journey.kind === 'bungee') {
        roll = -0.65 * Math.sin(k * Math.PI * 4) * envelope;
      } else if (journey.kind !== 'run') {
        roll = journey.bank * 3 * envelope;
      }
    }
    const x = _travel.x + x0;
    const y = _travel.y;
    const z = _travel.z;
    if (cato.current) {
      cato.current.rotation.set(pitch, 0, roll);
      _offset.set(0, scale, 0).applyQuaternion(cato.current.quaternion);
      cato.current.position.set(x - _offset.x, y + scale - _offset.y, z - _offset.z);
      cato.current.scale.setScalar(scale);
    }

    const orbit = journey.orbit * envelope * (narrow ? 0.55 : 1);
    const distance = 9 + journey.wide * envelope;
    const frameY = narrow ? -0.95 : 1;
    _cameraLook.set(x, y + frameY, z);
    _cameraPosition.set(x + orbit, y + frameY + 0.35 + journey.lift * envelope, z + distance);
    _offset.subVectors(_cameraPosition, _cameraLook);
    _right.crossVectors(_up, _offset).normalize();
    const framing = x0 * _offset.length() / Math.hypot(9, 0.35);
    _cameraPosition.addScaledVector(_right, -framing);
    _cameraLook.addScaledVector(_right, -framing);
    const kd = q.animate ? 1 - Math.exp(-dt * (trickOn ? 14 : 7)) : 1;
    S.camera.lerp(_cameraPosition, snapCamera ? 1 : kd);
    S.look.lerp(_cameraLook, snapCamera ? 1 : kd);
    S.bank += (journey.bank * envelope * (narrow ? 0.4 : 1) - S.bank) * (snapCamera ? 1 : kd);
    const impact = trickOn && journey.kind !== 'run' && k > TOUCH ? Math.max(0, 1 - (k - TOUCH) / 0.08) : 0;
    const shake = impact * 0.18 * Math.sin(k * 520);
    cam.position.copy(S.camera);
    cam.position.x += shake * 0.5;
    cam.position.y += shake;
    _look.copy(S.look);
    _look.y += shake * 0.6;
    cam.lookAt(_look);
    cam.rotateZ(S.bank);
    cam.updateMatrixWorld();
    cato.current?.updateWorldMatrix(true, true);

    if (tether.current) {
      tether.current.visible = trickOn && journey.kind === 'bungee' && k < TOUCH;
      if (tether.current.visible) {
        _p.fromArray(stopPositions[i]);
        _p.x += x0;
        _p.y += 3;
        _offset.set(x, y + scale, z).sub(_p);
        tether.current.position.copy(_p).addScaledVector(_offset, 0.5);
        tether.current.scale.set(1, _offset.length(), 1);
        tether.current.quaternion.setFromUnitVectors(_up, _offset.normalize());
        (tether.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * Math.min(1, envelope * 5);
      }
    }
    if (runway.current) {
      runway.current.visible = trickOn && journey.kind === 'run';
      if (runway.current.visible) {
        runway.current.position.set(x0 + 1, -9.08, 1);
        (runway.current.material as THREE.MeshPhysicalMaterial).opacity = 0.55 * Math.min(1, envelope * 5);
      }
    }

    /* Travel direction also drives the existing streaks, including horizontal and upward shots. */
    S.wind = Math.max(fallV, S.wind - dt * 2.5);
    const sm = streaks.current;
    if (sm) {
      sm.visible = S.wind > 0.02;
      if (sm.visible) {
        const mat = sm.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.45 * S.wind;
        _q.setFromUnitVectors(_up, _tangent);
        for (let n = 0; n < STREAKS; n++) {
          const sd = streakSeeds[n];
          const cyc = (sd.o + state.clock.elapsedTime * (1.2 + 2.4 * S.wind)) % 1;
          _p.set(Math.cos(sd.a) * sd.r, 3.5 - cyc * 7, Math.sin(sd.a) * sd.r).applyQuaternion(_q);
          _p.x += x; _p.y += y + 1; _p.z += z;
          _s.set(1, sd.len * (0.4 + 1.6 * S.wind), 1);
          sm.setMatrixAt(n, _m.compose(_p, _q, _s));
        }
        sm.instanceMatrix.needsUpdate = true;
      }
    }

    /* ---- shockwave ring on the landing ledge ---- */
    const sh = shock.current;
    if (sh) {
      const w = trickOn && k > TOUCH ? (k - TOUCH) / (1 - TOUCH) : -1;
      sh.visible = w >= 0 && w < 1 && journey.kind !== 'run';
      if (sh.visible) {
        sh.position.fromArray(stopPositions[i + 1]);
        sh.position.x += x0;
        sh.position.y += 0.02;
        sh.scale.setScalar(scale * (1 + 3.2 * Math.sqrt(w)));
        (sh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - w) ** 1.5;
      }
    }
    if (dust.current) dust.current.position.copy(S.look);
  }, -1);

  return (
    <>
      <SceneLightRig />
      <group ref={dust}>
        <ParticleField count={Math.floor(1100 * q.particles)} drift={q.animate ? 0.1 : 0} opacity={0.3} />
      </group>
      {journeyStops.map((stop, j) => (
        <Ledge key={stop.id} position={stopPositions[j]} />
      ))}
      <mesh ref={tether} visible={false}>
        <cylinderGeometry args={[0.018, 0.018, 1, 8]} />
        <meshBasicMaterial color="#7f97ff" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={runway} visible={false}>
        <boxGeometry args={[16, 0.08, 1.5]} />
        <meshPhysicalMaterial color="#f4f6ff" roughness={0.15} clearcoat={1} transparent depthWrite={false} />
      </mesh>
      <instancedMesh ref={streaks} args={[undefined, undefined, STREAKS]} frustumCulled={false}>
        <planeGeometry args={[0.018, 1]} />
        <meshBasicMaterial color="#9fb2ff" transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
      <mesh ref={shock} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[1.0, 1.12, 96]} />
        <meshBasicMaterial color="#7f97ff" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={cato}>
        <CatoBody ref={body} paused={!q.animate} />
      </group>
    </>
  );
}

const ledgeMats = {
  glass: new THREE.MeshPhysicalMaterial({ color: '#f4f6ff', roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.7 }),
  glow: new THREE.MeshBasicMaterial({ color: '#7f97ff', toneMapped: false }),
};

/** a glass ledge under Cato's x, matching his scale */
function Ledge({ position }: { position: Point }) {
  const g = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!g.current) return;
    const narrow = state.size.width < 760;
    const cam = state.camera as THREE.PerspectiveCamera;
    g.current.position.x = position[0] + getCatoX(cam, state.size.width, state.size.height, narrow);
    g.current.scale.setScalar(narrow ? 0.8 : 1.15);
  });
  return (
    <group ref={g} position={position}>
      <mesh position={[0, -0.05, 0]} material={ledgeMats.glass}>
        <cylinderGeometry args={[1.2, 1.05, 0.1, 64]} />
      </mesh>
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} material={ledgeMats.glow}>
        <ringGeometry args={[1.1, 1.17, 72]} />
      </mesh>
    </group>
  );
}
