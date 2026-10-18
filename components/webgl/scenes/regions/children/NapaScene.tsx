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
 * NapaScene — "The Rows".
 *
 * The Wine Country skyline — rolling hills with vine-row dashes along
 * the crests — assembles as a ParticleSculpture cloud (±10° sway, water
 * cursor). Below it, four parallel hairline rows of small points stretch
 * from the foreground into the valley: constant world spacing read
 * through the camera gives the perspective convergence for free. Between
 * the rows, a fine mist of ice-blue points rises and thins — each mote
 * climbs, fades, and loops back to the valley floor. A tiny deep-blue
 * sun hangs low over the hills.
 *
 * Scroll: on the `angles` beat the rows' opacity deepens and the mist
 * lifts — the valley fills in. Hotspot 'napa-skyline' rides the hill
 * crest for ProximityType.
 *
 * Zero allocations in useFrame, quality scaled, reduced motion →
 * assembled static with the rows filled in and the mist parked low.
 */

/* ---- the vine rows (world units) ---- */
const ROW_X = [-1.5, -0.5, 0.5, 1.5]; // constant spacing → perspective is free
const ROW_Z_NEAR = 1.3;
const ROW_Z_FAR = -6.5;
const ROW_Y_FAR = -1.3; // ground line at the horizon
const ROW_Y_DROP = 0.75; // how far the near end dips toward the viewer

const rowVertexShader = /* glsl */ `
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

const rowFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vSeed;
  varying float vFade;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.42, 0.06, d);
    float halo = smoothstep(0.5, 0.3, d) * 0.22;
    float a = (core + halo) * uOpacity * vFade;
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uColorA, uColorB, vSeed), a);
  }
`;

