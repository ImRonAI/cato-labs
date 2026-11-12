'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import SceneLightRig from '../../shared/SceneLightRig';
import ParticleField from '../../shared/ParticleField';
import { GlassMaterial } from '../../../lib/materials';
import { useQuality } from '../../../lib/quality';
import {
  getSectionProgress,
  sectionRange,
  smooth,
  pointer,
} from '../../../scroll-store';
import { useHotspotReporter } from '../../../kit/ProximityType';
import {
  beat,
  damp,
  introAt,
  newMoment,
  readMoment,
  useLensShift,
} from '../lib-b/stage';

/**
 * ArchitectureInteriorDesignScene — "The Cantilevered Glass Pavilion".
 *
 * Across the 280vh `moment` dwell (t: 0 → 1), a Miesian cantilevered
 * glass-and-wireframe pavilion rises out of a blueprint datum grid:
 *   • 0.00 → 0.28: Blueprint coordinate grid & datum axes draw across space.
 *   • 0.18 → 0.56: Blue architectural wireframe mullions, columns, and a
 *     dramatic cantilevered roof frame extrude upward from the blueprint.
 *   • 0.44 → 0.82: Refractive glass walls, structural columns, cantilevered
 *     roof slab, gallery plinth, and the deep-sapphire interior sculpture
 *     materialize onto the wireframe armature.
 *   • 0.68 → 1.00: Clerestory daylight with mullion shadow bars sweeps
 *     across the pavilion floor.
 *
 * Continues choreographing across `market-truth`, `feature`, `detail`, and
 * `cta`. Hotspot 'ind-aid-sculpture' rides the interior sculpture.
 * Zero allocations in useFrame; reduced motion renders the sunlit pavilion.
 */

const FLOOR_Y = -0.78;
const ROOF_Y = 1.48;
const ROOF_H = 0.085;

const patchVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const patchFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 c = abs(vUv - 0.5) * 2.0;
    float d = max(c.x, c.y);
    float a = smoothstep(1.0, 0.28, d);
    /* crisp architectural mullion shadow bars inside the sun patch */
    float g1 = smoothstep(0.01, 0.028, abs(vUv.x - 0.28));
    float g2 = smoothstep(0.01, 0.028, abs(vUv.x - 0.52));
    float g3 = smoothstep(0.01, 0.028, abs(vUv.x - 0.76));
    float g4 = smoothstep(0.01, 0.028, abs(vUv.y - 0.5));
    a *= 0.3 + 0.7 * g1 * g2 * g3 * g4;
    float alpha = a * uOpacity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/* build blueprint floor grid + 3D wireframe pavilion elevation once */
