'use client';

import * as THREE from 'three';

/**
 * Custom GLSL shaders for the Palm Springs architectural miniature:
 *  1. Mid-century star breeze-block screen (front/back faces with bevel specular)
 *  2. Porcelain terrace deck with projected star breeze-block & butterfly-roof shadows
 *  3. Desert modern swimming pool with tile grid, concentric ripples & caustics
 *  4. Topographic porcelain plinth base that melts into --paper (#fafbfe)
 *
 * Strictly blue-only spectrum (--paper #fafbfe, ice #dce6ff, azure #7d97ff,
 * electric #2e4bff, deep #1226c8, ink #0a0c12). Zero external textures.
 */

const BREEZE_BLOCK_FN = /* glsl */ `
  /* Classic Palm Springs mid-century breeze block:
     chamfered square frame + circular ring + 4-point star center */
  float breezeBlockMask(vec2 uv) {
    vec2 c = fract(uv) - 0.5;
    float outerFrame = step(0.42, max(abs(c.x), abs(c.y)));
    float r = length(c);
    float ringHole = 1.0 - step(0.365, r);
    vec2 a = abs(c);
    float star = step(a.x + a.y, 0.185) + step(max(a.x, a.y), 0.058);
    float crossRibs = step(min(a.x, a.y), 0.036) * step(r, 0.37);
    float solidCenter = clamp(star + crossRibs * 0.85, 0.0, 1.0);
    float opening = ringHole * (1.0 - solidCenter);
    return max(outerFrame, 1.0 - opening);
  }
`;

const screenVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const screenFrag = /* glsl */ `
  uniform vec2 uCells;
  uniform vec3 uSun;
  uniform float uShade;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  ${BREEZE_BLOCK_FN}

  void main() {
    vec2 cellUv = vUv * uCells;
    if (breezeBlockMask(cellUv) < 0.5) discard;

    vec2 c = fract(cellUv) - 0.5;
    float r = length(c);
    float bevel = smoothstep(0.35, 0.39, r) * (1.0 - smoothstep(0.39, 0.44, r));
    float frameEdge = smoothstep(0.41, 0.47, max(abs(c.x), abs(c.y)));
    float sunCatch = clamp(dot(normalize(c + vec2(1e-4)), -uSun.xy) * 0.5 + 0.5, 0.0, 1.0);
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 1.8);

    vec3 porcelain = vec3(0.88, 0.92, 1.0);
    vec3 azure = vec3(0.46, 0.59, 1.0);
    vec3 electric = vec3(0.18, 0.295, 1.0);
    vec3 col = mix(porcelain, azure, 0.32 + fresnel * 0.48 + uShade * 0.35);
    col = mix(col, electric, frameEdge * 0.42 + uShade * 0.22);
    col = mix(col, vec3(0.98, 0.99, 1.0), bevel * sunCatch * 0.88);

    gl_FragColor = vec4(col, uOpacity);
  }
`;