function VineRows({
  perRow,
  pointsRef,
}: {
  perRow: number;
  pointsRef: React.RefObject<THREE.Points | null>;
}) {
  const sim = useMemo(() => {
    const total = perRow * ROW_X.length;
    const positions = new Float32Array(total * 3);
    const scales = new Float32Array(total);
    const seeds = new Float32Array(total);
    let p = 0;
    for (let r = 0; r < ROW_X.length; r++) {
      const x0 = ROW_X[r];
      for (let i = 0; i < perRow; i++) {
        const t = i / (perRow - 1); // 0 near → 1 far
        /* ease the spacing so apparent density stays even with distance */
        const z = ROW_Z_NEAR + (ROW_Z_FAR - ROW_Z_NEAR) * Math.pow(t, 1.65);
        positions[p * 3] = x0 + (Math.random() - 0.5) * 0.03;
        positions[p * 3 + 1] =
          ROW_Y_FAR - (1 - t) * ROW_Y_DROP + (Math.random() - 0.5) * 0.02;
        positions[p * 3 + 2] = z;
        scales[p] = 0.5 + Math.random() * 0.9;
        seeds[p] = Math.random();
        p++;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: rowVertexShader,
      fragmentShader: rowFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 2.4 }, // hairline
        uPixelRatio: { value: 1 },
        uColorA: { value: new THREE.Color('#2e4bff') },
        uColorB: { value: new THREE.Color('#6f86ff') },
        uOpacity: { value: 0 },
      },
    });
    return { geometry, material };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perRow]);

  useEffect(() => {
    return () => {
      sim.geometry.dispose();
      sim.material.dispose();
    };
  }, [sim]);

  useFrame((state) => {
    sim.material.uniforms.uTime.value = state.clock.elapsedTime;
    sim.material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
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

/* ---- the mist between the rows (world units) ---- */
const MIST_X = [-1.0, 0.0, 1.0]; // between the four vine-row lanes
const MIST_Y_BASE = -1.15; // rises off the valley floor
const MIST_RISE = 0.85; // how high a mote climbs before fading out

const mistVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uLift;
  uniform float uMotion;
  attribute float aScale;
  attribute float aSeed;
  varying float vSeed;
  varying float vFade;
  varying float vLife;

  void main() {
    vSeed = aSeed;
    vec3 p = position;
    /* each mote loops: climb, thin, sink back — seeded phase offset */
    float life = fract(aSeed + uTime * (0.028 + aSeed * 0.022) * uMotion);
    p.y += life * MIST_RISE * uLift;
    p.x += sin(uTime * 0.18 * uMotion + aSeed * 31.0) * 0.06 * life;
    vLife = life;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * uPixelRatio * (14.0 / -mv.z);
    vFade = smoothstep(26.0, 8.0, -mv.z);
  }
`;

const mistFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vSeed;
  varying float vFade;
  varying float vLife;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.46, 0.08, d);
    /* motes fade in low, thin out as they climb */
    float age = sin(3.14159 * clamp(vLife, 0.0, 1.0));
    float a = core * uOpacity * vFade * age;
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uColorA, uColorB, vSeed), a);
  }
`;

/**
 * ValleyMist — a fine ice-blue mist rising between the vine rows.
 * The climb + fade loop runs entirely in the vertex shader.
 */
function ValleyMist({
  perLane,
  pointsRef,
}: {
  perLane: number;
  pointsRef: React.RefObject<THREE.Points | null>;
}) {
  const sim = useMemo(() => {
    const total = perLane * MIST_X.length;
    const positions = new Float32Array(total * 3);
    const scales = new Float32Array(total);
    const seeds = new Float32Array(total);
    let p = 0;
    for (let l = 0; l < MIST_X.length; l++) {
      for (let i = 0; i < perLane; i++) {
        const t = i / (perLane - 1); // 0 near → 1 far, matched to the rows
        const z = ROW_Z_NEAR + (ROW_Z_FAR - ROW_Z_NEAR) * Math.pow(t, 1.65);
        positions[p * 3] =
          MIST_X[l] + (Math.random() - 0.5) * 0.34; // drift inside the lane
        positions[p * 3 + 1] =
          MIST_Y_BASE - (1 - t) * ROW_Y_DROP + Math.random() * 0.08;
        positions[p * 3 + 2] = z;
        scales[p] = 0.9 + Math.random() * 1.7;
        seeds[p] = Math.random();
        p++;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: mistVertexShader,
      fragmentShader: mistFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      defines: { MIST_RISE: MIST_RISE.toFixed(3) },
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 5.6 },
        uPixelRatio: { value: 1 },
        uLift: { value: 1 },
        uMotion: { value: 1 },
        uColorA: { value: new THREE.Color('#eef2ff') },
        uColorB: { value: new THREE.Color('#b9ccff') },
        uOpacity: { value: 0 },
      },
    });
    return { geometry, material };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perLane]);

  useEffect(() => {
    return () => {
      sim.geometry.dispose();
      sim.material.dispose();
    };
  }, [sim]);

  useFrame((state) => {
    sim.material.uniforms.uTime.value = state.clock.elapsedTime;
    sim.material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
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

export default function NapaScene() {
  const q = useQuality();
  const wrap = useRef<THREE.Group>(null);
  const rowsPts = useRef<THREE.Points>(null);
  const mistPts = useRef<THREE.Points>(null);
  const anchor = useRef<THREE.Group>(null);
  const report = useHotspotReporter('napa-skyline');

  const skyline = useMemo(
    () => skylinePoints('napa', Math.max(64, Math.round(2400 * q.particles))),
    [q.particles],
  );

  useFrame((state) => {
    const el = state.clock.elapsedTime;
    const anim = q.animate;
    /* the angles beat: the rows deepen — the valley fills in */
    const angles = anim
      ? smooth(sectionRange(getSectionProgress('angles'), 0.05, 0.85))
      : 1;
    const intro = anim ? smooth(Math.min(el / 1.8, 1)) : 1;

    const g = wrap.current;
    if (g) {
      g.rotation.y = anim ? Math.sin(el * 0.05) * (Math.PI / 18) : 0; // ±10°
      g.position.y = -0.32 - 0.45 * (1 - intro);
      /* sculpture is the first child: group → points → material */
      const pts = g.children[0]?.children[0] as THREE.Points | undefined;
      const sm = pts?.material as THREE.ShaderMaterial | undefined;
      if (sm?.uniforms?.uOpacity) {
        sm.uniforms.uOpacity.value = 0.85 * (0.35 + 0.65 * intro);
      }
    }

    /* the rows fill the valley in */
    const rm = rowsPts.current?.material as THREE.ShaderMaterial | undefined;
    if (rm?.uniforms?.uOpacity) {
      const target = anim ? 0.22 + 0.4 * angles : 0.5;
      rm.uniforms.uOpacity.value = target * intro;
    }

    /* the mist lifts between the rows on the same beat */
    const mm = mistPts.current?.material as THREE.ShaderMaterial | undefined;
    if (mm?.uniforms?.uOpacity) {
      mm.uniforms.uOpacity.value = (anim ? 0.1 + 0.26 * angles : 0.2) * intro;
      mm.uniforms.uLift.value = 0.55 + 0.45 * angles;
      mm.uniforms.uMotion.value = anim ? 1 : 0;
    }

    /* hotspot rides the hill crest */
    if (anchor.current) report(anchor.current, state.camera, 0.5 + 0.3 * angles);

    /* camera — slow drift + pointer parallax, eased */
    const drift = anim ? Math.sin(el * 0.045) * ((Math.PI * 6) / 180) : 0.3;
    _camTarget.set(
      Math.sin(drift) * 9 + (anim ? pointer.x * 0.4 : 0),
      0.3 + (anim ? pointer.y * 0.25 : 0),
      Math.cos(drift) * 9,
    );
    state.camera.position.lerp(_camTarget, 0.05);
    state.camera.lookAt(0, -0.15, -1.5);
  });

  return (
    <group>
      <SceneLightRig />

      {/* hills + vine-dash skyline */}
      <group ref={wrap} position={[0, -0.32, -2.1]} scale={2}>
        <ParticleSculpture
          points={skyline}
          count={2400}
          size={0.032}
          color="#2e4bff"
          colorB="#93a9ff"
          opacity={0.85}
          waterRadius={0.3}
          waterStrength={0.16}
        />
        <group ref={anchor} position={[0, 0.28, 0]} />
      </group>

      {/* the valley floor — four hairline vine rows into the distance */}
      <VineRows perRow={Math.max(24, Math.round(90 * q.particles))} pointsRef={rowsPts} />

      {/* the morning mist — rising and thinning between the rows */}
      <ValleyMist perLane={Math.max(18, Math.round(70 * q.particles))} pointsRef={mistPts} />

      {/* a tiny deep-blue sun, hung low over the hills */}
      <mesh position={[1.55, 0.52, -4.4]}>
        <circleGeometry args={[0.13, 40]} />
        <meshBasicMaterial color="#1226c8" transparent opacity={0.9} />
      </mesh>
      <mesh position={[1.55, 0.52, -4.42]}>
        <circleGeometry args={[0.42, 40]} />
        <meshBasicMaterial color="#2e4bff" transparent opacity={0.07} depthWrite={false} />
      </mesh>

      <ParticleField
        count={Math.floor(700 * q.particles)}
        drift={q.animate ? 0.08 : 0}
        opacity={0.2}
      />
    </group>
  );
}
