'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SignalPanel, type BrowserSignals } from '@/components/kit/SignalPanel';
import { CtaButton } from '@/components/ui/Magnetic';

/* ------------------------------------------------------------------ */
/*  AgentPersona — "Your Cato Agent".                                  */
/*                                                                     */
/*  One client island holding both columns of the persona section:     */
/*  the SignalPanel (left) and the generated persona card (right).     */
/*  BrowserSignals flow straight from the panel into a local persona   */
/*  composer — name from the timezone, greeting from the local hour,   */
/*  insights from device / connection / referrer / UTM. The greeting   */
/*  streams character-by-character once the card scrolls into view.    */
/*  Zero network: everything is derived on-device, honestly labeled.   */
/* ------------------------------------------------------------------ */

const NAME_POOL = [
  'Meridian',
  'Solstice',
  'Polaris',
  'Halcyon',
  'Lumen',
  'Cirrus',
  'Zephyr',
  'Axiom',
  'Beacon',
  'Nimbus',
  'Summit',
  'Vega',
];

const SOCIAL_HOSTS = [
  'twitter',
  'x.com',
  't.co',
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'reddit',
  'threads',
];
const SEARCH_HOSTS = ['google.', 'bing.', 'duckduckgo', 'baidu', 'yahoo', 'ecosia'];

type Daypart = 'morning' | 'afternoon' | 'evening' | 'night';

interface Persona {
  name: string;
  city: string;
  part: Daypart;
  greeting: string;
  bullets: string[];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function hourInZone(tz: string): number {
  try {
    const s = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      hour12: false,
    }).format(new Date());
    const h = parseInt(s, 10);
    return Number.isFinite(h) ? h % 24 : new Date().getHours();
  } catch {
    return new Date().getHours();
  }
}

function daypartFor(hour: number): Daypart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

