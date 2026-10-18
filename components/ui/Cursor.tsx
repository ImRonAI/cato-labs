'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const INTERACTIVE = 'a, button, summary, [role="button"], input, textarea, select, label';

/**
 * Cursor — a quiet companion to the native pointer, never a replacement.
 * A hairline electric ring trails the cursor with a damped lag and only
 * appears over things you can act on; it tightens on press. Fine pointers
 * only; touch and reduced-motion users never mount it.
 */
export default function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    const toX = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
    const toY = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });
    let placed = false;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      if (!placed) {
        gsap.set(el, { x: e.clientX, y: e.clientY });
        placed = true;
      }
      toX(e.clientX);
      toY(e.clientY);
      const target = e.target as Element | null;
      const hit = target?.closest?.(INTERACTIVE);
      el.classList.toggle('is-hover', !!hit);
      el.classList.add('is-on');
    };
    const onDown = () => el.classList.add('is-down');
    const onUp = () => el.classList.remove('is-down');
    const onLeave = () => el.classList.remove('is-on', 'is-hover');

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      gsap.killTweensOf(el);
    };
  }, []);

  return (
    <div ref={ref} className="cursor" aria-hidden="true">
      <span className="cursor__ring" />
    </div>
  );
}
