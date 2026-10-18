'use client';

import React, { useEffect, useRef } from 'react';
import { getSectionProgress, sectionRange } from '@/components/webgl/scroll-store';
import './dwell.css';

export interface DwellStep {
  index: string;
  title: string;
  meta?: string;
}

/**
 * DwellSteps — the DOM half of a pinned signature moment.
 * A quiet ordered list that lights up item by item as the GL set piece
 * reaches each beat (`marks`, in pinned-progress units 0..1), plus a
 * hairline progress track. Reads the scroll store transiently in rAF and
 * only touches the DOM when a state changes — no React state per frame.
 * `from`/`to` is the section-progress window in which the section is pinned
 * (a 300vh section with a 100vh sticky inner pins between 0.25 and 0.75).
 */
export default function DwellSteps({
  section,
  label,
  steps,
  marks,
  from = 0.25,
  to = 0.75,
}: {
  section: string;
  label: string;
  steps: DwellStep[];
  marks: number[];
  from?: number;
  to?: number;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-step]'));
    const bar = el.querySelector<HTMLElement>('[data-bar]');
    const states = items.map(() => '');
    let raf = 0;
    let lastT = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = sectionRange(getSectionProgress(section), from, to);
      if (Math.abs(t - lastT) < 0.0004) return;
      lastT = t;
      if (bar) bar.style.transform = `scaleX(${t.toFixed(4)})`;
      let current = -1;
      for (let i = 0; i < items.length; i++) if (t >= (marks[i] ?? 1)) current = i;
      for (let i = 0; i < items.length; i++) {
        const s = i < current ? 'done' : i === current ? 'current' : 'idle';
        if (s !== states[i]) {
          states[i] = s;
          items[i].dataset.state = s;
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [section, from, to, marks]);

  return (
    <div ref={root} className="dw-steps">
      <p className="micro-label">{label}</p>
      <ol className="dw-steps__list">
        {steps.map((s) => (
          <li key={s.index} data-step data-state="idle" className="dw-steps__item">
            <span className="index-no dw-steps__no">{s.index}</span>
            <span className="dw-steps__text">
              <span className="dw-steps__title">{s.title}</span>
              {s.meta && <span className="dw-steps__meta">{s.meta}</span>}
            </span>
          </li>
        ))}
      </ol>
      <div className="dw-steps__track" aria-hidden="true">
        <div data-bar className="dw-steps__bar" />
      </div>
    </div>
  );
}