const terraceVert = /* glsl */ `
  varying vec2 vLocal;
  varying vec3 vWorld;
  void main() {
    vLocal = position.xy;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const terraceFrag = /* glsl */ `
  uniform vec3 uSun;
  uniform float uOpacity;
  uniform float uNightGlow;
  varying vec2 vLocal;
  varying vec3 vWorld;
  ${BREEZE_BLOCK_FN}

  /* Project from terrace floor point (x, z in plane local = x, -y) toward sun
     to test intersection with the breeze-block screen wall at x in [-0.25..1.15], z = 0.52 */
  float sampleScreenShadow(vec2 floorXZ) {
    float wallZ = 0.48;
    float dz = wallZ - floorXZ.y;
    /* Only cast shadow when sun has positive Z component (in front) or project across */
    float sunZ = max(abs(uSun.z), 0.18);
    float t = abs(dz) / sunZ;
    float hitY = t * max(uSun.y, 0.22);
    if (hitY < 0.0 || hitY > 0.78) return 0.0;
    float hitX = floorXZ.x + uSun.x * t * 0.65;
    float u = (hitX - (-0.15)) / 1.35;
    float v = hitY / 0.78;
    if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) return 0.0;
    return breezeBlockMask(vec2(u * 7.0, v * 4.0));
  }

  void main() {
    /* vLocal.x is X (-2.4..2.4), vLocal.y is -Z in world after -PI/2 X rotation */
    vec2 xz = vec2(vLocal.x, -vLocal.y);

    /* 5-tap soft penumbra for the breeze-block star shadow on the terrace */
    float spread = 0.014;
    float sh = (
      sampleScreenShadow(xz) +
      sampleScreenShadow(xz + vec2(spread, 0.0)) +
      sampleScreenShadow(xz - vec2(spread, 0.0)) +
      sampleScreenShadow(xz + vec2(0.0, spread)) +
      sampleScreenShadow(xz - vec2(0.0, spread))
    ) * 0.2;

    /* Butterfly roof architectural shadow under the pavilion (-1.65..0.15, -0.35..0.55) */
    vec2 roofUv = (xz - vec2(-0.75 + uSun.x * 0.22, 0.10)) / vec2(0.95, 0.52);
    float roofShadow = (1.0 - smoothstep(0.75, 1.05, max(abs(roofUv.x), abs(roofUv.y)))) * 0.42;

    /* Subtle architectural paver grid lines on the terrace */
    vec2 grid = abs(fract(xz * 3.5) - 0.5);
    float paverLine = 1.0 - smoothstep(0.0, 0.028, min(grid.x, grid.y));

    vec3 porcelain = vec3(0.955, 0.968, 1.0);
    vec3 gridTint = vec3(0.76, 0.83, 1.0);
    vec3 shadowTint = vec3(0.42, 0.55, 1.0);
    vec3 deepShadow = vec3(0.18, 0.295, 1.0);

    vec3 col = mix(porcelain, gridTint, paverLine * 0.38);
    float totalShadow = clamp(sh * 0.78 + roofShadow, 0.0, 0.88);
    col = mix(col, mix(shadowTint, deepShadow, sh * 0.55), totalShadow);

    /* Warm-blue evening architectural glow near the pavilion & pool */
    float pavilionGlow = exp(-length(xz - vec2(-0.65, 0.15)) * 1.45);
    float poolGlow = exp(-length(xz - vec2(0.55, 0.72)) * 1.65);
    col += vec3(0.18, 0.30, 1.0) * (pavilionGlow + poolGlow * 0.8) * uNightGlow * 0.38;

    /* Rounded terrace edge fade */
    vec2 edge = abs(vLocal) / vec2(2.35, 1.65);
    float alpha = (1.0 - smoothstep(0.82, 1.0, edge.x)) * (1.0 - smoothstep(0.80, 1.0, edge.y));
    gl_FragColor = vec4(col, alpha * uOpacity);
  }
`;

const poolVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vViewDir;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const poolFrag = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uNightGlow;
  varying vec2 vUv;
  varying vec3 vViewDir;
  varying vec3 vNormal;

  /* Procedural caustic wave interference in the Palm Springs pool */
  float causticPattern(vec2 p, float t) {
    vec2 a = p * 9.0 + vec2(t * 0.45, -t * 0.32);
    vec2 b = p * 11.5 + vec2(-t * 0.38, t * 0.52);
    float w1 = sin(a.x + sin(a.y * 1.3 + t)) * cos(a.y + cos(a.x * 1.1 - t));
    float w2 = sin(b.x * 1.1 - cos(b.y + t * 0.8)) * cos(b.y * 1.2 + sin(b.x));
    return smoothstep(0.25, 0.88, abs(w1 + w2) * 0.65);
  }

  void main() {
    vec2 p = vUv - 0.5;

    /* Subtle mosaic pool tile grid refracted by water waves */
    vec2 waveOffset = vec2(
      sin(vUv.y * 18.0 + uTime * 1.8) * 0.008,
      cos(vUv.x * 14.0 - uTime * 1.5) * 0.008
    );
    vec2 tileUv = (vUv + waveOffset) * vec2(14.0, 9.0);
    vec2 tileGrid = abs(fract(tileUv) - 0.5);
    float grout = 1.0 - smoothstep(0.0, 0.06, min(tileGrid.x, tileGrid.y));

    /* Concentric pool ripple rings from steps & float ring */
    float d1 = length((vUv - vec2(0.28, 0.46)) * vec2(1.45, 1.0));
    float d2 = length((vUv - vec2(0.74, 0.58)) * vec2(1.45, 1.0));
    float ring1 = sin(d1 * 34.0 - uTime * 2.4) * exp(-d1 * 3.2);
    float ring2 = sin(d2 * 28.0 - uTime * 2.0 + 1.4) * exp(-d2 * 3.0);
    float ripples = clamp((ring1 + ring2) * 0.5 + 0.5, 0.0, 1.0);

    float caustics = causticPattern(vUv, uTime);
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.0);

    /* Blue-only spectrum: azure pool water, electric depths, ice-white caustic highlights */
    vec3 shallowBlue = vec3(0.54, 0.68, 1.0);
    vec3 electricPool = vec3(0.18, 0.30, 1.0);
    vec3 deepNavy = vec3(0.07, 0.15, 0.78);
    vec3 causticIce = vec3(0.92, 0.96, 1.0);

    float depthGrad = smoothstep(0.0, 1.0, vUv.x * 0.7 + vUv.y * 0.3);
    vec3 water = mix(shallowBlue, electricPool, 0.45 + depthGrad * 0.4);
    water = mix(water, deepNavy, (1.0 - grout) * 0.18);
    water = mix(water, causticIce, (caustics * 0.52 + ripples * 0.25 + grout * 0.18));
    water = mix(water, vec3(0.88, 0.93, 1.0), fresnel * 0.38);

    /* Underwater pool lamp glow at twilight/night beats */
    float lamp = exp(-length(p * vec2(1.2, 1.6)) * 2.2);
    water += vec3(0.24, 0.40, 1.0) * lamp * (0.22 + uNightGlow * 0.65);

    /* Pool coping inner shadow around perimeter */
    vec2 border = abs(p) * 2.0;
    float innerRim = smoothstep(0.82, 0.98, max(border.x, border.y));
    water = mix(water, deepNavy, innerRim * 0.35);

    gl_FragColor = vec4(water, 0.94 * uOpacity);
  }
`;

