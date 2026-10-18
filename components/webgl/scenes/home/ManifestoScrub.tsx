'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { getSectionProgress } from '../../scroll-store';
import { COPY, SCRUB_DAMP, range } from './timeline';

/**
 * ManifestoScrub — the DOM half of the wrecking-ball moment.
 *
 * The statement is scrubbed word by word by the `manifesto` section's
 * progress (same damping as the GL scene), so "So we removed them."
 * lands on the frame the ball meets the tower. On impact, the commas
 * between the five disciplines (the boundaries) dissolve out of the
 * sentence and the list recedes. Copy is verbatim from content;
 * the full sentence is mirrored for screen readers. Reduced motion
 * renders the settled final state.
 */

type Token = { text: string; kind: 'word' | 'mark' };
type Part = 'lead' | 'accent' | 'punch';

/* the commas between the five disciplines are the boundaries */
const MARKS = /^,+$/;

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    if (MARKS.test(raw)) {
      out.push({ text: raw, kind: 'mark' });
      continue;
    }
    const m = raw.match(/^(.*?)([,]+)$/);
    if (m && m[1]) {
      out.push({ text: m[1], kind: 'word' });
      out.push({ text: m[2], kind: 'mark' });
    } else out.push({ text: raw, kind: 'word' });
  }
  return out;
}

export default function ManifestoScrub({
  eyebrow,
  lead,
  accent,
  punch,
  body,
}: {
  eyebrow: string;
  lead: string;
  accent: string;
  punch: string;
  body: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const parts = useMemo(
    () => ({ lead: tokenize(lead), accent: tokenize(accent), punch: tokenize(punch) }),
    [lead, accent, punch],
  );

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const words = Array.from(el.querySelectorAll<HTMLElement>('[data-w]'));
    const marks = Array.from(el.querySelectorAll<HTMLElement>('[data-mark]'));
    const leadEl = el.querySelector<HTMLElement>('[data-part="lead"]');
    const bodyEl = el.querySelector<HTMLElement>('[data-body]');
    const last = new Float32Array(words.length).fill(-1);
    const state = { p: 0, lastMark: -1, lastRecede: -1, lastBody: -1 };

    const apply = (p: number) => {
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const part = w.dataset.part as Part;
        const cue = COPY[part];
        const idx = Number(w.dataset.w);
        const k = range(p, cue.from + idx * cue.step, cue.from + idx * cue.step + cue.span);
        if (Math.abs(k - last[i]) < 0.002) continue;
        last[i] = k;
        w.style.setProperty('--k', k.toFixed(3));
      }
      const b = range(p, COPY.boundaries[0], COPY.boundaries[1]);
      if (Math.abs(b - state.lastMark) > 0.002) {
        state.lastMark = b;
        for (const mk of marks) mk.style.setProperty('--b', b.toFixed(3));
      }
      const r = range(p, COPY.recede[0], COPY.recede[1]);
      if (leadEl && Math.abs(r - state.lastRecede) > 0.002) {
        state.lastRecede = r;
        leadEl.style.setProperty('--r', r.toFixed(3));
      }
      const bo = range(p, COPY.body[0], COPY.body[1]);
      if (bodyEl && Math.abs(bo - state.lastBody) > 0.002) {
        state.lastBody = bo;
        bodyEl.style.setProperty('--k', bo.toFixed(3));
      }
    };

    if (reduced) {
      apply(1);
      return;
    }
    el.classList.add('is-scrub');
    state.p = getSectionProgress('manifesto');
    apply(state.p);
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const target = getSectionProgress('manifesto');
      state.p += (target - state.p) * SCRUB_DAMP;
      if (Math.abs(target - state.p) < 0.00005) state.p = target;
      apply(state.p);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [parts]);

  const renderPart = (part: Part, className: string) => {
    let wi = 0;
    return (
      <span className={className} data-part={part}>
        {parts[part].map((tok, i) => {
          /* commas hug their word; everything else takes a leading space */
          const gap = i > 0 && tok.kind !== 'mark' ? ' ' : '';
          return tok.kind === 'mark' ? (
            <React.Fragment key={i}>
              {gap}
              <span className="home-m-mark" data-mark="">
                {tok.text}
              </span>
            </React.Fragment>
          ) : (
            <React.Fragment key={i}>
              {gap}
              <span className="home-m-word" data-w={wi++} data-part={part}>
                <span className="home-m-word-inner">{tok.text}</span>
              </span>
            </React.Fragment>
          );
        })}
      </span>
    );
  };

  return (
    <div ref={root} className="home-manifesto-stage">
      <div className="home-manifesto-copy container-x">
        <p className="micro-label">{eyebrow}</p>
        <p className="display-2 home-manifesto-statement">
          <span className="motion-sr-only">{`${lead} ${accent} ${punch}`}</span>
          <span aria-hidden="true">
            {renderPart('lead', 'home-m-lead')} {renderPart('accent', 'home-m-accent text-accent')}{' '}
            {renderPart('punch', 'home-m-punch')}
          </span>
        </p>
        <p className="body-lg home-manifesto-body" data-body="">
          {body}
        </p>
      </div>
    </div>
  );
}
