'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import SceneLightRig from '../shared/SceneLightRig';
import ParticleField from '../shared/ParticleField';
import { useQuality } from '../../lib/quality';
import { getSectionProgress, sectionRange, smooth, pointer } from '../../scroll-store';
import { H, KEEL_HALF, buildFoldModel, poseVertex } from './fold';

/**
 * ContactScene — "The Paper Plane".
 *
 * A single sheet of glass lies flat, catching the studio light. As the
 * visitor scrolls past the hero it folds itself, crease by crease, into a
 * dart (corners in, edges in, keel, wings) through a real rigid-facet fold
 * model, so every intermediate state is physically valid and scrolling up
 * unfolds it exactly. Folded, it turns nose-forward and glides off on a
 * long, banking arc down toward the brief form, leaving a faint contrail.
 * When the form is in view the plane rests: a small glass dart hovering at
 * the margin, as if it's waiting to carry the message.
 */

const model = buildFoldModel();
const SHEET_SCALE = 1.05;
const STEPS = new Float32Array(4);
const TRAIL = 72;

/* module temps */
const _v = new Float32Array(3);
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _e = new THREE.Euler();
const _look = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3();
const _side = new THREE.Vector3();
const _tan2 = new THREE.Vector3();
const _rest = new THREE.Vector3();

/* the folded dart's own frame (see fold.ts): nose +y, wings open toward
   the keel-V bisector b = (cos h, 0, sin h). LOCAL_INV maps it to identity. */
const LOCAL_INV = (() => {
  const h = KEEL_HALF;
  const F = new THREE.Vector3(0, 1, 0);
  const U = new THREE.Vector3(Math.cos(h), 0, Math.sin(h));
  const S = new THREE.Vector3().crossVectors(F, U);
  return new THREE.Matrix4().makeBasis(F, U, S).transpose();
})();

/** the glide path — a cubic Bézier in world space. The sheet folds at P0
    beside the hero title, launches up and out, swings wide and settles
    beside the brief form. */
const PATH = {
  wide: [
    new THREE.Vector3(2.3, 0.2, 0),
    new THREE.Vector3(0.3, 1.7, 1.1),
    new THREE.Vector3(3.8, -0.6, 1.9),
    new THREE.Vector3(1.7, 1.1, 1.7),
  ],
  compact: [
    new THREE.Vector3(0, 0.95, 0),
    new THREE.Vector3(-1.1, 2.0, 1.0),
    new THREE.Vector3(1.3, 0.5, 1.5),
    new THREE.Vector3(0.42, 1.5, 1.9),
  ],
};
/** nose direction at rest: level, turned toward the form */
const REST_DIR = { wide: new THREE.Vector3(-1, 0.14, 0.32), compact: new THREE.Vector3(-1, 0.1, 0.4) };

function bezier(P: THREE.Vector3[], t: number, out: THREE.Vector3) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  out.set(
    P[0].x * a + P[1].x * b + P[2].x * c + P[3].x * d,
    P[0].y * a + P[1].y * b + P[2].y * c + P[3].y * d,
    P[0].z * a + P[1].z * b + P[2].z * c + P[3].z * d,
  );
}
function bezierTangent(P: THREE.Vector3[], t: number, out: THREE.Vector3) {
  const u = 1 - t;
  const a = 3 * u * u;
  const b = 6 * u * t;
  const c = 3 * t * t;
  out.set(
    (P[1].x - P[0].x) * a + (P[2].x - P[1].x) * b + (P[3].x - P[2].x) * c,
    (P[1].y - P[0].y) * a + (P[2].y - P[1].y) * b + (P[3].y - P[2].y) * c,
    (P[1].z - P[0].z) * a + (P[2].z - P[1].z) * b + (P[3].z - P[2].z) * c,
  );
  if (out.lengthSq() < 1e-8) out.set(1, 0, 0);
  out.normalize();
}

