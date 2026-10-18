'use client';

import React, { useEffect, useRef } from 'react';
import { useScrollStore } from '@/components/webgl/scroll-store';

/**
 * ReadingProgress — the hairline bar fixed under the nav.
 * A rAF loop reads the scroll store's scrollY TRANSIENTLY against the
 * document height and writes scaleX straight to the bar element — no
 * React state per frame. SSR-safe (DOM touched only inside effects) and
 * reduced-motion safe (it animates nothing of its own — it only mirrors
 * the scroll position, instantly, with no transitions).
 */
export default function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const bar = barRef.current;
      if (!bar) return;
      const y = useScrollStore.getState().scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      if (Math.abs(p - last) < 0.0005) return;
      last = p;
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="art-progress" aria-hidden="true">
      <div ref={barRef} className="art-progress__bar" />
    </div>
  );
}
