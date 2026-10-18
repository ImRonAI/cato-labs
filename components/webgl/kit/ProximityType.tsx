'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useScrollStore } from '../scroll-store';
import './proximity.css';

/**
 * ProximityType — typography that reacts to the GL layer.
 *
 * Renders the text twice: the normal ink copy, plus an absolutely-positioned
 * duplicate in an electric-blue gradient that is revealed through a CSS
 * `mask-image` whose radial-gradient centers follow the active GL hotspots
 * in the scroll store. A rAF loop writes the mask to a ref'd element — no
 * React state per frame. Up to `maxHotspots` (≤3) nearest hotspots are
 * composited; intensity drives each mask's radius and opacity. With no
 * hotspots the gradient layer stays hidden. Reduced motion: static (hidden).
 *
 * Usage (keep the h1/h2 semantics on the parent — this renders a span):
 *   <h1><ProximityType className="display-1">Agents that work.</ProximityType></h1>
 *
 * Scene components report hotspots with the companion hook:
 *   const report = useHotspotReporter('agent-hero');
 *   useFrame((state) => report(coreRef.current!, state.camera, 0.9));
 */

export interface ProximityTypeProps {
  className?: string;
  children: React.ReactNode;
  /** how many of the nearest hotspots to composite into the mask (1–3) */
  maxHotspots?: number;
}

export default function ProximityType({
  className,
  children,
  maxHotspots = 3,
}: ProximityTypeProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const glintRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const glint = glintRef.current;
    if (!root || !glint) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let visible = false;
    let lastMask = '';
    const cap = Math.max(1, Math.min(3, maxHotspots));

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const hotspots = useScrollStore.getState().hotspots;
      const keys = Object.keys(hotspots);
      if (keys.length === 0) {
        if (visible) {
          glint.style.opacity = '0';
          visible = false;
        }
        return;
      }
      const rect = root.getBoundingClientRect();
      if (
        rect.width === 0 ||
        rect.bottom < -80 ||
        rect.top > window.innerHeight + 80
      ) {
        if (visible) {
          glint.style.opacity = '0';
          visible = false;
        }
        return;
      }

      const ecx = rect.left + rect.width / 2;
      const ecy = rect.top + rect.height / 2;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // nearest hotspots to the element center, capped
      const near = keys
        .map((k) => {
          const h = hotspots[k];
          const px = h.x * vw;
          const py = h.y * vh;
          return {
            px,
            py,
            intensity: h.intensity,
            d: (px - ecx) * (px - ecx) + (py - ecy) * (py - ecy),
          };
        })
        .sort((a, b) => a.d - b.d)
        .slice(0, cap);

      const parts: string[] = [];
      for (const h of near) {
        const lx = h.px - rect.left;
        const ly = h.py - rect.top;
        const radius = 80 + h.intensity * 170;
        const alpha = Math.min(1, 0.25 + h.intensity * 0.75);
        parts.push(
          `radial-gradient(circle ${radius.toFixed(1)}px at ${lx.toFixed(1)}px ${ly.toFixed(1)}px, rgba(0,0,0,${alpha.toFixed(3)}) 0%, rgba(0,0,0,0) 72%)`,
        );
      }
      const mask = parts.join(', ');
      if (mask !== lastMask) {
        glint.style.maskImage = mask;
        glint.style.webkitMaskImage = mask;
        lastMask = mask;
      }
      if (!visible) {
        glint.style.opacity = '1';
        visible = true;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [maxHotspots]);

  return (
    <span
      ref={rootRef}
      className={`proximity-type${className ? ` ${className}` : ''}`}
    >
      <span className="proximity-type__base">{children}</span>
      <span ref={glintRef} className="proximity-type__glint" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  useHotspotReporter — the scene-side half of the contract.          */
/* ------------------------------------------------------------------ */

const _proj = new THREE.Vector3();

/**
 * Returns a function scenes call inside useFrame with a THREE.Object3D and
 * the camera. It projects the object to screen space (0..1 viewport coords,
 * y measured from the TOP) and writes it to the scroll store via setHotspot.
 * The hotspot is cleared automatically on unmount, and whenever the object
 * goes behind the camera or off-screen. Writes are epsilon-throttled so the
 * store isn't touched when the projection is effectively unchanged.
 *
 *   const report = useHotspotReporter('cap-hero-core');
 *   useFrame((state) => {
 *     if (coreRef.current) report(coreRef.current, state.camera, 0.9);
 *   });
 */
export function useHotspotReporter(id: string) {
  const last = useRef({ x: -1, y: -1, i: -1, on: false });

  useEffect(() => {
    const state = last.current;
    return () => {
      if (state.on) {
        useScrollStore.getState().setHotspot(id, null);
        state.on = false;
      }
    };
  }, [id]);

  return useCallback(
    (obj: THREE.Object3D, camera: THREE.Camera, intensity = 1) => {
      obj.getWorldPosition(_proj);
      _proj.project(camera);
      const behind = _proj.z > 1 || _proj.z < -1;
      const x = _proj.x * 0.5 + 0.5;
      const y = 0.5 - _proj.y * 0.5; // NDC y-up → screen y-down (0 = top)
      const L = last.current;

      if (behind || x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) {
        if (L.on) {
          useScrollStore.getState().setHotspot(id, null);
          L.on = false;
        }
        return;
      }
      if (
        L.on &&
        Math.abs(x - L.x) < 0.002 &&
        Math.abs(y - L.y) < 0.002 &&
        Math.abs(intensity - L.i) < 0.02
      ) {
        return;
      }
      useScrollStore.getState().setHotspot(id, { x, y, intensity });
      L.x = x;
      L.y = y;
      L.i = intensity;
      L.on = true;
    },
    [id],
  );
}
