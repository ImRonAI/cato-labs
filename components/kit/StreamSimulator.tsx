'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './kit.css';

/* ------------------------------------------------------------------ */
/*  Public API (preserved for compatibility with buildScript.ts)       */
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
/*  10 Real HTML Websites Catalog                                      */
/* ------------------------------------------------------------------ */

export interface StudioSiteEntry {
  slug: string;
  name: string;
  subtitle: string;
  domain: string;
  file: string;
}

export const STUDIO_SITES: StudioSiteEntry[] = [
  {
    slug: 'aurelle',
    name: 'AURELLE',
    subtitle: 'Alpine Botanical Parfum',
    domain: 'aurelle.ch',
    file: '/studio-sites/aurelle.html',
  },
  {
    slug: 'vespera',
    name: 'VESPERA',
    subtitle: 'Stratospheric Defense Systems',
    domain: 'vespera.aero',
    file: '/studio-sites/vespera.html',
  },
  {
    slug: 'kuroshio',
    name: 'KUROSHIO',
    subtitle: 'Ginza Hinoki Omakase Counter',
    domain: 'kuroshio.jp',
    file: '/studio-sites/kuroshio.html',
  },
  {
    slug: 'solstice-bio',
    name: 'SOLSTICE BIO',
    subtitle: 'Cellular Reprogramming Therapeutics',
    domain: 'solstice.bio',
    file: '/studio-sites/solstice-bio.html',
  },
  {
    slug: 'monolith',
    name: 'MONOLITH',
    subtitle: 'Brutalist Architectural Monograph',
    domain: 'monolith.arch',
    file: '/studio-sites/monolith.html',
  },
  {
    slug: 'velour-capital',
    name: 'VELOUR CAPITAL',
    subtitle: 'Sovereign & Family Office Advisory',
    domain: 'velour.capital',
    file: '/studio-sites/velour-capital.html',
  },
  {
    slug: 'aether-motors',
    name: 'AETHER MOTORS',
    subtitle: 'Coachbuilt Grand Tourer EV',
    domain: 'aether.motors',
    file: '/studio-sites/aether-motors.html',
  },
  {
    slug: 'nocturne-audio',
    name: 'NOCTURNE AUDIO',
    subtitle: 'Planar-Magnetic Reference Acoustics',
    domain: 'nocturneaudio.ch',
    file: '/studio-sites/nocturne-audio.html',
  },
  {
    slug: 'helios-grid',
    name: 'HELIOS GRID',
    subtitle: 'High-Field Compact Tokamak Fusion',
    domain: 'heliosgrid.ch',
    file: '/studio-sites/helios-grid.html',
  },
  {
    slug: 'maison-verve',
    name: 'MAISON VERVE',
    subtitle: 'Geneva Independent Haute Horlogerie',
    domain: 'maisonverve.ch',
    file: '/studio-sites/maison-verve.html',
  },
];

const DEFAULT_AGENTS: StreamAgent[] = [
  { id: 'strategy', name: 'Sapphire', role: 'Strategy', color: '#1226c8' },
  { id: 'design', name: 'Azure', role: 'Design', color: '#2e4bff' },
  { id: 'engineering', name: 'Ice', role: 'Engineering', color: '#5c78ff' },
  { id: 'seo', name: 'Indigo', role: 'Discoverability', color: '#0a1890' },
];

interface DomBuildTarget {
  el: HTMLElement;
  docTop: number;
  label: string;
}

interface AgentLiveDrawState {
  agent: StreamAgent;
  x: number;
  y: number;
  task: string;
  box: {
    left: number;
    top: number;
    width: number;
    height: number;
    tag: string;
  } | null;
}

function stripBundledRuntimeForCodeView(rawHtml: string): string {
  const begin = '<!-- STUDIO-CONCIERGE:BEGIN -->';
  const end = '<!-- STUDIO-CONCIERGE:END -->';
  const i = rawHtml.indexOf(begin);
  const j = rawHtml.indexOf(end);
  if (i !== -1 && j !== -1 && j > i) {
    return (
      rawHtml.slice(0, i) +
      `${begin}\n  <!-- Studio Concierge AI Elements Runtime (anthropic/claude-haiku-4-5) -->\n${end}` +
      rawHtml.slice(j + end.length)
    );
  }
  return rawHtml;
}

