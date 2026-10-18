'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import './kit.css';

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/*                                                                     */
/*  All coordinates are percents of the stage (0–100 in both axes).    */
/*  SVG `stroke` paths are authored in the same 0–100 space (the       */
/*  stage SVG uses viewBox="0 0 100 100", preserveAspectRatio="none"). */
/* ------------------------------------------------------------------ */

export interface StreamAgent {
  id: string;
  name: string;
  role: string;
  color: string;
}

export type StreamStep =
  | { type: 'cursor'; agent: string; to: { x: number; y: number }; dur?: number }
  | {
      type: 'rect';
      agent: string;
      id: string;
      at: { x: number; y: number; w: number; h: number };
      style: 'wire' | 'fill' | 'glass';
      label?: string;
      dur?: number;
    }
  | { type: 'stroke'; agent: string; id: string; path: string; dur?: number }
  | {
      type: 'text';
      agent: string;
      id: string;
      at: { x: number; y: number };
      content: string;
      style: 'h1' | 'h2' | 'body' | 'label' | 'button';
      dur?: number;
    }
  | {
      type: 'image';
      agent: string;
      id: string;
      at: { x: number; y: number; w: number; h: number };
      seed?: string;
      dur?: number;
    }
  | { type: 'wait'; ms: number }
  | { type: 'parallel'; steps: StreamStep[] };

/* ------------------------------------------------------------------ */
/*  Internal entity model (flattened from the script)                  */
/* ------------------------------------------------------------------ */

type Entity =
  | {
      kind: 'rect';
      id: string;
      at: { x: number; y: number; w: number; h: number };
      rstyle: 'wire' | 'fill' | 'glass';
      label?: string;
      agent: string;
    }
  | { kind: 'stroke'; id: string; path: string; agent: string }
  | {
      kind: 'text';
      id: string;
      at: { x: number; y: number };
      content: string;
      tstyle: 'h1' | 'h2' | 'body' | 'label' | 'button';
      agent: string;
    }
  | {
      kind: 'image';
      id: string;
      at: { x: number; y: number; w: number; h: number };
      seed: string;
      agent: string;
    };

function collectEntities(script: StreamStep[]): Entity[] {
  const out: Entity[] = [];
  const walk = (steps: StreamStep[]) => {
    for (const s of steps) {
      if (s.type === 'parallel') walk(s.steps);
      else if (s.type === 'rect')
        out.push({ kind: 'rect', id: s.id, at: s.at, rstyle: s.style, label: s.label, agent: s.agent });
      else if (s.type === 'stroke')
        out.push({ kind: 'stroke', id: s.id, path: s.path, agent: s.agent });
      else if (s.type === 'text')
        out.push({ kind: 'text', id: s.id, at: s.at, content: s.content, tstyle: s.style, agent: s.agent });
      else if (s.type === 'image')
        out.push({ kind: 'image', id: s.id, at: s.at, seed: s.seed ?? s.id, agent: s.agent });
    }
  };
  walk(script);
  return out;
}

/* ------------------------------------------------------------------ */
/*  Seeded generative art (blue spectrum only, no photos)              */
/* ------------------------------------------------------------------ */

