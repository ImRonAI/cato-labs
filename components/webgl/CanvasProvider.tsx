'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import gsap from 'gsap';
import { useQuality } from './lib/quality';
import { veilBus } from './scroll-store';

import HomeScene from './scenes/home/HomeScene';
import CapabilitiesScene from './scenes/capabilities/CapabilitiesScene';
import ApproachScene from './scenes/approach/ApproachScene';
import ContactScene from './scenes/contact/ContactScene';
import registry from './scenes/registry';

/**
 * SceneManager — one persistent canvas for the whole site.
 * Exact registry hits serve child pages (lazy-loaded per route);
 * the four original families stay eager as fallbacks. The veil covers
 * the cut, so moving between pages feels like passing through light.
 */
const eager: Record<string, React.ComponentType> = {
  '/': HomeScene,
  '/capabilities': CapabilitiesScene,
  '/approach': ApproachScene,
  '/contact': ContactScene,
};

function resolveScene(pathname: string): React.ComponentType {
  const lazyHit = registry[pathname];
  if (lazyHit) return lazyHit as unknown as React.ComponentType;
  return eager[pathname] ?? HomeScene;
}

function SceneManager() {
  const pathname = usePathname();
  const Scene = resolveScene(pathname);
  return (
    <>
      <color attach="background" args={['#fafbfe']} />
      <fog attach="fog" args={['#fafbfe', 16, 46]} />
      <Scene key={pathname} />
    </>
  );
}

/**
 * Full-screen light wipe that covers route transitions.
 * Cover: a paper sheet rises with an electric hairline and ice glow on its
 * leading edge; the monogram surfaces at centre and a hairline breathes
 * while the next route compiles. Reveal: the mark recedes and the sheet
 * continues up and away, so the cut reads as one continuous pass of light.
 * Back/forward and first load (no cover) get the full sweep instead.
 */
function Veil() {
  const ref = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const covered = useRef(false);
  const pathname = usePathname();

  /* reveal after the route commits.
     NOTE: always gsap.set({y:0, yPercent}) first — the SSR inline style
     translateY(102%) parses into a pixel `y`, which would otherwise linger
     and cancel out the yPercent travel. */
  useEffect(() => {
    const el = ref.current;
    const mark = markRef.current;
    if (!el || !mark) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.killTweensOf([el, mark]);
    el.classList.remove('is-covering');
    if (reduced) {
      gsap.set(el, { y: 0, yPercent: 0 });
      gsap.to(el, {
        autoAlpha: 0,
        duration: 0.45,
        ease: 'power1.out',
        delay: 0.05,
        onComplete: () => {
          gsap.set(el, { yPercent: 102, autoAlpha: 1 });
        },
      });
      covered.current = false;
      return;
    }
    const tl = gsap.timeline();
    if (covered.current) {
      tl.to(mark, { autoAlpha: 0, y: -14, duration: 0.35, ease: 'power2.in' }).to(
        el,
        { yPercent: -102, duration: 1.05, ease: 'expo.inOut' },
        '-=0.12',
      );
    } else {
      gsap.set(mark, { autoAlpha: 0 });
      gsap.set(el, { y: 0, yPercent: 102 });
      tl.to(el, { yPercent: -102, duration: 1.15, ease: 'expo.inOut', delay: 0.08 });
    }
    covered.current = false;
    return () => {
      tl.kill();
    };
  }, [pathname]);

  /* cover: nav links ask the veil to sweep in before navigating */
  useEffect(() => {
    const el = ref.current;
    const mark = markRef.current;
    if (!el || !mark) return;
    return veilBus.onCover(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      gsap.killTweensOf([el, mark]);
      covered.current = true;
      if (reduced) {
        gsap.set(el, { y: 0, yPercent: 0, autoAlpha: 0 });
        gsap.set(mark, { autoAlpha: 0 });
        gsap.to(el, { autoAlpha: 1, duration: 0.3, ease: 'power1.out' });
        return;
      }
      gsap.set(el, { y: 0, yPercent: 102, autoAlpha: 1 });
      gsap.set(mark, { autoAlpha: 0, y: 16 });
      gsap.to(el, { yPercent: 0, duration: 0.6, ease: 'expo.inOut' });
      gsap.to(mark, {
        autoAlpha: 1,
        y: 0,
        duration: 0.6,
        ease: 'expo.out',
        delay: 0.32,
        onComplete: () => {
          el.classList.add('is-covering');
        },
      });
    });
  }, []);

  return (
    <div ref={ref} className="veil" style={{ transform: 'translateY(102%)' }} aria-hidden="true">
      <div ref={markRef} className="veil__mark" style={{ opacity: 0 }}>
        <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
          <path d="M4 22 V4 h18" stroke="#0a0c12" strokeWidth="4.2" strokeLinecap="square" />
          <path d="M60 42 V60 H42" stroke="#0a0c12" strokeWidth="4.2" strokeLinecap="square" />
          <rect x="46" y="4" width="4.6" height="4.6" fill="#2e4bff" />
          <path
            d="M35.5 24.5 A9.5 9.5 0 1 0 35.5 39.5"
            stroke="#0a0c12"
            strokeWidth="5"
            strokeLinecap="square"
          />
          <path d="M42 24 V40 h11" stroke="#0a0c12" strokeWidth="5" strokeLinecap="square" />
        </svg>
        <span className="veil__line" />
      </div>
    </div>
  );
}

export default function CanvasProvider() {
  const q = useQuality();

  return (
    <>
      <div className="gl-stage" aria-hidden="true">
        <Canvas
          dpr={q.dpr}
          camera={{ position: [0, 0, 9], fov: 32, near: 0.1, far: 60 }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
          }}
        >
          <Suspense fallback={null}>
            <SceneManager />
            {q.bloom && (
              <EffectComposer multisampling={4}>
                {/* white-paper theme: threshold above paper luminance so only
                    HDR emissives + specular hits bloom — never the background */}
                <Bloom
                  intensity={0.4}
                  luminanceThreshold={0.86}
                  luminanceSmoothing={0.2}
                  mipmapBlur
                />
                <Vignette offset={0.22} darkness={0.16} />
              </EffectComposer>
            )}
          </Suspense>
        </Canvas>
      </div>
      <Veil />
    </>
  );
}
