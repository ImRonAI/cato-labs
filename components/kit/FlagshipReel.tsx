'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  flagshipShowcase,
  homeWebDesign,
  type FlagshipSite,
} from '@/lib/content/studio';
import { CtaButton } from '@/components/ui/Magnetic';
import { scrollToTarget } from '@/components/webgl/ScrollDirector';

interface StudioConciergeWindow extends Window {
  StudioConcierge?: {
    open: (prompt?: string) => void;
    close: () => void;
  };
}

interface LivePreviewState {
  slug: string;
  loaded: boolean;
  conciergeReqId: number;
  prompt?: string;
}

const VIRTUAL_DESKTOP_W = 1280;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Renders copy with Cato's electric-blue terminal full stop. */
function TerminalPeriod({ text }: { text: string }) {
  if (!text.endsWith('.')) return <>{text}</>;
  return (
    <>
      {text.slice(0, -1)}
      <span className="text-accent">.</span>
    </>
  );
}

/**
 * Bespoke sovereign brass-and-velour architectural relief for Velour Capital,
 * whose flagship site renders a procedural Three.js canvas rather than photography.
 */
function VelourArchitecturalPlate() {
  return (
    <div className="flagship-velour" aria-hidden="true">
      <svg
        viewBox="0 0 800 450"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flagship-velour__svg"
      >
        <defs>
          <radialGradient id="velourGlow" cx="58%" cy="44%" r="60%">
            <stop offset="0%" stopColor="#3a332d" />
            <stop offset="48%" stopColor="#231f1b" />
            <stop offset="100%" stopColor="#141210" />
          </radialGradient>
          <linearGradient id="brassStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c9b283" stopOpacity="0.72" />
            <stop offset="50%" stopColor="#b59b6a" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#ece6dc" stopOpacity="0.12" />
          </linearGradient>
        </defs>
        <rect width="800" height="450" fill="url(#velourGlow)" />
        {/* Architectural datum grid */}
        <line x1="88" y1="0" x2="88" y2="450" stroke="rgba(217,210,199,0.08)" />
        <line x1="400" y1="0" x2="400" y2="450" stroke="rgba(217,210,199,0.08)" />
        <line x1="712" y1="0" x2="712" y2="450" stroke="rgba(217,210,199,0.08)" />
        <line x1="0" y1="112" x2="800" y2="112" stroke="rgba(217,210,199,0.08)" />
        <line x1="0" y1="338" x2="800" y2="338" stroke="rgba(217,210,199,0.08)" />
        {/* Sovereign meridian rings */}
        <circle cx="485" cy="218" r="168" stroke="url(#brassStroke)" strokeWidth="1.2" />
        <circle cx="485" cy="218" r="124" stroke="rgba(201,178,131,0.26)" strokeWidth="0.9" />
        <circle cx="485" cy="218" r="76" stroke="rgba(201,178,131,0.42)" strokeWidth="1" />
        <ellipse
          cx="485"
          cy="218"
          rx="218"
          ry="84"
          transform="rotate(-16 485 218)"
          stroke="url(#brassStroke)"
          strokeWidth="1"
        />
        {/* Stepped brass ledger bars */}
        <rect x="430" y="138" width="2" height="160" fill="#b59b6a" fillOpacity="0.65" />
        <rect x="458" y="116" width="2" height="204" fill="#c9b283" fillOpacity="0.85" />
        <rect x="486" y="98" width="2" height="240" fill="#ece6dc" fillOpacity="0.55" />
        <rect x="514" y="126" width="2" height="184" fill="#b59b6a" fillOpacity="0.7" />
        <rect x="542" y="152" width="2" height="132" fill="#b59b6a" fillOpacity="0.45" />
        <circle cx="486" cy="98" r="3.5" fill="#c9b283" />
        <circle cx="458" cy="116" r="3" fill="#b59b6a" />
      </svg>
      <div className="flagship-velour__stamp">
        <span>DIRECT LENDING · MEZZANINE · SOVEREIGN</span>
        <span>LONDON · ZURICH</span>
      </div>
    </div>
  );
}

/**
 * Art-directed flagship plate rendered inside the glass browser viewport.
 * Uses scoped --fp-* variables from the site's own authentic brand palette.
 */