/* ------------------------------------------------------------------ */
/*  Glass sheet shader: a thin pane of ice-blue glass. Fresnel-tinted, */
/*  two-sided, with a soft specular sweep that follows the pointer.    */
/* ------------------------------------------------------------------ */
const sheetVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying vec2 vUv;
  varying vec3 vW;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const sheetFrag = /* glsl */ `
  uniform vec3 uLight;
  uniform float uOpacity;
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vV;
  varying vec2 vUv;
  varying vec3 vW;
  void main() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    float ndv = abs(dot(n, vV));
    float fres = pow(1.0 - ndv, 2.2);
    vec3 ice = vec3(0.90, 0.93, 1.0);
    vec3 azure = vec3(0.58, 0.66, 1.0);
    vec3 electric = vec3(0.18, 0.29, 1.0);
    vec3 col = mix(ice, azure, smoothstep(0.0, 0.7, fres));
    col = mix(col, electric, smoothstep(0.55, 1.0, fres) * 0.8);
    /* back faces read a touch deeper, like the inside of a fold */
    if (!gl_FrontFacing) col = mix(col, azure, 0.35);
    /* specular sweep */
    vec3 l = normalize(uLight - vW);
    vec3 h = normalize(l + vV);
    float spec = pow(max(dot(n, h), 0.0), 60.0);
    float broad = pow(max(dot(n, h), 0.0), 8.0) * 0.18;
    col += vec3(1.0) * (spec * 0.9 + broad);
    /* faint paper grain caught in the glass */
    float g = fract(sin(dot(floor(vUv * 380.0), vec2(12.9898, 78.233))) * 43758.5453);
    col -= g * 0.012;
    float a = uOpacity * (0.62 + fres * 0.38 + spec * 0.3);
    gl_FragColor = vec4(col, a);
  }
`;

