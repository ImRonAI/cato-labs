'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import ParticleSculpture from '../../../kit/ParticleSculpture';
import { skylinePoints } from '../../../kit/lib/skylines';
import { useHotspotReporter } from '../../../kit/ProximityType';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';

/**
 * SanFranciscoScene — "The Fog".
 *
 * The Transamerica pyramid skyline assembles out of light as a
 * ParticleSculpture point cloud (skylinePoints('san-francisco', …)),
 * swaying ±10° with a water cursor. A slow band of soft ice-colored
 * points — Karl the Fog — rolls through the skyline at mid-height,
 * parting around the pyramid: particles lift and push forward as they
 * cross the tower, so the density reads thinner there. The band is a
 * shader-free CPU wrapper: x positions advance and wrap inside a typed
 * array; the GPU only sees the final positions. Off to the right, a tiny
 * cable-car marker glides up and down a hairline wire strung across the
 * hillside — a slow ping-pong climb.
 *
 * Scroll: on the `angles` beat the fog thins and the skyline brightens.
 * Hotspot 'sf-skyline' rides the pyramid apex for ProximityType.
 *
 * Zero allocations in useFrame (module temps + typed arrays), quality
 * scaled, reduced motion → assembled static, fog parked thin, the car
 * parked mid-hill.
 */

/* ---- fog band tuning (sculpture-local units, the cloud spans [-1,1]) ---- */
const FOG_HALF_W = 1.75; // wrap bounds — wider than the skyline
const FOG_PART_R = 0.32; // parting radius around the pyramid (local x = 0)
const FOG_Y = -0.08; // mid-height of the building body
const FOG_OPACITY_HI = 0.5;
const FOG_OPACITY_LO = 0.1;

const fogVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aScale;
  attribute float aSeed;
  varying float vSeed;
  varying float vFade;

  void main() {
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.85 + 0.15 * sin(uTime * (0.5 + aSeed * 0.6) + aSeed * 40.0);
    gl_PointSize = uSize * aScale * twinkle * uPixelRatio * (14.0 / -mv.z);
    vFade = smoothstep(26.0, 8.0, -mv.z);
  }
`;

const fogFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vSeed;
  varying float vFade;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.45, 0.04, d);
    float halo = smoothstep(0.5, 0.22, d) * 0.3;
    float a = (core + halo) * uOpacity * vFade;
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uColorA, uColorB, vSeed), a);
  }
`;

function FogBand({
  count,
  pointsRef,
  animate,
}: {
  count: number;
  pointsRef: React.RefObject<THREE.Points | null>;
  animate: boolean;
}) {
  const sim = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const seeds = new Float32Array(count);
    const speeds = new Float32Array(count);
    const baseY = new Float32Array(count);
    const baseZ = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * FOG_HALF_W;
      // approx-normal vertical falloff so the band has a soft center
      const g = (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
      baseY[i] = FOG_Y + g * 0.15;
      baseZ[i] = (Math.random() * 2 - 1) * 0.3;
      positions[i * 3 + 1] = baseY[i];
      positions[i * 3 + 2] = baseZ[i];
      scales[i] = 0.7 + Math.random() * 1.6;
      seeds[i] = Math.random();
      speeds[i] = 0.04 + seeds[i] * 0.05; // the slow roll
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: fogVertexShader,
      fragmentShader: fogFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 5.2 },
        uPixelRatio: { value: 1 },
        uColorA: { value: new THREE.Color('#eef2ff') },
        uColorB: { value: new THREE.Color('#b9ccff') },
        uOpacity: { value: 0 },
      },
    });
    return { geometry, material, positions, speeds, baseY, baseZ };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useEffect(() => {
    return () => {
      sim.geometry.dispose();
      sim.material.dispose();
    };
  }, [sim]);

  useFrame((state, delta) => {
    const m = sim.material;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    m.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    if (!animate) return; // parked thin — parent holds opacity low
    const dt = Math.min(delta, 0.05);
    const { positions: pos, speeds, baseY, baseZ } = sim;
    const attr = sim.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      let x = pos[i3] + speeds[i] * dt;
      if (x > FOG_HALF_W) x -= FOG_HALF_W * 2;
      /* part around the pyramid: lift over and push forward, smoothly */
      const d = x / FOG_PART_R;
      const d2 = d * d;
      let y = baseY[i];
      let z = baseZ[i];
      if (d2 < 1) {
        const f = 1 - d2;
        const f2 = f * f;
        y += f2 * 0.22;
        z += f2 * 0.42;
      }
      pos[i3] = x;
      pos[i3 + 1] = y;
      pos[i3 + 2] = z;
    }
    attr.needsUpdate = true;
  });

  return (
    <points
      ref={pointsRef}
      geometry={sim.geometry}
      material={sim.material}
      frustumCulled={false}
    />
  );
}

/* module-scope temp — reused every frame, never allocated per-frame */
const _camTarget = new THREE.Vector3();

/* ---- the cable-car wire (sculpture-local units, the cloud spans [-1,1]) ---- */
/* strung up the hillside to the right of the pyramid */
const WIRE_A = new THREE.Vector3(-0.35, -0.62, 0.14);
const WIRE_B = new THREE.Vector3(0.92, 0.16, 0.14);