function buildPavilionLines() {
  /* 1. Blueprint datum grid on y = FLOOR_Y - 0.04 */
  const gridSegs: number[] = [];
  const gy = FLOOR_Y - 0.042;
  const gxMin = -2.8;
  const gxMax = 3.1;
  const gzMin = -2.1;
  const gzMax = 2.1;
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    const x = gxMin + (gxMax - gxMin) * u;
    gridSegs.push(x, gy, gzMin, x, gy, gzMax);
  }
  for (let j = 0; j <= 8; j++) {
    const v = j / 8;
    const z = gzMin + (gzMax - gzMin) * v;
    gridSegs.push(gxMin, gy, z, gxMax, gy, z);
  }
  /* datum extension ticks */
  gridSegs.push(-3.35, gy, 0, 3.55, gy, 0);
  gridSegs.push(0, gy, -2.55, 0, gy, 2.55);

  const gridArr = new Float32Array(gridSegs);
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.BufferAttribute(gridArr, 3));

  /* 2. Architectural wireframe elevation (columns → mullions → cantilevered roof) */
  const wf: number[] = [];
  const seg = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
  ) => {
    wf.push(ax, ay, az, bx, by, bz);
  };
  const boxWire = (
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
  ) => {
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const y0 = cy - h / 2;
    const y1 = cy + h / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    /* bottom */
    seg(x0, y0, z0, x1, y0, z0);
    seg(x1, y0, z0, x1, y0, z1);
    seg(x1, y0, z1, x0, y0, z1);
    seg(x0, y0, z1, x0, y0, z0);
    /* verticals */
    seg(x0, y0, z0, x0, y1, z0);
    seg(x1, y0, z0, x1, y1, z0);
    seg(x1, y0, z1, x1, y1, z1);
    seg(x0, y0, z1, x0, y1, z1);
    /* top */
    seg(x0, y1, z0, x1, y1, z0);
    seg(x1, y1, z0, x1, y1, z1);
    seg(x1, y1, z1, x0, y1, z1);
    seg(x0, y1, z1, x0, y1, z0);
  };

  /* plinth outline */
  boxWire(0.1, FLOOR_Y - 0.035, 0, 4.6, 0.07, 3.2);
  /* 4 structural column centerlines */
  const cols: [number, number][] = [
    [-1.85, -1.18],
    [0.55, -1.18],
    [-1.85, 1.18],
    [0.55, 1.18],
  ];
  for (const [cx, cz] of cols) {
    seg(cx, FLOOR_Y, cz, cx, ROOF_Y, cz);
  }
  /* rear curtain-wall mullions */
  for (let m = 0; m <= 6; m++) {
    const mx = -2.0 + m * 0.62;
    seg(mx, FLOOR_Y, -1.42, mx, ROOF_Y, -1.42);
  }
  seg(-2.0, FLOOR_Y + 1.15, -1.42, 1.72, FLOOR_Y + 1.15, -1.42);
  /* side wing partition mullions */
  for (let m = 0; m <= 3; m++) {
    const mz = -1.42 + m * 0.68;
    seg(-2.0, FLOOR_Y, mz, -2.0, ROOF_Y, mz);
  }
  /* cantilevered roof slab wireframe (extends out to x = +2.65!) */
  boxWire(0.32, ROOF_Y + ROOF_H / 2, 0, 4.75, ROOF_H, 2.95);
  /* roof structural joists showing the dramatic cantilever */
  for (let j = -1; j <= 1; j++) {
    seg(-2.05, ROOF_Y, j * 1.05, 2.69, ROOF_Y, j * 1.05);
  }

  const wfArr = new Float32Array(wf);
  const wfGeo = new THREE.BufferGeometry();
  wfGeo.setAttribute('position', new THREE.BufferAttribute(wfArr, 3));

  return {
    gridGeo,
    gridVerts: gridArr.length / 3,
    wfGeo,
    wfVerts: wfArr.length / 3,
    cols,
  };
}

const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();

