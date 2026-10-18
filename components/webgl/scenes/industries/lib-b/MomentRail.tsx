'use client';

import React, { useEffect, useRef } from 'react';
import { useScrollStore } from '../../../scroll-store';
import { MOMENT_ID, momentLocalFromProgress } from './stage';
import './moment-rail.css';

/**
 * MomentRail — the dwell that gives a page's signature scroll moment room.
 *
 * A tall block (`--mrail-dwell`, 280vh) tracked as `data-scene-section="moment"`
 * with a 100vh sticky stage inside. The stage is deliberately empty: the GL
 * layer is the content. A hairline at the foot fills with the moment's own
 * clock and a small label (existing copy) anchors it, so the viewer knows the
 * scroll is doing something. Reduced motion collapses the dwell to one
 * screen (the scene renders its composed final state).
 */
export default function MomentRail({ label, index }: { label: string; index?: string }) {
  const fill = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = fill.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.transform = 'scaleX(1)';
      return;
    }
    let raf = 0;
    let v = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = useScrollStore.getState().sections[MOMENT_ID];
      if (!s || !s.active) return;
      const t = momentLocalFromProgress(s.progress);
      if (Math.abs(t - v) < 0.0005) return;
      v = t;
      el.style.transform = `scaleX(${t.toFixed(4)})`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section data-scene-section={MOMENT_ID} className="mrail" aria-hidden="true">
      <div className="mrail__stage">
        <div className="container-x mrail__foot">
          <span className="micro-label micro-label--ink mrail__label">
            {index ? <span className="mrail__index">{index}</span> : null}
            {label}
          </span>
          <span className="mrail__track">
            <span ref={fill} className="mrail__fill" />
          </span>
        </div>
      </div>
    </section>
  );
}
