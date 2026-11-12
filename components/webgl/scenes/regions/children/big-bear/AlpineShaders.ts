import * as THREE from 'three';
import { PLINTH_RX, PLINTH_RZ } from './AlpineGeometry';

const terrainVertex = /* glsl */ `
  attribute vec3 aMeta;
  varying vec3 vPos;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vMeta;
  void main() {
    vPos = position;
    vMeta = aMeta;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const terrainFragment = /* glsl */ `
  uniform float uSeason;
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vPos;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vMeta;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // Blend smooth normal with screen-space facet normal for crisp architectural model ridges
    vec3 flatN = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
    vec3 n = normalize(mix(vNormal, flatN, 0.52));
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    float elev = vMeta.x;
    float runMask = vMeta.z;

    // Key, fill, and rim lighting in blue/white studio space
    vec3 keyDir = normalize(vec3(-0.45, 0.82, 0.55));
    vec3 rimDir = normalize(vec3(0.55, 0.45, -0.70));
    float diff = max(dot(n, keyDir), 0.0);
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.4);
    float slopeUp = clamp(n.y, 0.0, 1.0);

    // Base architectural slate-blue mountain rock
    vec3 deepRock = vec3(0.11, 0.19, 0.58);
    vec3 midSlate = vec3(0.32, 0.45, 0.88);
    vec3 paleRidge = vec3(0.66, 0.75, 0.98);
    vec3 rockCol = mix(deepRock, midSlate, smoothstep(0.05, 0.55, elev));
    rockCol = mix(rockCol, paleRidge, smoothstep(0.50, 0.95, elev) * 0.65);
    rockCol += vec3(0.10, 0.16, 0.35) * diff;

    // Snow line descends from summit (summer/shoulder) down to lake shore (winter)
    float snowLine = mix(0.46, 0.11, uSeason) - runMask * 0.28;
    float noisePatch = (hash(floor(vPos.xz * 22.0)) - 0.5) * 0.08;
    float snowCover = smoothstep(snowLine - 0.08, snowLine + 0.10, elev + noisePatch + slopeUp * 0.12);
    // Keep the ski run always clearly readable as a groomed porcelain piste
    snowCover = max(snowCover, smoothstep(0.25, 0.75, runMask) * (0.65 + 0.35 * uSeason));

    // Porcelain snow with cool azure shadows and electric-blue rim sheen
    vec3 snowShadow = vec3(0.76, 0.83, 0.99);
    vec3 snowLit = vec3(0.97, 0.985, 1.0);
    vec3 snowCol = mix(snowShadow, snowLit, 0.35 + 0.65 * diff);
    snowCol = mix(snowCol, vec3(0.24, 0.38, 1.0), rim * 0.28);

    // Subtle groomed corduroy stripes along the ski run
    float corduroy = sin((vPos.x + vPos.z) * 95.0) * 0.5 + 0.5;
    snowCol = mix(snowCol, vec3(0.58, 0.69, 1.0), runMask * corduroy * 0.12);

    // Crystalline snow glints
    float glintSeed = hash(floor(vPos.xz * 48.0));
    float glint = step(0.985, glintSeed) * (0.5 + 0.5 * sin(uTime * 2.4 + glintSeed * 60.0));
    snowCol = mix(snowCol, vec3(0.18, 0.30, 1.0), glint * snowCover * 0.55);

    vec3 col = mix(rockCol, snowCol, snowCover);

    // Subtle elevation contour band shading
    float contour = abs(fract(vPos.y * 6.25) - 0.5) * 2.0;
    float contourLine = 1.0 - smoothstep(0.0, 0.09, contour);
    col = mix(col, vec3(0.18, 0.29, 0.92), contourLine * 0.16);

    gl_FragColor = vec4(col, uOpacity);
  }
