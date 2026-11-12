'use client';

import { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { useQuality } from '../../../lib/quality';
import CatoBody, { type CatoBodyHandle } from '../../../kit/cato/CatoBody';
import PenDrawing from '../../../kit/cato/PenDrawing';
import { catoBus, setFallState, setScreenOpen } from '../../../kit/cato/bus';
import { journeyStops } from '@/lib/content/agentJourney';
import { JOURNEY_TRAVEL_SECONDS } from '@/lib/content/journeyLayout';

type Point = [number, number, number];
const stopPositions: Point[] = [
  [0, 0, 0], [2, -12, -1], [-7, -9, 1], [9, -9, 1],
  [17, -2, -2], [3, -2, -4], [-7, 6, -1], [8, 6, 2], [18, 14, -2],
];
const journeys = [
  { kind: 'dive', moves: ['jump', 'flip'], via: [[0.4, 2.2, 1.2], [1.2, 1.6, 2.8], [2, -4, 3], [2.3, -10.8, 0.5]] },
  { kind: 'run', moves: ['run', 'run'], via: [[0, -12, -1], [-3, -11, 0], [-5, -9, 1]] },
  { kind: 'jet', moves: ['jump', 'jump'], via: [[-5, -6, 2], [0, -3, 3], [6, -6, 2]] },
  { kind: 'bungee', moves: ['jump', 'cheer'], via: [[10, -8, 1], [12, -16, 3], [15, -10, 1], [16, -1, -1]] },
  { kind: 'vault', moves: ['kungfu', 'flip'], via: [[15, 0, 0], [11, 3, 2], [6, 1, 0]] },
  { kind: 'glide', moves: ['spin', 'spin'], via: [[1, 0, -1], [-3, 1, 2], [-8, 3, 1], [-8, 7, -2]] },
  { kind: 'spiral', moves: ['spin', 'spin'], via: [[-4, 9, 2], [0, 3, -2], [4, 9, 4], [6.5, 6.5, 3]] },
  { kind: 'land', moves: ['jump', 'jump'], via: [[10, 10, 3], [13, 16, 4], [16, 17, 1], [17.5, 15, -1]] },
].map((journey, i) => {
  const path = new THREE.CatmullRomCurve3([stopPositions[i], ...journey.via, stopPositions[i + 1]].map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  return { ...journey, path, length: path.getLength() };
});
const spectrum = ['#7FD8E6', '#2E4BFF', '#0A1890', '#6B2FD6', '#8B5CF6', '#3F2A9E', '#7A2E6E'];
const brands: Record<string, string> = { zendesk: '#03363D', hubspot: '#FF7A59', salesforce: '#00B3FF', zoho: '#E42527', intercom: '#6AFDEF', jira: '#0052CC', asana: '#F06A6A', linear: '#5E6AD2', clickup: '#7B68EE', perplexity: '#1FB8CD', anthropic: '#191919', openai: '#000000', mistral: '#FA520F', xai: '#000000', huggingface: '#FFD21E', axolotl: '#141310', notion: '#000000', confluence: '#172B4D', guru: '#000000', sharepoint: '#038489' };
const iconPaths = [
  '<path d="M3 7h13v10H3z M16 10l5-3v10l-5-3z"/>',
  '<path d="M4 14h2v6H4z M9 9h2v11H9z M14 3h2v17h-2z M19 7h2v13h-2z"/>',
  '<path d="M2 4h20v16H2z M4 18l5-7 4 4 3-5 4 8z"/>',
  '<path d="M2 17h4v5H2z M9 11h4v11H9z M16 3h4v19h-4z"/>',
  '<path d="M2 3h7v5H2z M15 16h7v5h-7z M2 16h7v5H2z M5 8v4h14v4 M5 12v4"/>',
  '<path d="M3 3h18v18H3z M7 8l3 4-3 4 M13 16h5"/>',
  '<path d="M3 3h18v14H9l-6 5z M7 8h10 M7 12h6"/>',
  '<path d="M2 4h8l2 2 2-2h8v16h-8l-2 2-2-2H2z M12 6v16"/>',
  '<path d="M2 3h20v16H2z M8 22h8 M12 19v3"/>',
];
const icons = iconPaths.map((path) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2E4BFF" stroke="#2E4BFF" stroke-width="1">${path}</svg>`);
const frame = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><path fill="currentColor" fill-rule="evenodd" d="M0 0h100v60H0z M1 1v58h98V1z"/></svg>';
const _target = new THREE.Vector3(), _next = new THREE.Vector3(), _previous = new THREE.Vector3();
const _desired = new THREE.Vector3(), _force = new THREE.Vector3(), _acceleration = new THREE.Vector3();
const _right = new THREE.Vector3(), _forward = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _camera = new THREE.Vector3(), _look = new THREE.Vector3(), _anchor = new THREE.Vector3(), _rope = new THREE.Vector3();
const sat = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => x * x * (3 - 2 * x);

export default function AiAgentSystemsScene() {
  const q = useQuality();
  const body = useRef<CatoBodyHandle>(null);
  const cato = useRef<THREE.Group>(null);
  const stage = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Group>(null);
  const tether = useRef<THREE.Mesh>(null);
  const jet = useRef<THREE.Group>(null);
  const S = useRef({ stop: -1, from: 0, goal: 0, start: 0, moving: false, distance: 0, progress: 0, finaleAt: -1, pose: '', speaking: false, position: new THREE.Vector3(), velocity: new THREE.Vector3(), lastVelocity: new THREE.Vector3(), camera: new THREE.Vector3(), look: new THREE.Vector3() });
  useFrame((state, dt) => {
    const core = body.current?.core, robot = cato.current;
    if (!core || !robot) return;
    const s = S.current, now = performance.now(), goal = catoBus.targetStop;
    const narrow = state.size.width < 760;
    const cam = state.camera as THREE.PerspectiveCamera;
    const scale = narrow ? 0.5 : state.size.width < 1000 ? 0.72 : 0.92;
    const halfW = 9 * Math.tan(THREE.MathUtils.degToRad(cam.fov * 0.5)) * state.size.width / state.size.height;
    const x0 = narrow ? 0 : halfW * 0.53;
    const finaleOffset = !narrow && s.stop === 8 && !s.moving ? -halfW * 0.87 : 0;
    const initialize = s.stop < 0 || (!catoBus.falling && s.stop !== catoBus.stopIndex && !s.moving);
    if (initialize) { s.stop = catoBus.stopIndex; s.position.fromArray(stopPositions[s.stop]); s.velocity.set(0, 0, 0); }
    if (!q.animate) {
      s.stop = goal; s.moving = false; s.position.fromArray(stopPositions[goal]); s.velocity.set(0, 0, 0);
      setFallState(goal, false); setScreenOpen(goal === 8);
    } else if (!s.moving && goal !== s.stop) {
      s.from = s.stop; s.goal = goal; s.start = now; s.progress = 0; s.distance = 0; s.moving = true; s.finaleAt = -1;
      s.velocity.set(0, 0, 0); s.lastVelocity.set(0, 0, 0); setScreenOpen(false);
    }
    const journeyIndex = Math.min(7, Math.min(s.from, s.goal));
    const journey = journeys[journeyIndex];
    let roll = 0, pitch = 0;
    if (s.moving) {
      const t = sat((now - s.start) / (JOURNEY_TRAVEL_SECONDS * 1000));
      const segments = Math.abs(s.goal - s.from);
      const along = t * segments;
      const step = Math.min(segments - 1, Math.floor(along));
      const direction = Math.sign(s.goal - s.from);
      const index = direction > 0 ? s.from + step : s.from - step - 1;
      const travel = journeys[index];
      const u = direction > 0 ? ease(sat(along - step)) : 1 - ease(sat(along - step));
      travel.path.getPointAt(u, _target);
      travel.path.getPointAt(sat(u + direction * 0.025), _next);
      _previous.copy(s.position);
      // Reynolds seek + path-follow, with an arrive envelope near the destination.
      _desired.subVectors(_next, s.position);
      const remaining = s.position.distanceTo(_target);
      const speed = travel.length / JOURNEY_TRAVEL_SECONDS * segments;
      if (_desired.lengthSq()) _desired.normalize().multiplyScalar(speed * Math.min(1, (1 - t) * 8 + 0.08));
      _force.subVectors(_desired, s.velocity);
      s.velocity.addScaledVector(_force, 1 - Math.exp(-24 * dt));
      s.position.addScaledVector(s.velocity, dt * Math.min(1, remaining / (speed * dt || 1)) * 0.15);
      s.position.x = THREE.MathUtils.damp(s.position.x, _target.x, 65, dt);
      s.position.y = THREE.MathUtils.damp(s.position.y, _target.y, 65, dt);
      s.position.z = THREE.MathUtils.damp(s.position.z, _target.z, 65, dt);
      s.distance += s.position.distanceTo(_previous);
      s.progress = sat(s.distance / (travel.length * segments));
      _acceleration.copy(s.velocity).sub(s.lastVelocity).divideScalar(dt || 1);
      _forward.set(0, 0, 1).applyQuaternion(robot.quaternion);
      _right.crossVectors(_up, _forward).normalize();
      roll = Math.atan(_acceleration.dot(_right) * 0.001) * 0.3;
      pitch = -Math.atan(_acceleration.dot(_forward) * 0.001) * 0.25;
      s.lastVelocity.copy(s.velocity);
      const p = sat(s.distance / (travel.length * (step + 1)));
      const move = travel.moves[p < 0.35 ? 0 : 1];
      const phase = p < 0.35 ? p / 0.35 : (p - 0.35) / 0.65;
      core.scrub(move, move === 'run' ? p * 2.5 : travel.kind === 'jet' ? 0.7 + p * 0.12 : phase * core.duration(move));
      s.pose = '';
      robot.userData.journey = travel.kind;
      robot.userData.distance = s.distance;
      robot.userData.pathLength = travel.length;
      robot.userData.progress = p;
      if (t >= 1) {
        s.position.fromArray(stopPositions[s.goal]); s.stop = s.goal; s.moving = false; s.velocity.set(0, 0, 0);
        core.release(); setFallState(s.stop, false);
        if (s.stop === 8) { s.finaleAt = now; core.play('turn'); s.pose = 'turn'; }
      }
    } else {
      if (q.animate) s.position.y = stopPositions[s.stop][1] + Math.sin(state.clock.elapsedTime * 0.8) * 0.016;
      if (s.stop === 8 && q.animate && s.finaleAt >= 0 && now - s.finaleAt < 1000) {
        const t = (now - s.finaleAt) / 1000;
        robot.rotation.y = THREE.MathUtils.damp(robot.rotation.y, t < 0.3 ? -0.7 : 0, 12, dt);
        if (t >= 0.3) { core.scrub('stretch', sat((t - 0.3) / 0.7) * 1.4); setScreenOpen(true); }
      } else {
        const want = catoBus.toolMove ?? (s.stop === 1 && catoBus.music ? 'dj' : 'idle');
        if (s.pose !== want) { core.release(); core.play(want); s.pose = want; }
        robot.rotation.y = THREE.MathUtils.damp(robot.rotation.y, 0, 12, dt);
      }
    }
    robot.rotation.x = THREE.MathUtils.damp(robot.rotation.x, pitch, 18, dt);
    robot.rotation.z = THREE.MathUtils.damp(robot.rotation.z, roll, 18, dt);
    robot.position.copy(s.position); robot.position.x += x0 + finaleOffset; robot.scale.setScalar(s.stop === 8 ? scale * 0.7 : scale);
    if (!narrow && s.stop === 8 && !s.moving) robot.position.y += 1.5;
    const music = catoBus.music;
    if (music && !music.audio.paused) core.beat(music.bpm, music.audio.currentTime * music.bpm / 60);
    if (catoBus.activity === 'speaking' && now - catoBus.mouthAt < 250) {
      core.viseme('aa', catoBus.visemes.aa); core.viseme('O', catoBus.visemes.O); core.viseme('E', catoBus.visemes.E); core.viseme('SS', catoBus.visemes.SS); s.speaking = true;
    } else if (s.speaking) { core.viseme('aa', 0); core.viseme('O', 0); core.viseme('E', 0); core.viseme('SS', 0); s.speaking = false; }
    _look.copy(s.position); _look.y += narrow ? q.animate ? -1.15 : -0.65 : 1;
    _camera.copy(_look); _camera.z += 9; _camera.y += 0.35;
    const damping = s.moving ? 70 : 12;
    if (initialize || !q.animate) { s.camera.copy(_camera); s.look.copy(_look); }
    else {
      s.camera.x = THREE.MathUtils.damp(s.camera.x, _camera.x, damping, dt); s.camera.y = THREE.MathUtils.damp(s.camera.y, _camera.y, damping, dt); s.camera.z = THREE.MathUtils.damp(s.camera.z, _camera.z, damping, dt);
      s.look.x = THREE.MathUtils.damp(s.look.x, _look.x, damping, dt); s.look.y = THREE.MathUtils.damp(s.look.y, _look.y, damping, dt); s.look.z = THREE.MathUtils.damp(s.look.z, _look.z, damping, dt);
    }
    cam.position.copy(s.camera); cam.lookAt(s.look); cam.updateMatrixWorld();
    if (stage.current) { stage.current.position.copy(s.position); stage.current.position.x += x0; stage.current.scale.setScalar(narrow ? 0.58 : state.size.width < 1000 ? 0.6 : 1); }
    if (dust.current) dust.current.position.copy(s.look);
    if (tether.current) {
      const kind = journeys[Math.min(7, Math.max(0, Math.min(s.from, s.goal)))].kind;
      tether.current.visible = s.moving && (kind === 'bungee' || kind === 'glide' || kind === 'spiral');
      if (tether.current.visible) {
        _anchor.fromArray(stopPositions[s.from]); _anchor.x += x0; _anchor.y += 3;
        _rope.copy(robot.position).sub(_anchor); tether.current.position.copy(_anchor).addScaledVector(_rope, 0.5);
        tether.current.scale.set(1, _rope.length(), 1); tether.current.quaternion.setFromUnitVectors(_up, _rope.normalize());
      }
    }
    if (jet.current) jet.current.visible = s.moving && journey.kind === 'jet';
    robot.updateWorldMatrix(true, true);
  }, -1);
  return <>
    <SceneLightRig />
    <group ref={dust}><ParticleField count={Math.floor(550 * q.particles)} drift={q.animate ? 0.1 : 0} opacity={0.2} /></group>
    <group ref={stage}>
      {journeyStops.map((stop, index) => {
        const glow = spectrum[Math.round(index * (spectrum.length - 1) / 8)];
        return <group key={stop.id}>
          <Suspense fallback={null}><PenDrawing svg={icons[index]} stop={index} color={glow} glow={glow} position={[1.1, 1.4, 0]} size={0.45} reduced={!q.animate} /></Suspense>
          <Suspense fallback={null}><PenDrawing svg={frame} stop={index} color={glow} glow={glow} position={[0, 1, -0.35]} size={2.2} reduced={!q.animate} /></Suspense>
          {stop.logos.map((slug, n) => <Suspense key={slug} fallback={null}>
            <PenDrawing url={`/logos/${slug}.svg`} stop={index} color={brands[slug]} glow={glow} position={[-1.65 + (n % 2) * 0.55, 0.25 + Math.floor(n / 2) * 0.6, -0.1]} size={0.42} reduced={!q.animate} />
          </Suspense>)}
        </group>;
      })}
    </group>
    <mesh ref={tether} visible={false}><cylinderGeometry args={[0.016, 0.016, 1, 8]} /><meshBasicMaterial color="#8B5CF6" toneMapped={false} /></mesh>
    <group ref={cato} name="Cato tour">
      <CatoBody ref={body} paused={!q.animate} />
      <group ref={jet} visible={false} position={[0, -0.3, 0]}>
        <mesh position={[-0.28, 0, 0]}><coneGeometry args={[0.12, 0.65, 8]} /><meshBasicMaterial color={[1, 2, 5]} toneMapped={false} /></mesh>
        <mesh position={[0.28, 0, 0]}><coneGeometry args={[0.12, 0.65, 8]} /><meshBasicMaterial color={[1, 2, 5]} toneMapped={false} /></mesh>
      </group>
    </group>
  </>;
}