const BLUE_STOPS = [
  '#f4f7ff', '#e8eeff', '#dce4ff', '#b9c9ff', '#93a9ff',
  '#6b87ff', '#2e4bff', '#1f38e0', '#1226c8', '#0a1890',
];

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function GenerativeArt({ seed }: { seed: string }): React.JSX.Element {
  const rawId = React.useId();
  const gid = `kit-g-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  const art = useMemo(() => {
    const rnd = mulberry32(hashSeed(seed));
    const pick = (lo: number, hi: number) =>
      BLUE_STOPS[lo + Math.floor(rnd() * (hi - lo + 1))];
    const items: React.ReactNode[] = [];
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const kind = rnd();
      const cx = rnd() * 100;
      const cy = rnd() * 100;
      if (kind < 0.45) {
        const r = 8 + rnd() * 26;
        items.push(
          <circle key={i} cx={cx} cy={cy} r={r} fill={pick(2, 7)} opacity={0.35 + rnd() * 0.45} />
        );
      } else if (kind < 0.75) {
        const w = 14 + rnd() * 30;
        const h = 10 + rnd() * 26;
        items.push(
          <rect
            key={i}
            x={cx - w / 2}
            y={cy - h / 2}
            width={w}
            height={h}
            rx={3}
            fill={pick(1, 6)}
            opacity={0.4 + rnd() * 0.4}
            transform={`rotate(${(rnd() * 40 - 20).toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})`}
          />
        );
      } else {
        const r = 10 + rnd() * 22;
        const a0 = rnd() * Math.PI * 2;
        const a1 = a0 + 1 + rnd() * 2.5;
        items.push(
          <path
            key={i}
            d={`M ${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)}`}
            fill="none"
            stroke={pick(5, 9)}
            strokeWidth={2.5}
            opacity={0.7}
            vectorEffect="non-scaling-stroke"
          />
        );
      }
    }
    const hy = 62 + rnd() * 24;
    items.push(
      <line
        key="horizon"
        x1={0}
        y1={hy}
        x2={100}
        y2={hy}
        stroke={pick(3, 5)}
        strokeWidth={1}
        opacity={0.6}
        vectorEffect="non-scaling-stroke"
      />
    );
    return { items, g0: pick(0, 2), g1: pick(4, 6) };
  }, [seed]);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={art.g0} />
          <stop offset="1" stopColor={art.g1} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gid})`} />
      {art.items}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  StreamSimulator                                                    */
/* ------------------------------------------------------------------ */

