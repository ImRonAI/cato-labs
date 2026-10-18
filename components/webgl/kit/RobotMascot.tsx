'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { GlassMaterial } from '../lib/materials';
import { pointer } from '../scroll-store';
import { useQuality } from '../lib/quality';
import { mulberry32 } from './lib/samplePath';

/**
 * RobotMascot — the Cato character. Built from primitives: a rounded-glass
 * head (crystal) with a dark visor band holding two glowing electric-blue
 * eyes, a small pane-glass body with a chest core light, thin arms, and an
 * antenna with a bobbing tip.
 *
 * Behaviors (all in useFrame, zero allocations):
 *  - head + eyes track the global pointer (clamped, damped — alive, not owl)
 *  - blink every 2.8–5.2s (seeded), eyes scaleY → 0.08 and back over ~140ms
 *  - body breathes (scaleY ±1.5% at rest rate); gentle hover bob + sway
 *  - antenna springs behind head yaw (secondary motion) + idle bob
 *  - wave: pointer within ~0.35 NDC distance of the robot's projected
 *    position raises an arm and oscillates it; relaxes (with hysteresis)
 *    when the pointer leaves
 *  - variant="mini": head + eyes only — for bubbles and cameos
 *  - q.animate === false (reduced motion): static pose, eyes open
 */

export interface RobotMascotProps {
  position?: [number, number, number];
  scale?: number;
  /** 'hero' = full body; 'mini' = head + eyes only */
  variant?: 'hero' | 'mini';
  /** 0..1 multiplier on all motion amplitude (tracking, bob, wave) */
  intensity?: number;
  /** seeds the blink schedule — give multiple mascots different seeds */
  seed?: number;
}

