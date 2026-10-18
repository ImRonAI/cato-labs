'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useScrollStore } from '@/components/webgl/scroll-store';
import '@/app/motion.css';

/**
 * Reveal — the site's scroll-reveal primitive.
 *
 * <Reveal>                      → soft rise + de-blur when entering viewport
 * <Reveal line>                 → masked line reveal for headline lines
 * <Reveal split="chars|words">  → masked per-char/word cascade (aria-safe:
 *                                 full phrase in sr-only span + aria-label,
 *                                 split units aria-hidden)
 * <Reveal parallax={0.6}>       → element drifts y = (sectionProgress-0.5)
 *                                 * parallax * 60px, rAF-driven, no state
 * <Reveal magnetX={6}>          → ±6px x-pull toward cursor (mouse only)
 * <Reveal split="words" blur>   → masked rise + per-unit de-blur (words
 *                                 mode blurs by default; pass blur={false}
 *                                 for a pure mask)
 * delay (seconds) staggers siblings; stagger (seconds) sets split cadence.
 *
 * Default usage is untouched: no split/parallax/magnet props → identical
 * DOM and CSS as v1. Pure IntersectionObserver + CSS, fires once.
 */

type TagName = 'div' | 'span' | 'section' | 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'figure';

/** Plain-text content of a React node tree — for aria mirrors. */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement(node)) {
    return textOf((node.props as { children?: React.ReactNode }).children);
  }
  return '';
}

/** Masked char/word units with per-unit stagger delays. */
function SplitUnits({
  text,
  mode,
  delay,
  stagger,
}: {
  text: string;
  mode: 'chars' | 'words';
  delay: number;
  stagger: number;
}) {
  const tokens = text.split(/(\s+)/).filter((t) => t.length > 0);
  let i = 0;
  return (
    <>
      {tokens.map((token, ti) => {
        if (/^\s+$/.test(token)) return <React.Fragment key={ti}> </React.Fragment>;
        if (mode === 'words') {
          const d = delay + i++ * stagger;
          return (
            <span className="reveal-unit" aria-hidden="true" key={ti}>
              <span className="reveal-unit-inner" style={{ transitionDelay: `${d}s` }}>
                {token}
              </span>
            </span>
          );
        }
        /* chars — grouped per word so wrapping stays word-level */
        return (
          <span className="reveal-split-word" aria-hidden="true" key={ti}>
            {Array.from(token).map((ch, ci) => {
              const d = delay + i++ * stagger;
              return (
                <span className="reveal-unit" key={ci}>
                  <span className="reveal-unit-inner" style={{ transitionDelay: `${d}s` }}>
                    {ch}
                  </span>
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}

export default function Reveal({
  children,
  delay = 0,
  line = false,
  split,
  stagger = 0.02,
  parallax,
  magnetX,
  blur,
  className = '',
  style,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  line?: boolean;
  split?: 'chars' | 'words';
  /** seconds between split units (default 20ms) */
  stagger?: number;
  /** scroll parallax strength — y = (sectionProgress-0.5) * parallax * 60px */
  parallax?: number;
  /** max px of x-drift toward the cursor (mouse only) */
  magnetX?: number;
  /** split units also de-blur as they rise (default: on for words, off for chars) */
  blur?: boolean;
  className?: string;
  style?: React.CSSProperties;
  as?: TagName;
}) {
  const ref = useRef<HTMLElement>(null);
  const auxRef = useRef<HTMLSpanElement>(null);
  const magRef = useRef<HTMLSpanElement>(null);
  const reduced = useRef(false);

  /* cache reduced-motion once — never query per pointermove */
  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  /* entrance observer — unchanged v1 behavior */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add('is-in');
            io.disconnect();
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -6% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* scroll parallax — rAF loop, transient store reads, damped, no state */
  useEffect(() => {
    if (!parallax) return;
    const host = ref.current;
    const el = auxRef.current;
    if (!host || !el || reduced.current) return;
    const id = host.closest('[data-scene-section]')?.getAttribute('data-scene-section');
    if (!id) return;
    const state = { v: 0 };
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = useScrollStore.getState().sections[id];
      if (!s || !s.active) return;
      const target = (s.progress - 0.5) * parallax * 60;
      state.v += (target - state.v) * 0.09;
      el.style.transform = `translate3d(0, ${state.v.toFixed(2)}px, 0)`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [parallax]);

  /* magnetic x-drift — gsap on the inner wrapper, mouse only */
  const onPointerMove = (e: React.PointerEvent) => {
    const el = magRef.current;
    const host = ref.current;
    if (!el || !host || !magnetX || reduced.current || e.pointerType !== 'mouse') return;
    const r = host.getBoundingClientRect();
    if (r.width <= 0) return;
    const rel = (e.clientX - r.left) / r.width;
    const x = Math.max(-1, Math.min(1, (rel - 0.5) * 2)) * magnetX;
    gsap.to(el, { x, duration: 0.55, ease: 'power3.out', overwrite: 'auto' });
  };
  const onPointerLeave = () => {
    const el = magRef.current;
    if (!el || !magnetX) return;
    gsap.to(el, { x: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
  };

  const splitBlur = split ? (blur ?? split === 'words') : false;
  const cls = `${split ? 'reveal-split' : line ? 'reveal-line' : 'reveal'}${
    splitBlur ? ' reveal-split--blur' : ''
  } ${className}`.trim();
  const merged = { ...style, '--d': `${delay}s` } as React.CSSProperties;

  /* content assembly — split mirror, then optional transform layers */
  let content: React.ReactNode;
  if (split) {
    const fullText = textOf(children);
    content = (
      <>
        <span className="motion-sr-only">{fullText}</span>
        <SplitUnits text={fullText} mode={split} delay={delay} stagger={stagger} />
      </>
    );
  } else if (line) {
    content = <span>{children}</span>;
  } else {
    content = children;
  }
  if (magnetX) {
    content = (
      <span ref={magRef} className="reveal-magnet">
        {content}
      </span>
    );
  }
  if (parallax) {
    content = (
      <span ref={auxRef} className="reveal-aux">
        {content}
      </span>
    );
  }

  const a11y = split ? { 'aria-label': textOf(children) } : {};
  const handlers = magnetX
    ? { onPointerMove, onPointerLeave: onPointerLeave as React.PointerEventHandler }
    : {};

  return (
    // @ts-expect-error polymorphic tag
    <Tag ref={ref} className={cls} style={merged} {...a11y} {...handlers}>
      {content}
    </Tag>
  );
}
