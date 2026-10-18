'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import './kit.css';

/* ------------------------------------------------------------------ */
/*  ChartDraw — animated revenue chart.                                */
/*                                                                     */
/*  Geometry is computed in a 0–100 percent space and drawn into an    */
/*  SVG with viewBox="0 0 100 100" + preserveAspectRatio="none", so    */
/*  the exact same static markup renders on the server; the stroke-    */
/*  draw animation is layered on client-side via IntersectionObserver. */
/*  Dots, labels and the tooltip are real DOM (no canvas text).        */
/* ------------------------------------------------------------------ */

export interface ChartMilestone {
  index: number;
  label: string;
}

const PLOT = { x0: 9, x1: 100, y0: 16, y1: 86 };

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function fmtMoney(v: number): string {
  if (v <= 0) return '$0';
  if (v < 1000) return `$${Math.round(v)}`;
  if (v < 1_000_000) return `$${Math.round(v / 1000)}K`;
  const m = v / 1_000_000;
  const label = m >= 10 ? String(Math.round(m)) : String(Math.round(m * 10) / 10);
  return `$${label}M+`;
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const f = v / base;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * base;
}

/** Catmull-Rom → cubic bezier smooth path through the points. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length === 1 ? `M ${pts[0].x} ${pts[0].y}` : '';
  const r = (n: number) => Math.round(n * 100) / 100;
  let d = `M ${r(pts[0].x)} ${r(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${r(c1x)} ${r(c1y)} ${r(c2x)} ${r(c2y)} ${r(p2.x)} ${r(p2.y)}`;
  }
  return d;
}

export function ChartDraw({
  data,
  milestones = [],
  onExpand,
  height = 360,
}: {
  data: number[];
  milestones?: ChartMilestone[];
  onExpand?: () => void;
  height?: number;
}): React.JSX.Element {
  const wrapRef = useRef<HTMLElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const gridRef = useRef<SVGGElement>(null);
  const ylabRefs = useRef(new Map<number, HTMLSpanElement>());
  const msRefs = useRef(new Map<number, HTMLDivElement>());
  const [hover, setHover] = useState<number | null>(null);

  const rawId = React.useId();
  const areaId = `kit-area-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  const geom = useMemo(() => {
    const max = niceCeil(Math.max(...data, 1));
    const span = Math.max(1, data.length - 1);
    const pts = data.map((v, i) => ({
      x: PLOT.x0 + (i / span) * (PLOT.x1 - PLOT.x0),
      y: PLOT.y0 + (1 - Math.min(v / max, 1)) * (PLOT.y1 - PLOT.y0),
    }));
    const line = smoothPath(pts);
    const area =
      pts.length > 1
        ? `${line} L ${pts[pts.length - 1].x} ${PLOT.y1} L ${pts[0].x} ${PLOT.y1} Z`
        : '';
    const ticks = [0, 1, 2, 3, 4].map((i) => {
      const v = (max / 4) * i;
      return { v, y: PLOT.y0 + (1 - v / max) * (PLOT.y1 - PLOT.y0) };
    });
    return { pts, line, area, ticks, max };
  }, [data]);

  const msMap = useMemo(() => new Map(milestones.map((m) => [m.index, m.label])), [milestones]);

  /* stroke-draw on scroll-enter; reduced motion → leave the SSR-drawn state */
  useIsoLayoutEffect(() => {
    const wrap = wrapRef.current;
    const lineEl = lineRef.current;
    if (!wrap || !lineEl || data.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let len = 300;
    try {
      len = lineEl.getTotalLength();
    } catch {
      /* keep fallback */
    }
    const ylabs = Array.from(ylabRefs.current.values());
    const mss = Array.from(msRefs.current.values());

    gsap.set(lineEl, { attr: { 'stroke-dasharray': len, 'stroke-dashoffset': len } });
    if (areaRef.current) gsap.set(areaRef.current, { autoAlpha: 0 });
    if (gridRef.current) gsap.set(gridRef.current, { autoAlpha: 0 });
    if (ylabs.length) gsap.set(ylabs, { autoAlpha: 0 });
    if (mss.length) gsap.set(mss, { autoAlpha: 0, scale: 0.3 });

    let tl: gsap.core.Timeline | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        tl = gsap.timeline();
        if (gridRef.current)
          tl.to(gridRef.current, { autoAlpha: 1, duration: 0.7, ease: 'power2.out' }, 0);
        if (ylabs.length)
          tl.to(ylabs, { autoAlpha: 1, duration: 0.5, stagger: 0.05, ease: 'power2.out' }, 0.1);
        tl.to(
          lineEl,
          { attr: { 'stroke-dashoffset': 0 }, duration: 1.7, ease: 'power2.inOut' },
          0.15
        );
        if (areaRef.current)
          tl.to(areaRef.current, { autoAlpha: 1, duration: 1, ease: 'power2.out' }, 0.9);
        if (mss.length)
          tl.to(
            mss,
            { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(2.4)', stagger: 0.13 },
            1.05
          );
      },
      { threshold: 0.35 }
    );
    io.observe(wrap);
    return () => {
      io.disconnect();
      tl?.kill();
    };
  }, [geom, data.length]);

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const t = (px - PLOT.x0) / (PLOT.x1 - PLOT.x0);
    const idx = Math.round(t * (data.length - 1));
    setHover(idx < 0 ? 0 : idx > data.length - 1 ? data.length - 1 : idx);
  };

  const first = data[0] ?? 0;
  const last = data[data.length - 1] ?? 0;

  return (
    <figure
      ref={wrapRef}
      className="kit-chart"
      style={{ margin: 0 }}
      aria-label={`Growth chart, rising from ${fmtMoney(first)} to ${fmtMoney(last)}.`}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <div className="kit-chart-stage" style={{ height }}>
        <svg
          className="kit-chart-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--blue-600)" stopOpacity="0.26" />
              <stop offset="1" stopColor="var(--blue-600)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g ref={gridRef}>
            {geom.ticks.map((t, i) => (
              <line
                key={i}
                x1={0}
                x2={100}
                y1={t.y}
                y2={t.y}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                style={{ stroke: i === 0 ? 'var(--line)' : 'var(--line-soft)' }}
              />
            ))}
          </g>
          <path ref={areaRef} d={geom.area} fill={`url(#${areaId})`} />
          <path
            ref={lineRef}
            d={geom.line}
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ stroke: 'var(--blue-600)' }}
          />
        </svg>

        {/* y-axis labels (DOM) */}
        {geom.ticks.map((t, i) => (
          <span
            key={i}
            ref={(el) => {
              if (el) ylabRefs.current.set(i, el);
              else ylabRefs.current.delete(i);
            }}
            className="kit-chart-ylab"
            style={{ top: `${t.y}%` }}
          >
            {fmtMoney(t.v)}
          </span>
        ))}

        {/* milestone dots + labels (DOM) */}
        {milestones
          .filter((m) => m.index >= 0 && m.index < data.length)
          .map((m) => (
            <div
              key={m.index}
              ref={(el) => {
                if (el) msRefs.current.set(m.index, el);
                else msRefs.current.delete(m.index);
              }}
              className="kit-chart-ms"
              style={{
                left: `${geom.pts[m.index]?.x ?? 0}%`,
                top: `${geom.pts[m.index]?.y ?? 0}%`,
              }}
            >
              <span>{m.label}</span>
              <i aria-hidden="true" />
            </div>
          ))}

        {/* hover crosshair + tooltip */}
        {hover !== null && geom.pts[hover] && (
          <>
            <div
              className="kit-chart-hover"
              style={{ left: `${geom.pts[hover].x}%`, top: `${geom.pts[hover].y}%` }}
              aria-hidden="true"
            >
              <i />
            </div>
            <div
              className="kit-chart-tip"
              style={{
                left: `clamp(56px, ${geom.pts[hover].x}%, calc(100% - 56px))`,
                top: `${geom.pts[hover].y}%`,
              }}
              aria-hidden="true"
            >
              <b>{fmtMoney(data[hover])}</b>
              <span>{msMap.get(hover) ?? `No. ${String(hover + 1).padStart(2, '0')}`}</span>
            </div>
          </>
        )}
      </div>

      {data.length < 2 && <p className="kit-chart-empty">Not enough data to draw.</p>}

      {onExpand && (
        <div className="kit-chart-expand">
          <button type="button" className="link-line" onClick={onExpand}>
            Explore the levers <span aria-hidden="true">↓</span>
          </button>
        </div>
      )}
    </figure>
  );
}

export default ChartDraw;
