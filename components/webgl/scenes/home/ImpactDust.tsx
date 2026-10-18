'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { WreckTimeline } from './wreck';
import { FLOOR_Y, STRIKE_DIR } from './wreck';

const vertexShader = /* glsl */ `
  uniform float uT;          // simulated seconds (scrubbed, so fully reversible)
  uniform float uSize;
  uniform float uPixelRatio;
  attribute vec3 aVel;
  attribute float aStart;
  attribute float aLife;
  attribute float aScale;
  attribute float aSeed;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    float age = uT - aStart;
    vSeed = aSeed;
    if (age <= 0.0 || age >= aLife) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      return;
    }
    /* exponential air drag + a slow settle: fine glass dust, not sparks */
    float k = 2.6;
    vec3 p = position + aVel * (1.0 - exp(-k * age)) / k;
    p.y -= 0.32 * age * age;
    p.y = max(p.y, ${FLOOR_Y.toFixed(3)} + 0.01);
    /* lazy turbulence as it hangs in the air */
    p.x += sin(age * 1.7 + aSeed * 31.0) * 0.05 * age;
    p.z += cos(age * 1.3 + aSeed * 17.0) * 0.05 * age;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float life = age / aLife;
    vAlpha = smoothstep(0.0, 0.05, life) * pow(1.0 - life, 1.4);
    gl_PointSize = uSize * aScale * uPixelRatio * (10.0 / -mv.z) * (0.7 + 0.6 * smoothstep(0.0, 0.4, life));
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uBlue;
  uniform vec3 uIce;
  uniform vec3 uInk;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.08, d) * vAlpha * uOpacity;
    if (a < 0.004) discard;
    vec3 col = mix(uIce, uBlue, smoothstep(0.25, 0.9, vSeed));
    col = mix(col, uInk, step(0.94, vSeed) * 0.6);
    gl_FragColor = vec4(col, a);
  }
`;

/* deterministic PRNG — the dust is part of the recording, identical every scrub */
function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * ImpactDust — glass dust that kicks off every impact in the baked
 * recording. Emitters come from `analyseWreck`; each particle is a pure
 * function of simulated time, so the dust rewinds with the scroll.
 */
export default function ImpactDust({
  timeline,
  duration,
  budget,
  material,
}: {
  timeline: WreckTimeline;
  duration: number;
  budget: number;
  material: THREE.ShaderMaterial;
}) {
  const geometry = useMemo(() => {
    const rand = prng(7);
    const strikeT = timeline.hit * duration;
    type Emit = { t: number; pos: [number, number, number]; strength: number; floor: boolean; strike: boolean };
    const emitters: Emit[] = [
      { t: strikeT, pos: timeline.hitPos, strength: 1, floor: false, strike: true },
      ...timeline.events.map((e) => ({ ...e, strike: false })),
    ];
    const weights = emitters.map((e) => (e.strike ? 4.5 : 0.4 + e.strength));
    const total = weights.reduce((a, b) => a + b, 0);

    const pos: number[] = [];
    const vel: number[] = [];
    const start: number[] = [];
    const life: number[] = [];
    const scale: number[] = [];
    const seed: number[] = [];

    emitters.forEach((e, ei) => {
      const n = Math.max(6, Math.round((weights[ei] / total) * budget));
      for (let i = 0; i < n; i++) {
        let vx: number, vy: number, vz: number;
        if (e.strike) {
          /* a cone of glass dust thrown along the strike, plus a backspray */
          const back = rand() < 0.22 ? -0.55 : 1;
          const sp = (0.8 + rand() * 2.6) * back;
          vx = STRIKE_DIR.x * sp + (rand() - 0.5) * 1.5;
          vy = (rand() - 0.25) * 1.6;
          vz = STRIKE_DIR.z * sp + (rand() - 0.5) * 1.5;
        } else if (e.floor) {
          /* low radial puff that hugs the floor */
          const a = rand() * Math.PI * 2;
          const sp = (0.4 + rand() * 1.4) * (0.5 + e.strength);
          vx = Math.cos(a) * sp;
          vy = rand() * 0.55 * e.strength;
          vz = Math.sin(a) * sp;
        } else {
          const a = rand() * Math.PI * 2;
          const sp = (0.3 + rand() * 1.0) * (0.4 + e.strength);
          vx = Math.cos(a) * sp;
          vy = (rand() - 0.3) * 0.9;
          vz = Math.sin(a) * sp;
        }
        pos.push(e.pos[0] + (rand() - 0.5) * 0.25, e.pos[1] + (rand() - 0.5) * 0.2, e.pos[2] + (rand() - 0.5) * 0.25);
        vel.push(vx, vy, vz);
        start.push(e.t + rand() * 0.05);
        life.push((e.strike ? 1.8 : 1.2) + rand() * 1.6);
        scale.push(0.35 + rand() * (e.strike ? 1.5 : 1.1));
        seed.push(rand());
      }
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aVel', new THREE.Float32BufferAttribute(vel, 3));
    g.setAttribute('aStart', new THREE.Float32BufferAttribute(start, 1));
    g.setAttribute('aLife', new THREE.Float32BufferAttribute(life, 1));
    g.setAttribute('aScale', new THREE.Float32BufferAttribute(scale, 1));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    return g;
  }, [timeline, duration, budget]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}

export function createDustMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uT: { value: 0 },
      uSize: { value: 3.4 },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 0.85 },
      uBlue: { value: new THREE.Color('#2e4bff') },
      uIce: { value: new THREE.Color('#9fb3ff') },
      uInk: { value: new THREE.Color('#0a0c12') },
    },
  });
}