`;

export function createTerrainMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: terrainVertex,
    fragmentShader: terrainFragment,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uSeason: { value: 0.78 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    },
  });
}

const lakeVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const lakeFragment = /* glsl */ `
  uniform float uSeason;
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vPos;
  varying vec3 vWorldPos;

  void main() {
    // Elliptical lake basin centered around (-0.48, 0.86)
    vec2 p = vPos.xz;
    vec2 center = vec2(-0.48, 0.86);
    vec2 d = (p - center) / vec2(1.36, 0.64);
    float r = length(d);
    if (r > 1.0) discard;

    float shoreDist = 1.0 - r;
    float edgeAlpha = smoothstep(0.0, 0.08, shoreDist);

    // Deep sapphire water to ice-blue shoreline gradient
    vec3 deepWater = vec3(0.07, 0.15, 0.72);
    vec3 midWater = vec3(0.18, 0.32, 0.96);
    vec3 shallowIce = vec3(0.72, 0.82, 1.0);

    vec3 col = mix(shallowIce, midWater, smoothstep(0.0, 0.26, shoreDist));
    col = mix(col, deepWater, smoothstep(0.24, 0.78, shoreDist));

    // Summer stone-skipping ripples (3 skip points across the lake)
    float skipVis = 1.0 - uSeason * 0.55;
    vec2 s1 = vec2(-0.05, 0.88);
    vec2 s2 = vec2(-0.42, 0.84);
    vec2 s3 = vec2(-0.78, 0.80);
    float w1 = sin(length(p - s1) * 38.0 - uTime * 3.2) * exp(-length(p - s1) * 4.2);
    float w2 = sin(length(p - s2) * 38.0 - uTime * 3.2 + 1.2) * exp(-length(p - s2) * 4.5);
    float w3 = sin(length(p - s3) * 38.0 - uTime * 3.2 + 2.4) * exp(-length(p - s3) * 4.8);
    float ripples = max(0.0, w1 + w2 + w3) * skipVis;
    col = mix(col, vec3(0.92, 0.96, 1.0), ripples * 0.65);

    // Winter frosted ice shelf along the shoreline + crystalline specular bands
    float frostRim = smoothstep(0.22 * uSeason + 0.04, 0.0, shoreDist);
    col = mix(col, vec3(0.94, 0.97, 1.0), frostRim * (0.45 + 0.5 * uSeason));

    // Specular sky reflection band
    float sheen = smoothstep(0.4, 0.0, abs(p.x + 0.35 - p.y * 0.3 + sin(uTime * 0.5 + p.y * 6.0) * 0.05));
    col += vec3(0.22, 0.32, 0.58) * sheen * 0.45;

    // Shoreline bathymetry rings
    float bathy = abs(fract(shoreDist * 9.0) - 0.5) * 2.0;
    float bathyLine = 1.0 - smoothstep(0.0, 0.12, bathy);
    col = mix(col, vec3(0.85, 0.91, 1.0), bathyLine * 0.22);

    gl_FragColor = vec4(col, edgeAlpha * 0.94 * uOpacity);
  }
`;

export function createLakeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: lakeVertex,
    fragmentShader: lakeFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uSeason: { value: 0.78 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    },
  });
}

const snowParticleVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSeason;
  uniform float uPixelRatio;
  attribute vec4 aSeed;
  varying float vAlpha;
  void main() {
    float phase = fract(aSeed.w + uTime * (0.08 + aSeed.z * 0.06));
    float y = mix(2.85, 0.12, phase);
    float angle = uTime * 0.6 + aSeed.w * 25.0;
    float x = aSeed.x + sin(angle) * 0.12;
    float z = aSeed.y + cos(angle * 0.8) * 0.10;
    vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
    gl_Position = projectionMatrix * mv;
    float fadeEdge = smoothstep(0.0, 0.15, phase) * (1.0 - smoothstep(0.82, 1.0, phase));
    vAlpha = fadeEdge * (0.35 + 0.65 * uSeason);
    gl_PointSize = (2.0 + aSeed.z * 2.6) * uPixelRatio * (10.0 / max(1.0, -mv.z));
  }
`;

const snowParticleFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.08, d) * vAlpha * uOpacity;
    if (a < 0.01) discard;
    vec3 col = mix(vec3(0.96, 0.98, 1.0), vec3(0.28, 0.42, 1.0), d * 1.4);
    gl_FragColor = vec4(col, a);
  }
`;

export function createSnowfallResources(count: number): {
  geo: THREE.BufferGeometry;
  mat: THREE.ShaderMaterial;
} {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  let s = 42;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(rand()) * 0.92;
    const theta = rand() * Math.PI * 2;
    seed[i * 4] = Math.cos(theta) * PLINTH_RX * r;
    seed[i * 4 + 1] = Math.sin(theta) * PLINTH_RZ * r;
    seed[i * 4 + 2] = rand();
    seed[i * 4 + 3] = rand();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.2, 0), 4.5);

  const mat = new THREE.ShaderMaterial({
    vertexShader: snowParticleVertex,
    fragmentShader: snowParticleFragment,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSeason: { value: 0.78 },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 1 },
    },
  });

  return { geo, mat };
}