function referrerHost(ref: string): string {
  try {
    return new URL(ref).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** The local persona composer — deterministic, honest, zero network. */
function composePersona(s: BrowserSignals): Persona {
  const city =
    s.timezoneCity && s.timezoneCity !== 'Unknown' ? s.timezoneCity : 'your city';
  const part = daypartFor(hourInZone(s.timezone));
  const name = s.timezone
    ? NAME_POOL[hashString(s.timezone) % NAME_POOL.length]
    : NAME_POOL[0];

  const host = referrerHost(s.referrer);
  const isSocial = SOCIAL_HOSTS.some((d) => host.includes(d));
  const isSearch = SEARCH_HOSTS.some((d) => host.includes(d));

  const opener =
    part === 'night'
      ? `It's late in ${city} — good thing agents don't sleep.`
      : `Good ${part}.`;
  const intro = `I'm ${name}, your Cato agent — already on ${city} time.`;

  const insights: string[] = [];
  if (s.touch) {
    insights.push(
      `You're on touch, so I'd keep every answer glanceable — short, thumb-reachable, nothing to pinch.`
    );
  } else {
    insights.push(
      `You have a precise pointer and room to spare, so I'd use the full canvas — tables when they beat paragraphs.`
    );
  }

  if (isSocial) {
    insights.push(`You came from ${host}, so I'd skip the pitch and show the work.`);
  } else if (isSearch) {
    insights.push(`You arrived via ${host}, so I'd start with the question you actually typed.`);
  } else if (host) {
    insights.push(`You arrived via ${host} — I'd remember the road you took.`);
  } else {
    insights.push(
      `You came directly, so no warm-up — I'd treat you as someone who already knows why they're here.`
    );
  }

  if (s.location.status === 'granted' && s.location.locality) {
    insights.push(`With your location shared, I'd open with what's near ${s.location.locality}.`);
  } else if (s.utm.utm_source) {
    insights.push(
      `Your ${s.utm.utm_source} campaign tag is noted — I'd keep the thread of what brought you.`
    );
  } else if (s.connection?.saveData) {
    insights.push(`Data-saver is on, so I'd keep every byte lean.`);
  } else if (s.connection?.effectiveType && /2g/.test(s.connection.effectiveType)) {
    insights.push(`Your connection looks measured, so I'd keep things feather-light.`);
  } else if (s.reducedMotion) {
    insights.push(`You prefer reduced motion, so I'd stay still and simply be useful.`);
  } else if (s.locale && !s.locale.toLowerCase().startsWith('en')) {
    insights.push(`Your first language is ${s.locale} — I'd greet you in it, English when you wanted.`);
  }

  const escalation =
    `And the moment something needs human judgment, I hand you over — transcript, intent and next step attached. You'd never repeat yourself.`;

  const bullets = [
    `On your hours — ${city} time, whenever it runs.`,
    s.touch
      ? 'Glanceable by default — short answers, thumb-first actions.'
      : 'Detail on demand — your screen has the room for it.',
    isSocial
      ? 'Skips the pitch — you already saw the good part.'
      : isSearch
        ? 'Starts with your question, not our script.'
        : host
          ? 'Picks up the conversation where the last page left it.'
          : 'No cold open — you arrive already understood.',
  ];

  return {
    name,
    city,
    part,
    greeting: [opener, intro, ...insights.slice(0, 3), escalation].join(' '),
    bullets,
  };
}

/** Fires once when the element scrolls into view — gates the stream. */
function useInViewOnce<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        });
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export default function AgentPersona(): React.JSX.Element {
  const [signals, setSignals] = useState<BrowserSignals | null>(null);
  const { ref, inView } = useInViewOnce<HTMLDivElement>(0.2);

  const persona = useMemo(() => (signals ? composePersona(signals) : null), [signals]);
  const text = persona?.greeting ?? '';

  /* character-by-character stream; regenerates when the signals do */
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!inView || !text) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTyped(text);
      return;
    }
    setTyped('');
    let i = 0;
    const iv = window.setInterval(() => {
      i += 2;
      setTyped(text.slice(0, i));
      if (i >= text.length) window.clearInterval(iv);
    }, 22);
    return () => window.clearInterval(iv);
  }, [inView, text]);

  const done = text.length > 0 && typed.length >= text.length;

  return (
    <div className="aas-persona-grid" ref={ref}>
      <SignalPanel onSignals={setSignals} />

      <div
        className={`aas-agent glass-card${done ? ' is-live' : ''}`}
        aria-label="Your generated Cato agent"
      >
        {persona === null ? (
          <div className="aas-agent-skel">
            <span className="kit-sr-only">Composing your agent locally…</span>
            {[72, 48, 60].map((w, i) => (
              <div
                key={i}
                className="aas-agent-skel-bar"
                style={{ width: `${w}%` }}
                aria-hidden="true"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="aas-agent-head">
              {/* own 2D robot face — no R3F in the DOM */}
              <svg className="aas-agent-avatar" viewBox="0 0 72 72" aria-hidden="true">
                <line x1="36" y1="3" x2="36" y2="11" stroke="var(--blue-300)" strokeWidth="2.5" />
                <circle cx="36" cy="4" r="3" fill="var(--blue-600)" />
                <rect x="6" y="11" width="60" height="50" rx="16" fill="#fff" stroke="var(--blue-200)" />
                <rect x="14" y="22" width="44" height="22" rx="11" fill="#0a0c12" />
                <g className="aas-agent-eyes" fill="#2e4bff">
                  <circle cx="28" cy="33" r="4" />
                  <circle cx="44" cy="33" r="4" />
                </g>
                <path
                  d="M28 52 Q36 56.5 44 52"
                  stroke="var(--blue-700)"
                  strokeWidth="2.2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
              <div>
                <p className="aas-agent-name">{persona.name}</p>
                <p className="aas-agent-sub">
                  Cato agent · tuned to {persona.city} time
                </p>
              </div>
            </div>

            <p className="aas-agent-stream" aria-live="polite">
              {typed}
              {!done && <span className="kit-caret" aria-hidden="true" />}
            </p>

            <div className="aas-agent-rep">
              <p className="aas-agent-rep-label">How I'd represent you</p>
              <ul className="aas-agent-bullets">
                {persona.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>

            <div className="aas-agent-foot">
              <p className="aas-agent-note">
                Composed locally from the signals above. Imagine what we build
                with real knowledge architecture.
              </p>
              <CtaButton href="/contact" label="Start a build" variant="blue" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
