'use client';

import React, { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GlassMaterial } from '../../../../lib/materials';

export interface FestivalStageHandle {
  update: (time: number, beat: number, beatPulse: number, focus: number, anim: boolean) => void;
}

const EQ_BARS = 24;
const BEAM_COUNT = 7;

const beamVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const beamFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    // vUv.y = 1.0 at apex (lamp), 0.0 at far open base of cone
    // Avoid pow(0.0, x) which is undefined (NaN) on Metal/WebGL2 and corrupts Bloom mipmaps
    float vy = clamp(vUv.y, 0.001, 1.0);
    float axial = vy * sqrt(vy);
    float tipFade = smoothstep(1.0, 0.90, vy) * smoothstep(0.0, 0.08, vy);
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    float ndv = clamp(abs(dot(N, V)), 0.001, 1.0);
    float softWash = ndv * sqrt(ndv);
    float ndv2 = ndv * ndv;
    float coreRay = ndv2 * ndv2 * 0.85;
    vec3 col = mix(uColorB, uColorA, vy);
    float alpha = clamp(axial * tipFade * (softWash * 0.65 + coreRay) * uIntensity, 0.0, 0.62);
    gl_FragColor = vec4(col, alpha);
  }
`;

const _m = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _euler = new THREE.Euler();
const _c = new THREE.Color();
const _ice = new THREE.Color('#9db2ff');
const _elec = new THREE.Color('#2e4bff').multiplyScalar(2.4);
const _peak = new THREE.Color('#ffffff').multiplyScalar(3.0);

/**
 * FestivalStage — Miniature of the Empire Polo Club main stage: tiered
 * porcelain & sapphire-glass deck, triple parabolic arch pavilion with
 * space-frame truss lattice, line-array speaker towers, 24-bar curved LED
 * equalizer wall, and 7 volumetric sweeping stage light beams.
 */
const FestivalStage = React.forwardRef<
  FestivalStageHandle,
  { position?: [number, number, number]; rotationY?: number; children?: React.ReactNode }
>(function FestivalStage({ position = [0.88, -1.325, 0.28], rotationY = -0.22, children }, ref) {
  const eqRef = useRef<THREE.InstancedMesh>(null);
  const beamRefs = useRef<(THREE.Mesh | null)[]>([]);

  /* Parabolic stage arches + space-frame truss lattice + canopy shell */
  const { archesGeo, canopyGeo, trussLines, speakersGeo } = useMemo(() => {
    const archSpecs = [
      { span: 1.14, height: 1.72, z: 0.28, r: 0.028 },
      { span: 1.00, height: 1.52, z: -0.10, r: 0.024 },
      { span: 0.86, height: 1.32, z: -0.46, r: 0.020 },
    ];

    const archPts: THREE.Vector3[][] = [];
    const mergedArchPos: number[] = [];
    const mergedArchNorm: number[] = [];
    const v = new THREE.Vector3();

    for (const spec of archSpecs) {
      const curvePts: THREE.Vector3[] = [];
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const u = -1 + (2 * i) / steps; // -1 .. +1
        const x = u * spec.span;
        const y = 0.14 + spec.height * (1 - u * u * 0.88);
        const z = spec.z - (1 - u * u) * 0.06;
        curvePts.push(new THREE.Vector3(x, y, z));
      }
      archPts.push(curvePts);
      const curve = new THREE.CatmullRomCurve3(curvePts);
      const tube = new THREE.TubeGeometry(curve, 36, spec.r, 10, false);
      const pAttr = tube.attributes.position;
      const nAttr = tube.attributes.normal;
      const idx = tube.index!;
      for (let i = 0; i < idx.count; i++) {
        const vi = idx.getX(i);
        v.fromBufferAttribute(pAttr, vi);
        mergedArchPos.push(v.x, v.y, v.z);
        v.fromBufferAttribute(nAttr, vi);
        mergedArchNorm.push(v.x, v.y, v.z);
      }
      tube.dispose();
    }

    const aGeo = new THREE.BufferGeometry();
    aGeo.setAttribute('position', new THREE.Float32BufferAttribute(mergedArchPos, 3));
    aGeo.setAttribute('normal', new THREE.Float32BufferAttribute(mergedArchNorm, 3));

    // Frosted glass acoustic canopy skin between arches 0->1 and 1->2
    const cPos: number[] = [];
    const lines: number[] = [];
    for (let a = 0; a < 2; a++) {
      const ringA = archPts[a];
      const ringB = archPts[a + 1];
      for (let i = 0; i < ringA.length - 1; i++) {
        const p00 = ringA[i];
        const p01 = ringA[i + 1];
        const p10 = ringB[i];
        const p11 = ringB[i + 1];
        // Canopy triangles (skip the lowest 3 segments near ground so sides stay open)
        if (i >= 3 && i < ringA.length - 4) {
          cPos.push(
            p00.x, p00.y, p00.z, p10.x, p10.y, p10.z, p01.x, p01.y, p01.z,
            p01.x, p01.y, p01.z, p10.x, p10.y, p10.z, p11.x, p11.y, p11.z,
          );
        }
        // Space-frame truss longitudinal + diagonal bracing lines
        lines.push(p00.x, p00.y, p00.z, p10.x, p10.y, p10.z);
        lines.push(p00.x, p00.y, p00.z, p11.x, p11.y, p11.z);
        lines.push(p01.x, p01.y, p01.z, p10.x, p10.y, p10.z);
      }
    }
    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.Float32BufferAttribute(cPos, 3));
    cGeo.computeVertexNormals();

    const tLines = new THREE.BufferGeometry();
    tLines.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));

    // Line-array speaker stacks hung on left and right of front arch
    const sPos: number[] = [];
    const sNorm: number[] = [];
    for (const side of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const box = new THREE.BoxGeometry(0.16, 0.068, 0.11);
        box.rotateX(k * 0.06);
        box.rotateY(side * -0.18);
        box.translate(side * 0.78, 1.02 - k * 0.082, 0.24);
        const pAttr = box.attributes.position;
        const nAttr = box.attributes.normal;
        const idx = box.index!;
        for (let i = 0; i < idx.count; i++) {
          const vi = idx.getX(i);
          v.fromBufferAttribute(pAttr, vi);
          sPos.push(v.x, v.y, v.z);
          v.fromBufferAttribute(nAttr, vi);
          sNorm.push(v.x, v.y, v.z);
        }
        box.dispose();
      }
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
    sGeo.setAttribute('normal', new THREE.Float32BufferAttribute(sNorm, 3));

    return { archesGeo: aGeo, canopyGeo: cGeo, trussLines: tLines, speakersGeo: sGeo };
  }, []);

  /* Volumetric stage light beam geometry (apex at [0,0,0], opening upward along +Y) */
  const beamGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.42, 3.1, 28, 1, true);
    // Flip cone so apex (vUv.y = 1) sits at (0,0,0) and cone opens upward along +Y
    g.rotateX(Math.PI);
    g.translate(0, 1.55, 0);
    return g;
  }, []);

  const beamMats = useMemo(() => {
    return Array.from({ length: BEAM_COUNT }, (_, i) => {
      const isCenter = i === 3;
      return new THREE.ShaderMaterial({
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
        uniforms: {
          uColorA: { value: new THREE.Color(isCenter ? '#1226c8' : '#2e4bff') },
          uColorB: { value: new THREE.Color('#7a96ff') },
          uIntensity: { value: 0.36 },
        },
      });
    });
  }, []);

  const trussMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#2e4bff', transparent: true, opacity: 0.62 }),
    [],
  );
  const eqMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);

  /* Anchor positions along the upper front arch for the 7 stage light beams */
  const beamAnchors = useMemo(() => {
    return Array.from({ length: BEAM_COUNT }, (_, i) => {
      const u = ((i / (BEAM_COUNT - 1)) - 0.5) * 1.36; // -0.68 .. +0.68
      const x = u * 1.14;
      const y = 0.14 + 1.72 * (1 - u * u * 0.88);
      const z = 0.28 - (1 - u * u) * 0.06;
      return { x, y, z, u };
    });
  }, []);

  useEffect(
    () => () => {
      archesGeo.dispose();
      canopyGeo.dispose();
      trussLines.dispose();
      speakersGeo.dispose();
      beamGeo.dispose();
      beamMats.forEach((m) => m.dispose());
      trussMat.dispose();
      eqMat.dispose();
    },
    [archesGeo, canopyGeo, trussLines, speakersGeo, beamGeo, beamMats, trussMat, eqMat],
  );

  useImperativeHandle(
    ref,
    () => ({
      update(time: number, beat: number, beatPulse: number, focus: number, anim: boolean) {
        // Animate the 24 curved LED equalizer bars behind Cato on stage
        const eq = eqRef.current;
        if (eq) {
          for (let i = 0; i < EQ_BARS; i++) {
            const u = (i / (EQ_BARS - 1)) * 2 - 1; // -1 .. +1
            const x = u * 0.68;
            const z = -0.34 - (1 - u * u) * 0.12;
            const wave = anim
              ? 0.35 +
                0.45 * Math.abs(Math.sin(beat * Math.PI * 1.5 + i * 0.55)) +
                0.2 * Math.sin(time * 4.2 + i * 1.1)
              : 0.45 + 0.35 * Math.cos(u * Math.PI);
            const h = Math.max(0.08, Math.min(0.78, wave * (0.65 + 0.35 * beatPulse)));
            _pos.set(x, 0.18 + h * 0.5, z);
            _euler.set(0, -u * 0.28, 0);
            _quat.setFromEuler(_euler);
            _scl.set(1, h, 1);
            _m.compose(_pos, _quat, _scl);
            eq.setMatrixAt(i, _m);

            _c.copy(_ice)
              .lerp(_elec, Math.min(1, h * 1.35))
              .lerp(_peak, Math.max(0, (h - 0.52) * 1.8));
            eq.setColorAt(i, _c);
          }
          eq.instanceMatrix.needsUpdate = true;
          if (eq.instanceColor) eq.instanceColor.needsUpdate = true;
        }

        // Sweep & pulse the 7 volumetric stage light beams
        for (let i = 0; i < BEAM_COUNT; i++) {
          const bm = beamRefs.current[i];
          if (!bm) continue;
          const { u } = beamAnchors[i];
          const sweep = anim ? Math.sin(time * 1.15 + i * 0.85) * (0.16 + 0.12 * focus) : 0;
          const tiltForward = 0.34 + Math.cos(time * 0.9 + i * 1.2) * (anim ? 0.10 : 0) + focus * 0.08;
          // Cone opens upward along +Y; positive X tilts forward over the stage & lawn, -Z fans outward
          bm.rotation.set(tiltForward, 0, -u * 0.52 + sweep);
          const pulse = anim
            ? 0.28 + 0.12 * focus + 0.16 * beatPulse * (0.65 + 0.35 * Math.sin(beat * Math.PI + i))
            : 0.32;
          beamMats[i].uniforms.uIntensity.value = pulse;
        }
      },
    }),
    [beamAnchors, beamMats],
  );

  return (
    <group position={position} rotation-y={rotationY}>
      {/* Lower deep-sapphire glass stage base */}
      <mesh position={[0, 0.065, -0.04]}>
        <cylinderGeometry args={[1.12, 1.18, 0.13, 48]} />
        <GlassMaterial kind="deep" />
      </mesh>

      {/* Upper matte porcelain main stage deck */}
      <mesh position={[0, 0.145, -0.04]}>
        <cylinderGeometry args={[1.04, 1.08, 0.045, 48]} />
        <meshStandardMaterial color="#eef3ff" roughness={0.24} metalness={0.05} />
      </mesh>

      {/* Forestage DJ thrust platform + glowing LED riser edge */}
      <mesh position={[0, 0.155, 0.26]}>
        <boxGeometry args={[0.98, 0.05, 0.56]} />
        <meshStandardMaterial color="#f5f8ff" roughness={0.22} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.155, 0.542]}>
        <boxGeometry args={[0.98, 0.018, 0.012]} />
        <meshBasicMaterial color="#2e4bff" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.07, 0.62]}>
        <boxGeometry args={[0.76, 0.04, 0.18]} />
        <GlassMaterial kind="azure" />
      </mesh>

      {/* Sweeping parabolic stage arches & acoustic glass canopy */}
      <mesh geometry={archesGeo}>
        <GlassMaterial kind="azure" />
      </mesh>
      <mesh geometry={canopyGeo}>
        <GlassMaterial kind="ice" side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={trussLines} material={trussMat} />

      {/* Hanging Line-Array Speaker Stacks */}
      <mesh geometry={speakersGeo}>
        <meshStandardMaterial color="#1226c8" roughness={0.25} metalness={0.2} />
      </mesh>

      {/* 24-Bar Curved LED Equalizer Backdrop Wall */}
      <instancedMesh ref={eqRef} args={[undefined, undefined, EQ_BARS]} material={eqMat}>
        <boxGeometry args={[0.032, 1, 0.022]} />
      </instancedMesh>

      {/* 7 Volumetric Sweeping Stage Light Beams */}
      {beamAnchors.map((a, i) => (
        <mesh
          key={i}
          ref={(el) => {
            beamRefs.current[i] = el;
          }}
          position={[a.x, a.y, a.z]}
          geometry={beamGeo}
          material={beamMats[i]}
        />
      ))}

      {/* Cato on the Forestage Deck (local origin inside stage) */}
      <group position={[0, 0.17, 0.16]}>{children}</group>
    </group>
  );
});

export default FestivalStage;
