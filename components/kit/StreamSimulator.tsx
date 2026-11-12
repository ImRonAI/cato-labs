'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BuildDirector, type DirectorStats } from './buildDirector';
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

type Stage = 'loading' | 'building' | 'complete';

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

/* ------------------------------------------------------------------ */
/*  StreamSimulator                                                    */
/* ------------------------------------------------------------------ */

/**
 * One of the ten finished flagship sites, drawn into place by four agents.
 * Each agent claims its own div in the current section, outlines it, paints it
 * in, then claims the next; the camera moves down a section once it is drawn.
 * The choreography lives in `buildDirector.ts`; this component is the browser
 * chrome, the controls and the optional streaming source pane around it.
 */
export function StreamSimulator({
  agents = DEFAULT_AGENTS,
  autoPlay = true,
  defaultCodeVisible = true,
  onDone,
}: {
  script?: StreamStep[];
  agents?: StreamAgent[];
  autoPlay?: boolean;
  loop?: boolean;
  /** whether the streaming HTML pane starts open (narrow placements start with the live render alone) */
  defaultCodeVisible?: boolean;
  onDone?: () => void;
  brand?: { name: string; domain: string };
}): React.JSX.Element {
  const [selectedSlug, setSelectedSlug] = useState<string>(STUDIO_SITES[0].slug);
  const [code, setCode] = useState<{ slug: string; html: string } | null>(null);
  const [reduced, setReduced] = useState<boolean>(false);
  const [showCodePane, setShowCodePane] = useState<boolean>(defaultCodeVisible);
  const [playing, setPlaying] = useState<boolean>(autoPlay);
  const [stage, setStage] = useState<Stage>('loading');
  const [stats, setStats] = useState<DirectorStats | null>(null);

  const simRootRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const barFillRef = useRef<HTMLDivElement | null>(null);
  const codePreRef = useRef<HTMLPreElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const finishRef = useRef<HTMLButtonElement | null>(null);
  const directorRef = useRef<BuildDirector | null>(null);
  /** the iframe document the current director is drawing */
  const builtDocRef = useRef<Document | null>(null);
  const inViewRef = useRef<boolean>(false);
  const playingRef = useRef<boolean>(autoPlay);
  const reducedRef = useRef<boolean>(false);
  const userScrolledCodeRef = useRef<boolean>(false);
  const autoScrollingCodeRef = useRef<boolean>(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const activeSite = useMemo(
    () => STUDIO_SITES.find((s) => s.slug === selectedSlug) ?? STUDIO_SITES[0],
    [selectedSlug]
  );

  const syncVisibility = useCallback(() => {
    directorRef.current?.setVisible(inViewRef.current && !document.hidden);
  }, []);

  /* Reduced motion: no build, the finished site as it is */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = (on: boolean) => {
      reducedRef.current = on;
      setReduced(on);
      if (on) directorRef.current?.finish();
    };
    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /* Build only while the simulator is on screen and the tab is in front */
  useEffect(() => {
    const node = simRootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      inViewRef.current = true;
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.intersectionRatio >= 0.25) inViewRef.current = true;
        else if (entry.intersectionRatio < 0.05) inViewRef.current = false;
        syncVisibility();
      },
      { threshold: [0, 0.05, 0.25, 0.5] }
    );
    obs.observe(node);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      obs.disconnect();
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, [syncVisibility]);

  /* A new site: tear the old build down; the new iframe's load starts the next one */
  useEffect(() => {
    setStage('loading');
    setStats(null);
    userScrolledCodeRef.current = false;
    return () => {
      directorRef.current?.destroy();
      directorRef.current = null;
    };
  }, [activeSite.slug]);

  /* The streaming source pane fetches the file only once someone opens it */
  useEffect(() => {
    if (!showCodePane || code?.slug === activeSite.slug) return;
    let cancelled = false;
    const slug = activeSite.slug;
    fetch(activeSite.file)
      .then((res) => (res.ok ? res.text() : ''))
      .then((html) => {
        if (!cancelled && html) setCode({ slug, html: stripBundledRuntimeForCodeView(html) });
      })
      .catch(() => {
        /* the live render works without the source pane */
      });
    return () => {
      cancelled = true;
    };
  }, [showCodePane, activeSite.slug, activeSite.file, code?.slug]);

  useEffect(() => {
    playingRef.current = playing;
    const director = directorRef.current;
    if (!director) return;
    if (playing) director.play();
    else director.pause();
  }, [playing]);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    const overlay = overlayRef.current;
    if (!iframe || !overlay) return;
    let path = '';
    let doc: Document | null = null;
    try {
      path = iframe.contentWindow?.location.pathname ?? '';
      doc = iframe.contentDocument;
    } catch {
      return;
    }
    // a link followed inside the finished site: leave the visitor to it
    if (path !== activeSite.file || !doc) return;
    // the same page can be reported twice (its load event, and the check below for a page that
    // loaded before hydration): one build per page
    if (directorRef.current && builtDocRef.current === doc) return;
    directorRef.current?.destroy();
    directorRef.current = null;
    builtDocRef.current = doc;
    // no build for this page (reduced motion, or it can't be measured): show it finished, with
    // the toggle offering to build it
    const showFinished = () => {
      playingRef.current = false;
      setPlaying(false);
      setStage('complete');
    };
    if (reducedRef.current) {
      showFinished();
      return;
    }
    let director: BuildDirector;
    try {
      director = new BuildDirector({
        iframe,
        overlay,
        agents,
        bar: barFillRef.current,
        onStats: setStats,
        onComplete: () => {
          playingRef.current = false;
          setStage('complete');
          setPlaying(false);
          onDoneRef.current?.();
        },
      });
    } catch {
      showFinished();
      return;
    }
    directorRef.current = director;
    director.setVisible(inViewRef.current && !document.hidden);
    if (playingRef.current) director.play();
    director
      .prepare()
      .then(() => {
        if (directorRef.current === director && !director.isComplete) setStage('building');
      })
      .catch(() => {
        // the page went away mid-measure: show it as it is rather than a veil that never lifts
        if (directorRef.current !== director) return;
        director.destroy();
        directorRef.current = null;
        showFinished();
      });
  }, [activeSite.file, agents]);

  /* A page that finished loading before hydration (a cached revisit) fired its load event before
     React was listening, so look for it: otherwise the veil would never lift */
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let ready = false;
    try {
      ready = iframe.contentDocument?.readyState === 'complete';
    } catch {
      return;
    }
    if (ready) handleLoad();
  }, [handleLoad]);

  const isComplete = stage === 'complete';
  const progress = isComplete ? 1 : stats?.progress ?? 0;

  /* A site picked from the list is a site someone wants to watch being drawn: it plays */
  const chooseSite = (slug: string) => {
    playingRef.current = true;
    setPlaying(true);
    setSelectedSlug(slug);
  };

  /* Replay starts over on a fresh copy of the page: whatever the visitor opened in the finished
     site (a menu, a routed view, a dialog) closes, and the agents begin again on a blank canvas.
     The reload's load event builds the new director. */
  const replay = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    userScrolledCodeRef.current = false;
    directorRef.current?.destroy();
    directorRef.current = null;
    playingRef.current = true;
    setPlaying(true);
    setStats(null);
    setStage('loading');
    try {
      iframe.contentWindow?.location.replace(activeSite.file);
    } catch {
      iframe.src = activeSite.file;
    }
  };

  const togglePlay = () => {
    if (isComplete) replay();
    else setPlaying((p) => !p);
  };

  const finishNow = () => {
    // the Finish button leaves with the build: keep keyboard focus in the controls
    const hadFocus = document.activeElement === finishRef.current;
    directorRef.current?.finish();
    if (hadFocus) toggleRef.current?.focus();
  };

  /* Source pane: the file streams in step with the drawing */
  const streamedCode = useMemo(() => {
    if (!showCodePane || !code || code.slug !== activeSite.slug) return '';
    return code.html.slice(0, Math.max(120, Math.floor(code.html.length * progress)));
  }, [showCodePane, code, activeSite.slug, progress]);

  const lineCount = useMemo(() => (streamedCode ? streamedCode.split('\n').length : 0), [streamedCode]);

  const handleCodePaneScroll = useCallback(() => {
    if (autoScrollingCodeRef.current) return;
    const pre = codePreRef.current;
    if (!pre) return;
    userScrolledCodeRef.current = pre.scrollHeight - pre.scrollTop - pre.clientHeight > 48;
  }, []);

  useEffect(() => {
    const pre = codePreRef.current;
    if (!pre || isComplete || userScrolledCodeRef.current) return;
    autoScrollingCodeRef.current = true;
    pre.scrollTop = pre.scrollHeight;
    const id = requestAnimationFrame(() => {
      autoScrollingCodeRef.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [streamedCode, isComplete]);

  const status =
    stage === 'loading'
      ? 'Preparing the canvas'
      : isComplete
        ? 'Every section drawn'
        : stats
          ? `Section ${stats.section.index} of ${stats.section.total} · ${stats.section.label}`
          : '';

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
            onChange={(e) => chooseSite(e.target.value)}
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

      {/* Main split stage: streaming HTML source + the live site the agents draw into */}
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

        <div className={`kit-sim-renderpane ${isComplete ? '' : 'is-building'}`}>
          <iframe
            ref={iframeRef}
            key={activeSite.slug}
            src={activeSite.file}
            onLoad={handleLoad}
            title={`${activeSite.name} rendered website`}
            className="kit-sim-iframe"
            tabIndex={isComplete ? 0 : -1}
          />
          {/* the build director draws the agents, their outlines and labels into this layer */}
          <div ref={overlayRef} className="kit-sim-overlay" aria-hidden="true" />
          <div className={`kit-sim-veil ${stage === 'loading' ? '' : 'is-off'}`} aria-hidden="true">
            <span className="kit-sim-veil__name">{activeSite.name}</span>
            <span className="kit-sim-veil__domain">{activeSite.domain}</span>
            <span className="kit-sim-veil__bar" />
          </div>
        </div>
      </div>

      {/* Progress hairline (the director moves it every frame) */}
      <div className={`kit-sim-bar ${isComplete ? 'is-full' : ''}`} aria-hidden="true">
        <div ref={barFillRef} />
      </div>

      {/* Agents, what they've drawn, and the controls */}
      <div className="kit-sim-controls">
        <div className="kit-sim-legend">
          {agents.map((a) => {
            const drawn = stats?.drawn[a.id] ?? 0;
            return (
              <span className="kit-sim-agent" key={a.id}>
                <i style={{ background: a.color }} aria-hidden="true" />
                {a.name} <span>· {a.role}</span>
                {!reduced && (
                  <b className="kit-sim-agent__count" title={`${drawn} divs drawn`}>
                    {drawn}
                  </b>
                )}
              </span>
            );
          })}
        </div>

        <div className="kit-sim-side">
          {!reduced && (
            <span className={`kit-sim-status ${isComplete ? 'is-done' : ''}`}>{status}</span>
          )}
          {reduced ? (
            <span className="kit-sim-note">Motion reduced · the finished site</span>
          ) : (
            <div className="kit-sim-btns">
              <button
                ref={toggleRef}
                type="button"
                className="kit-mini-btn"
                onClick={togglePlay}
                disabled={stage === 'loading'}
                aria-label={playing ? 'Pause the build' : isComplete ? 'Build it again' : 'Play the build'}
              >
                {playing ? 'Pause' : isComplete ? 'Rebuild' : 'Play'}
              </button>
              {!isComplete && (
                <button
                  ref={finishRef}
                  type="button"
                  className="kit-mini-btn"
                  onClick={finishNow}
                  disabled={stage === 'loading'}
                  aria-label="Finish the build now"
                >
                  Finish Build
                </button>
              )}
              <button
                type="button"
                className="kit-mini-btn"
                onClick={replay}
                disabled={stage === 'loading'}
                aria-label="Replay the build from the start"
              >
                Replay
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StreamSimulator;
