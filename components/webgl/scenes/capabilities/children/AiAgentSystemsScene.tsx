'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { GlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import { useBakedSimulation, type Rapier, type PhysicsWorld } from '../../../lib/physics-bake';
import { getSectionProgress, sectionRange, smooth, pointer } from '../../../scroll-store';
import { readDwell, clamp01, lerp, easeInOutSine, type DwellBeats } from './agents/signature';

/**
 * AiAgentSystemsScene — "The Relay".
 *
 * A spiral of glass dominoes stands on a pale disc. Above it hang four agent
 * nodes (the four specialisms) and a central hub. In the signature dwell a
 * glass orb (the request) tips the outermost domino and a real, baked Rapier
 * cascade runs inward along the spiral. Every fallen domino draws a filament
 * of light up to its agent; a node wakes as its quarter of the spiral falls,
 * and when the last domino drops at the centre the hub lights and the network
 * closes. One push, the whole system relays the work.
 *
 * Scroll: hero = standing spiral, stage-right · signature = glide to centre,
 * cascade scrubbed by progress (reversible) · after = the lit network retires
 * behind the persona section. Reduced motion: the completed, lit network.
 */

/* ---------------- spiral layout (shared by bake + rest pose) ---------------- */
const HX = 0.05;
const HY = 0.32;
const HZ = 0.17;
const GAP = 0.27;
const R0 = 2.3;
const R1 = 0.8;
const TURNS = 1.35;
const AGENTS = 4;
const STEPS = 340;

function spiralPoints() {
  const fine: [number, number][] = [];
  const M = 4000;
  for (let i = 0; i <= M; i++) {
    const u = i / M;
    const th = u * TURNS * Math.PI * 2;
    const r = R0 + (R1 - R0) * u;
    fine.push([Math.cos(th) * r, Math.sin(th) * r]);
  }
  const pts: [number, number][] = [fine[0]];
  let acc = 0;
  for (let i = 1; i <= M; i++) {
    acc += Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]);
    if (acc >= GAP) {
      pts.push(fine[i]);
      acc = 0;
    }
  }
  return pts;
}

const PTS = spiralPoints();
const N = PTS.length;
/** yaw (about +y) that aligns local x with the spiral tangent at domino i */
const YAW = PTS.map((_, i) => {
  const b = PTS[Math.min(N - 1, i + 1)];
  const c = PTS[Math.max(0, i - 1)];
  const tx = b[0] - c[0];
  const tz = b[1] - c[1];
  return Math.atan2(-tz, tx);
});
const T0 = (() => {
  const l = Math.hypot(PTS[1][0] - PTS[0][0], PTS[1][1] - PTS[0][1]);
  return [(PTS[1][0] - PTS[0][0]) / l, (PTS[1][1] - PTS[0][1]) / l];
})();
const ORB_R = 0.085;
const ORB_START: [number, number, number] = [PTS[0][0] - T0[0] * 0.55, 0.62, PTS[0][1] - T0[1] * 0.55];

/** domino i belongs to agent floor(i / N * AGENTS) */
const agentOf = (i: number) => Math.min(AGENTS - 1, Math.floor((i / N) * AGENTS));
const AGENT_POS: THREE.Vector3[] = Array.from({ length: AGENTS }, (_, a) => {
  /* place each agent above the mean of its spiral quarter, pulled outward */
  let sx = 0;
  let sz = 0;
  let n = 0;
  for (let i = 0; i < N; i++) {
    if (agentOf(i) !== a) continue;
    sx += PTS[i][0];
    sz += PTS[i][1];
    n++;
  }
  const v = new THREE.Vector3(sx / n, 0, sz / n);
  const len = Math.max(0.001, Math.hypot(v.x, v.z));
  v.multiplyScalar(1.55 / len);
  v.y = 1.75 + a * 0.12;
  return v;
});
const HUB_POS = new THREE.Vector3(0, 2.35, 0);

function setupWorld(R: Rapier, world: PhysicsWorld) {
  const g = world.createRigidBody(R.RigidBodyDesc.fixed());
  world.createCollider(R.ColliderDesc.cuboid(10, 0.1, 10).setTranslation(0, -0.1, 0).setFriction(0.7), g);
  const bodies = [];
  for (let i = 0; i < N; i++) {
    const y = YAW[i];
    const d = R.RigidBodyDesc.dynamic()
      .setTranslation(PTS[i][0], HY + 0.001, PTS[i][1])
      .setRotation({ x: 0, y: Math.sin(y / 2), z: 0, w: Math.cos(y / 2) })
      .setCanSleep(false);
    const b = world.createRigidBody(d);
    world.createCollider(
      R.ColliderDesc.cuboid(HX, HY, HZ).setFriction(0.45).setRestitution(0.05).setDensity(1),
      b,
    );
    bodies.push(b);
  }
  const orb = world.createRigidBody(
    R.RigidBodyDesc.dynamic()
      .setTranslation(ORB_START[0], ORB_START[1], ORB_START[2])
      .setLinvel(T0[0] * 1.7, 0.6, T0[1] * 1.7)
      .setCanSleep(false),
  );
  world.createCollider(R.ColliderDesc.ball(ORB_R).setDensity(3).setRestitution(0.2).setFriction(0.5), orb);
  bodies.push(orb);
  return bodies;
}

