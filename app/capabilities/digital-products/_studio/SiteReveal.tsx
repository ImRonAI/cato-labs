'use client';

import { memo, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { oubliSiteUrl, studioSession } from '@/lib/content/studio';

/**
 * "Yes, show me": the session window blooms, from the button, into a field of blurple light
 * (rings turning at their own speeds, comets riding them, ribbons and aurora drifting through),
 * while oubliai.com loads underneath. Once the site has loaded and the field has had its
 * moment, the rings rush outward and the light slowly dissolves into the live site.
 *
 * If the site cannot be framed (see /api/oubli-frame), no iframe is loaded: the field settles
 * and says so, with a link to the site instead.
 */

type RevealPhase = 'bloom' | 'flow' | 'dissolve' | 'done' | 'parked';

const BLOOM_MS = 1400;
/** the least time the field is on screen, bloom included */
const HOLD_MS = 4600;
/** after the site's load event, a beat for its first frames */
const SETTLE_MS = 900;
/** if the load event never comes, dissolve anyway */
const FALLBACK_MS = 10_000;
const DISSOLVE_MS = 3000;

const EASE_BLOOM = 'cubic-bezier(0.76, 0, 0.24, 1)';

/* ---------------------------------------------------------------- the field's geometry */

const CX = 600;
const CY = 400;

/** deterministic 0–1 noise, so the field is the same on every visit */
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const r1 = (n: number) => Math.round(n * 10) / 10;

const RINGS = Array.from({ length: 22 }, (_, i) => {
  const r = 34 * 1.14 ** i;
  return {
    rx: r1(r * (1 + 0.05 * Math.sin(i * 1.7))),
    ry: r1(r * (1 - 0.05 * Math.cos(i * 1.3))),
    /** seconds per turn; outer rings turn slower */
    dur: r1(22 + (i % 5) * 6 + i * 1.1),
    reverse: i % 2 === 1,
    width: r1(0.6 + (i % 4) * 0.4),
    /** inner rings burn brighter */
    opacity: Math.round((0.16 + 0.62 * (1 - i / 22) ** 1.3) * 100) / 100,
    dash: i % 3 === 0 ? '1 4' : i % 3 === 2 ? '28 5 2 5' : undefined,
    comet: i % 3 === 1 && i < 20,
  };
});

const BLOBS = [
  { cx: 250, cy: 210, r: 390, c: '#3d3bff', d: 19, x: 90, y: 60 },
  { cx: 980, cy: 240, r: 350, c: '#7a5cff', d: 23, x: -100, y: 80 },
  { cx: 830, cy: 650, r: 430, c: '#2b20b8', d: 27, x: -70, y: -90 },
  { cx: 290, cy: 660, r: 330, c: '#5b8cff', d: 21, x: 100, y: -60 },
  { cx: 600, cy: 400, r: 300, c: '#a08bff', d: 16, x: 36, y: 44 },
] as const;

const RIBBONS = [
  {
    a: 'M-80 560 C 180 430, 380 700, 600 520 S 1010 330, 1280 500',
    b: 'M-80 500 C 200 640, 420 380, 600 560 S 980 660, 1280 430',
    dur: 13,
    w: 1.6,
  },
  {
    a: 'M-80 300 C 220 180, 430 420, 640 290 S 1000 140, 1280 260',
    b: 'M-80 360 C 240 420, 400 160, 620 330 S 1040 380, 1280 210',
    dur: 17,
    w: 1.1,
  },
  {
    a: 'M-80 420 C 160 360, 420 520, 600 400 S 980 280, 1280 380',
    b: 'M-80 380 C 180 480, 380 300, 600 420 S 1000 520, 1280 400',
    dur: 11,
    w: 2.2,
  },
] as const;

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const SPARKS = Array.from({ length: 64 }, (_, i) => {
  const t = (i + 0.5) / 64;
  const rad = 80 + 560 * Math.sqrt(t);
  const a = i * GOLDEN;
  return {
    x: r1(CX + Math.cos(a) * rad * 1.25),
    y: r1(CY + Math.sin(a) * rad * 0.8),
    r: r1(0.7 + hash(i) * 1.9),
    delay: r1(-hash(i + 7) * 6),
    dur: r1(2.6 + hash(i + 13) * 3.4),
  };
});

function Morph({ a, b, dur }: { a: string; b: string; dur: number }) {
  return (
    <animate
      attributeName="d"
      values={`${a};${b};${a}`}
      keyTimes="0;0.5;1"
      calcMode="spline"
      keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
      dur={`${dur}s`}
      repeatCount="indefinite"
    />
  );
}

const BlurpleField = memo(function BlurpleField({ uid, animate }: { uid: string; animate: boolean }) {
  const id = (k: string) => `${uid}-${k}`;
  const url = (k: string) => `url(#${id(k)})`;
  return (
    <svg className="cs-rv-svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={id('bg')} cx="50%" cy="50%" r="75%">
          <stop offset="0" stopColor="#2a2085" />
          <stop offset="0.45" stopColor="#140f4a" />
          <stop offset="1" stopColor="#05040f" />
        </radialGradient>
        {BLOBS.map((b, i) => (
          <radialGradient key={i} id={id(`b${i}`)}>
            <stop offset="0" stopColor={b.c} stopOpacity="0.9" />
            <stop offset="0.5" stopColor={b.c} stopOpacity="0.32" />
            <stop offset="1" stopColor={b.c} stopOpacity="0" />
          </radialGradient>
        ))}
        <linearGradient id={id('ring')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b55ff" />
          <stop offset="0.46" stopColor="#cfc6ff" />
          <stop offset="0.52" stopColor="#ffffff" />
          <stop offset="1" stopColor="#4b2fd8" />
        </linearGradient>
        <linearGradient id={id('rib')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6c5cff" stopOpacity="0" />
          <stop offset="0.25" stopColor="#6f7dff" stopOpacity="0.8" />
          <stop offset="0.5" stopColor="#efeaff" />
          <stop offset="0.75" stopColor="#8f7bff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#6c5cff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id('core')}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.1" stopColor="#e4deff" stopOpacity="0.85" />
          <stop offset="0.32" stopColor="#9c8aff" stopOpacity="0.4" />
          <stop offset="0.65" stopColor="#4b3dff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#3b2fd1" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('vig')} cx="50%" cy="50%" r="72%">
          <stop offset="0.55" stopColor="#05040f" stopOpacity="0" />
          <stop offset="1" stopColor="#05040f" stopOpacity="0.72" />
        </radialGradient>
      </defs>

      <rect width="1200" height="800" fill={url('bg')} />

      <g className="cs-rv-world">
        <g className="cs-rv-blobs">
          {BLOBS.map((b, i) => (
            <circle
              key={i}
              className="cs-rv-blob"
              cx={b.cx}
              cy={b.cy}
              r={b.r}
              fill={url(`b${i}`)}
              style={{ '--d': `${b.d}s`, '--x': `${b.x}px`, '--y': `${b.y}px` } as CSSProperties}
            />
          ))}
        </g>

        <g className="cs-rv-ribbons">
          {RIBBONS.map((rb, i) => (
            <g key={i}>
              <path d={rb.a} className="cs-rv-ribbon__glow" stroke={url('rib')} strokeWidth={rb.w * 12}>
                {animate && <Morph a={rb.a} b={rb.b} dur={rb.dur} />}
              </path>
              <path d={rb.a} className="cs-rv-ribbon__core" stroke={url('rib')} strokeWidth={rb.w}>
                {animate && <Morph a={rb.a} b={rb.b} dur={rb.dur} />}
              </path>
              <path d={rb.a} className="cs-rv-ribbon__flow" strokeWidth={rb.w + 1.2}>
                {animate && <Morph a={rb.a} b={rb.b} dur={rb.dur} />}
              </path>
            </g>
          ))}
        </g>

        <g className="cs-rv-rings">
          {RINGS.map((r, i) => (
            <g
              key={i}
              className="cs-rv-ring"
              style={{ animationDuration: `${r.dur}s`, animationDirection: r.reverse ? 'reverse' : 'normal' }}
            >
              <ellipse
                cx={CX}
                cy={CY}
                rx={r.rx}
                ry={r.ry}
                stroke={url('ring')}
                strokeWidth={r.width}
                strokeOpacity={r.opacity}
                strokeDasharray={r.dash}
                pathLength={360}
              />
              {r.comet && (
                <>
                  <ellipse
                    className="cs-rv-comet cs-rv-comet--tail"
                    cx={CX}
                    cy={CY}
                    rx={r.rx}
                    ry={r.ry}
                    strokeWidth={r.width + 1}
                    pathLength={100}
                    style={{ animationDuration: `${r1(r.dur / 2.4)}s` }}
                  />
                  <ellipse
                    className="cs-rv-comet"
                    cx={CX}
                    cy={CY}
                    rx={r.rx}
                    ry={r.ry}
                    strokeWidth={r.width + 1.6}
                    pathLength={100}
                    style={{
                      animationDuration: `${r1(r.dur / 2.4)}s`,
                      animationDelay: `${-r1((r.dur / 2.4) * 0.115)}s`,
                    }}
                  />
                </>
              )}
            </g>
          ))}
        </g>

        <g className="cs-rv-sparks">
          {SPARKS.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
            />
          ))}
        </g>

        <circle className="cs-rv-core" cx={CX} cy={CY} r="240" fill={url('core')} />
      </g>

      <rect width="1200" height="800" fill={url('vig')} />
    </svg>
  );
});

