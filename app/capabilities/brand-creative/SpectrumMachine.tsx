'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

/* ================================================================
   The Spectrum Machine — identity as a system of dials.

   Three dials (Archetype / Voice / Structure) drive three outputs:
   a) a generative SVG mark that redraws itself — stroke weights,
      corner radii, symmetry and spacing interpolate with the dials,
      stroke color travels the blue spectrum;
   b) a sample headline rewritten live from a 4×2×2 phrase matrix
      (nearest cell);
   c) a recipe line reading out the current setting.

   The mark, dial needles and arcs are written imperatively inside a
   single rAF loop (damped toward the dial targets — no React state
   per frame). Text derives from React state and only changes when a
   dial crosses into a new cell.
   ================================================================ */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fmt = (n: number) => n.toFixed(2);

/* ---------------------------------------------------------------- */
/*  Dial model                                                       */
/* ---------------------------------------------------------------- */

interface DialStop {
  v: number;
  name: string;
}

interface DialDef {
  label: string;
  caption: string;
  stops: DialStop[];
}

const ARCH_DIAL: DialDef = {
  label: 'Archetype',
  caption: 'Who the brand is when no one is watching.',
  stops: [
    { v: 0, name: 'Sage' },
    { v: 1 / 3, name: 'Creator' },
    { v: 2 / 3, name: 'Ruler' },
    { v: 1, name: 'Explorer' },
  ],
};

const VOICE_DIAL: DialDef = {
  label: 'Voice',
  caption: 'How loudly the system is allowed to speak.',
  stops: [
    { v: 0, name: 'Quiet' },
    { v: 1, name: 'Bold' },
  ],
};

const STRUCT_DIAL: DialDef = {
  label: 'Structure',
  caption: 'How far the grid is allowed to bend.',
  stops: [
    { v: 0, name: 'Classic' },
    { v: 1, name: 'Avant-garde' },
  ],
};

interface DialValues {
  arch: number;
  voice: number;
  struct: number;
}

/** First impression: Creator × Quiet × Classic — the Cato resting face. */
const INITIAL: DialValues = { arch: 1 / 3, voice: 0.35, struct: 0.45 };

/* ---------------------------------------------------------------- */
/*  Phrase matrix — [archetype][voice][structure], nearest cell.     */
/*  "We make {X} for {Y}" is the spine; the corners break it.        */
/* ---------------------------------------------------------------- */

const HEADLINES: string[][][] = [
  /* Sage */
  [
    ['Considered goods for people who notice.', 'Quiet tools for the next century.'],
    ['We make evidence irresistible.', 'The future, considered — then claimed.'],
  ],
  /* Creator */
  [
    ['Useful things, made beautifully.', 'New forms for familiar needs.'],
    ['Made to be remade.', 'We invent the category. Twice.'],
  ],
  /* Ruler */
  [
    ['Order, made visible.', 'The standard, rewritten.'],
    ['Own the room. Every time.', 'Lead, or be led.'],
  ],
  /* Explorer */
  [
    ['Provisions for the road ahead.', 'Maps for territory without names.'],
    ['Go further. We packed.', 'Off the map. On purpose.'],
  ],
];

const ARCH_NAMES = ['Sage', 'Creator', 'Ruler', 'Explorer'];
const VOICE_NAMES = ['Quiet', 'Bold'];
const STRUCT_NAMES = ['Classic', 'Avant-garde'];

/* ---------------------------------------------------------------- */
/*  Generative-mark math — module-level temps, no per-frame alloc.   */
/* ---------------------------------------------------------------- */

/** The stroke's journey across the blue spectrum: Sage → Creator → Ruler → Explorer. */
const STROKE_RAMP: readonly (readonly [number, number, number])[] = [
  [18, 38, 200] /* blue-800 */,
  [46, 75, 255] /* blue-600 */,
  [10, 24, 144] /* blue-900 */,
  [107, 135, 255] /* blue-500 */,
];

const _stroke: [number, number, number] = [0, 0, 0];
const _dot: [number, number, number] = [0, 0, 0];

function rampColor(t: number, out: [number, number, number]) {
  const x = clamp01(t) * (STROKE_RAMP.length - 1);
  const i = Math.min(Math.floor(x), STROKE_RAMP.length - 2);
  const f = x - i;
  const a = STROKE_RAMP[i];
  const b = STROKE_RAMP[i + 1];
  out[0] = lerp(a[0], b[0], f);
  out[1] = lerp(a[1], b[1], f);
  out[2] = lerp(a[2], b[2], f);
}