export default function ArchitectureInteriorDesignScene() {
  const q = useQuality();
  const lens = useLensShift();
  const moment = useRef(newMoment());
  const startAt = useRef<number | null>(null);

  const groupRef = useRef<THREE.Group>(null);
  const rigRef = useRef<THREE.Group>(null);
  const gridMatRef = useRef<THREE.LineBasicMaterial>(null);
  const wfGroupRef = useRef<THREE.Group>(null);
  const wfMatRef = useRef<THREE.LineBasicMaterial>(null);
  const floorRef = useRef<THREE.Mesh>(null);
  const rearWallRef = useRef<THREE.Mesh>(null);
  const wingWallRef = useRef<THREE.Mesh>(null);
  const roofRef = useRef<THREE.Mesh>(null);
  const colRefs = useRef<(THREE.Mesh | null)[]>([]);
  const plinthRef = useRef<THREE.Mesh>(null);
  const sculptRef = useRef<THREE.Mesh>(null);
  const patchRef = useRef<THREE.Mesh>(null);
  const tilt = useRef({ x: 0, y: 0 });

  const report = useHotspotReporter('ind-aid-sculpture');

  const lines = useMemo(buildPavilionLines, []);
  const patch = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(2.85, 1.75);
    const material = new THREE.ShaderMaterial({
      vertexShader: patchVertex,
      fragmentShader: patchFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color('#7d97ff') },
        uOpacity: { value: 0 },
      },
    });
    return { geometry, material };
  }, []);

  useEffect(
    () => () => {
      lines.gridGeo.dispose();
      lines.wfGeo.dispose();
      patch.geometry.dispose();
      patch.material.dispose();
    },
    [lines, patch],
  );

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    if (startAt.current === null) startAt.current = now;
    const el = now - startAt.current;
    const anim = q.animate;
    const dt = Math.min(delta, 0.05);

    const mo = readMoment(moment.current, anim);
    const t = mo.t;
    const settled = anim ? Math.max(t, mo.leave > 0 ? 1 : 0) : 1;

    /* post-dwell section reads */
    const truth = smooth(sectionRange(getSectionProgress('market-truth'), 0.05, 0.9));
    const feat = smooth(sectionRange(getSectionProgress('feature'), 0.05, 0.92));
    const det = smooth(sectionRange(getSectionProgress('detail'), 0.08, 0.88));
    const cta = smooth(sectionRange(getSectionProgress('cta'), 0.05, 0.85));

    const intro = anim ? introAt(el, 0, 1.6) : 1;
    if (groupRef.current) {
      groupRef.current.position.y = -0.8 * (1 - intro);
    }

    /* Phase 1 (0.00 → 0.28): Blueprint coordinate grid draws across space */
    const gridDraw = anim ? Math.max(0.35, beat(settled, 0.0, 0.26)) : 1;
    lines.gridGeo.setDrawRange(
      0,
      Math.floor((gridDraw * lines.gridVerts) / 2) * 2,
    );
    if (gridMatRef.current) {
      gridMatRef.current.opacity = intro * (0.2 + 0.16 * gridDraw);
    }

    /* Phase 2 (0.14 → 0.56): Blue architectural wireframe extrudes upward */
    const wfDraw = anim ? Math.max(0.22, beat(settled, 0.1, 0.54)) : 1;
    lines.wfGeo.setDrawRange(0, Math.floor((wfDraw * lines.wfVerts) / 2) * 2);
    if (wfGroupRef.current) {
      const extrude = anim ? 0.18 + 0.82 * beat(settled, 0.12, 0.52) : 1;
      wfGroupRef.current.position.y = FLOOR_Y * (1 - extrude);
      wfGroupRef.current.scale.set(1, Math.max(extrude * intro, 0.001), 1);
    }
    if (wfMatRef.current) {
      /* crisp blueprint blue during extrusion, softens delicately once glass wraps it */
      const glassSettled = beat(settled, 0.55, 0.85);
      wfMatRef.current.opacity = intro * (0.58 - 0.22 * glassSettled);
    }

    /* Phase 3 (0.40 → 0.82): Refractive glass volumes materialize onto frame */
    const floorIn = anim ? Math.max(0.25, beat(settled, 0.08, 0.38)) : 1;
    if (floorRef.current) {
      floorRef.current.scale.set(
        Math.max(floorIn * intro, 0.001),
        1,
        Math.max(floorIn * intro, 0.001),
      );
    }

    const colIn = anim ? beat(settled, 0.34, 0.62) : 1;
    const colH = ROOF_Y - FLOOR_Y;
    for (let i = 0; i < lines.cols.length; i++) {
      const cm = colRefs.current[i];
      if (!cm) continue;
      const sy = Math.max(colIn * intro, 0.0001);
      cm.scale.set(sy > 0.02 ? 1 : 0.001, sy, sy > 0.02 ? 1 : 0.001);
      cm.position.y = FLOOR_Y + (colH * sy) / 2;
    }

    const wallIn = anim ? beat(settled, 0.42, 0.72) : 1;
    if (rearWallRef.current) {
      const sy = Math.max(wallIn * intro, 0.0001);
      rearWallRef.current.scale.set(Math.max(wallIn * intro, 0.0001), sy, 1);
      rearWallRef.current.position.y = FLOOR_Y + (colH * sy) / 2;
    }
    if (wingWallRef.current) {
      const sy = Math.max(wallIn * intro, 0.0001);
      wingWallRef.current.scale.set(1, sy, Math.max(wallIn * intro, 0.0001));
      wingWallRef.current.position.y = FLOOR_Y + (colH * sy) / 2;
    }

    /* cantilevered roof slab glides horizontally & settles onto columns */
    const roofIn = anim ? beat(settled, 0.5, 0.8) : 1;
    if (roofRef.current) {
      const sy = Math.max(roofIn * intro, 0.0001);
      roofRef.current.scale.set(sy, sy > 0.02 ? 1 : 0.001, sy);
      roofRef.current.position.set(
        0.32 - (1 - roofIn) * 0.65,
        ROOF_Y + ROOF_H / 2 + (1 - roofIn) * 0.35,
        0,
      );
    }

    /* interior plinth + singular deep-sapphire sculptural totem */
    const interiorIn = anim ? beat(settled, 0.56, 0.84) : 1;
    if (plinthRef.current) {
      const sy = Math.max(interiorIn * intro, 0.0001);
      plinthRef.current.scale.setScalar(sy);
      plinthRef.current.position.y = FLOOR_Y + 0.26 * sy;
    }
    const s = sculptRef.current;
    if (s) {
      const sy = Math.max(interiorIn * intro, 0.0001);
      s.scale.setScalar(sy);
      s.position.y = FLOOR_Y + 0.52 + 0.38 * sy;
      if (anim) s.rotation.y = el * 0.18 + settled * 0.6;
      else s.rotation.set(0.15, 0.65, 0);
      report(
        s,
        state.camera,
        0.5 + 0.38 * interiorIn + 0.12 * Math.max(truth, det),
      );
    }

    /* Phase 4 (0.66 → 1.00): Clerestory daylight sweeps across pavilion floor */
    const lightIn = anim ? beat(settled, 0.66, 0.98) : 1;
    if (patchRef.current) {
      const sweep = lightIn * 0.55 + feat * 0.45;
      patchRef.current.position.set(
        -0.95 + sweep * 2.15,
        FLOOR_Y + 0.008,
        -0.25 + sweep * 0.45,
      );
      patch.material.uniforms.uOpacity.value = 0.44 * lightIn * intro;
    }

    /* subtle architectural pointer tilt */
    if (rigRef.current) {
      tilt.current.x = damp(tilt.current.x, anim ? -pointer.y * 0.045 : 0, 3.2, dt);
      tilt.current.y = damp(
        tilt.current.y,
        -0.36 +
          settled * 0.48 +
          feat * 0.28 -
          det * 0.16 +
          (anim ? pointer.x * 0.09 : 0),
        3.2,
        dt,
      );
      rigRef.current.rotation.x = tilt.current.x;
      rigRef.current.rotation.y = tilt.current.y;
    }

    /* camera choreography: architectural eye-level rising to frame cantilever */
    const inMoment = anim ? mo.enter * (1 - mo.leave) : 0;
    const radius =
      (q.compact ? 12.2 : 9.4) -
      intro * 0.55 -
      inMoment * 0.75 -
      det * 0.45 +
      cta * 0.85;
    const az = anim ? Math.sin(el * 0.038) * 0.04 : 0.02;

    _cam.set(
      0.25 + Math.sin(az) * radius + (anim ? pointer.x * 0.28 : 0),
      1.95 - inMoment * 0.32 + cta * 0.4 + (anim ? pointer.y * 0.18 : 0),
      Math.cos(az) * radius,
    );
    if (anim) state.camera.position.lerp(_cam, 0.05);
    else state.camera.position.copy(_cam);

    _look.set(0.2, 0.28, -0.1);
    state.camera.lookAt(_look);

    /* lens shift: stage-right alongside copy, centred on the pinned moment */
    if (q.compact) lens(0, -0.08 + inMoment * 0.08);
    else lens(0.22 * (1 - inMoment), -0.03 * (1 - inMoment));
  });

  return (
    <group ref={groupRef}>
      <SceneLightRig />

      <group ref={rigRef}>
        {/* blueprint coordinate grid & datum ticks */}
        <lineSegments geometry={lines.gridGeo} frustumCulled={false}>
          <lineBasicMaterial
            ref={gridMatRef}
            color="#7d97ff"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </lineSegments>

        {/* blue wireframe architectural elevation */}
        <group ref={wfGroupRef}>
          <lineSegments geometry={lines.wfGeo} frustumCulled={false}>
            <lineBasicMaterial
              ref={wfMatRef}
              color="#2e4bff"
              transparent
              opacity={0}
              depthWrite={false}
            />
          </lineSegments>
        </group>

        {/* terrazzo-blue structural glass floor plinth */}
        <RoundedBox
          ref={floorRef}
          args={[4.6, 0.07, 3.2]}
          radius={0.028}
          smoothness={3}
          position={[0.1, FLOOR_Y - 0.035, 0]}
        >
          <GlassMaterial kind="pane" />
        </RoundedBox>

        {/* 4 slender structural crystal columns */}
        {lines.cols.map(([cx, cz], i) => (
          <mesh
            key={i}
            ref={(m) => {
              colRefs.current[i] = m;
            }}
            position={[cx, (FLOOR_Y + ROOF_Y) / 2, cz]}
          >
            <cylinderGeometry args={[0.042, 0.042, ROOF_Y - FLOOR_Y, 20]} />
            <GlassMaterial kind="crystal" />
          </mesh>
        ))}

        {/* rear shear glass curtain wall */}
        <RoundedBox
          ref={rearWallRef}
          args={[3.72, ROOF_Y - FLOOR_Y, 0.065]}
          radius={0.025}
          smoothness={3}
          position={[-0.14, (FLOOR_Y + ROOF_Y) / 2, -1.42]}
        >
          <GlassMaterial kind="ice" />
        </RoundedBox>

        {/* perpendicular azure gallery wing wall */}
        <RoundedBox
          ref={wingWallRef}
          args={[0.065, ROOF_Y - FLOOR_Y, 2.04]}
          radius={0.025}
          smoothness={3}
          position={[-2.0, (FLOOR_Y + ROOF_Y) / 2, -0.4]}
        >
          <GlassMaterial kind="azure" />
        </RoundedBox>

        {/* dramatic cantilevered crystal roof slab */}
        <RoundedBox
          ref={roofRef}
          args={[4.75, ROOF_H, 2.95]}
          radius={0.03}
          smoothness={4}
          position={[0.32, ROOF_Y + ROOF_H / 2, 0]}
        >
          <GlassMaterial kind="crystal" />
        </RoundedBox>

        {/* interior gallery plinth + singular deep-sapphire sculpture */}
        <RoundedBox
          ref={plinthRef}
          args={[0.78, 0.52, 0.78]}
          radius={0.035}
          smoothness={3}
          position={[1.15, FLOOR_Y + 0.26, 0.15]}
        >
          <GlassMaterial kind="pane" />
        </RoundedBox>

        <mesh ref={sculptRef} position={[1.15, FLOOR_Y + 0.9, 0.15]}>
          <torusKnotGeometry args={[0.29, 0.098, 150, 24, 2, 3]} />
          <GlassMaterial
            kind="deep"
            emissive="#1226c8"
            emissiveIntensity={0.28}
          />
        </mesh>

        {/* clerestory sun-and-mullion patch sweeping the floor */}
        <mesh
          ref={patchRef}
          geometry={patch.geometry}
          material={patch.material}
          rotation={[-Math.PI / 2, 0, 0.36]}
          position={[-0.95, FLOOR_Y + 0.008, -0.25]}
          renderOrder={2}
        />
      </group>

      <ParticleField
        count={Math.floor(1250 * q.particles)}
        drift={q.animate ? 0.08 : 0}
        opacity={0.28}
      />
    </group>
  );
}
