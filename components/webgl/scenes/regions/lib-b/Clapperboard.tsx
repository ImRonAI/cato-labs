'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import { pointer, smooth } from '../../../scroll-store';
import { fadeTree } from './fade';
import { phase, sat } from './moment';
import { ribbonGeometry } from './ribbon';
import { moment, refreshMoment } from './stage';

/**
 * Clapperboard — the Los Angeles signature moment.
 *
 * Scrubbed by the `moment` dwell (t 0→1):
 *  0.00–0.16  the glass slate rises into frame and the clapper arm opens
 *  0.19–0.235 the arm accelerates shut (quadratic fall), SNAP — a hairline
 *             shock ring and a camera kick, then a damped chatter
 *  0.30–0.46  the slate lifts out of shot; the projector lamp warms
 *  0.36–1.00  film runs through the gate: the strip advances with scroll,
 *             each frame passing the gate is lit, and the beam throws that
 *             frame — a tiny procedural skyline — onto the screen at right,
 *             with a shutter flicker on every frame change
 * Scrolling up rewinds all of it exactly. Reduced motion: the timeline is
 * frozen on a composed still (film in the gate, picture on screen) that
 * simply fades in with the dwell.
 */

const FRAME_PITCH = 0.34; // world units per film frame
const FILM_RUN = 9.5; // frames advanced over the whole run
const GATE_Y = 0.45; // film-local height of the gate / lens axis

const filmVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vLocal;
  void main() {
    vUv = uv;
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* shared: a frame's skyline — bars from a per-frame hash */
const skylineGlsl = /* glsl */ `
  float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  /* p in 0..1 cell space, f = frame index; returns 1 inside a tower */
  float frameCity(vec2 p, float f) {
    float cols = 9.0;
    float c = floor(p.x * cols);
    float hgt = 0.18 + 0.62 * pow(h11(c * 7.13 + f * 3.71), 1.6);
    /* one spire per frame */
    float spire = step(abs(c - floor(h11(f * 1.37) * cols)), 0.0) * 0.18;
    float gap = step(0.12, fract(p.x * cols)) * step(fract(p.x * cols), 0.9);
    return gap * step(p.y, hgt + spire);
  }
`;

const filmFragment = /* glsl */ `
  uniform float uOffset;
  uniform float uPitch;
  uniform float uLit;
  uniform float uGateY;
  uniform float uOpacity;
  uniform vec3 uBase;
  uniform vec3 uCell;
  uniform vec3 uGlow;
  varying vec2 vUv;
  varying vec3 vLocal;
  ${skylineGlsl}
  float box(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    float s = vUv.x + uOffset;
    float fi = floor(s / uPitch);
    float fx = fract(s / uPitch);
    float w = vUv.y;
    /* sprocket holes, four per frame, both edges */
    float hx = fract(s / (uPitch * 0.25)) - 0.5;
    float edge = min(w, 1.0 - w);
    float hole = box(vec2(hx, (edge - 0.085) * 4.0), vec2(0.22, 0.17), 0.08);
    if (edge < 0.17 && hole < 0.0) discard;
    /* frame cell */
    vec2 cp = vec2(fx - 0.5, w - 0.5);
    float cell = box(cp, vec2(0.43, 0.3), 0.04);
    float inCell = step(cell, 0.0);
    /* which frame is in the gate — lit by the lamp */
    float gate = exp(-pow((vLocal.y - uGateY) * 3.2, 2.0)) * uLit;
    vec2 local = vec2((fx - 0.07) / 0.86, (w - 0.2) / 0.6);
    float city = frameCity(local, fi) * inCell;
    vec3 col = uBase;
    float a = 0.9;
    col = mix(col, uCell, inCell);
    a = mix(a, 0.42 + 0.4 * gate, inCell);
    col = mix(col, uBase, city * (1.0 - gate));
    col = mix(col, uGlow, gate * inCell * (1.0 - city * 0.65));
    a = mix(a, 0.95, city);
    gl_FragColor = vec4(col, a * uOpacity);
  }
`;

const screenFragment = /* glsl */ `
  uniform float uFrame;
  uniform float uFlick;
  uniform float uOpacity;
  uniform vec3 uInk;
  uniform vec3 uGlow;
  varying vec2 vUv;
  ${skylineGlsl}
  void main() {
    vec2 p = vUv;
    /* projected picture: soft vignette, the gate's frame, magnified */
    vec2 d = abs(p - 0.5) * 2.0;
    float vig = smoothstep(1.0, 0.72, max(d.x, d.y));
    float city = frameCity(vec2((p.x - 0.07) / 0.86, (p.y - 0.08) / 0.75), uFrame);
    float scan = 0.94 + 0.06 * sin(p.y * 220.0);
    vec3 col = mix(uGlow, uInk, city * 0.85);
    float a = (0.16 + 0.6 * city) * vig * scan * uFlick;
    /* hairline frame edge */
    float edgeLine = smoothstep(0.985, 1.0, max(d.x, d.y));
    a = max(a, edgeLine * 0.5);
    gl_FragColor = vec4(col, a * uOpacity);
  }
`;

const beamVertex = /* glsl */ `
  varying float vAlong;
  varying float vRim;
  void main() {
    vAlong = uv.y;
    vec3 n = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vRim = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;

const beamFragment = /* glsl */ `
  uniform float uOpacity;
  uniform float uFlick;
  uniform vec3 uColor;
  varying float vAlong;
  varying float vRim;
  void main() {
    /* brighter near the lens, soft at the cone's edges (volumetric fake) */
    float along = mix(1.0, 0.3, vAlong);
    float body = pow(vRim, 1.6);
    float a = body * along * uOpacity * uFlick;
    gl_FragColor = vec4(uColor, a);
  }
`;

const stripeFragment = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uA;
  uniform vec3 uB;
  varying vec2 vUv;
  void main() {
    float s = step(0.5, fract((vUv.x * 7.0 + vUv.y * 1.2)));
    gl_FragColor = vec4(mix(uA, uB, s), uOpacity);
  }
`;


export default function Clapperboard({
  position = [0, 0, 0],
}: {
  position?: [number, number, number];
}) {
  const q = useQuality();
  const root = useRef<THREE.Group>(null);
  const slate = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const rig = useRef<THREE.Group>(null);
  const reelTop = useRef<THREE.Group>(null);
  const reelBot = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const lamp = useRef<THREE.MeshBasicMaterial>(null);

  const mats = useMemo(() => {
    const stripe = (a: string, b: string) =>
      new THREE.ShaderMaterial({
        vertexShader: filmVertex,
        fragmentShader: stripeFragment,
        transparent: true,
        uniforms: {
          uOpacity: { value: 1 },
          uA: { value: new THREE.Color(a) },
          uB: { value: new THREE.Color(b) },
        },
      });
    const film = new THREE.ShaderMaterial({
      vertexShader: filmVertex,
      fragmentShader: filmFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uOffset: { value: 0 },
        uPitch: { value: FRAME_PITCH },
        uLit: { value: 0 },
        uGateY: { value: GATE_Y },
        uOpacity: { value: 1 },
        uBase: { value: new THREE.Color('#1226c8') },
        uCell: { value: new THREE.Color('#dfe7ff') },
        uGlow: { value: new THREE.Color('#f6f8ff') },
      },
    });
    const screen = new THREE.ShaderMaterial({
      vertexShader: filmVertex,
      fragmentShader: screenFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uFrame: { value: 0 },
        uFlick: { value: 1 },
        uOpacity: { value: 1 },
        uInk: { value: new THREE.Color('#2e4bff') },
        uGlow: { value: new THREE.Color('#b9ccff') },
      },
    });
    const beamM = new THREE.ShaderMaterial({
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uOpacity: { value: 0 },
        uFlick: { value: 1 },
        uColor: { value: new THREE.Color('#5f7dff') },
      },
    });
    return {
      stickA: stripe('#1226c8', '#eef2ff'),
      stickB: stripe('#eef2ff', '#1226c8'),
      film,
      screen,
      beam: beamM,
    };
  }, []);

  /* the film path: top reel → down through the gate → bottom reel */
  const film = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-0.55, 1.62, -0.25),
        new THREE.Vector3(-0.08, 1.15, 0),
        new THREE.Vector3(0, 0.4, 0.04),
        new THREE.Vector3(0, -0.3, 0.04),
        new THREE.Vector3(-0.1, -1.0, 0),
        new THREE.Vector3(-0.6, -1.5, -0.25),
      ],
      false,
      'centripetal',
    );
    const r = ribbonGeometry(curve, 120, 0.42);
    /* arc length at the gate (y = GATE_Y) — the frame the beam throws */
    const p = new THREE.Vector3();
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i <= 200; i++) {
      curve.getPointAt(i / 200, p);
      const d = Math.abs(p.y - GATE_Y);
      if (d < bestD) {
        bestD = d;
        best = i / 200;
      }
    }
    return { ...r, gateArc: best * r.length };
  }, []);

  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      film.geometry.dispose();
    },
    [mats, film],
  );

  useFrame(() => {
    refreshMoment();
    const t = q.animate ? moment.t : 0.72;
    const w = moment.w;
    const g = root.current;
    if (!g) return;
    g.visible = w > 0.002;
    if (!g.visible) return;

    /* pointer: the whole set turns a whisper toward the cursor */
    const px = q.animate ? pointer.x : 0;
    const py = q.animate ? pointer.y : 0;
    g.rotation.y += (px * 0.14 - g.rotation.y) * 0.06;
    g.rotation.x += (-py * 0.06 - g.rotation.x) * 0.06;

    /* ---- the slate: rise in, clap, lift out ---- */
    const rise = phase(t, 0.0, 0.12);
    const leave = phase(t, 0.3, 0.46);
    const sl = slate.current;
    if (sl) {
      sl.position.set(leave * 0.6, -0.9 * (1 - rise) + leave * 1.9, 0);
      sl.rotation.z = -0.06 * (1 - rise) + leave * 0.22;
      sl.rotation.y = -0.18 + 0.12 * rise;
      fadeTree(sl, sat(rise * 1.4) * (1 - leave) * w);
    }
    /* arm: open (eased), then a gravity-like snap, then a damped chatter */
    const open = phase(t, 0.04, 0.16) * 0.62;
    const fall = sat((t - 0.19) / 0.045);
    let angle = open * (1 - fall * fall);
    const after = t - 0.235;
    if (after > 0) angle += Math.abs(Math.sin(after * 95)) * 0.07 * Math.exp(-after * 40);
    if (arm.current) arm.current.rotation.z = angle;

    /* the shock ring at the snap */
    const shock = sat((t - 0.235) / 0.11);
    if (ring.current && ringMat.current) {
      const on = t > 0.235 && shock < 1;
      ring.current.visible = on;
      const s = 0.2 + shock * 2.6;
      ring.current.scale.set(s, s, s);
      ringMat.current.opacity = on ? (1 - shock) * (1 - shock) * 0.7 * w : 0;
    }
    /* the whole set jolts at the snap — scrubbed, so it rewinds too */
    const kick = t > 0.235 ? Math.sin((t - 0.235) * 160) * Math.exp(-(t - 0.235) * 45) * 0.05 : 0;
    g.position.set(position[0], position[1] + kick, position[2]);

    /* ---- the projector: lamp warms, film runs, picture flickers ---- */
    const lampOn = phase(t, 0.34, 0.46);
    const rigIn = phase(t, 0.28, 0.42);
    const run = sat((t - 0.36) / 0.64);
    const offset = run * FILM_RUN * FRAME_PITCH;
    const frac = (offset / FRAME_PITCH) % 1;
    /* the shutter: dark for a sliver of each frame pull-down */
    const flick = run > 0 && run < 1 ? 0.55 + 0.45 * smooth(sat(Math.abs(frac - 0.5) * 2.2 - 0.05)) : 1;
    const shutter = 1 - (1 - flick) * lampOn;
    const fu = mats.film.uniforms;
    fu.uOffset.value = -offset;
    fu.uLit.value = lampOn;
    const rg = rig.current;
    if (rg) {
      rg.position.y = (1 - rigIn) * -0.4;
      fadeTree(rg, rigIn * w);
    }
    mats.beam.uniforms.uOpacity.value = lampOn * 0.55 * w;
    mats.beam.uniforms.uFlick.value = shutter;
    mats.screen.uniforms.uOpacity.value = lampOn * w;
    mats.screen.uniforms.uFlick.value = shutter;
    /* the frame in the gate: s = vUv.x + uOffset at the gate's arc position */
    mats.screen.uniforms.uFrame.value = Math.floor((film.gateArc - offset) / FRAME_PITCH);
    if (lamp.current) lamp.current.opacity = (0.35 + 0.65 * lampOn * shutter) * rigIn * w;
    if (beam.current) beam.current.rotation.x = py * 0.04;
    /* reels spin with the film: angle = arc / radius */
    if (reelTop.current) reelTop.current.rotation.z = offset / 0.42;
    if (reelBot.current) reelBot.current.rotation.z = offset / 0.42;
  });

  const reel = (ref: React.RefObject<THREE.Group | null>, pos: [number, number, number]) => (
    <group position={pos}>
      <group ref={ref}>
        <mesh>
          <cylinderGeometry args={[0.46, 0.46, 0.05, 48]} />
          <GlassMaterial kind="ice" transparent />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]} position={[0, 0, 0.035]}>
            <boxGeometry args={[0.84, 0.035, 0.01]} />
            <meshBasicMaterial color="#2e4bff" transparent opacity={0.85} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.04]}>
          <circleGeometry args={[0.09, 24]} />
          <meshBasicMaterial color="#1226c8" transparent />
        </mesh>
      </group>
    </group>
  );

  return (
    <group ref={root} position={position}>
      {/* ---------- the slate ---------- */}
      <group ref={slate}>
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[1.7, 1.05, 0.07]} />
          <GlassMaterial kind="pane" transparent />
        </mesh>
        {/* the slate's ruled fields */}
        {[0.18, -0.12, -0.38].map((y) => (
          <mesh key={y} position={[0, y, 0.04]}>
            <boxGeometry args={[1.52, 0.012, 0.004]} />
            <meshBasicMaterial color="#2e4bff" transparent opacity={0.7} />
          </mesh>
        ))}
        {[-0.28, 0.32].map((x) => (
          <mesh key={x} position={[x, -0.25, 0.04]}>
            <boxGeometry args={[0.012, 0.26, 0.004]} />
            <meshBasicMaterial color="#2e4bff" transparent opacity={0.7} />
          </mesh>
        ))}
        {/* fixed stick */}
        <mesh position={[0, 0.58, 0]} material={mats.stickA}>
          <boxGeometry args={[1.7, 0.17, 0.09]} />
        </mesh>
        {/* hinged clapper arm, pivoting at the left end */}
        <group position={[-0.85, 0.67, 0]}>
          <group ref={arm}>
            <mesh position={[0.85, 0.085, 0]} material={mats.stickB}>
              <boxGeometry args={[1.7, 0.17, 0.09]} />
            </mesh>
          </group>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.12, 16]} />
            <meshBasicMaterial color="#1226c8" transparent />
          </mesh>
        </group>
        {/* snap shock ring at the meeting edge */}
        <mesh ref={ring} position={[0.6, 0.67, 0.06]} visible={false}>
          <ringGeometry args={[0.96, 1, 96]} />
          <meshBasicMaterial
            ref={ringMat}
            color="#2e4bff"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ---------- the projector rig ---------- */}
      <group ref={rig}>
        <group position={[-1.6, 0, 0]}>
          {reel(reelTop, [-0.62, 1.55, -0.3])}
          {reel(reelBot, [-0.66, -1.45, -0.3])}
          <mesh geometry={film.geometry} material={mats.film} />
          {/* lamp behind the gate, glass lens in front of it */}
          <mesh position={[-0.42, GATE_Y, -0.05]}>
            <circleGeometry args={[0.13, 32]} />
            <meshBasicMaterial ref={lamp} color="#2e4bff" transparent opacity={0} />
          </mesh>
          <mesh position={[0.3, GATE_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.2, 0.2, 0.36, 40]} />
            <GlassMaterial kind="core" transparent />
          </mesh>
          {/* the beam: an open cone from lens to screen */}
          <group position={[2.43, GATE_Y, -0.05]}>
            <mesh ref={beam} rotation={[0, 0, -Math.PI / 2]} material={mats.beam}>
              <cylinderGeometry args={[0.9, 0.16, 3.9, 48, 1, true]} />
            </mesh>
          </group>
          {/* the projected picture */}
          <mesh position={[4.45, GATE_Y, -0.1]} material={mats.screen}>
            <planeGeometry args={[2.5, 1.62]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