const rgb = (c: readonly [number, number, number]) =>
  `rgb(${c[0].toFixed(0)},${c[1].toFixed(0)},${c[2].toFixed(0)})`;

interface MarkParams {
  apexX: number;
  apexY: number;
  baseLX: number;
  baseRX: number;
  baseRY: number;
  barY: number;
  wLegs: number;
  wBar: number;
  radius: number;
  dotX: number;
  dotY: number;
  dotR: number;
}

const BASE_Y = 86;
const P: MarkParams = {
  apexX: 50,
  apexY: 15,
  baseLX: 30,
  baseRX: 70,
  baseRY: BASE_Y,
  barY: 60,
  wLegs: 5,
  wBar: 3.5,
  radius: 2,
  dotX: 50,
  dotY: 6,
  dotR: 2.5,
};

/** Interpolation functions, precomputed: dials → mark geometry. Writes P in place. */
function computeMark(a: number, v: number, s: number) {
  const asym = a * a; /* Sage sits at perfect symmetry; Explorer leans off-axis */
  P.wLegs = lerp(2.6, 12, v); /* Quiet → hairline, Bold → poster weight */
  P.wBar = P.wLegs * 0.7;
  P.apexX = 50 + asym * lerp(5, 15, s);
  P.apexY = lerp(17, 12, v);
  const spread = lerp(19, 24, s) + v * 1.5;
  P.baseLX = 50 - spread * (1 + 0.18 * asym);
  P.baseRX = 50 + spread * (1 - 0.06 * asym);
  P.baseRY = BASE_Y + asym * s * 5;
  P.barY = lerp(63, 49, s) - v * 3; /* avant-garde raises the bar */
  P.radius = lerp(0.6, 9, s); /* Classic is sharp; Avant-garde rounds the corner */
  P.dotR = lerp(1.7, 4.4, v);
  P.dotX = P.apexX + s * 24;
  P.dotY = lerp(P.apexY - 8.5, 81, s * s);
  rampColor(a, _stroke);
  rampColor(1 - a, _dot);
}

/** Legs as one path B → A → C with the apex corner rounded by P.radius. */
function legsPath(): string {
  const bx = P.baseLX;
  const by = BASE_Y;
  const ax = P.apexX;
  const ay = P.apexY;
  const cx = P.baseRX;
  const cy = P.baseRY;
  let d1x = ax - bx;
  let d1y = ay - by;
  const l1 = Math.hypot(d1x, d1y) || 1;
  d1x /= l1;
  d1y /= l1;
  let d2x = cx - ax;
  let d2y = cy - ay;
  const l2 = Math.hypot(d2x, d2y) || 1;
  d2x /= l2;
  d2y /= l2;
  const r = Math.min(P.radius, l1 * 0.45, l2 * 0.45);
  const p1x = ax - d1x * r;
  const p1y = ay - d1y * r;
  const p2x = ax + d2x * r;
  const p2y = ay + d2y * r;
  return `M ${fmt(bx)} ${fmt(by)} L ${fmt(p1x)} ${fmt(p1y)} Q ${fmt(ax)} ${fmt(
    ay,
  )} ${fmt(p2x)} ${fmt(p2y)} L ${fmt(cx)} ${fmt(cy)}`;
}

/** Crossbar between the legs at P.barY, inset by its own weight. */
function barPath(): string {
  const t = clamp01((P.barY - P.apexY) / (BASE_Y - P.apexY));
  const lx = lerp(P.apexX, P.baseLX, t);
  const ly = lerp(P.apexY, BASE_Y, t);
  const rx = lerp(P.apexX, P.baseRX, t);
  const ry = lerp(P.apexY, P.baseRY, t);
  let dx = rx - lx;
  let dy = ry - ly;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const inset = P.wBar * 0.6 + 1;
  return `M ${fmt(lx + dx * inset)} ${fmt(ly + dy * inset)} L ${fmt(rx - dx * inset)} ${fmt(
    ry - dy * inset,
  )}`;
}

/** Render-side snapshot: state-derived attrs for SSR/first paint (rAF then owns the DOM). */
function snapshotMark(v: DialValues) {
  computeMark(v.arch, v.voice, v.struct);
  return {
    legs: legsPath(),
    bar: barPath(),
    wLegs: fmt(P.wLegs),
    wBar: fmt(P.wBar),
    stroke: rgb(_stroke),
    dotFill: rgb(_dot),
    dotX: fmt(P.dotX),
    dotY: fmt(P.dotY),
    dotR: fmt(P.dotR),
  };
}