/* ---------------- shaders ---------------- */
const groundFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uLit;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = smoothstep(1.0, 0.15, r) * 0.55;
    float ring = smoothstep(0.012, 0.0, abs(r - 0.93)) * 0.5;
    vec3 col = mix(vec3(0.86, 0.9, 1.0), vec3(0.62, 0.7, 1.0), uLit * (1.0 - r));
    gl_FragColor = vec4(col, a * (0.55 + uLit * 0.45) + ring * 0.6);
  }
`;
const groundVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/* ---------------- module temps (no per-frame allocation) ---------------- */
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3();
const _look = new THREE.Vector3();
const _c = new THREE.Color();
const C_ICE = new THREE.Color('#e4ebff');
const C_LIT = new THREE.Color('#5a74ff');
const C_LINE = new THREE.Color('#2e4bff');
const beats: DwellBeats = { arrive: 0, play: 0, leave: 0 };

export default function AiAgentSystemsScene() {
  const q = useQuality();
  const stage = useRef<THREE.Group>(null);
  const dominoes = useRef<THREE.InstancedMesh>(null);
  const orb = useRef<THREE.Mesh>(null);
  const nodes = useRef<(THREE.Group | null)[]>([]);
  const halos = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const hub = useRef<THREE.Group>(null);
  const hubHalo = useRef<THREE.MeshBasicMaterial>(null);
  const report = useHotspotReporter('agents-robot');
  const born = useRef(-1);
  const fallReady = useRef(false);

  const sim = useBakedSimulation({
    key: 'aas-domino-relay-v1',
    steps: STEPS,
    dt: 1 / 60,
    substeps: 3,
    solverIterations: 12,
    setup: setupWorld,
  });

  /* per-domino fall time (normalized sim t), filled once after the bake */
  const fallT = useMemo(() => new Float32Array(N).fill(2), []);

  const geo = useMemo(() => new RoundedBoxGeometry(HX * 2, HY * 2, HZ * 2, 3, 0.018), []);

  /* filaments: domino → agent (N) + agent → hub (AGENTS) */
  const lines = useMemo(() => {
    const segs = N + AGENTS;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(segs * 6);
    const col = new Float32Array(segs * 8);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const obj = new THREE.LineSegments(g, m);
    obj.frustumCulled = false;
    return { obj, pos, col, g, m };
  }, []);

  const ground = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: groundVert,
        fragmentShader: groundFrag,
        transparent: true,
        depthWrite: false,
        uniforms: { uLit: { value: 0 } },
      }),
    [],
  );

  useEffect(
    () => () => {
      geo.dispose();
      lines.g.dispose();
      lines.m.dispose();
      ground.dispose();
    },
    [geo, lines, ground],
  );

  /* rest pose: every domino standing — shown until the bake lands */
  useEffect(() => {
    const mesh = dominoes.current;
    if (!mesh) return;
    for (let i = 0; i < N; i++) {
      _p.set(PTS[i][0], HY, PTS[i][1]);
      _q.setFromAxisAngle(_up.set(0, 1, 0), YAW[i]);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      mesh.setColorAt(i, C_ICE);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (born.current < 0) born.current = t;
    const animate = q.animate;
    const intro = animate ? smooth(clamp01((t - born.current) / 1.8)) : 1;
    const baked = sim.current;

    /* ---- beats ---- */
    readDwell('signature', beats);
    const play = animate ? beats.play : 1;
    const arrive = animate ? easeInOutSine(beats.arrive) : 1;
    const leave = animate ? smooth(beats.leave) : 0;
    const persona = animate ? smooth(sectionRange(getSectionProgress('persona'), 0.1, 0.6)) : 0;

    /* ---- one-time fall-time extraction from the recording ---- */
    if (baked && !fallReady.current) {
      const last = baked.frames - 1;
      for (let i = 0; i < N; i++) {
        for (let f = 0; f <= last; f++) {
          const qi = (f * baked.count + i) * 4;
          const qx = baked.quaternions[qi];
          const qz = baked.quaternions[qi + 2];
          const upY = 1 - 2 * (qx * qx + qz * qz);
          if (upY < 0.82) {
            fallT[i] = f / last;
            break;
          }
        }
      }
      fallReady.current = true;
    }

    /* the cascade: whole recording across the pinned phase */
    const simT = play;

    /* ---- dominoes ---- */
    const mesh = dominoes.current;
    let fallen = 0;
    if (mesh && baked) {
      for (let i = 0; i < N; i++) {
        baked.sample(i, simT, _p, _q);
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
        const lit = clamp01((simT - fallT[i]) / 0.03);
        if (lit > 0) fallen++;
        _c.copy(C_ICE).lerp(C_LIT, lit);
        mesh.setColorAt(i, _c);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    /* ---- the request orb ---- */
    if (orb.current) {
      if (baked) {
        baked.sample(N, simT, _p, _q);
        orb.current.position.copy(_p);
        orb.current.quaternion.copy(_q);
      }
      const idle = animate ? 1 - clamp01(play * 30) : 0;
      orb.current.position.y += Math.sin(t * 1.4) * 0.05 * idle;
      orb.current.scale.setScalar(Math.max(1e-4, intro));
    }

    /* ---- agents wake per quarter; hub when the spiral completes ---- */
    let agentsLit = 0;
    for (let a = 0; a < AGENTS; a++) {
      let total = 0;
      let lit = 0;
      for (let i = 0; i < N; i++) {
        if (agentOf(i) !== a) continue;
        total++;
        if (fallReady.current && simT >= fallT[i]) lit++;
      }
      const w = baked ? lit / total : animate ? 0 : 1;
      const done = w >= 0.999 ? 1 : 0;
      agentsLit += done;
      const g = nodes.current[a];
      if (g) {
        const s = (0.55 + w * 0.45 + done * 0.15) * intro;
        g.scale.setScalar(Math.max(1e-4, s));
        g.position.y = AGENT_POS[a].y + (animate ? Math.sin(t * 0.8 + a * 1.7) * 0.04 : 0);
      }
      const h = halos.current[a];
      if (h) h.opacity = (0.04 + w * 0.12 + done * 0.16) * intro;
    }
    const hubW = fallReady.current ? clamp01((simT - fallT[N - 1]) / 0.06) : animate ? 0 : 1;
    if (hub.current) {
      hub.current.scale.setScalar(Math.max(1e-4, (0.6 + hubW * 0.6) * intro));
      hub.current.position.y = HUB_POS.y + (animate ? Math.sin(t * 0.6) * 0.05 : 0);
      hub.current.rotation.y = animate ? t * 0.25 : 0.6;
    }
    if (hubHalo.current) hubHalo.current.opacity = (0.05 + hubW * 0.24) * intro;
    ground.uniforms.uLit.value = fallen / N;

    /* ---- filaments ---- */
    const pos = lines.pos;
    const col = lines.col;
    for (let i = 0; i < N; i++) {
      const a = agentOf(i);
      const ng = nodes.current[a];
      let bx = PTS[i][0];
      let by = HY * 2;
      let bz = PTS[i][1];
      if (mesh && baked) {
        mesh.getMatrixAt(i, _m);
        _up.set(0, HY, 0).applyMatrix4(_m);
        bx = _up.x;
        by = _up.y;
        bz = _up.z;
      }
      const o = i * 6;
      pos[o] = bx;
      pos[o + 1] = by;
      pos[o + 2] = bz;
      pos[o + 3] = AGENT_POS[a].x;
      pos[o + 4] = ng ? ng.position.y : AGENT_POS[a].y;
      pos[o + 5] = AGENT_POS[a].z;
      /* flash on the fall, settle to a steady thread */
      const since = fallReady.current ? simT - fallT[i] : animate ? -1 : 1;
      const on = since >= 0 ? 1 : 0;
      const flash = on * Math.exp(-Math.max(0, since) * 28);
      const alpha = on * (0.16 + flash * 0.7);
      const c = i * 8;
      col[c] = C_LINE.r;
      col[c + 1] = C_LINE.g;
      col[c + 2] = C_LINE.b;
      col[c + 3] = alpha * 0.35;
      col[c + 4] = C_LINE.r;
      col[c + 5] = C_LINE.g;
      col[c + 6] = C_LINE.b;
      col[c + 7] = alpha;
    }
    for (let a = 0; a < AGENTS; a++) {
      const o = (N + a) * 6;
      const ng = nodes.current[a];
      pos[o] = AGENT_POS[a].x;
      pos[o + 1] = ng ? ng.position.y : AGENT_POS[a].y;
      pos[o + 2] = AGENT_POS[a].z;
      pos[o + 3] = HUB_POS.x;
      pos[o + 4] = hub.current ? hub.current.position.y : HUB_POS.y;
      pos[o + 5] = HUB_POS.z;
      const alpha = 0.06 + hubW * 0.5;
      const c = (N + a) * 8;
      col[c] = C_LINE.r;
      col[c + 1] = C_LINE.g;
      col[c + 2] = C_LINE.b;
      col[c + 3] = alpha;
      col[c + 4] = C_LINE.r;
      col[c + 5] = C_LINE.g;
      col[c + 6] = C_LINE.b;
      col[c + 7] = alpha;
    }
    (lines.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (lines.g.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    /* ---- stage placement: right in hero → centre for the relay → retire ---- */
    const g = stage.current;
    if (g) {
      const heroX = q.compact ? 0 : 3.05;
      const heroY = q.compact ? -2.1 : -1.55;
      const restX = q.compact ? 0.2 : 2.6;
      const cx = lerp(lerp(heroX, 0, arrive), restX, leave);
      const cy = lerp(lerp(heroY, -0.75, arrive), -0.9, leave) + (1 - intro) * -0.6;
      const cz = lerp(lerp(-1.2, 0, arrive), -2.4 - persona * 0.8, leave);
      g.position.set(cx, cy, cz);
      const s = (q.compact ? 0.62 : 0.92) * lerp(lerp(0.7, 1, arrive), 0.85, leave);
      g.scale.setScalar(s);
      /* the spiral turns a quarter as it arrives; pointer tilts the table */
      const px = animate ? pointer.x : 0;
      const py = animate ? pointer.y : 0;
      g.rotation.y += (-0.5 + arrive * 0.5 + leave * 0.4 + (animate ? t * 0.012 * (1 - arrive + leave) : 0) + px * 0.12 - g.rotation.y) * 0.05;
      g.rotation.x += (-py * 0.05 - g.rotation.x) * 0.05;
    }

    /* ---- hotspot (hub) → ProximityType headlines ---- */
    if (hub.current) report(hub.current, state.camera, 0.45 + hubW * 0.5);

    /* ---- camera: lift during the relay so the spiral reads ---- */
    const cam = state.camera;
    const camY = lerp(lerp(1.1, 3.6, arrive), 1.4, leave);
    const camZ = lerp(lerp(9, 8.4, arrive), 9, leave) + (q.compact ? 3.2 : 0);
    const px = animate ? pointer.x * 0.25 : 0;
    const py = animate ? pointer.y * 0.18 : 0;
    if (animate) {
      cam.position.x += (px - cam.position.x) * 0.05;
      cam.position.y += (camY + py - cam.position.y) * 0.05;
      cam.position.z += (camZ - cam.position.z) * 0.05;
    } else {
      cam.position.set(0, 2.4, 9 + (q.compact ? 3.2 : 0));
    }
    _look.set(lerp(q.compact ? 0 : 1.1, 0, arrive) * (1 - leave) + (q.compact ? 0 : 1.2) * leave, lerp(-0.3, -0.4, arrive), 0);
    cam.lookAt(_look);
  });

  return (
    <group>
      <SceneLightRig />
      <ParticleField count={Math.floor(1300 * q.particles)} drift={q.animate ? 0.1 : 0} opacity={0.32} />

      <group ref={stage} position={[2.3, -0.9, -1.2]} scale={0.8}>
        {/* the table */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]} material={ground}>
          <planeGeometry args={[6.4, 6.4]} />
        </mesh>

        {/* the dominoes */}
        <instancedMesh ref={dominoes} args={[geo, undefined, N]} frustumCulled={false}>
          <GlassMaterial kind="ice" thickness={0.4} />
        </instancedMesh>

        {/* the request */}
        <mesh ref={orb} position={ORB_START}>
          <sphereGeometry args={[ORB_R, 32, 32]} />
          <GlassMaterial kind="deep" />
        </mesh>

        {/* the network */}
        <primitive object={lines.obj} />
        {AGENT_POS.map((p, a) => (
          <group
            key={a}
            position={p}
            ref={(el) => {
              nodes.current[a] = el;
            }}
          >
            <mesh>
              <sphereGeometry args={[0.11, 32, 32]} />
              <GlassMaterial kind="core" />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.17, 24, 24]} />
              <meshBasicMaterial
                ref={(el) => {
                  halos.current[a] = el;
                }}
                color="#93a9ff"
                transparent
                opacity={0.1}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
        <group ref={hub} position={HUB_POS}>
          <mesh>
            <octahedronGeometry args={[0.2, 0]} />
            <GlassMaterial kind="deep" flatShading />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.28, 24, 24]} />
            <meshBasicMaterial
              ref={hubHalo}
              color="#93a9ff"
              transparent
              opacity={0.1}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
