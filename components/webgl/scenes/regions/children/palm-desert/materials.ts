import * as THREE from 'three';

export interface PalmDesertMaterials {
  porcelainMat: THREE.MeshStandardMaterial;
  azureBaseMat: THREE.MeshStandardMaterial;
  trunkMat: THREE.MeshStandardMaterial;
  bunkerMat: THREE.MeshStandardMaterial;
  flagstickMat: THREE.MeshStandardMaterial;
  flagPennantMat: THREE.MeshStandardMaterial;
  golfBallMat: THREE.MeshStandardMaterial;
  mountainsMat: THREE.ShaderMaterial;
  mountainsLineMat: THREE.LineBasicMaterial;
  floraMat: THREE.ShaderMaterial;
  storefrontGlowMat: THREE.ShaderMaterial;
  golfGreenMat: THREE.ShaderMaterial;
  sunHaloMat: THREE.LineBasicMaterial;
  lineworkMat: THREE.LineBasicMaterial;
  rippleRingMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

const mountainVertex = /* glsl */ `
  varying vec3 vLocalPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vLocalPos = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const mountainFragment = /* glsl */ `
  uniform float uDawn;
  uniform float uOpacity;
  varying vec3 vLocalPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    // Faceted screen-space derivative normal for crisp architectural model planes
    vec3 fNorm = normalize(cross(dFdx(vLocalPos), dFdy(vLocalPos)));
    vec3 n = normalize(mix(vNormal, fNorm, 0.72));

    // Dawn sun direction rising behind the saddle
    vec3 sunDir = normalize(vec3(-0.18, 0.45 + 0.35 * uDawn, -0.65));
    vec3 keyDir = normalize(vec3(0.55, 0.78, 0.48));
    float diffKey = clamp(dot(n, keyDir), 0.0, 1.0);
    float diffSun = clamp(dot(n, sunDir), 0.0, 1.0);
    float fresnel = pow(1.0 - abs(dot(n, normalize(vViewDir))), 1.8);

    // Height normalized 0..1 (max height ~2.2)
    float h = clamp(vLocalPos.y / 2.1, 0.0, 1.0);

    vec3 deepBlue = vec3(0.08, 0.16, 0.72);     // #1429b8
    vec3 electricBlue = vec3(0.18, 0.29, 1.0);  // #2e4bff
    vec3 azure = vec3(0.56, 0.67, 1.0);         // #8fabff
    vec3 ice = vec3(0.86, 0.90, 1.0);           // #dce6ff
    vec3 porcelain = vec3(0.97, 0.98, 1.0);     // #f7faff

    // Base elevation ramp: deep blue foothills -> azure slopes -> porcelain peaks
    vec3 col = mix(deepBlue, electricBlue, smoothstep(0.0, 0.28, h));
    col = mix(col, azure, smoothstep(0.22, 0.62, h));
    col = mix(col, ice, smoothstep(0.55, 0.85, h));
    col = mix(col, porcelain, smoothstep(0.78, 1.0, h));

    // Facet lighting contrast
    col = mix(col * 0.82, col * 1.12, diffKey * 0.75 + diffSun * 0.35);

    // Dawn backlight halo around the central canyon saddle (x ~ -0.15)
    float saddleDist = length(vec2((vLocalPos.x + 0.15) * 0.65, (vLocalPos.y - 1.15) * 0.85));
    float dawnRim = exp(-saddleDist * saddleDist * 1.4) * (0.35 + 0.65 * uDawn);
    col = mix(col, vec3(0.32, 0.46, 1.0), fresnel * 0.45);
    col += vec3(0.22, 0.34, 0.95) * dawnRim * 0.42;

    // Soft fade at the very base where mountain meets plinth
    float baseAlpha = smoothstep(0.0, 0.035, vLocalPos.y);
    gl_FragColor = vec4(col, baseAlpha * uOpacity);
  }