/* ---------------------------------------------------------------- */
/*  Dial — drag-to-rotate knob, keyboard accessible.                 */
/* ---------------------------------------------------------------- */

interface DialViz {
  needle: SVGGElement | null;
  arc: SVGCircleElement | null;
}

const SWEEP_RAD = (270 * Math.PI) / 180;

/** pointer angle (atan2, y-down) → dial value; the bottom of the circle is the dead zone. */
function angleToValue(rad: number): number {
  const deg = (rad * 180) / Math.PI; /* clockwise from east, SVG convention */
  if (deg > 45 && deg < 135) return deg <= 90 ? 1 : 0;
  const shifted = deg >= 135 ? deg - 360 : deg;
  return clamp01((shifted + 225) / 270);
}

function Dial({
  def,
  value,
  onChange,
  vizRef,
}: {
  def: DialDef;
  value: number;
  onChange: (v: number) => void;
  vizRef: { current: DialViz };
}) {
  const faceRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ angle: number; value: number } | null>(null);

  const nearest = def.stops.reduce(
    (best, s) => (Math.abs(s.v - value) < Math.abs(best.v - value) ? s : best),
    def.stops[0],
  );

  const pointerAngle = (clientX: number, clientY: number) => {
    const el = faceRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.atan2(clientY - (r.top + r.height / 2), clientX - (r.left + r.width / 2));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    faceRef.current?.focus(); /* preventDefault suppresses native focus — restore it */
    faceRef.current?.setPointerCapture(e.pointerId);
    const a = pointerAngle(e.clientX, e.clientY);
    const v = angleToValue(a); /* grab = jump to the touched angle, then track */
    onChange(v);
    drag.current = { angle: a, value: v };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const a = pointerAngle(e.clientX, e.clientY);
    let delta = a - d.angle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    onChange(clamp01(d.value + delta / SWEEP_RAD));
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.18 : 0.06;
    let v: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v = clamp01(value + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v = clamp01(value - step);
    else if (e.key === 'Home') v = 0;
    else if (e.key === 'End') v = 1;
    if (v !== null) {
      e.preventDefault();
      onChange(v);
    }
  };

  return (
    <div className="sm-dial">
      <div className="sm-dial__head">
        <span className="sm-dial__label">{def.label}</span>
        <span className="sm-dial__current">{nearest.name}</span>
      </div>
      <div
        ref={faceRef}
        className="sm-dial__face"
        role="slider"
        tabIndex={0}
        aria-label={def.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={nearest.name}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={onKeyDown}
      >
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="sm-dial__rail" cx="60" cy="60" r="52" />
          {def.stops.map((s) => (
            <line
              key={s.name}
              className="sm-dial__tick"
              x1="60"
              y1="6"
              x2="60"
              y2="12"
              transform={`rotate(${-135 + s.v * 270} 60 60)`}
            />
          ))}
          <circle
            ref={(el) => {
              vizRef.current.arc = el;
            }}
            className="sm-dial__arc"
            cx="60"
            cy="60"
            r="52"
            pathLength={100}
            strokeDasharray={`${fmt(value * 75)} 100`}
            transform="rotate(135 60 60)"
          />
          <g
            ref={(el) => {
              vizRef.current.needle = el;
            }}
            transform={`rotate(${-135 + value * 270} 60 60)`}
          >
            <line className="sm-dial__needle" x1="60" y1="60" x2="60" y2="20" />
            <circle className="sm-dial__hub" cx="60" cy="60" r="16" />
            <line className="sm-dial__notch" x1="60" y1="46" x2="60" y2="30" />
          </g>
        </svg>
      </div>
      <div className="sm-stops" role="group" aria-label={`${def.label} presets`}>
        {def.stops.map((s) => (
          <button
            key={s.name}
            type="button"
            className="sm-stop"
            aria-pressed={nearest.name === s.name}
            onClick={() => onChange(s.v)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <p className="sm-dial__caption">{def.caption}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  SpectrumMachine                                                  */
/* ---------------------------------------------------------------- */

export default function SpectrumMachine() {
  const [dials, setDials] = useState<DialValues>(INITIAL);
  const targetRef = useRef<DialValues>(INITIAL);
  const shownRef = useRef<DialValues>({ ...INITIAL });

  const archViz = useRef<DialViz>({ needle: null, arc: null });
  const voiceViz = useRef<DialViz>({ needle: null, arc: null });
  const structViz = useRef<DialViz>({ needle: null, arc: null });

  const legsRef = useRef<SVGPathElement>(null);
  const barRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    targetRef.current = dials;
  }, [dials]);

  const setDial = useCallback(
    (id: keyof DialValues) => (v: number) => {
      setDials((prev) => ({ ...prev, [id]: v }));
    },
    [],
  );

  /* The morph loop: damp shown → target, then write needles, arcs and the
     mark imperatively. One rAF, zero React state per frame. */
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const viz: readonly (readonly [{ current: DialViz }, keyof DialValues])[] = [
      [archViz, 'arch'],
      [voiceViz, 'voice'],
      [structViz, 'struct'],
    ];
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = targetRef.current;
      const s = shownRef.current;
      const l = reduced ? 1 : 0.16;
      s.arch += (t.arch - s.arch) * l;
      s.voice += (t.voice - s.voice) * l;
      s.struct += (t.struct - s.struct) * l;

      for (const [ref, key] of viz) {
        const v = s[key];
        const els = ref.current;
        els.needle?.setAttribute('transform', `rotate(${fmt(-135 + v * 270)} 60 60)`);
        els.arc?.setAttribute('stroke-dasharray', `${fmt(v * 75)} 100`);
      }

      computeMark(s.arch, s.voice, s.struct);
      const stroke = rgb(_stroke);
      if (legsRef.current) {
        legsRef.current.setAttribute('d', legsPath());
        legsRef.current.setAttribute('stroke-width', fmt(P.wLegs));
        legsRef.current.setAttribute('stroke', stroke);
      }
      if (barRef.current) {
        barRef.current.setAttribute('d', barPath());
        barRef.current.setAttribute('stroke-width', fmt(P.wBar));
        barRef.current.setAttribute('stroke', stroke);
      }
      if (dotRef.current) {
        dotRef.current.setAttribute('cx', fmt(P.dotX));
        dotRef.current.setAttribute('cy', fmt(P.dotY));
        dotRef.current.setAttribute('r', fmt(P.dotR));
        dotRef.current.setAttribute('fill', rgb(_dot));
      }
      if (chipRef.current) chipRef.current.style.background = stroke;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* text outputs — nearest cell, changes are discrete */
  const ai = Math.min(3, Math.max(0, Math.round(dials.arch * 3)));
  const vi = dials.voice < 0.5 ? 0 : 1;
  const si = dials.struct < 0.5 ? 0 : 1;
  const headline = HEADLINES[ai][vi][si];
  const recipe = `${ARCH_NAMES[ai]} × ${VOICE_NAMES[vi]} × ${STRUCT_NAMES[si]}`;

  const mark = snapshotMark(dials);

  return (
    <div className="sm-grid">
      <div className="sm-controls">
        <Dial def={ARCH_DIAL} value={dials.arch} onChange={setDial('arch')} vizRef={archViz} />
        <Dial def={VOICE_DIAL} value={dials.voice} onChange={setDial('voice')} vizRef={voiceViz} />
        <Dial def={STRUCT_DIAL} value={dials.struct} onChange={setDial('struct')} vizRef={structViz} />

        <div className="sm-voice">
          <span className="micro-label micro-label--ink">Sample headline</span>
          <p className="sm-headline" aria-live="polite">
            <span key={headline}>{headline}</span>
          </p>
        </div>
      </div>

      <div className="sm-stage glass-card">
        <div className="sm-stage__top">
          <span className="micro-label micro-label--ink">Live specimen</span>
          <span className="index-no">№ 04</span>
        </div>
        <div className="sm-stage__frame">
          <svg
            className="sm-mark"
            viewBox="0 0 100 100"
            role="img"
            aria-label={`Generative identity mark — ${recipe}`}
          >
            <path
              ref={legsRef}
              d={mark.legs}
              fill="none"
              stroke={mark.stroke}
              strokeWidth={mark.wLegs}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              ref={barRef}
              d={mark.bar}
              fill="none"
              stroke={mark.stroke}
              strokeWidth={mark.wBar}
              strokeLinecap="round"
            />
            <circle ref={dotRef} cx={mark.dotX} cy={mark.dotY} r={mark.dotR} fill={mark.dotFill} />
          </svg>
        </div>
        <div className="sm-recipe">
          <span className="micro-label micro-label--ink">Current recipe</span>
          <p className="sm-recipe__line" aria-live="polite">
            <span
              ref={chipRef}
              className="sm-chip"
              style={{ background: mark.stroke }}
              aria-hidden="true"
            />
            {recipe}
          </p>
        </div>
      </div>
    </div>
  );
}