function describeElement(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'img') {
    const src = (el as HTMLImageElement).getAttribute('src') || '';
    const file = src.split('/').pop() || 'image';
    return `<img> ${file.slice(0, 22)}`;
  }
  if (tag === 'canvas') {
    return `<canvas#${el.id || 'webgl'}> 3D Stage`;
  }
  if (tag === 'svg') {
    return `<svg> Vector Diagram`;
  }
  if (tag === 'form') {
    return `<form#${el.id || 'interactive'}>`;
  }
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  const idPart = el.id ? `#${el.id}` : '';
  if (text.length > 0) {
    return `<${tag}${idPart}> ${text.slice(0, 22)}${text.length > 22 ? '…' : ''}`;
  }
  return `<${tag}${idPart}>`;
}

/* ------------------------------------------------------------------ */
/*  StreamSimulator                                                    */
/* ------------------------------------------------------------------ */

export function StreamSimulator({
  agents = DEFAULT_AGENTS,
  autoPlay = true,
  onDone,
}: {
  script?: StreamStep[];
  agents?: StreamAgent[];
  autoPlay?: boolean;
  loop?: boolean;
  onDone?: () => void;
  brand?: { name: string; domain: string };
}): React.JSX.Element {
  const [selectedSlug, setSelectedSlug] = useState<string>(STUDIO_SITES[0].slug);
  const [codeHtml, setCodeHtml] = useState<string>('');
  const [iframeReady, setIframeReady] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(autoPlay);
  const [reduced, setReduced] = useState<boolean>(false);
  const [showCodePane, setShowCodePane] = useState<boolean>(true);
  const [agentVisuals, setAgentVisuals] = useState<AgentLiveDrawState[]>([]);

  const simRootRef = useRef<HTMLDivElement | null>(null);
  const codePreRef = useRef<HTMLPreElement | null>(null);
  const barFillRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const domTargetsRef = useRef<DomBuildTarget[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const lastStateCommitRef = useRef<number>(0);
  const progressRef = useRef<number>(0);
  const inViewRef = useRef<boolean>(true);
  const userScrolledCodeRef = useRef<boolean>(false);
  const autoScrollingCodeRef = useRef<boolean>(false);
  const smoothScrollRef = useRef<number | null>(null);
  const smoothedAgentsRef = useRef<
    Map<
      string,
      {
        x: number;
        y: number;
        left: number;
        top: number;
        width: number;
        height: number;
      }
    >
  >(new Map());
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const activeSite = useMemo(
    () => STUDIO_SITES.find((s) => s.slug === selectedSlug) ?? STUDIO_SITES[0],
    [selectedSlug]
  );

  /* Respect prefers-reduced-motion */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  /* Pause simulation ticks when scrolled out of viewport so the build awaits the visitor */
  useEffect(() => {
    const node = simRootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        inViewRef.current = entry.isIntersecting;
        if (!entry.isIntersecting) {
          lastTickRef.current = null;
        }
      },
      { threshold: 0.08 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  /* Fetch HTML source for the streaming code pane & reset build when site changes */
  useEffect(() => {
    let cancelled = false;
    setIframeReady(false);
    domTargetsRef.current = [];
    const initialProgress = reduced ? 1 : 0;
    progressRef.current = initialProgress;
    setProgress(initialProgress);
    setPlaying(reduced ? false : autoPlay);
    lastTickRef.current = null;
    lastStateCommitRef.current = 0;
    smoothScrollRef.current = null;
    smoothedAgentsRef.current.clear();
    userScrolledCodeRef.current = false;

    fetch(activeSite.file)
      .then((res) => (res.ok ? res.text() : ''))
      .then((html) => {
        if (cancelled || !html) return;
        setCodeHtml(stripBundledRuntimeForCodeView(html));
      })
      .catch(() => {
        /* ignore code preview fetch errors */
      });

    return () => {
      cancelled = true;
    };
  }, [activeSite.file, autoPlay, reduced]);

  /* Collect real renderable DOM elements inside the live iframe when it loads */
  const collectIframeTargets = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!doc || !win || !doc.body) return;

    /* Inject progressive build stylesheet into the iframe document */
    let styleEl = doc.getElementById('kit-sim-build-style') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = 'kit-sim-build-style';
      styleEl.textContent = `
        [data-sim-stage="pending"] {
          opacity: 0 !important;
          transform: translateY(18px) scale(0.985) !important;
          pointer-events: none !important;
        }
        [data-sim-stage="building"] {
          opacity: 0.9 !important;
          transform: translateY(2px) scale(0.997) !important;
          transition: opacity 1.6s cubic-bezier(0.16, 1, 0.3, 1), transform 1.6s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        [data-sim-stage="done"] {
          opacity: 1 !important;
          transform: none !important;
          transition: opacity 1.2s ease, transform 1.2s ease !important;
        }
      `;
      doc.head.appendChild(styleEl);
    }

    /* Force any scroll-triggered reveal elements (.rv, .reveal) to be visible once built */
    doc.querySelectorAll('.rv, .reveal').forEach((el) => el.classList.add('in'));

    const selector = [
      'header',
      'h1',
      'h2',
      'h3',
      'p',
      'figure',
      'img',
      'canvas',
      'svg',
      'article',
      'form',
      'table',
      'dl',
      '.flacon',
      '.sys',
      '.course',
      '.piece',
      '.work-entry',
      '.tech-item',
      '.prog',
      'footer',
    ].join(', ');

    const rawNodes = Array.from(doc.body.querySelectorAll<HTMLElement>(selector));
    const filtered: DomBuildTarget[] = [];

    for (const el of rawNodes) {
      if (
        el.closest(
          '#concierge-root, [hidden], dialog, .dlg, .view, .sheet, .drawer, .mnav, .menu, .dossier-backdrop, template'
        )
      ) {
        continue;
      }
      /* Skip child SVG icons inside buttons or links so we target meaningful blocks */
      if (el.tagName.toLowerCase() === 'svg' && el.closest('a, button')) {
        continue;
      }
      /* Skip nested elements if an ancestor card/article is already in our list */
      const rect = el.getBoundingClientRect();
      if (rect.width < 28 || rect.height < 14) continue;
      if (rect.height > win.innerHeight * 2.2 && el.tagName.toLowerCase() !== 'section') continue;

      const docTop = rect.top + win.scrollY;
      filtered.push({
        el,
        docTop,
        label: describeElement(el),
      });
    }

    filtered.sort((a, b) => a.docTop - b.docTop);

    /* Deduplicate closely overlapping parent/child targets so each step is visually distinct */
    const deduped: DomBuildTarget[] = [];
    for (const item of filtered) {
      const prev = deduped[deduped.length - 1];
      if (prev && prev.el.contains(item.el) && Math.abs(prev.docTop - item.docTop) < 18) {
        /* Prefer the more specific child element (e.g. h1, img, canvas) */
        deduped[deduped.length - 1] = item;
      } else {
        deduped.push(item);
      }
    }

    domTargetsRef.current = deduped;
    smoothScrollRef.current = 0;
    smoothedAgentsRef.current.clear();
    setIframeReady(true);
  }, []);

  /* Clean up build attributes once complete */
  const restoreFullDocument = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!doc || !win) return;
    doc.querySelectorAll('[data-sim-stage]').forEach((el) => {
      el.removeAttribute('data-sim-stage');
    });
    const styleEl = doc.getElementById('kit-sim-build-style');
    if (styleEl) styleEl.remove();
    try {
      win.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      /* ignore */
    }
  }, []);

  /* Synchronize DOM element reveal states + agent cursor coordinates with live iframe DOM */
  useEffect(() => {
    if (!iframeReady) return;
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!doc || !win) return;

    if (progress >= 1) {
      restoreFullDocument();
      setAgentVisuals([]);
      return;
    }

    /* Ensure build style exists when replaying */
    if (!doc.getElementById('kit-sim-build-style')) {
      collectIframeTargets();
    }

    const targets = domTargetsRef.current;
    if (!targets.length) return;

    const total = targets.length;
    const headFloat = progress * total;
    const headIdx = Math.min(total - 1, Math.max(0, Math.floor(headFloat)));
    const nextIdx = Math.min(total - 1, headIdx + 1);
    const localPhase = headFloat - Math.floor(headFloat);
    const smoothLocal = localPhase * localPhase * (3 - 2 * localPhase);

    /* Assign the 4 agents to the 4 elements currently rendering at the build frontier */
    const activeIndices = agents.map((_, aIdx) =>
      Math.max(0, Math.min(total - 1, headIdx - (agents.length - 1 - aIdx)))
    );
    const activeSet = new Set(activeIndices);

    for (let i = 0; i < total; i++) {
      const node = targets[i].el;
      const desired =
        i > headIdx ? 'pending' : activeSet.has(i) ? 'building' : 'done';
      if (node.getAttribute('data-sim-stage') !== desired) {
        node.setAttribute('data-sim-stage', desired);
      }
    }

    /* Smoothly interpolate and damp iframe scroll between current and next build target */
    const leadTarget = targets[headIdx];
    const nextTarget = targets[nextIdx] ?? leadTarget;
    if (leadTarget && playing) {
      const interpolatedDocTop =
        leadTarget.docTop + (nextTarget.docTop - leadTarget.docTop) * smoothLocal;
      const maxScroll = Math.max(0, doc.documentElement.scrollHeight - win.innerHeight);
      const desiredScroll = Math.max(
        0,
        Math.min(maxScroll, interpolatedDocTop - win.innerHeight * 0.48)
      );
      const prevScroll = smoothScrollRef.current ?? win.scrollY;
      const nextScroll = prevScroll + (desiredScroll - prevScroll) * 0.14;
      smoothScrollRef.current = nextScroll;
      win.scrollTo({ top: nextScroll, behavior: 'auto' });
    }

    /* Measure the live viewport bounding boxes of the 4 active elements */
    const vw = Math.max(1, win.innerWidth);
    const vh = Math.max(1, win.innerHeight);

    const nextVisuals: AgentLiveDrawState[] = agents.map((agent, aIdx) => {
      const targetIdx = activeIndices[aIdx];
      const target = targets[targetIdx];
      if (!target) {
        return {
          agent,
          x: 20 + aIdx * 18,
          y: 30,
          task: ' Rendering DOM',
          box: null,
        };
      }

      const rect = target.el.getBoundingClientRect();
      const rawLeftPct = Math.max(1, Math.min(94, (rect.left / vw) * 100));
      const rawTopPct = Math.max(2, Math.min(92, (rect.top / vh) * 100));
      const rawWidthPct = Math.max(4, Math.min(98 - rawLeftPct, (rect.width / vw) * 100));
      const rawHeightPct = Math.max(3, Math.min(96 - rawTopPct, (rect.height / vh) * 100));

      /* Trace the agent cursor along a continuous Lissajous path inside the active bounding box */
      const orbitAngle = localPhase * Math.PI * 2 + aIdx * 1.57;
      const sweepX = 0.5 + 0.34 * Math.sin(orbitAngle);
      const sweepY = 0.5 + 0.32 * Math.cos(orbitAngle * 0.75 + aIdx * 0.9);
      const rawCursorX = Math.max(3, Math.min(84, rawLeftPct + rawWidthPct * sweepX));
      const rawCursorY = Math.max(6, Math.min(91, rawTopPct + rawHeightPct * sweepY));

      const prevAgent = smoothedAgentsRef.current.get(agent.id);
      const lerpFactor = 0.22;
      const smoothed = prevAgent
        ? {
            x: prevAgent.x + (rawCursorX - prevAgent.x) * lerpFactor,
            y: prevAgent.y + (rawCursorY - prevAgent.y) * lerpFactor,
            left: prevAgent.left + (rawLeftPct - prevAgent.left) * lerpFactor,
            top: prevAgent.top + (rawTopPct - prevAgent.top) * lerpFactor,
            width: prevAgent.width + (rawWidthPct - prevAgent.width) * lerpFactor,
            height: prevAgent.height + (rawHeightPct - prevAgent.height) * lerpFactor,
          }
        : {
            x: rawCursorX,
            y: rawCursorY,
            left: rawLeftPct,
            top: rawTopPct,
            width: rawWidthPct,
            height: rawHeightPct,
          };
      smoothedAgentsRef.current.set(agent.id, smoothed);

      return {
        agent,
        x: smoothed.x,
        y: smoothed.y,
        task: ` ${target.label}`,
        box: {
          left: smoothed.left,
          top: smoothed.top,
          width: smoothed.width,
          height: smoothed.height,
          tag: `${agent.name} · ${target.label}`,
        },
      };
    });

    setAgentVisuals(nextVisuals);
  }, [progress, iframeReady, playing, agents, collectIframeTargets, restoreFullDocument]);

  /*
   * Animate progressive DOM build & HTML code stream over ~150 seconds (~13.6x slower than 11s).
   * Uses delta-time clamping (max 100ms per frame) to prevent tab-switch jumps and throttled
   * React state commits (~24fps) to avoid main-thread layout thrashing on 70–90KB HTML strings.
   */
  useEffect(() => {
    if (!iframeReady || !playing || reduced) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = null;
      return;
    }

    const BUILD_DURATION_MS = 150_000;
    const STATE_COMMIT_INTERVAL_MS = 42;

    const step = (now: number) => {
      if (!inViewRef.current || document.hidden) {
        lastTickRef.current = now;
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      if (lastTickRef.current === null) {
        lastTickRef.current = now;
      }
      const rawDt = now - lastTickRef.current;
      const dt = Math.min(100, Math.max(0, rawDt));
      lastTickRef.current = now;

      const next = Math.min(1, progressRef.current + dt / BUILD_DURATION_MS);
      progressRef.current = next;

      if (barFillRef.current) {
        barFillRef.current.style.transform = `scaleX(${next})`;
      }

      if (next >= 1) {
        setProgress(1);
        setPlaying(false);
        onDoneRef.current?.();
        return;
      }

      if (now - lastStateCommitRef.current >= STATE_COMMIT_INTERVAL_MS) {
        lastStateCommitRef.current = now;
        setProgress(next);
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = null;
    };
  }, [iframeReady, playing, reduced]);

  /* Auto-scroll the streaming HTML code pane unless the user manually scrolled up to read */
  const streamedCode = useMemo(() => {
    if (!codeHtml) return '';
    const charCount = Math.max(120, Math.floor(codeHtml.length * progress));
    return codeHtml.slice(0, charCount);
  }, [codeHtml, progress]);

  const lineCount = useMemo(() => {
    if (!streamedCode) return 0;
    return streamedCode.split('\n').length;
  }, [streamedCode]);

  const handleCodePaneScroll = useCallback(() => {
    if (autoScrollingCodeRef.current) return;
    const pre = codePreRef.current;
    if (!pre) return;
    const distanceFromBottom = pre.scrollHeight - pre.scrollTop - pre.clientHeight;
    userScrolledCodeRef.current = distanceFromBottom > 48;
  }, []);

  useEffect(() => {
    const pre = codePreRef.current;
    if (pre && playing && !userScrolledCodeRef.current) {
      autoScrollingCodeRef.current = true;
      pre.scrollTop = pre.scrollHeight;
      requestAnimationFrame(() => {
        autoScrollingCodeRef.current = false;
      });
    }
  }, [streamedCode, playing]);

  const togglePlay = () => {
    if (progress >= 1) {
      collectIframeTargets();
      progressRef.current = 0;
      setProgress(0);
      lastTickRef.current = null;
      userScrolledCodeRef.current = false;
      setPlaying(true);
    } else {
      lastTickRef.current = null;
      setPlaying((p) => !p);
    }
  };

  const replay = () => {
    collectIframeTargets();
    progressRef.current = 0;
    setProgress(0);
    lastTickRef.current = null;
    userScrolledCodeRef.current = false;
    setPlaying(true);
  };

  const finishImmediately = () => {
    progressRef.current = 1;
    setProgress(1);
    setPlaying(false);
    restoreFullDocument();
    onDoneRef.current?.();
  };

  const isComplete = progress >= 1;

  return (
    <div
      ref={simRootRef}
      className="kit-sim"
      role="group"
      aria-label={`${activeSite.name} live HTML build simulation`}
    >
      {/* Browser chrome with 10-site dropdown selector */}
      <div className="kit-sim-chrome">
        <div className="kit-sim-dots" aria-hidden="true">
          <span className="kit-sim-dot" />
          <span className="kit-sim-dot" />
          <span className="kit-sim-dot" />
        </div>

        <label className="kit-sim-picker-label">
          <span className="kit-sr-only">Choose website to build</span>
          <select
            className="kit-sim-select"
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            aria-label="Choose a website to watch being built"
          >
            {STUDIO_SITES.map((s, idx) => (
              <option key={s.slug} value={s.slug}>
                {String(idx + 1).padStart(2, '0')} · {s.name} — {s.subtitle}
              </option>
            ))}
          </select>
        </label>

        <span className="kit-sim-pill" aria-hidden="true">
          https://{activeSite.domain}
        </span>

        <div className="kit-sim-chrome-actions">
          <button
            type="button"
            className="kit-mini-btn"
            onClick={() => setShowCodePane((v) => !v)}
            aria-pressed={showCodePane}
          >
            {showCodePane ? 'Hide HTML Stream' : 'Show HTML Stream'}
          </button>
          <a
            href={activeSite.file}
            target="_blank"
            rel="noopener noreferrer"
            className="kit-mini-btn"
          >
            Open Full Site ↗
          </a>
        </div>
      </div>

      {/* Main split stage: streaming HTML source + live rendering iframe with agent cursors */}
      <div className={`kit-sim-stage kit-sim-stage--live ${showCodePane ? 'is-split' : ''}`}>
        {showCodePane && (
          <div className="kit-sim-codepane" aria-label="Streaming HTML file source">
            <div className="kit-sim-codepane__head">
              <span>{activeSite.slug}.html</span>
              <span>
                {lineCount} lines · {Math.round(progress * 100)}%
              </span>
            </div>
            <pre
              ref={codePreRef}
              onScroll={handleCodePaneScroll}
              className="kit-sim-codepane__pre"
            >
              <code>{streamedCode}</code>
              {!isComplete && <span className="kit-caret" />}
            </pre>
          </div>
        )}

        <div className="kit-sim-renderpane">
          <iframe
            ref={iframeRef}
            key={activeSite.slug}
            src={activeSite.file}
            onLoad={collectIframeTargets}
            title={`${activeSite.name} rendered website`}
            className="kit-sim-iframe"
          />

          {/* Live DOM bounding-box highlights + 4 agent cursors drawing directly over the rendering elements */}
          {!isComplete && agentVisuals.length > 0 && (
            <div className="kit-sim-overlay" aria-hidden="true">
              {agentVisuals.map(
                ({ agent, box }) =>
                  box && (
                    <div
                      key={`box-${agent.id}`}
                      className="kit-sim-target-box"
                      style={
                        {
                          left: `${box.left}%`,
                          top: `${box.top}%`,
                          width: `${box.width}%`,
                          height: `${box.height}%`,
                          '--agent-color': agent.color,
                        } as React.CSSProperties
                      }
                    >
                      <span className="kit-sim-target-box__tag">{box.tag}</span>
                    </div>
                  )
              )}
              {agentVisuals.map(({ agent, x, y, task }) => (
                <div
                  key={agent.id}
                  className="kit-sim-cursor"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transition:
                      'left 0.28s cubic-bezier(0.22, 1, 0.36, 1), top 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path
                      d="M1 1 L12.2 6.2 L6.9 7.6 L5.1 13 Z"
                      fill={agent.color}
                      stroke="#fff"
                      strokeWidth="1"
                    />
                  </svg>
                  <span className="kit-sim-chip" style={{ background: agent.color }}>
                    {agent.name}
                    <em className="kit-sim-chip__task">{task}</em>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress hairline */}
      <div className="kit-sim-bar" aria-hidden="true">
        <div ref={barFillRef} style={{ transform: `scaleX(${progress})` }} />
      </div>

      {/* Controls & agent legend */}
      <div className="kit-sim-controls">
        <div className="kit-sim-legend">
          {agents.map((a) => (
            <span className="kit-sim-agent" key={a.id}>
              <i style={{ background: a.color }} aria-hidden="true" />
              {a.name} <span>· {a.role}</span>
            </span>
          ))}
        </div>

        <div className="kit-sim-btns">
          <button
            type="button"
            className="kit-mini-btn"
            onClick={togglePlay}
            aria-label={playing ? 'Pause simulation' : 'Play simulation'}
            aria-pressed={playing}
          >
            {playing ? 'Pause' : isComplete ? 'Rebuild' : 'Play'}
          </button>
          {!isComplete && (
            <button
              type="button"
              className="kit-mini-btn"
              onClick={finishImmediately}
              aria-label="Finish build immediately"
            >
              Finish Build
            </button>
          )}
          <button
            type="button"
            className="kit-mini-btn"
            onClick={replay}
            aria-label="Replay simulation"
          >
            Replay
          </button>
        </div>
      </div>
    </div>
  );
}

export default StreamSimulator;
