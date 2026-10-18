'use client';

import React, { useEffect, useRef } from 'react';
import { getSectionProgress } from '../../../scroll-store';
import { MOMENT_ID, dwellHeight, momentT } from './dwell';
import './stage.css';

/**
 * RegionStage — the dwell that hosts a region's signature scroll moment.
 *
 * An empty, tall section (`data-scene-section="moment"`) whose sticky inner
 * leaves the viewport to the WebGL set piece. The only DOM is a quiet foot:
 * a micro-label, a hairline that fills with the moment's progress and an
 * optional caption or counter. The hairline reads the same progress the
 * scene scrubs, so the two can never drift apart.
 */
export default function RegionStage({
  label,
  caption,
  count,
  ariaLabel,
}: {
  label: string;
  caption?: string;
  /** when set, the foot shows "NN / total" stepping with the moment */
  count?: number;
  ariaLabel: string;
}) {
  const barRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      if (countRef.current && count) countRef.current.textContent = pad(count);
      return;
    }
    const compactMq = window.matchMedia('(max-width: 820px)');
    let raf = 0;
    let lastT = -1;
    const tick = () => {
      const t = momentT(getSectionProgress(MOMENT_ID), dwellHeight(compactMq.matches));
      if (Math.abs(t - lastT) > 0.0005) {
        lastT = t;
        if (barRef.current) barRef.current.style.transform = `scaleX(${t.toFixed(4)})`;
        if (countRef.current && count) {
          countRef.current.textContent = pad(Math.min(count, Math.floor(t * count * 1.02)));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count]);

  return (
    <section data-scene-section={MOMENT_ID} className="rgs-stage" aria-label={ariaLabel}>
      <div className="rgs-stage__pin">
        <div className="container-x rgs-stage__foot" aria-hidden="true">
          <span className="micro-label">{label}</span>
          <span className="rgs-stage__track">
            <span ref={barRef} className="rgs-stage__bar" />
          </span>
          {count ? (
            <span className="micro-label rgs-stage__caption">
              <span ref={countRef}>00</span> / {pad(count)}
            </span>
          ) : caption ? (
            <span className="micro-label rgs-stage__caption">{caption}</span>
          ) : (
            <span />
          )}
        </div>
      </div>
    </section>
  );
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}