export default function ContactScene() {
  const q = useQuality();
  const planeRef = useRef<THREE.Group>(null);
  const bankRef = useRef<THREE.Group>(null);
  const startRef = useRef<number | null>(null);

  /* -------- geometry: one triangle soup for the facets, one for creases -------- */
  const { sheetGeo, edgeGeo, sheetMat, edgeMat, trailGeo, trailMat, base } = useMemo(() => {
    const triCount = model.triVerts;
    const pos = new Float32Array(triCount * 3);
    const uv = new Float32Array(triCount * 2);
    /* base = (sheet x, sheet y, layer offset, facet index) per tri vertex */
    const baseArr: number[] = [];
    let o = 0;
    model.facets.forEach((f, fi) => {
      const n = f.poly.length / 2;
      for (let k = 1; k < n - 1; k++) {
        for (const idx of [0, k, k + 1]) {
          const x = f.poly[idx * 2];
          const y = f.poly[idx * 2 + 1];
          baseArr.push(x, y, f.layer * 0.004, fi);
          uv[o * 2] = (x + 1) / 2;
          uv[o * 2 + 1] = (y + H) / (2 * H);
          o++;
        }
      }
    });
    const sheetGeo = new THREE.BufferGeometry();
    sheetGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sheetGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    sheetGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(triCount * 3), 3));

    /* crease/edge lines: every facet boundary */
    const edgeBase: number[] = [];
    model.facets.forEach((f, fi) => {
      const n = f.poly.length / 2;
      for (let k = 0; k < n; k++) {
        const a = k;
        const b = (k + 1) % n;
        edgeBase.push(f.poly[a * 2], f.poly[a * 2 + 1], f.layer * 0.004 + 0.002, fi);
        edgeBase.push(f.poly[b * 2], f.poly[b * 2 + 1], f.layer * 0.004 + 0.002, fi);
      }
    });
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeBase.length / 4 * 3), 3));

    const sheetMat = new THREE.ShaderMaterial({
      vertexShader: sheetVert,
      fragmentShader: sheetFrag,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: {
        uLight: { value: new THREE.Vector3(2, 3, 5) },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
      },
    });
    const edgeMat = new THREE.LineBasicMaterial({
      color: '#2e4bff',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    trailGeo.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(TRAIL), 1));
    trailGeo.setDrawRange(0, 0);
    const trailMat = new THREE.LineDashedMaterial({
      color: '#2e4bff',
      transparent: true,
      opacity: 0,
      dashSize: 0.07,
      gapSize: 0.09,
      depthWrite: false,
    });

    return {
      sheetGeo,
      edgeGeo,
      sheetMat,
      edgeMat,
      trailGeo,
      trailMat,
      base: { tri: new Float32Array(baseArr), edge: new Float32Array(edgeBase) },
    };
  }, []);

  useEffect(
    () => () => {
      sheetGeo.dispose();
      edgeGeo.dispose();
      sheetMat.dispose();
      edgeMat.dispose();
      trailGeo.dispose();
      trailMat.dispose();
    },
    [sheetGeo, edgeGeo, sheetMat, edgeMat, trailGeo, trailMat]
  );

  const trailLine = useMemo(() => {
    const l = new THREE.Line(trailGeo, trailMat);
    l.frustumCulled = false;
    return l;
  }, [trailGeo, trailMat]);
  const edgeLines = useMemo(() => {
    const l = new THREE.LineSegments(edgeGeo, edgeMat);
    l.frustumCulled = false;
    return l;
  }, [edgeGeo, edgeMat]);

  useFrame((state) => {
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startRef.current;
    const intro = q.animate ? smooth(Math.min(elapsed / 1.6, 1)) : 1;
    const P = q.compact ? PATH.compact : PATH.wide;

    /* ---------------- scroll choreography ---------------- */
    /* fold over the hero's exit; glide as the form arrives */
    const hero = getSectionProgress('contact-hero');
    const form = getSectionProgress('contact-form');
    let fold: number;
    let glide: number;
    if (!q.animate) {
      /* reduced motion: the finished dart, poised beside the title */
      fold = 1;
      glide = 0;
    } else {
      fold = sectionRange(hero, 0.33, 0.64);
      glide = smooth(sectionRange(form, 0.04, 0.42));
    }
    /* four folds, overlapping slightly so the motion flows */
    for (let i = 0; i < 4; i++) {
      STEPS[i] = smooth(sectionRange(fold, i * 0.22, i * 0.22 + 0.34));
    }

    /* ---------------- pose the sheet ---------------- */
    const tri = base.tri;
    const pos = sheetGeo.attributes.position.array as Float32Array;
    const nor = sheetGeo.attributes.normal.array as Float32Array;
    for (let i = 0, n = tri.length / 4; i < n; i++) {
      const f = model.facets[tri[i * 4 + 3]];
      poseVertex(model, f.folds, STEPS, tri[i * 4], tri[i * 4 + 1], tri[i * 4 + 2], _v, 0);
      pos[i * 3] = _v[0];
      pos[i * 3 + 1] = _v[1];
      pos[i * 3 + 2] = _v[2];
    }
    /* flat normals per triangle */
    for (let i = 0; i < pos.length; i += 9) {
      const ax = pos[i + 3] - pos[i];
      const ay = pos[i + 4] - pos[i + 1];
      const az = pos[i + 5] - pos[i + 2];
      const bx = pos[i + 6] - pos[i];
      const by = pos[i + 7] - pos[i + 1];
      const bz = pos[i + 8] - pos[i + 2];
      let nx = ay * bz - az * by;
      let ny = az * bx - ax * bz;
      let nz = ax * by - ay * bx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
      for (let k = 0; k < 9; k += 3) {
        nor[i + k] = nx;
        nor[i + k + 1] = ny;
        nor[i + k + 2] = nz;
      }
    }
    sheetGeo.attributes.position.needsUpdate = true;
    sheetGeo.attributes.normal.needsUpdate = true;

    const eb = base.edge;
    const ep = edgeGeo.attributes.position.array as Float32Array;
    for (let i = 0, n = eb.length / 4; i < n; i++) {
      const f = model.facets[eb[i * 4 + 3]];
      poseVertex(model, f.folds, STEPS, eb[i * 4], eb[i * 4 + 1], eb[i * 4 + 2], ep, i * 3);
    }
    edgeGeo.attributes.position.needsUpdate = true;

    /* ---------------- orient + fly ---------------- */
    const plane = planeRef.current;
    const bank = bankRef.current;
    if (plane && bank) {
      /* flat sheet faces the camera with a slight tilt; folded, the plane
         turns nose-forward (sheet +y = nose) along the path tangent */
      const turn = smooth(sectionRange(fold, 0.6, 1));
      _e.set(-0.18 + pointer.y * 0.08, -0.32 + pointer.x * 0.12, -0.08);
      _qa.setFromEuler(_e);

      bezier(P, glide, _p);
      bezierTangent(P, Math.min(glide, 0.999), _tan);
      /* as it arrives, the nose levels out and turns toward the form */
      const settle = smooth(sectionRange(glide, 0.72, 1));
      _rest.copy(q.compact ? REST_DIR.compact : REST_DIR.wide).normalize();
      _tan.lerp(_rest, settle).normalize();

      /* world frame: nose → tangent, wings level with world up */
      _up.set(0, 1, 0).addScaledVector(_tan, -_tan.y);
      if (_up.lengthSq() < 1e-6) _up.set(0, 0, 1);
      _up.normalize();
      _side.crossVectors(_tan, _up);
      _m.makeBasis(_tan, _up, _side).multiply(LOCAL_INV);
      _qb.setFromRotationMatrix(_m);

      plane.quaternion.slerpQuaternions(_qa, _qb, turn);

      /* bank into the turn: roll from the path's horizontal curvature */
      bezierTangent(P, Math.min(glide + 0.03, 0.999), _tan2);
      const curve = _tan.x * _tan2.z - _tan.z * _tan2.x;
      const inFlight = glide > 0.002 && glide < 0.97 ? 1 : 0;
      const roll = q.animate ? Math.max(-0.7, Math.min(0.7, curve * 9)) * inFlight * (1 - settle) : 0;
      bank.rotation.y += (roll - bank.rotation.y) * 0.08;

      /* idle hover — a breath of air under the wings */
      const hover = q.animate ? Math.sin(elapsed * 0.9) * 0.05 : 0;
      plane.position.set(_p.x, _p.y + hover + (1 - intro) * -0.4, _p.z);

      /* scale: the sheet is generous; the plane at rest is small */
      const s = SHEET_SCALE * (1 - glide * 0.8) * (0.94 + 0.06 * intro);
      plane.scale.setScalar(q.compact ? s * 0.64 : s);

      /* contrail: sampled along the path behind the plane */
      const tp = trailGeo.attributes.position.array as Float32Array;
      const span = Math.min(glide, 0.55);
      for (let i = 0; i < TRAIL; i++) {
        const tt = Math.max(glide - span * (i / (TRAIL - 1)), 0);
        bezier(P, tt, _look);
        tp[i * 3] = _look.x;
        tp[i * 3 + 1] = _look.y - 0.04;
        tp[i * 3 + 2] = _look.z - 0.05;
      }
      /* dash distances, measured from the plane backward (in place) */
      const ld = trailGeo.attributes.lineDistance.array as Float32Array;
      ld[0] = 0;
      for (let i = 1; i < TRAIL; i++) {
        const dx = tp[i * 3] - tp[i * 3 - 3];
        const dy = tp[i * 3 + 1] - tp[i * 3 - 2];
        const dz = tp[i * 3 + 2] - tp[i * 3 - 1];
        ld[i] = ld[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.attributes.lineDistance.needsUpdate = true;
      trailGeo.setDrawRange(0, glide > 0.01 ? TRAIL : 0);
      const trailTarget = q.animate ? Math.sin(Math.min(glide, 1) * Math.PI) * 0.4 + glide * 0.06 : 0.12;
      trailMat.opacity += (trailTarget - trailMat.opacity) * 0.1;
    }

    /* materials */
    sheetMat.uniforms.uOpacity.value = 0.86 * intro;
    sheetMat.uniforms.uTime.value = elapsed;
    const L = sheetMat.uniforms.uLight.value as THREE.Vector3;
    L.x += (pointer.x * 4 + 1 - L.x) * 0.06;
    L.y += (pointer.y * 3 + 2 - L.y) * 0.06;
    edgeMat.opacity = (0.3 + 0.35 * Math.max(STEPS[0], 0.2)) * intro;

    /* ---------------- camera ---------------- */
    const cam = state.camera;
    if (!q.animate) {
      cam.position.set(0, 0.2, 9);
      cam.lookAt(0, 0.1, 0);
    } else {
      cam.position.x += (pointer.x * 0.35 - cam.position.x) * 0.05;
      cam.position.y += (0.15 + pointer.y * 0.2 - cam.position.y) * 0.05;
      cam.position.z += (9 - cam.position.z) * 0.05;
      _look.set(0, 0.1, 0);
      cam.lookAt(_look);
    }
  });

  return (
    <group>
      <SceneLightRig intensity={0.85} />
      <group ref={planeRef}>
        <group ref={bankRef}>
          <mesh geometry={sheetGeo} material={sheetMat} renderOrder={2} frustumCulled={false} />
          <primitive object={edgeLines} />
        </group>
      </group>
      <primitive object={trailLine} />
      <ParticleField
        count={Math.floor(1300 * q.particles)}
        spread={[11, 6, 5]}
        position={[0, 0, -1.5]}
        size={0.04}
        drift={q.animate ? 0.08 : 0}
        opacity={0.3}
      />
    </group>
  );
}
