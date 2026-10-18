'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import gsap from 'gsap';
import { veilBus } from '@/components/webgl/scroll-store';

/**
 * Magnetic — wraps a button/link with a gravitational cursor pull.
 * The shell follows the cursor; the label inside travels a little further
 * (depth parallax), and a soft light tracks the pointer across the surface
 * via --mx/--my. Fine pointers only; touch and reduced-motion users get the
 * plain element.
 */
export default function Magnetic({
  children,
  strength = 0.32,
  className,
}: {
  children: React.ReactElement;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = useRef(false);
  const movers = useRef<{
    x: (v: number) => void;
    y: (v: number) => void;
    ix?: (v: number) => void;
    iy?: (v: number) => void;
  } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    enabled.current = fine && !reduced;
    if (!enabled.current) return;
    const inner = el.querySelector<HTMLElement>('.btn-label');
    movers.current = {
      x: gsap.quickTo(el, 'x', { duration: 0.7, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 0.7, ease: 'power3.out' }),
      ix: inner ? gsap.quickTo(inner, 'x', { duration: 0.8, ease: 'power3.out' }) : undefined,
      iy: inner ? gsap.quickTo(inner, 'y', { duration: 0.8, ease: 'power3.out' }) : undefined,
    };
    return () => {
      gsap.killTweensOf(el);
      if (inner) gsap.killTweensOf(inner);
      movers.current = null;
    };
  }, []);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    const m = movers.current;
    if (!el || !m || !enabled.current || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    /* subtract the current offset so the light sits under the real cursor */
    const ox = Number(gsap.getProperty(el, 'x')) || 0;
    const oy = Number(gsap.getProperty(el, 'y')) || 0;
    const left = r.left - ox;
    const top = r.top - oy;
    const x = e.clientX - (left + r.width / 2);
    const y = e.clientY - (top + r.height / 2);
    m.x(x * strength);
    m.y(y * strength);
    m.ix?.(x * strength * 0.35);
    m.iy?.(y * strength * 0.35);
    el.style.setProperty('--mx', `${(e.clientX - left).toFixed(1)}px`);
    el.style.setProperty('--my', `${(e.clientY - top).toFixed(1)}px`);
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el || !enabled.current) return;
    const inner = el.querySelector<HTMLElement>('.btn-label');
    gsap.to(el, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.38)', overwrite: true });
    if (inner) gsap.to(inner, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.38)', overwrite: true });
  };

  return (
    <div
      ref={ref}
      className={`magnetic${className ? ` ${className}` : ''}`}
      style={{ display: 'inline-block', willChange: 'transform' }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </div>
  );
}

/** Primary CTA link with arrow — the standard Cato button. */
export function CtaButton({
  href,
  label,
  variant = 'ink',
  className = '',
}: {
  href: string;
  label: string;
  variant?: 'ink' | 'blue' | 'ghost';
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const cls =
    variant === 'blue' ? 'btn btn--blue' : variant === 'ghost' ? 'btn btn--ghost' : 'btn';

  /* internal route changes pass under the light veil, same as the nav */
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (!href.startsWith('/') || href.includes('#') || href === pathname) return;
    e.preventDefault();
    veilBus.cover();
    window.setTimeout(() => router.push(href), 420);
  };

  return (
    <Magnetic>
      <Link href={href} className={`${cls} ${className}`.trim()} onClick={onClick}>
        <span className="btn-label">{label}</span>
        <span className="btn-arrow" aria-hidden="true">
          <span className="btn-arrow__a">→</span>
          <span className="btn-arrow__b">→</span>
        </span>
      </Link>
    </Magnetic>
  );
}
