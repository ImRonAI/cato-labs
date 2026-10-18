'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { CtaButton } from '@/components/ui/Magnetic';
import { useScrollStore } from '@/components/webgl/scroll-store';
import './kit.css';

/* ------------------------------------------------------------------ */
/*  ProactiveBubble — the agent that speaks first.                     */
/*                                                                     */
/*  Appears bottom-right after `delayMs` of dwell time, or earlier     */
/*  when `triggerSection` (a data-scene-section id) crosses the        */
/*  viewport middle — read transiently from the scroll store with a    */
/*  single subscription. Dismissal is remembered per pathname in       */
/*  sessionStorage; navigating re-arms the bubble.                     */
/* ------------------------------------------------------------------ */

function prefersReduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function ProactiveBubble({
  agentName,
  message,
  ctaLabel,
  ctaHref,
  delayMs = 9000,
  triggerSection,
  avatarHue = '#2e4bff',
}: {
  agentName: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  delayMs?: number;
  triggerSection?: string;
  avatarHue?: string;
}): React.JSX.Element | null {
  const pathname = usePathname();
  const [phase, setPhase] = useState<'armed' | 'open' | 'dismissed'>('armed');
  const [typed, setTyped] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(false);

  const storageKey = `cato-bubble-dismissed:${pathname}`;

  /* arm (and re-arm on route change) + dwell timer */
  useEffect(() => {
    shownRef.current = false;
    setTyped('');
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(storageKey) === '1';
    } catch {
      /* storage unavailable — stay armed */
    }
    if (dismissed) {
      setPhase('dismissed');
      return;
    }
    setPhase('armed');
    const t = window.setTimeout(() => {
      if (!shownRef.current) {
        shownRef.current = true;
        setPhase('open');
      }
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [pathname, delayMs, storageKey]);

  /* scroll trigger: section progress crossing viewport middle (0.5) */
  useEffect(() => {
    if (!triggerSection) return;
    const tryShow = (p: number) => {
      if (shownRef.current || p < 0.5) return;
      shownRef.current = true;
      setPhase((ph) => (ph === 'armed' ? 'open' : ph));
    };
    tryShow(useScrollStore.getState().sections[triggerSection]?.progress ?? 0);
    const unsub = useScrollStore.subscribe((state) => {
      tryShow(state.sections[triggerSection]?.progress ?? 0);
    });
    return unsub;
  }, [triggerSection, pathname]);

  /* message types itself once open */
  useEffect(() => {
    if (phase !== 'open') return;
    if (prefersReduced()) {
      setTyped(message);
      return;
    }
    setTyped('');
    let i = 0;
    const iv = window.setInterval(() => {
      i += 1;
      setTyped(message.slice(0, i));
      if (i >= message.length) window.clearInterval(iv);
    }, 18);
    return () => window.clearInterval(iv);
  }, [phase, message]);

  /* spring-up entrance (one cycle; pulse ring is pure CSS) */
  useEffect(() => {
    if (phase !== 'open' || !cardRef.current || prefersReduced()) return;
    const tween = gsap.fromTo(
      cardRef.current,
      { y: 28, autoAlpha: 0, scale: 0.95 },
      { y: 0, autoAlpha: 1, scale: 1, duration: 0.75, ease: 'back.out(1.6)' }
    );
    return () => {
      tween.kill();
    };
  }, [phase]);

  const dismiss = () => {
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
    const el = cardRef.current;
    if (el && !prefersReduced()) {
      gsap.to(el, {
        y: 16,
        autoAlpha: 0,
        duration: 0.35,
        ease: 'power2.in',
        onComplete: () => setPhase('dismissed'),
      });
    } else {
      setPhase('dismissed');
    }
  };

  if (phase !== 'open') return null;

  const doneTyping = typed.length >= message.length;

  return (
    <div
      ref={cardRef}
      className="kit-bubble"
      role="dialog"
      aria-label={`Message from ${agentName}`}
    >
      {/* own 2D SVG robot face — visor + blinking eyes */}
      <svg className="kit-bubble-avatar" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
        <line x1="22" y1="2" x2="22" y2="7" stroke="var(--blue-300)" strokeWidth="2" />
        <circle cx="22" cy="2.5" r="2" fill={avatarHue} />
        <rect x="3" y="7" width="38" height="32" rx="10" fill="#fff" stroke="var(--blue-200)" />
        <rect x="9" y="14" width="26" height="14" rx="7" fill={avatarHue} />
        <g className="kit-bubble-eyes" fill="#fff">
          <circle cx="17" cy="21" r="2.6" />
          <circle cx="27" cy="21" r="2.6" />
        </g>
        <path
          d="M17 32.5 Q22 35.5 27 32.5"
          stroke="var(--blue-700)"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      <div className="kit-bubble-body">
        <p className="kit-bubble-name">{agentName} · Cato agent</p>
        <p className="kit-bubble-msg" aria-live="polite">
          {typed}
          {!doneTyping && <span className="kit-caret" aria-hidden="true" />}
        </p>
        <div className="kit-bubble-actions">
          <CtaButton href={ctaHref} label={ctaLabel} variant="blue" className="kit-bubble-btn" />
        </div>
      </div>

      <button type="button" className="kit-bubble-close" onClick={dismiss} aria-label="Dismiss message">
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export default ProactiveBubble;