const _world = new THREE.Vector3();

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export default function RobotMascot({
  position = [0, 0, 0],
  scale = 1,
  variant = 'hero',
  intensity = 1,
  seed = 1,
}: RobotMascotProps) {
  const q = useQuality();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyeTrack = useRef<THREE.Group>(null);
  const eyeBlink = useRef<THREE.Group>(null);
  const antenna = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);

  /* seeded blink schedule state */
  const rng = useMemo(() => mulberry32(seed * 7919 + 13), [seed]);
  const anim = useRef({
    nextBlink: 2 + rng() * 3,
    blinkStart: -1,
    prevYaw: 0,
    waving: false,
    waveZ: 0,
    baseY: position[1],
  });

  useFrame((state, delta) => {
    const r = root.current;
    const h = head.current;
    if (!r || !h) return;
    if (!q.animate) return; // static pose, eyes open — initial transforms already correct

    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const A = anim.current;
    const amp = clamp(intensity, 0, 1);

    /* ---- head tracks pointer: damped, clamped yaw/pitch ---- */
    const yawT = clamp(pointer.x * 0.55, -0.6, 0.6) * amp;
    const pitchT = clamp(-pointer.y * 0.3, -0.35, 0.35) * amp;
    h.rotation.y += (yawT - h.rotation.y) * 0.06;
    h.rotation.x += (pitchT - h.rotation.x) * 0.06;

    /* ---- eyes slide within the visor ---- */
    const et = eyeTrack.current;
    if (et) {
      const exT = clamp(pointer.x * 0.09, -0.06, 0.06) * amp;
      const eyT = clamp(pointer.y * 0.06, -0.04, 0.04) * amp;
      et.position.x += (exT - et.position.x) * 0.12;
      et.position.y += (0.03 + eyT - et.position.y) * 0.12;
    }

    /* ---- blink: every 2.8–5.2s, 140ms lid dip ---- */
    const eb = eyeBlink.current;
    if (eb) {
      if (A.blinkStart < 0 && t > A.nextBlink) A.blinkStart = t;
      if (A.blinkStart >= 0) {
        const p = (t - A.blinkStart) / 0.14;
        if (p >= 1) {
          eb.scale.y = 1;
          A.blinkStart = -1;
          A.nextBlink = t + 2.8 + rng() * 2.4;
        } else if (p < 0.5) {
          eb.scale.y = 1 - p * 2 * 0.92;
        } else {
          eb.scale.y = 0.08 + (p - 0.5) * 2 * 0.92;
        }
      }
    }

    /* ---- antenna: spring lag behind head yaw + idle tip bob ---- */
    const an = antenna.current;
    if (an) {
      const yawVel = (h.rotation.y - A.prevYaw) / Math.max(dt, 1e-4);
      const tiltT = clamp(-yawVel * 0.09, -0.4, 0.4);
      an.rotation.z += (tiltT - an.rotation.z) * 0.07;
      an.rotation.x = Math.sin(t * 1.6 + seed) * 0.06 * amp;
    }
    A.prevYaw = h.rotation.y;

    /* ---- breathing + hover bob + gentle sway ---- */
    const b = body.current;
    if (b) {
      b.scale.y = 1 + Math.sin(t * 1.4) * 0.015 * amp;
    }
    r.position.y = A.baseY + Math.sin(t * 0.9 + seed * 2.1) * 0.045 * amp;
    r.rotation.z = Math.sin(t * 0.6 + seed) * 0.018 * amp;

    /* ---- wave: pointer near the robot's projected position ---- */
    const aR = armR.current;
    const aL = armL.current;
    if (variant === 'hero' && aR) {
      let near = false;
      if (pointer.active) {
        r.getWorldPosition(_world);
        _world.project(state.camera);
        const dx = _world.x - pointer.x;
        const dy = _world.y - pointer.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (!A.waving && d < 0.35) A.waving = true;
        else if (A.waving && d > 0.48) A.waving = false; // hysteresis — no flicker
        near = A.waving;
      } else {
        A.waving = false;
      }
      const waveT = near
        ? 2.15 + Math.sin(t * 8.5) * 0.38 * amp
        : 0.12 + Math.sin(t * 1.3) * 0.05 * amp;
      aR.rotation.z += (waveT - aR.rotation.z) * (near ? 0.18 : 0.07);
      if (aL) {
        aL.rotation.z += (-0.12 - Math.sin(t * 1.2 + 1) * 0.05 * amp - aL.rotation.z) * 0.07;
      }
    }
  });

  const headY = variant === 'hero' ? 0.12 : 0;

  return (
    <group ref={root} position={position} scale={scale}>
      {variant === 'hero' && (
        <group ref={body} position={[0, -0.95, 0]}>
          {/* torso */}
          <RoundedBox args={[0.66, 0.8, 0.52]} radius={0.18} smoothness={4}>
            <GlassMaterial kind="pane" />
          </RoundedBox>
          {/* chest core light */}
          <mesh position={[0, 0.08, 0.27]}>
            <circleGeometry args={[0.06, 24]} />
            <meshBasicMaterial color="#2e4bff" toneMapped={false} />
          </mesh>
          {/* left arm (viewer left) */}
          <group ref={armL} position={[-0.42, 0.28, 0]}>
            <RoundedBox
              args={[0.15, 0.52, 0.15]}
              radius={0.06}
              smoothness={4}
              position={[0, -0.26, 0]}
            >
              <GlassMaterial kind="ice" />
            </RoundedBox>
          </group>
          {/* right arm (viewer right) — the wave arm */}
          <group ref={armR} position={[0.42, 0.28, 0]}>
            <RoundedBox
              args={[0.15, 0.52, 0.15]}
              radius={0.06}
              smoothness={4}
              position={[0, -0.26, 0]}
            >
              <GlassMaterial kind="ice" />
            </RoundedBox>
          </group>
        </group>
      )}

      <group ref={head} position={[0, headY, 0]}>
        {/* rounded glass skull */}
        <RoundedBox args={[1.14, 0.95, 0.95]} radius={0.3} smoothness={5}>
          <GlassMaterial kind="crystal" />
        </RoundedBox>
        {/* dark visor band */}
        <RoundedBox
          args={[0.9, 0.4, 0.36]}
          radius={0.16}
          smoothness={4}
          position={[0, 0.03, 0.34]}
        >
          <meshStandardMaterial color="#0a0c12" roughness={0.35} metalness={0.15} />
        </RoundedBox>
        {/* eyes: slide group (tracking) ▸ blink group (scaleY) ▸ two flat glowing discs */}
        <group ref={eyeTrack} position={[0, 0.03, 0.53]}>
          <group ref={eyeBlink}>
            <mesh position={[-0.2, 0, 0]}>
              <circleGeometry args={[0.072, 24]} />
              <meshBasicMaterial color="#2e4bff" toneMapped={false} />
            </mesh>
            <mesh position={[0.2, 0, 0]}>
              <circleGeometry args={[0.072, 24]} />
              <meshBasicMaterial color="#2e4bff" toneMapped={false} />
            </mesh>
          </group>
        </group>
        {/* antenna with glowing tip */}
        {variant === 'hero' && (
          <group ref={antenna} position={[0.2, 0.48, 0]}>
            <mesh position={[0, 0.16, 0]}>
              <cylinderGeometry args={[0.016, 0.02, 0.32, 10]} />
              <meshStandardMaterial color="#0a0c12" roughness={0.4} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.35, 0]}>
              <sphereGeometry args={[0.055, 18, 14]} />
              <meshBasicMaterial color="#2e4bff" toneMapped={false} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}