/* ---------------------------------------------------------------- the reveal */

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function SiteReveal({
  origin,
  framable,
  idle,
  onDone,
}: {
  /** where the bloom starts, relative to the stage: the centre of the Yes button */
  origin: { x: number; y: number } | null;
  /** whether oubliai.com can be shown in a frame; null while that is still being checked */
  framable: boolean | null;
  /** the window is off screen: rest the field's motion */
  idle: boolean;
  /** called once the reveal settles: true when the live site is showing */
  onDone: (shown: boolean) => void;
}) {
  /* only ever mounted after a click, so the media query is safe to read here */
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<RevealPhase>(reduced ? 'flow' : 'bloom');
  const [held, setHeld] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const rim = useRef<HTMLDivElement>(null);
  const uid = `cs-rv-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  /* the bloom: a circle opening from the button, with a bright rim riding its edge */
  useLayoutEffect(() => {
    if (reduced) return;
    const box = root.current;
    const v = veil.current;
    const ring = rim.current;
    if (!box || !v || !ring) return;
    const w = box.clientWidth;
    const h = box.clientHeight;
    const x = origin?.x ?? w / 2;
    const y = origin?.y ?? h / 2;
    const R = Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) + 2;
    const clip = v.animate(
      [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${R}px at ${x}px ${y}px)` }],
      { duration: BLOOM_MS, easing: EASE_BLOOM, fill: 'forwards' },
    );
    Object.assign(ring.style, { left: `${x}px`, top: `${y}px`, width: `${R * 2}px`, height: `${R * 2}px` });
    const grow = ring.animate(
      [{ transform: 'translate(-50%, -50%) scale(0)' }, { transform: 'translate(-50%, -50%) scale(1)' }],
      { duration: BLOOM_MS, easing: EASE_BLOOM, fill: 'forwards' },
    );
    const fade = ring.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 420,
      delay: BLOOM_MS - 220,
      fill: 'forwards',
    });
    clip.onfinish = () => {
      v.style.clipPath = 'none';
      clip.cancel();
      setPhase('flow');
    };
    return () => {
      clip.onfinish = null;
      clip.cancel();
      grow.cancel();
      fade.cancel();
    };
  }, [reduced, origin]);

  /* the field holds for at least HOLD_MS; the site gets FALLBACK_MS to load */
  useEffect(() => {
    const hold = window.setTimeout(() => setHeld(true), reduced ? 900 : HOLD_MS);
    const fallback = window.setTimeout(() => setReady(true), FALLBACK_MS);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(fallback);
    };
  }, [reduced]);

  useEffect(() => {
    if (!loaded) return;
    const t = window.setTimeout(() => setReady(true), reduced ? 200 : SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [loaded, reduced]);

  useEffect(() => {
    if (phase !== 'flow' || !held) return;
    if (framable === true && ready) setPhase('dissolve');
    else if (framable === false) setPhase('parked');
  }, [phase, held, ready, framable]);

  /* still unanswered when the fallback fires: treat the site as unavailable */
  useEffect(() => {
    if (framable !== null || phase !== 'flow' || !ready) return;
    setPhase('parked');
  }, [framable, phase, ready]);

  useEffect(() => {
    if (phase !== 'dissolve') return;
    const t = window.setTimeout(() => setPhase('done'), reduced ? 900 : DISSOLVE_MS);
    return () => window.clearTimeout(t);
  }, [phase, reduced]);

  useEffect(() => {
    if (phase === 'done') onDone(true);
    else if (phase === 'parked') onDone(false);
  }, [phase, onDone]);

  /* rest the field (CSS and SMIL) while the window is off screen */
  useEffect(() => {
    const svg = root.current?.querySelector<SVGSVGElement>('svg.cs-rv-svg');
    if (!svg) return;
    if (idle) svg.pauseAnimations();
    else svg.unpauseAnimations();
  }, [idle, phase]);

  return (
    <div
      ref={root}
      className="cs-reveal"
      data-phase={phase}
      data-ready={ready || undefined}
      data-reduced={reduced || undefined}
      data-idle={idle || undefined}
    >
      {framable === true && (
        <div className="cs-reveal__site" inert={phase !== 'done'}>
          <iframe
            src={oubliSiteUrl}
            title={studioSession.siteTitle}
            onLoad={() => setLoaded(true)}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            allow="fullscreen"
          />
        </div>
      )}
      {phase !== 'done' && (
        <div ref={veil} className="cs-reveal__veil" aria-hidden="true">
          <BlurpleField uid={uid} animate={!reduced} />
          <div className="cs-rv-mark">
            <span className="cs-rv-mark__word">oubli</span>
            <span className="cs-rv-mark__url">oubliai.com</span>
            <span className="cs-rv-mark__bar">
              <i />
            </span>
          </div>
        </div>
      )}
      {phase === 'parked' && (
        <div className="cs-rv-note" role="status">
          <p>{studioSession.unframed}</p>
          <a className="cs-btn cs-btn--primary" href={oubliSiteUrl} target="_blank" rel="noopener">
            {studioSession.openSite}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      )}
      {!reduced && phase === 'bloom' && <div ref={rim} className="cs-reveal__rim" aria-hidden="true" />}
    </div>
  );
}