export function StreamSimulator({
  script,
  agents,
  autoPlay = true,
  loop = false,
  onDone,
  brand,
}: {
  script: StreamStep[];
  agents: StreamAgent[];
  autoPlay?: boolean;
  loop?: boolean;
  onDone?: () => void;
  brand?: { name: string; domain: string };
}): React.JSX.Element {
  const scriptKey = useMemo(() => JSON.stringify(script), [script]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entities = useMemo(() => collectEntities(script), [scriptKey]);

  const elRefs = useRef(new Map<string, Element>());
  const textRefs = useRef(new Map<string, HTMLSpanElement>());
  const caretRefs = useRef(new Map<string, HTMLSpanElement>());
  const cursorRefs = useRef(new Map<string, HTMLDivElement>());
  const barRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const brandName = brand?.name ?? 'Your brand';
  const domain = brand?.domain ?? 'your-next-site.com';

  const agentColor = (id: string) =>
    agents.find((a) => a.id === id)?.color ?? 'var(--blue-600)';

  /* reduced-motion listener (client only) */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  /* build / rebuild the timeline */
  useEffect(() => {
    const els = elRefs.current;
    const texts = textRefs.current;
    const carets = caretRefs.current;
    const cursors = cursorRefs.current;

    /* final cursor positions (last cursor step per agent wins) */
    const finalCursors = new Map<string, { x: number; y: number }>();
    const walkFinal = (steps: StreamStep[]) => {
      for (const s of steps) {
        if (s.type === 'parallel') walkFinal(s.steps);
        else if (s.type === 'cursor') finalCursors.set(s.agent, s.to);
      }
    };

    const revealFinal = () => {
      entities.forEach((e) => {
        const el = els.get(e.id);
        if (el) gsap.set(el, { autoAlpha: 1, y: 0, scale: 1 });
        if (e.kind === 'rect') {
          const r = el?.querySelector('rect');
          if (r) r.setAttribute('stroke-dashoffset', '0');
          const lbl = els.get(`${e.id}__label`);
          if (lbl) gsap.set(lbl, { autoAlpha: 1, y: 0 });
        }
        if (e.kind === 'stroke' && el) el.setAttribute('stroke-dashoffset', '0');
        if (e.kind === 'text') {
          const t = texts.get(e.id);
          if (t) t.textContent = e.content;
          const c = carets.get(e.id);
          if (c) gsap.set(c, { autoAlpha: 0 });
        }
      });
      cursors.forEach((el, id) => {
        const fin = finalCursors.get(id);
        if (fin) gsap.set(el, { left: `${fin.x}%`, top: `${fin.y}%` });
      });
      if (barRef.current) barRef.current.style.transform = 'scaleX(1)';
    };

    walkFinal(script);

    if (reduced) {
      revealFinal();
      setPlaying(false);
      return;
    }

    /* ---- prep: everything hidden, dash lengths set ---- */
    entities.forEach((e) => {
      const el = els.get(e.id);
      if (!el) return;
      if (e.kind === 'rect' && e.rstyle === 'wire') {
        const r = el.querySelector('rect');
        if (r) {
          const per = 2 * (e.at.w + e.at.h);
          r.setAttribute('stroke-dasharray', String(per));
          r.setAttribute('stroke-dashoffset', String(per));
        }
        gsap.set(el, { autoAlpha: 0 });
      } else if (e.kind === 'stroke') {
        let len = 120;
        try {
          len = (el as SVGPathElement).getTotalLength();
        } catch {
          /* keep fallback */
        }
        el.setAttribute('stroke-dasharray', String(len));
        el.setAttribute('stroke-dashoffset', String(len));
        gsap.set(el, { autoAlpha: 0 });
      } else {
        gsap.set(el, { autoAlpha: 0, y: 0, scale: 1 });
      }
      if (e.kind === 'rect') {
        const lbl = els.get(`${e.id}__label`);
        if (lbl) gsap.set(lbl, { autoAlpha: 0, y: 0 });
      }
      if (e.kind === 'text') {
        const t = texts.get(e.id);
        if (t) t.textContent = '';
        const c = carets.get(e.id);
        if (c) gsap.set(c, { autoAlpha: 1 });
      }
    });
    agents.forEach((a, i) => {
      const c = cursors.get(a.id);
      if (c) gsap.set(c, { left: `${6 + i * 9}%`, top: '105%' });
    });
    if (barRef.current) barRef.current.style.transform = 'scaleX(0)';

    /* ---- timeline ---- */
    const tl = gsap.timeline({ paused: true, repeat: loop ? -1 : 0 });
    tlRef.current = tl;

    const addStep = (s: StreamStep, pos?: number): void => {
      switch (s.type) {
        case 'cursor': {
          const el = cursorRefs.current.get(s.agent);
          if (!el) return;
          tl.to(
            el,
            {
              left: `${s.to.x}%`,
              top: `${s.to.y}%`,
              duration: s.dur ?? 0.9,
              ease: 'back.out(1.5)',
            },
            pos
          );
          break;
        }
        case 'rect': {
          const el = els.get(s.id);
          if (!el) return;
          const dur = s.dur ?? (s.style === 'wire' ? 1 : 0.7);
          if (s.style === 'wire') {
            const r = el.querySelector('rect') ?? el;
            tl.set(el, { autoAlpha: 1 }, pos);
            tl.to(
              r,
              { attr: { 'stroke-dashoffset': 0 }, duration: dur, ease: 'power2.inOut' },
              pos
            );
          } else {
            tl.fromTo(
              el,
              { autoAlpha: 0, y: 1.6 },
              { autoAlpha: 1, y: 0, duration: dur, ease: 'power3.out' },
              pos
            );
          }
          const lbl = els.get(`${s.id}__label`);
          if (lbl) {
            tl.fromTo(
              lbl,
              { autoAlpha: 0, y: 4 },
              { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out' },
              typeof pos === 'number' ? pos + dur * 0.55 : `>-${(dur * 0.45).toFixed(2)}`
            );
          }
          break;
        }
        case 'stroke': {
          const el = els.get(s.id);
          if (!el) return;
          tl.set(el, { autoAlpha: 1 }, pos);
          tl.to(
            el,
            {
              attr: { 'stroke-dashoffset': 0 },
              duration: s.dur ?? 1.1,
              ease: 'power2.inOut',
            },
            pos
          );
          break;
        }
        case 'text': {
          const wrap = els.get(s.id);
          const contentEl = texts.get(s.id);
          const caret = carets.get(s.id);
          if (!wrap || !contentEl) return;
          const chars = s.content.length;
          const dur = s.dur ?? Math.min(1.8, 0.35 + chars * 0.035);
          const proxy = { n: 0 };
          tl.set(wrap, { autoAlpha: 1 }, pos);
          tl.to(
            proxy,
            {
              n: chars,
              duration: dur,
              ease: 'none',
              onUpdate: () => {
                const n = Math.round(proxy.n);
                const next = s.content.slice(0, n);
                if (contentEl.textContent !== next) contentEl.textContent = next;
              },
            },
            pos
          );
          if (caret) {
            tl.set(
              caret,
              { autoAlpha: 0 },
              typeof pos === 'number' ? pos + dur + 0.05 : undefined
            );
          }
          break;
        }
        case 'image': {
          const el = els.get(s.id);
          if (!el) return;
          tl.fromTo(
            el,
            { autoAlpha: 0, y: 14, scale: 0.97 },
            { autoAlpha: 1, y: 0, scale: 1, duration: s.dur ?? 0.9, ease: 'power3.out' },
            pos
          );
          break;
        }
        case 'wait': {
          tl.to({}, { duration: Math.max(0.05, s.ms / 1000) }, pos);
          break;
        }
        case 'parallel': {
          const start = tl.duration();
          s.steps.forEach((sub) => addStep(sub, start));
          break;
        }
      }
    };

    script.forEach((s) => addStep(s));

    tl.eventCallback('onUpdate', () => {
      if (barRef.current && tlRef.current) {
        barRef.current.style.transform = `scaleX(${tlRef.current.progress()})`;
      }
    });
    let doneFired = false;
    const fireDone = () => {
      if (!doneFired) {
        doneFired = true;
        onDoneRef.current?.();
      }
    };
    tl.eventCallback('onComplete', () => {
      fireDone();
      setPlaying(false);
    });
    tl.eventCallback('onRepeat', fireDone);

    if (autoPlay) {
      tl.play(0);
      setPlaying(true);
    } else {
      setPlaying(false);
    }

    return () => {
      tl.kill();
      if (tlRef.current === tl) tlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptKey, reduced, autoPlay, loop]);

  const toggle = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!tl.paused()) {
      tl.pause();
      setPlaying(false);
    } else {
      if (tl.progress() >= 1) tl.restart();
      else tl.play();
      setPlaying(true);
    }
  };

  const replay = () => {
    const tl = tlRef.current;
    if (!tl) return;
    tl.restart();
    setPlaying(true);
  };

  /* ref helpers */
  const setEl = (id: string) => (el: Element | null) => {
    if (el) elRefs.current.set(id, el);
    else elRefs.current.delete(id);
  };
  const setText = (id: string) => (el: HTMLSpanElement | null) => {
    if (el) textRefs.current.set(id, el);
    else textRefs.current.delete(id);
  };
  const setCaret = (id: string) => (el: HTMLSpanElement | null) => {
    if (el) caretRefs.current.set(id, el);
    else caretRefs.current.delete(id);
  };
  const setCursor = (id: string) => (el: HTMLDivElement | null) => {
    if (el) cursorRefs.current.set(id, el);
    else cursorRefs.current.delete(id);
  };

  const hidden: React.CSSProperties = { opacity: 0, visibility: 'hidden' };

  return (
    <div className="kit-sim" role="group" aria-label={`${brandName} site build simulation`}>
      {/* browser chrome */}
      <div className="kit-sim-chrome" aria-hidden="true">
        <span className="kit-sim-dot" />
        <span className="kit-sim-dot" />
        <span className="kit-sim-dot" />
        <span className="kit-sim-pill">{domain}</span>
      </div>

      {/* stage */}
      <div className="kit-sim-stage" aria-hidden="true">
        <svg className="kit-sim-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
          {entities.map((e) => {
            if (e.kind === 'rect') {
              return (
                <g key={e.id} ref={setEl(e.id)} style={hidden}>
                  <rect
                    x={e.at.x}
                    y={e.at.y}
                    width={e.at.w}
                    height={e.at.h}
                    rx={1.1}
                    vectorEffect="non-scaling-stroke"
                    className={`kit-sim-rect--${e.rstyle}`}
                  />
                </g>
              );
            }
            if (e.kind === 'stroke') {
              return (
                <path
                  key={e.id}
                  ref={setEl(e.id)}
                  d={e.path}
                  fill="none"
                  className="kit-sim-stroke"
                  vectorEffect="non-scaling-stroke"
                  style={hidden}
                />
              );
            }
            return null;
          })}
        </svg>

        {/* images */}
        {entities.map((e) =>
          e.kind === 'image' ? (
            <div
              key={e.id}
              ref={setEl(e.id)}
              className="kit-sim-img"
              style={{
                left: `${e.at.x}%`,
                top: `${e.at.y}%`,
                width: `${e.at.w}%`,
                height: `${e.at.h}%`,
                ...hidden,
              }}
            >
              <GenerativeArt seed={e.seed} />
            </div>
          ) : null
        )}

        {/* rect labels + typed text */}
        {entities.map((e) => {
          if (e.kind === 'rect' && e.label) {
            return (
              <div
                key={`${e.id}__label`}
                ref={setEl(`${e.id}__label`)}
                className="kit-sim-rect-label"
                style={{ left: `${e.at.x}%`, top: `${e.at.y + e.at.h}%`, ...hidden }}
              >
                {e.label}
              </div>
            );
          }
          if (e.kind === 'text') {
            return (
              <div
                key={e.id}
                ref={setEl(e.id)}
                className={`kit-sim-text kit-sim-text--${e.tstyle}`}
                style={{ left: `${e.at.x}%`, top: `${e.at.y}%`, ...hidden }}
              >
                <span ref={setText(e.id)} />
                <span
                  ref={setCaret(e.id)}
                  className="kit-caret"
                  style={{ background: agentColor(e.agent) }}
                />
              </div>
            );
          }
          return null;
        })}

        {/* agent cursors */}
        {agents.map((a, i) => (
          <div
            key={a.id}
            ref={setCursor(a.id)}
            className="kit-sim-cursor"
            style={{ left: `${6 + i * 9}%`, top: '105%' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M1 1 L12.2 6.2 L6.9 7.6 L5.1 13 Z" fill={a.color} stroke="#fff" strokeWidth="1" />
            </svg>
            <span className="kit-sim-chip" style={{ background: a.color }}>
              {a.name}
            </span>
          </div>
        ))}
      </div>

      {/* screen-reader summary of the visual simulation */}
      <p className="kit-sr-only">
        Animated simulation: {agents.map((a) => a.name).join(', ')} assemble a {brandName} landing
        page block by block inside a browser frame.
      </p>

      {/* progress hairline */}
      <div className="kit-sim-bar" aria-hidden="true">
        <div ref={barRef} />
      </div>

      {/* controls */}
      <div className="kit-sim-controls">
        <div className="kit-sim-legend">
          {agents.map((a) => (
            <span className="kit-sim-agent" key={a.id}>
              <i style={{ background: a.color }} aria-hidden="true" />
              {a.name} <span>· {a.role}</span>
            </span>
          ))}
        </div>
        {reduced ? (
          <span className="kit-sim-note">Shown complete · reduced motion respected</span>
        ) : (
          <div className="kit-sim-btns">
            <button
              type="button"
              className="kit-mini-btn"
              onClick={toggle}
              aria-label={playing ? 'Pause simulation' : 'Play simulation'}
              aria-pressed={playing}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              className="kit-mini-btn"
              onClick={replay}
              aria-label="Replay simulation"
            >
              Replay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default StreamSimulator;