`;

const floraVertex = /* glsl */ `
  uniform float uTime;
  attribute float aWind;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vWind;
  void main() {
    vWind = aWind;
    vec3 p = position;
    // Gentle desert breeze swaying the palm fronds
    float sway = sin(uTime * 1.6 + position.x * 2.3 + position.z * 1.9) * 0.028 * aWind;
    float lift = cos(uTime * 1.2 + position.x * 1.7) * 0.014 * aWind;
    p.x += sway;
    p.y += lift;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const floraFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vWind;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vViewDir);
    float fres = pow(1.0 - abs(dot(n, v)), 1.5);
    float key = clamp(dot(n, normalize(vec3(0.4, 0.85, 0.5))), 0.0, 1.0);

    vec3 deep = vec3(0.06, 0.14, 0.75);
    vec3 electric = vec3(0.18, 0.29, 1.0);
    vec3 azure = vec3(0.38, 0.54, 1.0);
    vec3 ice = vec3(0.76, 0.85, 1.0);

    vec3 col = mix(deep, electric, 0.4 + 0.45 * key);
    col = mix(col, azure, vWind * 0.45);
    col = mix(col, ice, fres * 0.55 + key * 0.18);

    gl_FragColor = vec4(col, uOpacity);
  }
`;

const storefrontGlowVertex = /* glsl */ `
  attribute float aStore;
  varying float vStore;
  varying vec3 vLocal;
  void main() {
    vStore = aStore;
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const storefrontGlowFragment = /* glsl */ `
  uniform float uSweep;
  uniform float uOpacity;
  varying float vStore;
  varying vec3 vLocal;
  void main() {
    // Each storefront (0, 1, 2) illuminates progressively as uSweep rises 0 -> 1
    float threshold = vStore * 0.28;
    float activeGlow = smoothstep(threshold, threshold + 0.42, uSweep);
    float baseGlow = 0.38 + 0.62 * activeGlow;

    vec3 unlit = vec3(0.76, 0.83, 0.98);
    vec3 litCore = vec3(0.24, 0.38, 1.0) * 1.45; // slight HDR boost for bloom
    vec3 litTop = vec3(0.88, 0.93, 1.0) * 1.25;

    float vGrad = clamp((vLocal.y - 0.08) / 0.75, 0.0, 1.0);
    vec3 activeCol = mix(litCore, litTop, vGrad);
    vec3 col = mix(unlit, activeCol, baseGlow);

    gl_FragColor = vec4(col, uOpacity * 0.95);
  }
`;

const golfGreenVertex = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vNormal;
  void main() {
    vLocal = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const golfGreenFragment = /* glsl */ `
  uniform float uPulse;
  uniform float uOpacity;
  varying vec3 vLocal;
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    float key = clamp(dot(n, normalize(vec3(0.45, 0.85, 0.4))), 0.0, 1.0);

    // Subtle country-club mowing stripes across the green in a rich azure-blue spectrum
    float stripe = smoothstep(-0.2, 0.2, sin((vLocal.x + vLocal.z) * 24.0));
    vec3 turfA = vec3(0.54, 0.67, 1.0); // rich azure turf
    vec3 turfB = vec3(0.67, 0.78, 1.0); // lighter mowing stripe
    vec3 col = mix(turfA, turfB, stripe * 0.7);
    col = mix(col * 0.86, col * 1.08, key);

    // Putting cup at (1.88, 0.38)
    float cupDist = length(vLocal.xz - vec2(1.88, 0.38));
    // Dark navy cup hole + electric blue rim
    float inCup = 1.0 - smoothstep(0.036, 0.052, cupDist);
    float cupRim = smoothstep(0.042, 0.056, cupDist) * (1.0 - smoothstep(0.056, 0.082, cupDist));
    col = mix(col, vec3(0.04, 0.08, 0.32), inCup);
    col = mix(col, vec3(0.18, 0.29, 1.0) * 1.4, cupRim);

    // Concentric celebration ring when the golf ball drops in Beat 3
    if (uPulse > 0.01) {
      float ringR = uPulse * 0.68;
      float ring = exp(-pow((cupDist - ringR) / 0.048, 2.0)) * (1.0 - uPulse * 0.7);
      col = mix(col, vec3(0.18, 0.29, 1.0) * 1.45, clamp(ring, 0.0, 1.0));
    }

    gl_FragColor = vec4(col, uOpacity);
  }
`;

export function createPalmDesertMaterials(): PalmDesertMaterials {
  const porcelainMat = new THREE.MeshStandardMaterial({
    color: '#f3f6ff',
    roughness: 0.36,
    metalness: 0.04,
  });

  const azureBaseMat = new THREE.MeshStandardMaterial({
    color: '#d4e0ff',
    roughness: 0.42,
    metalness: 0.06,
  });

  const trunkMat = new THREE.MeshStandardMaterial({
    color: '#c4d4ff',
    roughness: 0.48,
    metalness: 0.05,
  });

  const bunkerMat = new THREE.MeshStandardMaterial({
    color: '#fafbfe',
    roughness: 0.25,
    metalness: 0.02,
  });

  const flagstickMat = new THREE.MeshStandardMaterial({
    color: '#1226c8',
    roughness: 0.2,
    metalness: 0.65,
  });

  const flagPennantMat = new THREE.MeshStandardMaterial({
    color: '#2e4bff',
    emissive: '#1f38e0',
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const golfBallMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#dce4ff',
    emissiveIntensity: 0.35,
    roughness: 0.12,
    metalness: 0.08,
  });

  const mountainsMat = new THREE.ShaderMaterial({
    vertexShader: mountainVertex,
    fragmentShader: mountainFragment,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      uDawn: { value: 0.5 },
      uOpacity: { value: 1 },
    },
  });

  const mountainsLineMat = new THREE.LineBasicMaterial({
    color: '#4a68ff',
    transparent: true,
    opacity: 0.42,
  });

  const floraMat = new THREE.ShaderMaterial({
    vertexShader: floraVertex,
    fragmentShader: floraFragment,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    },
  });

  const storefrontGlowMat = new THREE.ShaderMaterial({
    vertexShader: storefrontGlowVertex,
    fragmentShader: storefrontGlowFragment,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uSweep: { value: 0.3 },
      uOpacity: { value: 1 },
    },
  });

  const golfGreenMat = new THREE.ShaderMaterial({
    vertexShader: golfGreenVertex,
    fragmentShader: golfGreenFragment,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uPulse: { value: 0 },
      uOpacity: { value: 1 },
    },
  });

  const sunHaloMat = new THREE.LineBasicMaterial({
    color: '#5f7dff',
    transparent: true,
    opacity: 0.52,
  });

  const lineworkMat = new THREE.LineBasicMaterial({
    color: '#2e4bff',
    transparent: true,
    opacity: 0.55,
  });

  const rippleRingMat = new THREE.MeshBasicMaterial({
    color: '#2e4bff',
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  return {
    porcelainMat,
    azureBaseMat,
    trunkMat,
    bunkerMat,
    flagstickMat,
    flagPennantMat,
    golfBallMat,
    mountainsMat,
    mountainsLineMat,
    floraMat,
    storefrontGlowMat,
    golfGreenMat,
    sunHaloMat,
    lineworkMat,
    rippleRingMat,
    dispose() {
      porcelainMat.dispose();
      azureBaseMat.dispose();
      trunkMat.dispose();
      bunkerMat.dispose();
      flagstickMat.dispose();
      flagPennantMat.dispose();
      golfBallMat.dispose();
      mountainsMat.dispose();
      mountainsLineMat.dispose();
      floraMat.dispose();
      storefrontGlowMat.dispose();
      golfGreenMat.dispose();
      sunHaloMat.dispose();
      lineworkMat.dispose();
      rippleRingMat.dispose();
    },
  };
}
