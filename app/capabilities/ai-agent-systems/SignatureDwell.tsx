'use client';

import React, { useEffect, useRef } from 'react';
import { useScrollStore } from '@/components/webgl/scroll-store';
import './signature.css';

/**
 * SignatureDwell — the scroll room for a page's signature GL moment.
 *
 * A tall section (280vh) whose inner stage is sticky for 100vh. The WebGL
 * scene reads this section's progress (data-scene-section={id}) and scrubs
 * its physical event across the pinned phase. The DOM only carries a quiet
 * legend: the page's own feature titles (from lib/content, passed in by the
 * server page) light up in step with the event, plus a hairline progress
 * rule. No state per frame — a rAF loop toggles classes and one CSS var.
 *
 * Timing constants mirror components/webgl/scenes/capabilities/children/agents/signature.ts.
 */

const DWELL_VH = 280;
const SPAN = DWELL_VH + 100;
const STICK_IN = 100 / SPAN;
const STICK_OUT = DWELL_VH / SPAN;

export default function SignatureDwell({
  id = 'signature',
  label,
  steps,
  /** play-progress at which each step lights (0..1), defaults to even spacing */
  at,
  align = 'left',
}: {
  id?: string;
  label: string;
  steps: string[];
  at?: number[];
  align?: 'left' | 'right';
}) {
  const rootRef = useRef<HTMLElement>(null);
  const itemsRef = useRef<(HTMLLIElement | null)[]>([]);
  const thresholds = at ?? steps.map((_, i) => (i + 0.6) / (steps.length + 0.4));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('sig--static');
      root.style.setProperty('--sig-p', '1');
      return;
    }
    let raf = 0;
    let lastP = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const raw = useScrollStore.getState().sections[id]?.progress ?? 0;
      const span = STICK_OUT - 0.05 - (STICK_IN + 0.01);
      const p = Math.min(1, Math.max(0, (raw - (STICK_IN + 0.01)) / span));
      if (Math.abs(p - lastP) < 0.0015) return;
      lastP = p;
      root.style.setProperty('--sig-p', p.toFixed(4));
      for (let i = 0; i < itemsRef.current.length; i++) {
        const li = itemsRef.current[i];
        if (!li) continue;
        const on = p >= thresholds[i];
        const next = thresholds[i + 1] ?? 2;
        li.classList.toggle('is-lit', on);
        li.classList.toggle('is-current', on && p < next);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // thresholds derive from props that never change after mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <section
      ref={rootRef}
      data-scene-section={id}
      className={`sig sig--${align}`}
      style={{ minHeight: `${DWELL_VH}vh` }}
      aria-label={label}
    >
      <div className="sig-stage">
        <div className="container-x sig-legend-wrap">
          <div className="sig-legend">
            <p className="micro-label sig-label">{label}</p>
            <ol className="sig-steps">
              {steps.map((s, i) => (
                <li
                  key={s}
                  ref={(el) => {
                    itemsRef.current[i] = el;
                  }}
                  className="sig-step"
                >
                  <span className="index-no sig-step-no">{String(i + 1).padStart(2, '0')}</span>
                  <span className="sig-step-title">{s}</span>
                </li>
              ))}
            </ol>
            <div className="sig-rule" aria-hidden="true">
              <span className="sig-rule-fill" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
