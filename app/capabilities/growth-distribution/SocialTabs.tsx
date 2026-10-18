'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import ParticleSculpture from '@/components/webgl/kit/ParticleSculpture';
import type { ShapeName } from '@/components/webgl/kit/lib/shapes';

/**
 * SocialTabs — "Every platform, sculpted."
 *
 * A lightweight, page-local R3F stage: one ParticleSculpture morphing between
 * the Cato mark and the social logos (shapes from lib/shapes). The canvas is
 * lazy-mounted only when the section approaches the viewport, carries no
 * lights (the sculpture is an unlit point shader), and is pointer-events:
 * none — the water cursor reads the global pointer, so visitors drag through
 * the logo without the canvas ever intercepting a click.
 */

interface Platform {
  id: ShapeName;
  label: string;
  line: string;
}

const PLATFORMS: Platform[] = [
  {
    id: 'cato',
    label: 'Cato',
    line: 'The mark itself — the standard every room below is held to.',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    line: 'The brand world in public — identity, work and proof, composed as a grid worth returning to.',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    line: 'Reach engineered, never chased — short-form systems that teach the algorithm who you are.',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    line: 'The thinking, where decisions get made — operator-grade content for buyers who actually read.',
  },
  {
    id: 'x',
    label: 'X',
    line: 'The signal channel — sharp positions shipped daily, where the industry argues in public.',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    line: 'Depth that compounds — the long-form archive that keeps selling while you sleep.',
  },
];

export default function SocialTabs() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState<ShapeName>('cato');

  /* lazy-mount the canvas only when the stage approaches the viewport */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || mounted) return;
    if (!('IntersectionObserver' in window)) {
      setMounted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px', threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  const platform = PLATFORMS.find((p) => p.id === active) ?? PLATFORMS[0];

  return (
    <div>
      <div ref={stageRef} className="gd-stage">
        <span className="gd-stage__hint" aria-hidden="true">
          Drag through the mark
        </span>
        <div className="gd-stage__canvas" aria-hidden="true">
          {mounted && (
            <Canvas
              dpr={[1, 1.5]}
              camera={{ position: [0, 0, 7], fov: 30, near: 0.1, far: 40 }}
              gl={{ antialias: true, alpha: true }}
              style={{ background: 'transparent' }}
            >
              <ParticleSculpture
                shape={active}
                count={2400}
                size={0.045}
                scale={1.15}
                color="#2e4bff"
                colorB="#93a9ff"
                opacity={0.8}
                waterRadius={0.45}
                waterStrength={0.3}
              />
            </Canvas>
          )}
        </div>
      </div>

      <ul className="gd-tabs" role="group" aria-label="Choose a platform">
        {PLATFORMS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="gd-tab"
              aria-pressed={active === p.id}
              onClick={() => setActive(p.id)}
            >
              {p.label}
            </button>
          </li>
        ))}
      </ul>

      <p className="gd-platform-line" aria-live="polite">
        <span key={platform.id}>
          <b>{platform.label}.</b> {platform.line}
        </span>
      </p>
    </div>
  );
}
