'use client';

import * as THREE from 'three';

/**
 * Home glass — tuned for real refraction on paper white.
 *
 * The old blocks read as flat lilac because they were tinted and had
 * nothing behind them to bend. These are near-colourless, fully
 * transmissive volumes with high-ish IOR, spectral dispersion and a
 * whisper of thin-film iridescence; the floor grid underneath gives the
 * refraction something to visibly distort, and the electric-blue core
 * block is coloured by Beer–Lambert attenuation (volume), not by albedo.
 */
type Tone = 'clear' | 'ice' | 'core' | 'ball';

const base: THREE.MeshPhysicalMaterialParameters = {
  color: '#ffffff',
  metalness: 0,
  roughness: 0.035,
  transmission: 1,
  ior: 1.52,
  thickness: 1.1,
  dispersion: 0.42,
  clearcoat: 1,
  clearcoatRoughness: 0.03,
  specularIntensity: 1,
  specularColor: new THREE.Color('#ffffff'),
  envMapIntensity: 1.55,
  iridescence: 0.16,
  iridescenceIOR: 1.3,
  iridescenceThicknessRange: [120, 420],
  attenuationColor: new THREE.Color('#c8d6ff'),
  attenuationDistance: 2.4,
};

const tones: Record<Tone, THREE.MeshPhysicalMaterialParameters> = {
  clear: {},
  ice: {
    attenuationColor: new THREE.Color('#a9bdff'),
    attenuationDistance: 1.25,
    roughness: 0.06,
  },
  core: {
    color: '#e6ebff',
    attenuationColor: new THREE.Color('#2e4bff'),
    attenuationDistance: 0.42,
    thickness: 1.25,
    dispersion: 0.6,
    iridescence: 0.08,
  },
  ball: {
    thickness: 1.0,
    ior: 1.5,
    dispersion: 0.55,
    attenuationColor: new THREE.Color('#dbe4ff'),
    attenuationDistance: 3,
    iridescence: 0.22,
  },
};

export function createHomeGlass(tone: Tone) {
  return new THREE.MeshPhysicalMaterial({ ...base, ...tones[tone] });
}
