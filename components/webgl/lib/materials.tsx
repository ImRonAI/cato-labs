'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeElements } from '@react-three/fiber';

type PhysicalProps = Partial<ThreeElements['meshPhysicalMaterial']>;

/**
 * The Cato glass system (v2 — blue-forward).
 *
 * v1 was near-white glass on paper-white — objects washed out. v2 law:
 * every object on this site reads as GLASS IN A SHADE OF BLUE. Transmission
 * is lowered so the tint actually lands, attenuation is saturated, and a
 * custom fresnel-gradient shader (`gradient`) gives the signature
 * ice→electric→deep blue ramp that stays legible on white.
 */
export const glassPresets = {
  /** Hero glass — clear but unmistakably blue in the volume. */
  crystal: {
    transmission: 0.82,
    thickness: 1.6,
    roughness: 0.06,
    ior: 1.46,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    attenuationColor: '#7d97ff',
    attenuationDistance: 1.6,
    envMapIntensity: 1.5,
    specularIntensity: 1,
    specularColor: '#e8eeff',
    iridescence: 0.35,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [120, 420],
    color: '#c9d7ff',
  },
  /** Frosted structural glass — a blue pane, not a clear sheet. */
  pane: {
    transmission: 0.68,
    thickness: 1,
    roughness: 0.2,
    ior: 1.4,
    clearcoat: 0.85,
    clearcoatRoughness: 0.22,
    attenuationColor: '#93a9ff',
    attenuationDistance: 1.4,
    envMapIntensity: 1.35,
    color: '#b4c6ff',
  },
  /** Electric core glass — the primary accent. */
  core: {
    transmission: 0.62,
    thickness: 1.8,
    roughness: 0.08,
    ior: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    attenuationColor: '#2e4bff',
    attenuationDistance: 1,
    envMapIntensity: 1.6,
    specularColor: '#dce4ff',
    iridescence: 0.25,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [180, 520],
    color: '#8ba2ff',
  },
  /** Ice glass — palest blue, for ambient structures. Still blue. */
  ice: {
    transmission: 0.78,
    thickness: 1,
    roughness: 0.14,
    ior: 1.42,
    clearcoat: 0.9,
    clearcoatRoughness: 0.16,
    attenuationColor: '#aebdff',
    attenuationDistance: 1.8,
    envMapIntensity: 1.3,
    color: '#d9e3ff',
  },
  /** Azure glass — mid-spectrum blue, the workhorse. */
  azure: {
    transmission: 0.6,
    thickness: 1.3,
    roughness: 0.09,
    ior: 1.46,
    clearcoat: 1,
    clearcoatRoughness: 0.07,
    attenuationColor: '#5f7dff',
    attenuationDistance: 1.2,
    envMapIntensity: 1.5,
    specularColor: '#e8eeff',
    iridescence: 0.18,
    iridescenceIOR: 1.25,
    iridescenceThicknessRange: [160, 460],
    color: '#9db2ff',
  },
  /** Deep glass — darkest blue, for singular hero accents. */
  deep: {
    transmission: 0.5,
    thickness: 2,
    roughness: 0.07,
    ior: 1.52,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    attenuationColor: '#1226c8',
    attenuationDistance: 0.9,
    envMapIntensity: 1.7,
    specularColor: '#c9d7ff',
    iridescence: 0.3,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [200, 600],
    color: '#5f7dff',
  },
  /** Prism glass — thick, near-clear, strongly dispersive with a thin-film
      sheen at grazing angles. For singular refractive heroes (lenses, orbs). */
  prism: {
    transmission: 0.94,
    thickness: 2.4,
    roughness: 0.03,
    ior: 1.55,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    attenuationColor: '#6b87ff',
    attenuationDistance: 2.4,
    envMapIntensity: 1.8,
    specularIntensity: 1,
    specularColor: '#ffffff',
    iridescence: 0.55,
    iridescenceIOR: 1.32,
    iridescenceThicknessRange: [140, 480],
    color: '#e8eeff',
  },
  /** Liquid glass — water/wine-clear, soft sheen, for fluids and droplets. */
  liquid: {
    transmission: 0.9,
    thickness: 1.2,
    roughness: 0.02,
    ior: 1.333,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    attenuationColor: '#93a9ff',
    attenuationDistance: 2,
    envMapIntensity: 1.6,
    specularIntensity: 1,
    specularColor: '#ffffff',
    sheen: 0.4,
    sheenColor: '#dce4ff',
    sheenRoughness: 0.4,
    color: '#eef2ff',
  },
} satisfies Record<string, PhysicalProps>;

export type GlassKind = keyof typeof glassPresets;

/** Spectral spread per kind (three r167+ `dispersion`). */
const dispersionFor: Record<GlassKind, number> = {
  crystal: 0.45,
  pane: 0.2,
  core: 0.6,
  ice: 0.45,
  azure: 0.45,
  deep: 0.45,
  prism: 1.1,
  liquid: 0.25,
};

export const GlassMaterial = React.forwardRef<
  THREE.MeshPhysicalMaterial,
  { kind?: GlassKind } & PhysicalProps
>(function GlassMaterial({ kind = 'crystal', ...rest }, ref) {
  const preset = glassPresets[kind] as Record<string, unknown>;
  return (
    <meshPhysicalMaterial
      ref={ref}
      {...preset}
      // dispersion: real spectral refraction (three r167+)
      {...({ dispersion: dispersionFor[kind] } as object)}
      {...rest}
    />
  );
});

/* ------------------------------------------------------------ */
/*  GradientGlass — the signature material: a fresnel ramp that  */
/*  runs ice → electric → deep blue across the silhouette, with  */
/*  a cool sheen. Reads gloriously on white, cheap to render.    */
/* ------------------------------------------------------------ */

const gradientVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const gradientFragment = /* glsl */ `
  uniform vec3 uIce;
  uniform vec3 uAzure;
  uniform vec3 uElectric;
  uniform vec3 uDeep;
  uniform float uOpacity;
  uniform float uSheen;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 1.6);
    float heightGrad = clamp(vWorldPos.y * 0.12 + 0.5, 0.0, 1.0);
    /* ice at facing center, azure mid, electric at grazing, deep at rim */
    vec3 col = mix(uIce, uAzure, smoothstep(0.05, 0.55, fres));
    col = mix(col, uElectric, smoothstep(0.45, 0.8, fres));
    col = mix(col, uDeep, smoothstep(0.78, 1.0, fres));
    col = mix(col, uAzure * 1.05, heightGrad * 0.25);
    /* cool top sheen */
    float sheen = pow(max(dot(normalize(vNormal), normalize(vec3(0.35, 1.0, 0.45))), 0.0), 22.0);
    col += vec3(0.9, 0.95, 1.0) * sheen * uSheen;
    gl_FragColor = vec4(col, uOpacity);
  }
`;

export function GradientGlassMaterial({
  opacity = 0.96,
  sheen = 0.65,
  ice = '#e8eeff',
  azure = '#93a9ff',
  electric = '#2e4bff',
  deep = '#1226c8',
}: {
  opacity?: number;
  sheen?: number;
  ice?: string;
  azure?: string;
  electric?: string;
  deep?: string;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: gradientVertex,
        fragmentShader: gradientFragment,
        transparent: true,
        depthWrite: true,
        side: THREE.FrontSide,
        uniforms: {
          uIce: { value: new THREE.Color(ice) },
          uAzure: { value: new THREE.Color(azure) },
          uElectric: { value: new THREE.Color(electric) },
          uDeep: { value: new THREE.Color(deep) },
          uOpacity: { value: opacity },
          uSheen: { value: sheen },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  React.useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" />;
}
