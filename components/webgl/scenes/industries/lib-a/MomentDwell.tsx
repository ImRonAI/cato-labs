'use client';

import React, { useEffect, useRef } from 'react';
import { getSectionProgress } from '../../../scroll-store';
import { createPhases, phasesFrom, dwellVh } from './stage';
import './moment.css';

/**
 * MomentDwell — the scroll room for an industries signature moment.
 *
 * An outer section (300vh desktop / 220vh compact, tracked by ScrollDirector
 * under `id`) with a sticky 100vh stage. The GL scene plays the moment from
 * the section's progress; this component only renders a quiet legend along
 * the bottom edge: the steps (copy passed in from the page's deck) light in
 * sequence on a hairline that fills with the moment. Progress is written to
 * CSS variables from a rAF loop — no React state per frame.
 */
export default function MomentDwell({
  id = 'moment',
  label,
  ariaLabel,
  steps = [],
  total,
}: {
  id?: string;
  /** the micro-label at the legend's left (deck copy) */
  label: string;
  ariaLabel: string;
  /** step captions lit in order across the moment (deck copy) */
  steps?: string[];
  /** when set, show an NN / total counter that tracks the moment */
  total?: number;
}) {
  const root = useRef<HTMLElement>(null);
  const counter = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const compactMq = window.matchMedia('(max-width: 820px)');
    const ph = createPhases();
    const n = steps.length;
    let raf = 0;
    let lastStep = -2;
    let lastCount = -1;

    const tick = () => {
      const play = reduced ? 1 : phasesFrom(getSectionProgress(id), dwellVh(compactMq.matches), ph).play;
      el.style.setProperty('--moment', play.toFixed(4));
      if (n > 0) {
        const step = play <= 0.001 ? -1 : Math.min(n - 1, Math.floor(play * n * 0.999));
        if (step !== lastStep) {
          el.dataset.step = String(step);
          el.querySelectorAll<HTMLElement>('.ia-dwell__step').forEach((li, i) => {
            li.dataset.state = i < step ? 'done' : i === step ? 'on' : 'off';
          });
          lastStep = step;
        }
      }
      if (total && counter.current) {
        const c = Math.round(play * total);
        if (c !== lastCount) {
          counter.current.textContent = String(c).padStart(2, '0');
          lastCount = c;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id, steps.length, total]);

  return (
    <section
      ref={root}
      data-scene-section={id}
      className="ia-dwell"
      aria-label={ariaLabel}
      data-step="-1"
    >
      <div className="ia-dwell__stage">
        <div className="container-x ia-dwell__legend">
          <p className="micro-label ia-dwell__label">{label}</p>
          {total ? (
            <p className="ia-dwell__count" aria-hidden="true">
              <span ref={counter}>00</span>
              <span className="ia-dwell__of"> / {String(total).padStart(2, '0')}</span>
            </p>
          ) : null}
          {steps.length > 0 && (
            <ol className="ia-dwell__steps">
              {steps.map((s, i) => (
                <li key={s} className="ia-dwell__step" style={{ '--i': i, '--n': steps.length } as React.CSSProperties}>
                  <span className="index-no">{String(i + 1).padStart(2, '0')}</span>
                  <span className="ia-dwell__step-title">{s}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="ia-dwell__rail" aria-hidden="true">
            <span className="ia-dwell__fill" />
          </div>
        </div>
      </div>
    </section>
  );
}