function FlagshipPlate({
  site,
  eager,
  onAskConcierge,
}: {
  site: FlagshipSite;
  eager: boolean;
  onAskConcierge: (site: FlagshipSite, prompt?: string) => void;
}) {
  const plateStyle = {
    '--fp-bg': site.palette.bg,
    '--fp-surface': site.palette.surface,
    '--fp-fg': site.palette.fg,
    '--fp-muted': site.palette.muted,
    '--fp-accent': site.palette.accent,
  } as React.CSSProperties;

  return (
    <div
      className={`flagship-plate flagship-plate--${site.palette.scheme}`}
      style={plateStyle}
    >
      {/* Internal flagship masthead */}
      <div className="flagship-plate__top">
        <div className="flagship-plate__brand">
          <span className="flagship-plate__wordmark">{site.name}</span>
          <span className="flagship-plate__loc">{site.location}</span>
        </div>
        <div className="flagship-plate__specimens">
          <span className="flagship-plate__type-chip" title={homeWebDesign.typographyLabel}>
            {site.typography.display} · {site.typography.specimen}
          </span>
          <span className="flagship-plate__swatches" aria-hidden="true">
            {site.palette.swatches.map((hex, idx) => (
              <i key={`${site.slug}-sw-${idx}`} style={{ background: hex }} />
            ))}
          </span>
        </div>
      </div>

      {/* Hero visual + editorial overlay */}
      <div className="flagship-plate__hero">
        <div className="flagship-plate__media">
          {site.heroImage ? (
            <img
              src={site.heroImage}
              alt={`${site.name} — ${site.discipline} (${site.location})`}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              className="flagship-plate__img"
            />
          ) : (
            <VelourArchitecturalPlate />
          )}
          <div className="flagship-plate__scrim" aria-hidden="true" />
        </div>

        {site.detailImage && (
          <div className="flagship-plate__inset" aria-hidden="true">
            <img
              src={site.detailImage}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

        <div className="flagship-plate__copy">
          <p className="flagship-plate__discipline">{site.discipline}</p>
          <h3 className="flagship-plate__headline">{site.headline}</h3>
          <p className="flagship-plate__summary">{site.summary}</p>
        </div>
      </div>

      {/* Structured architecture + live Mistral concierge bar */}
      <div className="flagship-plate__foot">
        <div className="flagship-plate__sections" aria-label={homeWebDesign.architectureLabel}>
          {site.sections.map((sec) => (
            <span key={sec} className="flagship-plate__sec-pill">
              {sec}
            </span>
          ))}
        </div>

        <button
          type="button"
          className="flagship-plate__concierge-prompt"
          onClick={() => onAskConcierge(site, site.conciergePrompt)}
        >
          <span className="flagship-plate__orb" aria-hidden="true" />
          <span className="flagship-plate__persona">{site.conciergeName}</span>
          <span className="flagship-plate__question">“{site.conciergePrompt}”</span>
          <span className="flagship-plate__ask-arrow" aria-hidden="true">
            ↗
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * FlagshipReel — Homepage showcase of Cato Labs' ten bespoke flagship builds.
 *
 * - Desktop (> 960px, prefers-reduced-motion: no-preference):
 *   420vh outer track (`data-scene-section="flagships"`) with a 100svh sticky
 *   stage that scrubs smoothly across 01 / 10 → 10 / 10 at 60fps via ref-driven
 *   depth transforms, paired with an interactive index rail and an on-demand
 *   scaled desktop live iframe + Mistral GLM 5.3 Flash AI concierge launcher.
 * - Mobile (<= 960px) or `prefers-reduced-motion: reduce`:
 *   Zero scroll-jacking; renders a clean, tactile editorial gallery.
 */
export default function FlagshipReel() {
  const count = flagshipShowcase.length;
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const activeIdxRef = useRef(0);
  const conciergeSeqRef = useRef(0);
  const handledConciergeRef = useRef(0);

  const [activeIndex, setActiveIndex] = useState(0);
  const [pinnedMode, setPinnedMode] = useState(true);
  const [liveState, setLiveState] = useState<LivePreviewState | null>(null);
  const [frameBox, setFrameBox] = useState({ scale: 0.62, virtualH: 800 });

  const activeSite = flagshipShowcase[activeIndex] ?? flagshipShowcase[0];
  const isLiveForActive = liveState?.slug === activeSite.slug;

  /* Track viewport breakpoint & prefers-reduced-motion */
  useEffect(() => {
    const mqWide = window.matchMedia('(min-width: 961px)');
    const mqMotion = window.matchMedia('(prefers-reduced-motion: no-preference)');
    const update = () => {
      setPinnedMode(mqWide.matches && mqMotion.matches);
    };
    update();
    mqWide.addEventListener('change', update);
    mqMotion.addEventListener('change', update);
    return () => {
      mqWide.removeEventListener('change', update);
      mqMotion.removeEventListener('change', update);
    };
  }, []);

  /* Keep virtual 1280px desktop iframe scaled cleanly to exact glass viewport ratio */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        const scale = w / VIRTUAL_DESKTOP_W;
        const virtualH = Math.round(VIRTUAL_DESKTOP_W * (h / w));
        setFrameBox({ scale, virtualH });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pinnedMode]);

  /* When active flagship changes via scroll, close any stale iframe for another site */
  useEffect(() => {
    activeIdxRef.current = activeIndex;
    setLiveState((prev) => (prev && prev.slug !== flagshipShowcase[activeIndex]?.slug ? null : prev));
  }, [activeIndex]);

  /* Desktop 60fps scroll-scrub choreography (zero per-frame React state) */
  useEffect(() => {
    if (!pinnedMode) return;
    let raf = 0;
    let smoothPos = activeIdxRef.current;
    let initialized = false;

    const applySlides = (pos: number, progress01: number) => {
      if (stageRef.current) {
        stageRef.current.style.setProperty('--reel-p', progress01.toFixed(4));
      }
      for (let i = 0; i < count; i++) {
        const el = slideRefs.current[i];
        if (!el) continue;
        const delta = i - pos; // >0 upcoming below, <0 passed above
        const abs = Math.abs(delta);
        if (abs > 1.35) {
          el.style.visibility = 'hidden';
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }
        el.style.visibility = 'visible';
        const opacity = delta >= 0 ? clamp01(1 - delta * 1.08) : clamp01(1 + delta * 1.18);
        const ty = delta >= 0 ? delta * 44 : delta * 28;
        const sc = delta >= 0 ? 1 - delta * 0.036 : 1 + (-delta) * 0.032;
        el.style.opacity = opacity.toFixed(4);
        el.style.transform = `translate3d(0, ${ty.toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
        el.style.zIndex = String(20 - Math.round(abs * 10));
        el.style.pointerEvents = abs < 0.45 ? 'auto' : 'none';
      }
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const sec = sectionRef.current;
      if (!sec) return;
      const rect = sec.getBoundingClientRect();
      const vh = window.innerHeight;
      const scrollable = Math.max(1, rect.height - vh);
      const raw = clamp01(-rect.top / scrollable);
      const scrub = clamp01((raw - 0.03) / 0.94);
      const targetPos = scrub * (count - 1);

      if (!initialized) {
        smoothPos = targetPos;
        initialized = true;
      } else {
        smoothPos += (targetPos - smoothPos) * 0.18;
      }

      applySlides(smoothPos, scrub);

      const discrete = Math.min(count - 1, Math.max(0, Math.round(scrub * (count - 1))));
      if (discrete !== activeIdxRef.current) {
        activeIdxRef.current = discrete;
        setActiveIndex(discrete);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pinnedMode, count]);

  /* Jump smoothly to flagship `index` on the pinned track (or gallery card on mobile) */
  const handleSelectIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(count - 1, index));
      setActiveIndex(clamped);
      if (pinnedMode && sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        const sectionTop = rect.top + window.scrollY;
        const scrollable = Math.max(1, rect.height - window.innerHeight);
        const targetRaw = 0.03 + (clamped / (count - 1)) * 0.94;
        const targetY = sectionTop + targetRaw * scrollable;
        scrollToTarget(targetY, { offset: 0, duration: 1.05 });
      } else {
        const slug = flagshipShowcase[clamped]?.slug;
        if (slug) {
          scrollToTarget(`#flagship-card-${slug}`, { offset: -104, duration: 0.9 });
        }
      }
    },
    [count, pinnedMode],
  );

  /* Keyboard Left/Right navigation on the index rail */
  const handleRailKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleSelectIndex((activeIdxRef.current + 1) % count);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handleSelectIndex((activeIdxRef.current - 1 + count) % count);
      }
    },
    [count, handleSelectIndex],
  );

  /* Toggle live interactive iframe or launch the embedded Mistral AI concierge */
  const toggleLivePreview = useCallback((site: FlagshipSite) => {
    setLiveState((prev) =>
      prev?.slug === site.slug
        ? null
        : { slug: site.slug, loaded: false, conciergeReqId: 0 },
    );
  }, []);

  const launchLiveConcierge = useCallback((site: FlagshipSite, prompt?: string) => {
    const nextReqId = ++conciergeSeqRef.current;
    setLiveState((prev) => {
      if (prev?.slug === site.slug) {
        return { ...prev, conciergeReqId: nextReqId, prompt };
      }
      return { slug: site.slug, loaded: false, conciergeReqId: nextReqId, prompt };
    });
  }, []);

  const handleIframeLoad = useCallback(() => {
    setLiveState((prev) => (prev ? { ...prev, loaded: true } : null));
  }, []);

  /* Open StudioConcierge once the iframe's React root has mounted its window API */
  useEffect(() => {
    if (!liveState || !liveState.loaded || liveState.conciergeReqId === 0) return;
    if (handledConciergeRef.current === liveState.conciergeReqId) return;

    let raf = 0;
    const tryOpen = () => {
      const win = iframeRef.current?.contentWindow as StudioConciergeWindow | null;
      if (win?.StudioConcierge) {
        handledConciergeRef.current = liveState.conciergeReqId;
        win.StudioConcierge.open(liveState.prompt);
        return;
      }
      raf = requestAnimationFrame(tryOpen);
    };
    raf = requestAnimationFrame(tryOpen);
    return () => cancelAnimationFrame(raf);
  }, [liveState]);

  return (
    <section
      ref={sectionRef}
      data-scene-section="flagships"
      className={`home-flagships${pinnedMode ? ' is-pinned' : ' is-gallery'}`}
      aria-labelledby="home-web-title"
    >
      {pinnedMode ? (
        /* ============================================================
           DESKTOP PINNED STAGE (420vh track · 100svh sticky showcase)
           ============================================================ */
        <div ref={stageRef} className="home-flagships-stage">
          <div className="container-x home-flagships-grid">
            {/* ---- LEFT EDITORIAL RAIL ---- */}
            <div className="flagship-rail">
              <div className="flagship-rail__eyebrow-row">
                <p className="micro-label">{homeWebDesign.eyebrow}</p>
                <span className="index-no flagship-rail__counter" aria-live="polite">
                  <strong className="text-accent">{activeSite.index}</strong>
                  <span> / {String(count).padStart(2, '0')}</span>
                </span>
              </div>

              <h2 className="h2 flagship-rail__title" id="home-web-title">
                <span>{homeWebDesign.titleLines[0]}</span>
                <span>
                  <TerminalPeriod text={homeWebDesign.titleLines[1]} />
                </span>
              </h2>

              <p className="flagship-rail__body">{homeWebDesign.body}</p>

              {/* Progress meter + interactive 01–10 index rail */}
              <div className="flagship-rail__meter">
                <div className="flagship-rail__progress" aria-hidden="true">
                  <span className="flagship-rail__progress-fill" />
                </div>
                <div
                  className="flagship-index-strip"
                  role="tablist"
                  aria-label="Flagship concept builds"
                  onKeyDown={handleRailKeyDown}
                >
                  {flagshipShowcase.map((site, i) => {
                    const isActive = i === activeIndex;
                    return (
                      <button
                        key={site.slug}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-label={`${site.index} ${site.name} — ${site.discipline}`}
                        title={`${site.index} · ${site.name}`}
                        className={`flagship-index-btn${isActive ? ' is-active' : ''}`}
                        onClick={() => handleSelectIndex(i)}
                      >
                        <span>{site.index}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active flagship editorial readout */}
              <div className="flagship-dossier glass-card" aria-live="polite">
                <div className="flagship-dossier__head">
                  <div>
                    <span className="index-no flagship-dossier__no">{activeSite.index}</span>
                    <h3 className="flagship-dossier__name">{activeSite.name}</h3>
                  </div>
                  <span className="flagship-dossier__domain">{activeSite.domain}</span>
                </div>
                <p className="flagship-dossier__meta">
                  <span>{activeSite.discipline}</span>
                  <i aria-hidden="true" />
                  <span>{activeSite.location}</span>
                </p>
                <div className="flagship-concierge-badge">
                  <span className="flagship-concierge-badge__dot" aria-hidden="true" />
                  <span className="flagship-concierge-badge__model">
                    {homeWebDesign.conciergeBadge}
                  </span>
                  <span className="flagship-concierge-badge__persona">
                    {activeSite.conciergeName}
                  </span>
                </div>
              </div>

              {/* Primary + Practice CTAs */}
              <div className="flagship-rail__actions">
                <a
                  href={activeSite.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--blue flagship-rail__primary-btn"
                >
                  <span className="btn-label">{homeWebDesign.exploreFlagshipLabel}</span>
                  <span className="btn-arrow" aria-hidden="true">
                    <span className="btn-arrow__a">↗</span>
                    <span className="btn-arrow__b">↗</span>
                  </span>
                </a>
                <CtaButton
                  href={homeWebDesign.cta.href}
                  label={homeWebDesign.cta.label}
                  variant="ghost"
                />
              </div>
            </div>

            {/* ---- RIGHT REFRACTIVE GLASS BROWSER VIEWPORT ---- */}
            <div className="flagship-browser">
              <div className="flagship-browser__chrome">
                <div className="flagship-browser__dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>

                <div className="flagship-browser__url" title={activeSite.href}>
                  <span className="flagship-browser__lock" aria-hidden="true" />
                  <span className="flagship-browser__host">{activeSite.domain}</span>
                  <span className="flagship-browser__path">{activeSite.href}</span>
                </div>

                <div className="flagship-browser__controls">
                  <button
                    type="button"
                    className={`flagship-chrome-btn${isLiveForActive ? ' is-on' : ''}`}
                    onClick={() => toggleLivePreview(activeSite)}
                    aria-pressed={isLiveForActive}
                  >
                    <span className="flagship-chrome-btn__dot" aria-hidden="true" />
                    <span>
                      {isLiveForActive
                        ? homeWebDesign.editorialPlateLabel
                        : homeWebDesign.livePreviewLabel}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="flagship-chrome-btn flagship-chrome-btn--accent"
                    onClick={() => launchLiveConcierge(activeSite)}
                  >
                    <span>{homeWebDesign.launchConciergeLabel}</span>
                  </button>

                  <a
                    href={activeSite.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flagship-chrome-link"
                    aria-label={`${homeWebDesign.openFullTabLabel}: ${activeSite.name}`}
                    title={homeWebDesign.openFullTabLabel}
                  >
                    <span>{homeWebDesign.openFullTabLabel}</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>

              <div ref={viewportRef} className="flagship-viewport">
                {/* 10 layered flagship plates scrubbed continuously by scroll */}
                <div
                  className={`flagship-deck${isLiveForActive ? ' is-under-live' : ''}`}
                  aria-hidden={isLiveForActive}
                >
                  {flagshipShowcase.map((site, i) => (
                    <div
                      key={site.slug}
                      ref={(el) => {
                        slideRefs.current[i] = el;
                      }}
                      className="flagship-slide"
                      style={{
                        opacity: i === activeIndex ? 1 : 0,
                        visibility: Math.abs(i - activeIndex) <= 1 ? 'visible' : 'hidden',
                        zIndex: 20 - Math.abs(i - activeIndex),
                      }}
                    >
                      <FlagshipPlate
                        site={site}
                        eager={i <= 1}
                        onAskConcierge={launchLiveConcierge}
                      />
                    </div>
                  ))}
                </div>

                {/* On-demand responsive scaled desktop iframe */}
                {isLiveForActive && liveState && (
                  <div className="flagship-live-layer">
                    {!liveState.loaded && (
                      <div className="flagship-live-loading" role="status">
                        <span className="flagship-live-loading__spinner" aria-hidden="true" />
                        <span>{homeWebDesign.loadingPreviewLabel}</span>
                      </div>
                    )}
                    <iframe
                      ref={iframeRef}
                      key={activeSite.slug}
                      src={activeSite.href}
                      title={`${activeSite.name} — ${activeSite.discipline}`}
                      className={`flagship-live-iframe${liveState.loaded ? ' is-ready' : ''}`}
                      style={{
                        width: `${VIRTUAL_DESKTOP_W}px`,
                        height: `${frameBox.virtualH}px`,
                        transform: `scale(${frameBox.scale})`,
                      }}
                      onLoad={handleIframeLoad}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================
           TACTILE EDITORIAL GALLERY (<= 960px or reduced motion)
           Zero scroll-jacking; every flagship is immediately reachable.
           ============================================================ */
        <div className="container-x section-y flagship-gallery-wrap">
          <header className="flagship-gallery-head">
            <p className="micro-label">{homeWebDesign.eyebrow}</p>
            <h2 className="h2 flagship-rail__title" id="home-web-title">
              <span>{homeWebDesign.titleLines[0]}</span>
              <span>
                <TerminalPeriod text={homeWebDesign.titleLines[1]} />
              </span>
            </h2>
            <p className="body-lg flagship-gallery-body">{homeWebDesign.body}</p>
            <ul className="home-web-facts">
              {homeWebDesign.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>

            <nav className="flagship-gallery-jumps" aria-label="Jump to flagship">
              {flagshipShowcase.map((site, i) => (
                <button
                  key={site.slug}
                  type="button"
                  className={`flagship-index-btn${i === activeIndex ? ' is-active' : ''}`}
                  onClick={() => handleSelectIndex(i)}
                >
                  <span>{site.index}</span>
                  <span className="flagship-index-btn__name">{site.name}</span>
                </button>
              ))}
            </nav>
          </header>

          <div className="flagship-gallery-grid">
            {flagshipShowcase.map((site, i) => {
              const isCardLive = liveState?.slug === site.slug;
              return (
                <article
                  key={site.slug}
                  id={`flagship-card-${site.slug}`}
                  className="flagship-gallery-card glass-card"
                >
                  <div className="flagship-gallery-card__top">
                    <div className="flagship-gallery-card__title-group">
                      <span className="index-no text-accent">{site.index}</span>
                      <h3 className="h3">{site.name}</h3>
                    </div>
                    <span className="flagship-dossier__domain">{site.domain}</span>
                  </div>

                  <p className="flagship-dossier__meta">
                    <span>{site.discipline}</span>
                    <i aria-hidden="true" />
                    <span>{site.location}</span>
                  </p>

                  <div className="flagship-gallery-card__frame">
                    {isCardLive ? (
                      <div className="flagship-gallery-card__live">
                        <iframe
                          ref={iframeRef}
                          src={site.href}
                          title={`${site.name} — ${site.discipline}`}
                          className="flagship-gallery-card__iframe"
                          onLoad={handleIframeLoad}
                        />
                      </div>
                    ) : (
                      <FlagshipPlate
                        site={site}
                        eager={i <= 1}
                        onAskConcierge={launchLiveConcierge}
                      />
                    )}
                  </div>

                  <div className="flagship-gallery-card__foot">
                    <div className="flagship-concierge-badge">
                      <span className="flagship-concierge-badge__dot" aria-hidden="true" />
                      <span className="flagship-concierge-badge__model">
                        {homeWebDesign.conciergeBadge}
                      </span>
                      <span className="flagship-concierge-badge__persona">
                        {site.conciergeName}
                      </span>
                    </div>

                    <div className="flagship-gallery-card__actions">
                      <a
                        href={site.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--blue flagship-card-btn"
                      >
                        <span className="btn-label">{homeWebDesign.exploreFlagshipLabel}</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                      <button
                        type="button"
                        className="btn btn--ghost flagship-card-btn"
                        onClick={() => toggleLivePreview(site)}
                      >
                        <span className="btn-label">
                          {isCardLive
                            ? homeWebDesign.editorialPlateLabel
                            : homeWebDesign.livePreviewLabel}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="link-line flagship-card-concierge-link"
                        onClick={() => launchLiveConcierge(site)}
                      >
                        <span>{homeWebDesign.launchConciergeLabel}</span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="flagship-gallery-cta">
            <Link href={homeWebDesign.cta.href} className="btn">
              <span className="btn-label">{homeWebDesign.cta.label}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
