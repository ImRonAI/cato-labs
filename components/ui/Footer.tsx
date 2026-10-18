'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { footer } from '@/lib/content';
import { scrollToTarget } from '@/components/webgl/ScrollDirector';
import Reveal from './Reveal';

/**
 * Footer — the closing frame.
 * Its one moment: the wordmark arrives loose (wide tracking, letters
 * risen out of a mask) and settles into its set as the reader reaches the
 * end of the page, scrubbed and reversible. A soft electric light inside
 * the letters follows the cursor. Reduced motion: the set wordmark, still.
 */
export default function Footer() {
  const wordRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wordRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      el.style.setProperty('--settle', '1');
      return;
    }
    let raf = 0;
    let cur = -1;
    let visible = false;
    const tick = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      /* 0 when the word's top meets the viewport bottom → 1 at 35% from the top */
      const t = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.65)));
      const next = cur < 0 ? t : cur + (t - cur) * 0.12;
      if (Math.abs(next - cur) > 0.0005) {
        cur = next;
        el.style.setProperty('--settle', cur.toFixed(4));
      }
      if (visible && Math.abs(t - cur) > 0.0005) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        kick();
      },
      { rootMargin: '0px 0px 10% 0px' },
    );
    io.observe(el);
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick, { passive: true });
    tick();
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', kick);
      window.removeEventListener('resize', kick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const onWordMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--fx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(2)}%`);
    el.style.setProperty('--fy', `${(((e.clientY - r.top) / r.height) * 100).toFixed(2)}%`);
    el.classList.add('is-lit');
  };
  const onWordLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('is-lit');
  };

  const letters = Array.from(footer.wordmark);
  const mid = (letters.length - 1) / 2;

  return (
    <footer className="footer">
      <div className="container-x section-y-sm">
        <div
          ref={wordRef}
          className="footer-word footer-word--settle"
          aria-hidden="true"
          onPointerMove={onWordMove}
          onPointerLeave={onWordLeave}
        >
          {letters.map((ch, i) => (
            <span
              key={i}
              className="footer-word__ch"
              style={{ '--o': (i - mid) / Math.max(mid, 1), '--k': Math.abs(i - mid) / Math.max(mid, 1) } as React.CSSProperties}
            >
              {ch === ' ' ? '\u00a0' : ch}
            </span>
          ))}
          <span className="footer-word__light" />
        </div>
        <Reveal>
          <p className="lede" style={{ marginTop: 18 }}>
            {footer.line}
          </p>
        </Reveal>

        <hr className="rule" style={{ margin: '56px 0' }} />

        <div className="footer-grid">
          {footer.columns.map((col) => (
            <div key={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h4>Signal</h4>
            <ul>
              <li>
                <a href="mailto:hello@catolabs.com">hello@catolabs.com</a>
              </li>
              <li>
                <Link href="/llms.txt" prefetch={false}>
                  llms.txt
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <hr className="rule" style={{ margin: '56px 0 28px' }} />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <p className="text-dim" style={{ fontSize: 13.5 }}>
            {footer.copyright}
          </p>
          <button
            className="link-line footer-top"
            style={{ fontSize: 13.5 }}
            onClick={() => scrollToTarget(0)}
          >
            Back to the light <span className="footer-top__arrow" aria-hidden="true">↑</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
