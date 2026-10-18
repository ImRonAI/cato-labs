'use client';

import React, { useEffect, useRef } from 'react';
import { useScrollStore } from '../../../scroll-store';
import { MOMENT_ID, readMoment, type MomentState } from './moment';

/**
 * MomentMeter — publishes the moment's timeline to CSS as `--rb-t` (0→1)
 * and `--rb-w` (stage weight) on its wrapper. Store subscription lives in
 * an effect and writes style properties directly: no React re-renders.
 */
export default function MomentMeter({ children }: { children: React.ReactNode }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const m: MomentState = { t: 0, w: 0, p: 0 };
    let last = -1;
    const apply = () => {
      readMoment(m);
      const key = Math.round(m.t * 1000) + Math.round(m.w * 1000) * 2000;
      if (key === last) return;
      last = key;
      node.style.setProperty('--rb-t', m.t.toFixed(4));
      node.style.setProperty('--rb-w', m.w.toFixed(4));
    };
    apply();
    return useScrollStore.subscribe((s, prev) => {
      if (s.sections[MOMENT_ID] !== prev.sections[MOMENT_ID]) apply();
    });
  }, []);

  return (
    <div ref={el} className="rb-moment__meter">
      {children}
    </div>
  );
}