const plinthVert = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const plinthFrag = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vPos;
  void main() {
    vec2 n = vPos / vec2(3.15, 2.25);
    float r = length(n);
    if (r > 1.0) discard;

    /* Concentric architectural model contour rings */
    float rings = abs(fract(r * 9.0) - 0.5);
    float ringLine = 1.0 - smoothstep(0.0, 0.035, rings);

    vec3 paper = vec3(0.980, 0.984, 1.0);
    vec3 porcelain = vec3(0.91, 0.94, 1.0);
    vec3 contourCol = vec3(0.56, 0.68, 1.0);

    vec3 col = mix(porcelain, paper, smoothstep(0.35, 0.98, r));
    col = mix(col, contourCol, ringLine * (1.0 - smoothstep(0.55, 0.95, r)) * 0.32);

    float fade = 1.0 - smoothstep(0.68, 1.0, r);
    gl_FragColor = vec4(col, fade * 0.92 * uOpacity);
  }
`;

export interface PalmSpringsShaderBundle {
  screenFrontMat: THREE.ShaderMaterial;
  screenBackMat: THREE.ShaderMaterial;
  terraceMat: THREE.ShaderMaterial;
  poolMat: THREE.ShaderMaterial;
  plinthMat: THREE.ShaderMaterial;
  sunVec: THREE.Vector3;
  dispose: () => void;
}

export function createPalmSpringsShaders(): PalmSpringsShaderBundle {
  const sunVec = new THREE.Vector3(0.38, 0.52, 0.76).normalize();
  const cells = new THREE.Vector2(7, 4);

  const makeScreen = (shade: number) =>
    new THREE.ShaderMaterial({
      vertexShader: screenVert,
      fragmentShader: screenFrag,
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uCells: { value: cells },
        uSun: { value: sunVec },
        uShade: { value: shade },
        uOpacity: { value: 1 },
      },
    });

  const screenFrontMat = makeScreen(0.0);
  const screenBackMat = makeScreen(0.55);

  const terraceMat = new THREE.ShaderMaterial({
    vertexShader: terraceVert,
    fragmentShader: terraceFrag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSun: { value: sunVec },
      uOpacity: { value: 1 },
      uNightGlow: { value: 0 },
    },
  });

  const poolMat = new THREE.ShaderMaterial({
    vertexShader: poolVert,
    fragmentShader: poolFrag,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uNightGlow: { value: 0 },
    },
  });

  const plinthMat = new THREE.ShaderMaterial({
    vertexShader: plinthVert,
    fragmentShader: plinthFrag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uOpacity: { value: 1 },
    },
  });

  return {
    screenFrontMat,
    screenBackMat,
    terraceMat,
    poolMat,
    plinthMat,
    sunVec,
    dispose() {
      screenFrontMat.dispose();
      screenBackMat.dispose();
      terraceMat.dispose();
      poolMat.dispose();
      plinthMat.dispose();
    },
  };
}