/**
 * CableCar — a hairline wire up the hill and a tiny deep-blue car
 * gliding along it. The wire is a thin stretched box (no Line element
 * typing quirks); the car is pure ref-driven motion — zero allocations
 * per frame.
 */
const _wireMid = new THREE.Vector3().addVectors(WIRE_A, WIRE_B).multiplyScalar(0.5);
const _wireDelta = new THREE.Vector3().subVectors(WIRE_B, WIRE_A);
const WIRE_LEN = _wireDelta.length();
const WIRE_ANGLE = Math.atan2(_wireDelta.y, _wireDelta.x);

function CableCar({ animate }: { animate: boolean }) {
  const car = useRef<THREE.Group>(null);

  useFrame((state) => {
    const c = car.current;
    if (!c) return;
    /* ping-pong climb: slow, eased at both ends; parked mid-hill when still */
    const t = animate
      ? 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 0.09 - Math.PI / 2)
      : 0.42;
    const e = t * t * (3 - 2 * t); // smoothstep ends
    c.position.lerpVectors(WIRE_A, WIRE_B, e);
    c.position.y += 0.055; // ride on the wire, not through it
  });

  return (
    <group>
      {/* the wire — a hairline box strung from A to B */}
      <mesh
        position={[_wireMid.x, _wireMid.y, _wireMid.z]}
        rotation={[0, 0, WIRE_ANGLE]}
      >
        <boxGeometry args={[WIRE_LEN, 0.0035, 0.0035]} />
        <meshBasicMaterial color="#2e4bff" transparent opacity={0.28} />
      </mesh>
      {/* the car — a small cabin with a roofline, riding the wire */}
      <group ref={car} position={[WIRE_A.x, WIRE_A.y + 0.055, WIRE_A.z]}>
        <mesh>
          <boxGeometry args={[0.052, 0.05, 0.036]} />
          <meshBasicMaterial color="#1226c8" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.034, 0]}>
          <boxGeometry args={[0.06, 0.014, 0.04]} />
          <meshBasicMaterial color="#2e4bff" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

export default function SanFranciscoScene() {
  const q = useQuality();
  const wrap = useRef<THREE.Group>(null);
  const fogPts = useRef<THREE.Points>(null);
  const anchor = useRef<THREE.Group>(null);
  const report = useHotspotReporter('sf-skyline');

  const skyline = useMemo(
    () => skylinePoints('san-francisco', Math.max(64, Math.round(2400 * q.particles))),
    [q.particles],
  );

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    /* the angles beat: fog thins, skyline brightens */
    const angles = anim
      ? smooth(sectionRange(getSectionProgress('angles'), 0.05, 0.85))
      : 1;
    const intro = anim ? smooth(Math.min(el / 1.8, 1)) : 1;

    const g = wrap.current;
    if (g) {
      g.rotation.y = anim ? Math.sin(el * 0.05) * (Math.PI / 18) : 0; // ±10°
      g.position.y = -0.18 - 0.45 * (1 - intro);
      /* sculpture is the first child: group → points → material */
      const pts = g.children[0]?.children[0] as THREE.Points | undefined;
      const sm = pts?.material as THREE.ShaderMaterial | undefined;
      if (sm?.uniforms?.uOpacity) {
        sm.uniforms.uOpacity.value =
          (0.5 + 0.4 * angles) * (0.35 + 0.65 * intro);
      }
    }

    /* the fog: thins on the angles beat; parked thin under reduced motion */
    const fm = fogPts.current?.material as THREE.ShaderMaterial | undefined;
    if (fm?.uniforms?.uOpacity) {
      const target = anim
        ? FOG_OPACITY_HI - (FOG_OPACITY_HI - FOG_OPACITY_LO) * angles
        : FOG_OPACITY_LO;
      fm.uniforms.uOpacity.value = target * intro;
    }

    /* hotspot rides the pyramid apex */
    if (anchor.current) report(anchor.current, state.camera, 0.55 + 0.35 * angles);

    /* camera — slow drift + pointer parallax, eased */
    const drift = anim ? Math.sin(el * 0.045) * ((Math.PI * 6) / 180) : 0.3;
    _camTarget.set(
      Math.sin(drift) * 9 + (anim ? pointer.x * 0.4 : 0),
      0.35 + (anim ? pointer.y * 0.25 : 0),
      Math.cos(drift) * 9,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    state.camera.lookAt(0, -0.05, -1);
  });

  return (
    <group>
      <SceneLightRig />
      <group ref={wrap} position={[0, -0.18, -1.7]} scale={2.15}>
        <ParticleSculpture
          points={skyline}
          count={2400}
          size={0.032}
          color="#2e4bff"
          colorB="#93a9ff"
          opacity={0.9}
          waterRadius={0.3}
          waterStrength={0.16}
        />
        <FogBand
          count={Math.max(48, Math.round(560 * q.particles))}
          pointsRef={fogPts}
          animate={q.animate}
        />
        {/* the cable car gliding its wire on the hillside */}
        <CableCar animate={q.animate} />
        <group ref={anchor} position={[0, 0.5, 0]} />
      </group>
      <ParticleField
        count={Math.floor(750 * q.particles)}
        drift={q.animate ? 0.08 : 0}
        opacity={0.22}
      />
    </group>
  );
}
