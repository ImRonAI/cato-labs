'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ARCH_NAMES,
  BRAND_PRESETS,
  BUILD_STEPS,
  DIAL_DEFS,
  MOTIF_NAMES,
  STRUCT_NAMES,
  VOICE_NAMES,
  buildStandaloneSvgString,
  clamp01,
  computeMarkGeometry,
  computePalette,
  computeTypePairing,
  computeVoice,
  fmt,
  hashBrandName,
  lerp,
  syncBrandBus,
  triggerBrandAssemblyPulse,
  type DialDef,
  type DialValues,
  type MarkGeometrySpec,
} from '@/lib/content/overhaul/cap-brand';

/* ================================================================
   THE IDENTITY ENGINE (evolved from SpectrumMachine)
   /capabilities/brand-creative

   The visitor types a company name and turns the Archetype, Voice
   and Structure dials. A deterministic generative grammar compiles
   a complete brand identity system live:
   01. Thesis & positioning coordinates
   02. Procedural SVG logomark (Swiss geometric grammar + SVG export)
   03. Wordmark lockup & deliberate type pairing + 5-tier type scale
   04. Blue-spectrum governed palette with roles & WCAG contrast
   05. Verbal identity matrix (Thesis, Flagship Headline, Product UI)
   06. Four live surface applications (Business Card, App Icon,
       Architectural Signage / Billboard, Flagship Website Hero)

   Synchronized at 60fps with BrandCreativeScene via `brandBus`.
   ================================================================ */

const INITIAL_DIALS: DialValues = { arch: 1 / 3, voice: 0.38, struct: 0.44 };
const SWEEP_RAD = (270 * Math.PI) / 180;

interface DialViz {
  needle: SVGGElement | null;
  arc: SVGCircleElement | null;
}

/** Pointer angle (atan2, y-down) → dial 0..1 value. */
function angleToValue(rad: number): number {
  const deg = (rad * 180) / Math.PI;
  if (deg > 45 && deg < 135) return deg <= 90 ? 1 : 0;
  const shifted = deg >= 135 ? deg - 360 : deg;
  return clamp01((shifted + 225) / 270);
}

/* ---------------------------------------------------------------- */
/*  Precision Rotary Dial                                            */
/* ---------------------------------------------------------------- */

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
    faceRef.current?.focus();
    faceRef.current?.setPointerCapture(e.pointerId);
    const a = pointerAngle(e.clientX, e.clientY);
    const v = angleToValue(a);
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
        <span className="sm-dial__current">
          {nearest.name} <span className="sm-dial__num">{fmt(value)}</span>
        </span>
      </div>
      <div className="sm-dial__body">
        <div
          ref={faceRef}
          className="sm-dial__face"
          role="slider"
          tabIndex={0}
          aria-label={def.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value * 100)}
          aria-valuetext={`${nearest.name} (${Math.round(value * 100)}%)`}
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
                y2="13"
                transform={`rotate(${fmt(-135 + s.v * 270)} 60 60)`}
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
              transform={`rotate(${fmt(-135 + value * 270)} 60 60)`}
            >
              <line className="sm-dial__needle" x1="60" y1="60" x2="60" y2="20" />
              <circle className="sm-dial__hub" cx="60" cy="60" r="16" />
              <line className="sm-dial__notch" x1="60" y1="46" x2="60" y2="30" />
            </g>
          </svg>
        </div>
        <div className="sm-dial__meta">
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
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Reusable crisp inline SVG Mark renderer for mockups              */
/* ---------------------------------------------------------------- */

function MiniBrandMark({
  mark,
  inverted = false,
  className = '',
}: {
  mark: MarkGeometrySpec;
  inverted?: boolean;
  className?: string;
}) {
  const strokeMain = inverted ? '#fafbfe' : mark.primaryColor;
  const strokeSub = inverted ? '#93a9ff' : mark.deepColor;
  const strokeTert = inverted ? '#6b87ff' : mark.secondaryColor;
  const dotFill = inverted ? '#6b87ff' : mark.primaryColor;

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path
        d={mark.tertiaryPath}
        fill="none"
        stroke={strokeTert}
        strokeWidth={fmt(mark.subStrokeWidth * 0.72)}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <path
        d={mark.primaryPath}
        fill="none"
        stroke={strokeMain}
        strokeWidth={fmt(mark.strokeWidth)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={mark.secondaryPath}
        fill="none"
        stroke={strokeSub}
        strokeWidth={fmt(mark.subStrokeWidth)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={fmt(mark.nodeX)} cy={fmt(mark.nodeY)} r={fmt(mark.nodeR)} fill={dotFill} />
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/*  Main Identity Engine Component                                   */
/* ---------------------------------------------------------------- */

export default function SpectrumMachine() {
  const nameInputId = useId();
  const [brandName, setBrandName] = useState<string>('Cato');
  const [dials, setDials] = useState<DialValues>(INITIAL_DIALS);
  const [motifOverride, setMotifOverride] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [darkStage, setDarkStage] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number>(5);
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [focusedApp, setFocusedApp] = useState<number>(-1);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [svgExportStatus, setSvgExportStatus] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const hasAutoPlayedRef = useRef<boolean>(false);

  const targetRef = useRef<DialValues>(INITIAL_DIALS);
  const shownRef = useRef<DialValues>({ ...INITIAL_DIALS });

  const archViz = useRef<DialViz>({ needle: null, arc: null });
  const voiceViz = useRef<DialViz>({ needle: null, arc: null });
  const structViz = useRef<DialViz>({ needle: null, arc: null });

  const primaryPathRef = useRef<SVGPathElement>(null);
  const secondaryPathRef = useRef<SVGPathElement>(null);
  const tertiaryPathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);

  // Derived deterministic brand specifications
  const seed = useMemo(() => hashBrandName(brandName), [brandName]);
  const mark = useMemo(
    () => computeMarkGeometry(seed, dials, motifOverride),
    [seed, dials, motifOverride],
  );
  const palette = useMemo(
    () => computePalette(dials.arch, dials.voice, dials.struct),
    [dials.arch, dials.voice, dials.struct],
  );

  const ai = Math.min(3, Math.max(0, Math.round(dials.arch * 3)));
  const vi = dials.voice < 0.5 ? 0 : 1;
  const si = dials.struct < 0.5 ? 0 : 1;
  const recipe = `${ARCH_NAMES[ai]} × ${VOICE_NAMES[vi]} × ${STRUCT_NAMES[si]}`;

  const { pairing, scale } = useMemo(
    () => computeTypePairing(seed.cleanName, ai, dials.voice, dials.struct),
    [seed.cleanName, ai, dials.voice, dials.struct],
  );
  const voiceOut = useMemo(
    () => computeVoice(seed.cleanName, ai, dials.voice, dials.struct),
    [seed.cleanName, ai, dials.voice, dials.struct],
  );

  const standaloneSvg = useMemo(
    () => buildStandaloneSvgString(seed.cleanName, mark, recipe),
    [seed.cleanName, mark, recipe],
  );

  // Keep refs & WebGL brandBus synchronized
  const seedRef = useRef(seed);
  const motifOverrideRef = useRef(motifOverride);
  const darkStageRef = useRef(darkStage);
  seedRef.current = seed;
  motifOverrideRef.current = motifOverride;
  darkStageRef.current = darkStage;

  useEffect(() => {
    targetRef.current = dials;
    syncBrandBus({
      brandName: seed.cleanName,
      motifIndex: mark.motifIndex,
      arch: dials.arch,
      voice: dials.voice,
      struct: dials.struct,
      cant: mark.cant,
      aperture: mark.aperture,
      strokeWeightNorm: dials.voice,
      activeStep,
      focusedApp,
    });
  }, [seed.cleanName, mark.motifIndex, mark.cant, mark.aperture, dials, activeStep, focusedApp]);

  const setDial = useCallback(
    (id: keyof DialValues) => (v: number) => {
      setDials((prev) => ({ ...prev, [id]: v }));
    },
    [],
  );

  // Step-by-step assembly sequence (driven by rAF elapsed time)
  const runAssemblySequence = useCallback(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    triggerBrandAssemblyPulse();
    if (reduced) {
      setActiveStep(5);
      setIsBuilding(false);
      return;
    }
    setIsBuilding(true);
    setActiveStep(0);
  }, []);

  useEffect(() => {
    if (!isBuilding) return;
    let raf = 0;
    const startAt = performance.now();
    const stepMs = 340;
    const tick = (now: number) => {
      const elapsed = now - startAt;
      const stepIdx = Math.floor(elapsed / stepMs);
      if (stepIdx >= 5) {
        setActiveStep(5);
        setIsBuilding(false);
        return;
      }
      setActiveStep(stepIdx);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isBuilding]);

  // Trigger initial assembly sequence when scrolled into view
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAutoPlayedRef.current) {
            hasAutoPlayedRef.current = true;
            runAssemblySequence();
          }
        }
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [runAssemblySequence]);

  // 60fps imperative morph loop for rotary needles & primary SVG specimen
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
      const l = reduced ? 1 : 0.18;
      s.arch += (t.arch - s.arch) * l;
      s.voice += (t.voice - s.voice) * l;
      s.struct += (t.struct - s.struct) * l;

      for (const [ref, key] of viz) {
        const v = s[key];
        const els = ref.current;
        els.needle?.setAttribute('transform', `rotate(${fmt(-135 + v * 270)} 60 60)`);
        els.arc?.setAttribute('stroke-dasharray', `${fmt(v * 75)} 100`);
      }

      const liveMark = computeMarkGeometry(seedRef.current, s, motifOverrideRef.current);
      const isDark = darkStageRef.current;
      const mainStroke = isDark ? '#fafbfe' : liveMark.primaryColor;
      const subStroke = isDark ? '#93a9ff' : liveMark.deepColor;
      const tertStroke = isDark ? '#6b87ff' : liveMark.secondaryColor;
      const dotFill = isDark ? '#6b87ff' : liveMark.primaryColor;

      if (primaryPathRef.current) {
        primaryPathRef.current.setAttribute('d', liveMark.primaryPath);
        primaryPathRef.current.setAttribute('stroke-width', fmt(liveMark.strokeWidth));
        primaryPathRef.current.setAttribute('stroke', mainStroke);
      }
      if (secondaryPathRef.current) {
        secondaryPathRef.current.setAttribute('d', liveMark.secondaryPath);
        secondaryPathRef.current.setAttribute('stroke-width', fmt(liveMark.subStrokeWidth));
        secondaryPathRef.current.setAttribute('stroke', subStroke);
      }
      if (tertiaryPathRef.current) {
        tertiaryPathRef.current.setAttribute('d', liveMark.tertiaryPath);
        tertiaryPathRef.current.setAttribute('stroke-width', fmt(liveMark.subStrokeWidth * 0.72));
        tertiaryPathRef.current.setAttribute('stroke', tertStroke);
      }
      if (dotRef.current) {
        dotRef.current.setAttribute('cx', fmt(liveMark.nodeX));
        dotRef.current.setAttribute('cy', fmt(liveMark.nodeY));
        dotRef.current.setAttribute('r', fmt(liveMark.nodeR));
        dotRef.current.setAttribute('fill', dotFill);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleSelectPreset = (preset: (typeof BRAND_PRESETS)[number]) => {
    setBrandName(preset.name);
    setDials(preset.dials);
    setMotifOverride(null);
    runAssemblySequence();
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([standaloneSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${seed.domainSlug}-identity-mark.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSvgExportStatus(`Exported ${seed.domainSlug}-identity-mark.svg`);
  };

  const handleCopyHex = (hex: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(hex).catch(() => {});
    }
    setCopiedHex(hex);
  };

  return (
    <div ref={rootRef} className="ie-shell" data-active-step={activeStep}>
      {/* ============================================================
          TOP BAR: Brand Name Input + Preset Seeds + Assembly Pipeline
          ============================================================ */}
      <div className="ie-command glass-card">
        <div className="ie-command__top">
          <div className="ie-input-group">
            <label htmlFor={nameInputId} className="micro-label">
              01 · Identity Seed (Company Name)
            </label>
            <div className="ie-input-row">
              <input
                id={nameInputId}
                type="text"
                className="ie-name-input"
                value={brandName}
                onChange={(e) => {
                  setBrandName(e.target.value);
                  setSvgExportStatus(null);
                }}
                placeholder="Type any company name…"
                aria-label="Company name"
                spellCheck={false}
              />
              <button
                type="button"
                className="ie-rebuild-btn"
                onClick={runAssemblySequence}
                aria-label="Assemble identity system step by step"
              >
                <span className="ie-rebuild-btn__dot" aria-hidden="true" />
                {isBuilding ? 'Assembling system…' : 'Assemble system'}
              </button>
            </div>
          </div>

          <div className="ie-presets" role="group" aria-label="Sample company presets">
            <span className="ie-presets__label">Presets</span>
            <div className="ie-presets__list">
              {BRAND_PRESETS.map((p) => {
                const active = seed.cleanName.toLowerCase() === p.name.toLowerCase();
                return (
                  <button
                    key={p.name}
                    type="button"
                    className="sm-stop ie-preset-pill"
                    aria-pressed={active}
                    onClick={() => handleSelectPreset(p)}
                  >
                    <span>{p.name}</span>
                    <span className="ie-preset-pill__sector">{p.sector}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step-by-step assembly bar (Vibe Studio style) */}
        <div className="ie-pipeline" role="status" aria-live="polite">
          {BUILD_STEPS.map((st, idx) => {
            const state =
              idx < activeStep ? 'done' : idx === activeStep ? 'active' : 'queued';
            return (
              <button
                key={st.id}
                type="button"
                className={`ie-step ie-step--${state}`}
                onClick={() => {
                  setActiveStep(idx);
                  triggerBrandAssemblyPulse();
                }}
              >
                <span className="ie-step__top">
                  <span className="ie-step__idx">{st.index}</span>
                  <span className="ie-step__status" aria-hidden="true">
                    {idx <= activeStep ? '●' : '○'}
                  </span>
                </span>
                <span className="ie-step__label">{st.label}</span>
                <span className="ie-step__detail">{st.detail}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================
          MAIN WORKSPACE: Left Dials & Voice / Right Live System
          ============================================================ */}
      <div className="sm-grid">
        {/* ---------- LEFT COLUMN: Dials + Motif Grammar + Voice ---------- */}
        <div className="sm-controls glass-card">
          <div className="sm-controls__header">
            <span className="micro-label">System Dials</span>
            <span className="index-no">3 AXES · CONTINUOUS</span>
          </div>

          <Dial def={DIAL_DEFS[0]} value={dials.arch} onChange={setDial('arch')} vizRef={archViz} />
          <Dial def={DIAL_DEFS[1]} value={dials.voice} onChange={setDial('voice')} vizRef={voiceViz} />
          <Dial
            def={DIAL_DEFS[2]}
            value={dials.struct}
            onChange={setDial('struct')}
            vizRef={structViz}
          />

          {/* Geometric grammar selector */}
          <div className="ie-grammar-box">
            <div className="sm-dial__head">
              <span className="sm-dial__label">Geometric Grammar</span>
              <span className="sm-dial__current">{mark.motifName}</span>
            </div>
            <div className="sm-stops" role="group" aria-label="Geometric motif grammar">
              <button
                type="button"
                className="sm-stop"
                aria-pressed={motifOverride === null}
                onClick={() => setMotifOverride(null)}
              >
                Auto ({MOTIF_NAMES[seed.motifIndex]})
              </button>
              {MOTIF_NAMES.map((mName, idx) => (
                <button
                  key={mName}
                  type="button"
                  className="sm-stop"
                  aria-pressed={motifOverride === idx}
                  onClick={() => setMotifOverride(idx)}
                >
                  {mName}
                </button>
              ))}
            </div>
          </div>

          {/* 05: Voice & Narrative Matrix */}
          <div className={`sm-voice ie-module ${activeStep >= 4 ? 'is-ready' : 'is-pending'}`}>
            <div className="ie-module__head">
              <span className="micro-label">05 · Verbal Identity Matrix</span>
              <span className="index-no">{voiceOut.tagline}</span>
            </div>

            <div className="ie-voice-pillars" aria-label="Voice tone pillars">
              {voiceOut.tonePillars.map((pillar) => (
                <span key={pillar} className="ie-voice-pillar">
                  {pillar}
                </span>
              ))}
            </div>

            <div className="ie-voice-block">
              <span className="ie-voice-block__label">Flagship Headline</span>
              <p className="sm-headline" aria-live="polite">
                <span key={voiceOut.headline}>{voiceOut.headline}</span>
              </p>
            </div>

            <div className="ie-voice-block">
              <span className="ie-voice-block__label">Brand Thesis</span>
              <p className="ie-voice-thesis" aria-live="polite">
                {voiceOut.thesis}
              </p>
            </div>

            <div className="ie-voice-block">
              <span className="ie-voice-block__label">Product / Support Surface</span>
              <p className="ie-voice-micro" aria-live="polite">
                “{voiceOut.productLine}”
              </p>
            </div>
          </div>
        </div>

        {/* ---------- RIGHT COLUMN: Live Identity Specification ---------- */}
        <div className="ie-spec-column">
          {/* MODULE 02 & 03: Procedural Logomark + Wordmark Lockup */}
          <div className={`sm-stage glass-card ie-module ${activeStep >= 1 ? 'is-ready' : 'is-pending'}`}>
            <div className="sm-stage__top">
              <div>
                <span className="micro-label">02 · Procedural Logomark & Wordmark</span>
                <p className="ie-stage-sub">
                  {mark.motifName} · Seed #{String(seed.hash % 9000 + 1000)} · {recipe}
                </p>
              </div>
              <div className="ie-stage-actions">
                <button
                  type="button"
                  className="sm-stop"
                  aria-pressed={showGrid}
                  onClick={() => setShowGrid((v) => !v)}
                >
                  Grid: {showGrid ? 'On' : 'Off'}
                </button>
                <button
                  type="button"
                  className="sm-stop"
                  aria-pressed={darkStage}
                  onClick={() => setDarkStage((v) => !v)}
                >
                  Surface: {darkStage ? 'Ink' : 'Paper'}
                </button>
                <button
                  type="button"
                  className="ie-download-btn"
                  data-testid="download-svg-btn"
                  onClick={handleDownloadSvg}
                >
                  Download .SVG ↓
                </button>
              </div>
            </div>

            <div className="ie-mark-split">
              {/* Left: Procedural SVG Blueprint */}
              <div
                className={`sm-stage__frame ${darkStage ? 'sm-stage__frame--dark' : ''}`}
                data-svg-ready="true"
              >
                <svg
                  className="sm-mark"
                  viewBox="0 0 100 100"
                  role="img"
                  aria-label={`Generative identity mark for ${seed.cleanName} — ${recipe}`}
                >
                  {showGrid && (
                    <g className="ie-svg-grid" aria-hidden="true">
                      <line x1="0" y1="50" x2="100" y2="50" />
                      <line x1="50" y1="0" x2="50" y2="100" />
                      <line x1="14" y1="14" x2="86" y2="86" />
                      <line x1="86" y1="14" x2="14" y2="86" />
                      <circle cx="50" cy="50" r="36" />
                      <circle cx="50" cy="50" r="22" />
                      <rect x="14" y="14" width="72" height="72" rx="4" />
                    </g>
                  )}
                  <path
                    ref={tertiaryPathRef}
                    d={mark.tertiaryPath}
                    fill="none"
                    stroke={darkStage ? '#6b87ff' : mark.secondaryColor}
                    strokeWidth={fmt(mark.subStrokeWidth * 0.72)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.85}
                  />
                  <path
                    ref={primaryPathRef}
                    d={mark.primaryPath}
                    fill="none"
                    stroke={darkStage ? '#fafbfe' : mark.primaryColor}
                    strokeWidth={fmt(mark.strokeWidth)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    ref={secondaryPathRef}
                    d={mark.secondaryPath}
                    fill="none"
                    stroke={darkStage ? '#93a9ff' : mark.deepColor}
                    strokeWidth={fmt(mark.subStrokeWidth)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    ref={dotRef}
                    cx={fmt(mark.nodeX)}
                    cy={fmt(mark.nodeY)}
                    r={fmt(mark.nodeR)}
                    fill={darkStage ? '#6b87ff' : mark.primaryColor}
                  />
                </svg>

                <div className="ie-mark-telemetry">
                  <span>w {fmt(mark.strokeWidth)}</span>
                  <span>r {fmt(mark.cornerRadius)}</span>
                  <span>θ {mark.innerAngleDeg}°</span>
                </div>
              </div>

              {/* Right: Live Wordmark Lockup & Type Pairing */}
              <div className="ie-wordmark-panel">
                <div className={`ie-lockup-card ${darkStage ? 'ie-lockup-card--dark' : ''}`}>
                  <span className="ie-lockup-card__tag">Primary Horizontal Lockup</span>
                  <div className="ie-lockup-row">
                    <div className="ie-lockup-mark">
                      <MiniBrandMark mark={mark} inverted={darkStage} />
                    </div>
                    <span
                      className="ie-lockup-word"
                      style={{
                        fontFamily: pairing.displayFontFamily,
                        fontWeight: pairing.displayWeight,
                        letterSpacing: `${pairing.displayTrackingEm}em`,
                        textTransform: pairing.displayTransform,
                        fontStyle: pairing.displayStyle,
                      }}
                    >
                      {seed.cleanName}
                    </span>
                  </div>
                  <div className="ie-lockup-sub">
                    <span>{seed.domainSlug}.com</span>
                    <span>{recipe}</span>
                  </div>
                </div>

                <div className="ie-pairing-meta">
                  <div className="ie-pairing-meta__head">
                    <span className="micro-label micro-label--ink">03 · Deliberate Type Pairing</span>
                    <span className="ie-pairing-meta__name">{pairing.name}</span>
                  </div>
                  <p className="ie-pairing-meta__desc">{pairing.rationale}</p>
                  <div className="ie-pairing-chips">
                    <div className="ie-pairing-chip">
                      <span className="ie-pairing-chip__role">Display</span>
                      <strong>{pairing.displayLabel}</strong>
                    </div>
                    <div className="ie-pairing-chip">
                      <span className="ie-pairing-chip__role">Editorial / UI</span>
                      <strong>{pairing.secondaryLabel}</strong>
                    </div>
                    <div className="ie-pairing-chip">
                      <span className="ie-pairing-chip__role">Telemetry</span>
                      <strong>{pairing.monoLabel}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {svgExportStatus && (
              <p className="ie-export-toast" role="status" aria-live="polite">
                ✓ {svgExportStatus} (512×512 standalone vector mark)
              </p>
            )}
          </div>

          {/* MODULE 04: Blue-Spectrum Palette with Roles */}
          <div className={`glass-card ie-card ie-module ${activeStep >= 3 ? 'is-ready' : 'is-pending'}`}>
            <div className="ie-module__head">
              <div>
                <span className="micro-label">04 · Blue-Spectrum Palette & Roles</span>
                <p className="ie-stage-sub">
                  Governed 5-role chromatic ramp — click any swatch to copy its hex token
                </p>
              </div>
              {copiedHex && (
                <span className="ie-copied-badge" role="status" aria-live="polite">
                  Copied {copiedHex}
                </span>
              )}
            </div>

            {/* Proportional spectrum bar */}
            <div className="ie-palette-bar" aria-hidden="true">
              {palette.map((sw) => (
                <div
                  key={sw.token}
                  className="ie-palette-bar__seg"
                  style={{
                    width: `${sw.sharePct}%`,
                    backgroundColor: sw.hex,
                  }}
                />
              ))}
            </div>

            <div className="ie-swatches">
              {palette.map((sw, idx) => {
                const isLight = idx <= 1;
                return (
                  <button
                    key={sw.token}
                    type="button"
                    className="ie-swatch"
                    onClick={() => handleCopyHex(sw.hex)}
                    aria-label={`${sw.role} ${sw.hex} (${sw.contrastBadge})`}
                  >
                    <div
                      className={`ie-swatch__chip ${isLight ? 'ie-swatch__chip--bordered' : ''}`}
                      style={{ backgroundColor: sw.hex }}
                    >
                      <span
                        className="ie-swatch__badge"
                        style={{ color: isLight ? '#0a0c12' : '#fafbfe' }}
                      >
                        {sw.contrastBadge}
                      </span>
                      <span
                        className="ie-swatch__share"
                        style={{ color: isLight ? '#454b59' : '#dce4ff' }}
                      >
                        {sw.sharePct}%
                      </span>
                    </div>
                    <div className="ie-swatch__info">
                      <span className="ie-swatch__role">{sw.role}</span>
                      <code className="ie-swatch__hex">{sw.hex.toUpperCase()}</code>
                      <span className="ie-swatch__usage">{sw.usage}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MODULE 03B: Governed Type Scale */}
          <div className={`glass-card ie-card ie-module ${activeStep >= 2 ? 'is-ready' : 'is-pending'}`}>
            <div className="ie-module__head">
              <span className="micro-label">03 · Optical Type Scale</span>
              <span className="index-no">5-TIER PROPORTIONAL HIERARCHY</span>
            </div>

            <div className="ie-typescale">
              {scale.map((row) => (
                <div key={row.tag} className="ie-typescale__row">
                  <div className="ie-typescale__meta">
                    <span className="ie-typescale__tag">{row.tag}</span>
                    <span className="ie-typescale__role">{row.role}</span>
                    <code className="ie-typescale__metrics">
                      {row.remSize} ({row.pxSize}) · LH {row.lineHeight} · {row.tracking}
                    </code>
                  </div>
                  <p
                    className="ie-typescale__sample"
                    style={{
                      fontFamily: row.fontFamily,
                      fontWeight: row.weight,
                      letterSpacing: row.tracking,
                      lineHeight: row.lineHeight,
                    }}
                  >
                    {row.sample}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* MODULE 06: Surface Applications (4 Crisp Live Mockups) */}
          <div className={`glass-card ie-card ie-module ${activeStep >= 5 ? 'is-ready' : 'is-pending'}`}>
            <div className="ie-module__head">
              <div>
                <span className="micro-label">06 · Surface Applications</span>
                <p className="ie-stage-sub">
                  Pressure-tested across print, OS icon, architectural signage and flagship web
                </p>
              </div>
              <div className="sm-stops" role="group" aria-label="Inspect surface application">
                {[
                  { id: -1, label: 'All 4' },
                  { id: 0, label: 'Business Card' },
                  { id: 1, label: 'App Icon' },
                  { id: 2, label: 'Signage' },
                  { id: 3, label: 'Website Hero' },
                ].map((tab) => (
                  <button
                    key={tab.label}
                    type="button"
                    className="sm-stop"
                    aria-pressed={focusedApp === tab.id}
                    onClick={() => setFocusedApp(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ie-apps-grid">
              {/* 1. BUSINESS CARD MOCKUP */}
              {(focusedApp === -1 || focusedApp === 0) && (
                <article
                  className="ie-app-card"
                  onMouseEnter={() => syncBrandBus({ focusedApp: 0 })}
                  onMouseLeave={() => syncBrandBus({ focusedApp })}
                >
                  <div className="ie-app-card__head">
                    <span className="index-no">01 · PRINT & STATIONERY</span>
                    <span className="ie-app-card__title">Executive Business Card</span>
                  </div>
                  <div className="ie-mockup-bcard">
                    {/* Back face (deep blue) */}
                    <div
                      className="ie-bcard-sheet ie-bcard-sheet--back"
                      style={{
                        background: `linear-gradient(135deg, ${palette[2].hex} 0%, #0a1890 100%)`,
                      }}
                    >
                      <div className="ie-bcard-sheet__mark">
                        <MiniBrandMark mark={mark} inverted />
                      </div>
                      <span className="ie-bcard-sheet__domain">{seed.domainSlug}.com</span>
                    </div>
                    {/* Front face (paper white with electric blue bevel) */}
                    <div
                      className="ie-bcard-sheet ie-bcard-sheet--front"
                      style={{ borderTopColor: palette[2].hex }}
                    >
                      <div className="ie-bcard-front__top">
                        <div className="ie-bcard-front__lockup">
                          <div className="ie-bcard-front__mini">
                            <MiniBrandMark mark={mark} />
                          </div>
                          <span
                            style={{
                              fontFamily: pairing.displayFontFamily,
                              fontWeight: pairing.displayWeight,
                              letterSpacing: `${pairing.displayTrackingEm}em`,
                              textTransform: pairing.displayTransform,
                            }}
                          >
                            {seed.cleanName}
                          </span>
                        </div>
                        <span className="ie-bcard-front__code">№ 01</span>
                      </div>
                      <div className="ie-bcard-front__bottom">
                        <p className="ie-bcard-front__person">Elena Vance · Principal Architect</p>
                        <p className="ie-bcard-front__contact">
                          architecture@{seed.domainSlug}.com · {ARCH_NAMES[ai]} Division
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* 2. APP ICON MOCKUP */}
              {(focusedApp === -1 || focusedApp === 1) && (
                <article
                  className="ie-app-card"
                  onMouseEnter={() => syncBrandBus({ focusedApp: 1 })}
                  onMouseLeave={() => syncBrandBus({ focusedApp })}
                >
                  <div className="ie-app-card__head">
                    <span className="index-no">02 · PRODUCT SURFACE</span>
                    <span className="ie-app-card__title">OS App Icon & Launcher</span>
                  </div>
                  <div className="ie-mockup-icon">
                    <div className="ie-squircle-stage">
                      <div
                        className="ie-squircle"
                        style={{
                          background: `radial-gradient(circle at 30% 24%, ${palette[3].hex} 0%, ${palette[2].hex} 52%, #0a1890 100%)`,
                        }}
                      >
                        <div className="ie-squircle__gloss" aria-hidden="true" />
                        <div className="ie-squircle__mark">
                          <MiniBrandMark mark={mark} inverted />
                        </div>
                      </div>
                      <span className="ie-squircle__label">{seed.cleanName}</span>
                    </div>

                    <div className="ie-icon-specs">
                      <div className="ie-icon-notif">
                        <div className="ie-icon-notif__badge">
                          <MiniBrandMark mark={mark} />
                        </div>
                        <div>
                          <strong>{seed.cleanName} OS</strong>
                          <p>{voiceOut.productLine}</p>
                        </div>
                      </div>
                      <div className="ie-icon-meta">
                        <span>Superellipse r=22.5%</span>
                        <span>1024×1024 Master</span>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* 3. SIGNAGE / BILLBOARD MOCKUP */}
              {(focusedApp === -1 || focusedApp === 2) && (
                <article
                  className="ie-app-card"
                  onMouseEnter={() => syncBrandBus({ focusedApp: 2 })}
                  onMouseLeave={() => syncBrandBus({ focusedApp })}
                >
                  <div className="ie-app-card__head">
                    <span className="index-no">03 · ENVIRONMENTAL & OOH</span>
                    <span className="ie-app-card__title">Architectural Signage & Billboard</span>
                  </div>
                  <div
                    className="ie-mockup-billboard"
                    style={{
                      background: `linear-gradient(125deg, #0a1890 0%, ${palette[2].hex} 62%, #1226c8 100%)`,
                    }}
                  >
                    <div className="ie-billboard__grid" aria-hidden="true" />
                    <div className="ie-billboard__top">
                      <div className="ie-billboard__lockup">
                        <div className="ie-billboard__mark">
                          <MiniBrandMark mark={mark} inverted />
                        </div>
                        <span
                          style={{
                            fontFamily: pairing.displayFontFamily,
                            fontWeight: pairing.displayWeight,
                            letterSpacing: `${pairing.displayTrackingEm}em`,
                            textTransform: pairing.displayTransform,
                          }}
                        >
                          {seed.cleanName}
                        </span>
                      </div>
                      <span className="ie-billboard__wayfinding">PAVILION 04 ↗</span>
                    </div>

                    <p
                      className="ie-billboard__headline"
                      style={{
                        fontFamily: pairing.displayFontFamily,
                        fontWeight: pairing.displayWeight,
                        letterSpacing: `${pairing.displayTrackingEm}em`,
                      }}
                    >
                      {voiceOut.headline}
                    </p>

                    <div className="ie-billboard__foot">
                      <span>{seed.domainSlug}.com</span>
                      <span>
                        {voiceOut.tonePillars[0]} · {voiceOut.tonePillars[1]} ·{' '}
                        {voiceOut.tonePillars[2]}
                      </span>
                    </div>
                  </div>
                </article>
              )}

              {/* 4. WEBSITE HERO MOCKUP */}
              {(focusedApp === -1 || focusedApp === 3) && (
                <article
                  className="ie-app-card"
                  onMouseEnter={() => syncBrandBus({ focusedApp: 3 })}
                  onMouseLeave={() => syncBrandBus({ focusedApp })}
                >
                  <div className="ie-app-card__head">
                    <span className="index-no">04 · DIGITAL FLAGSHIP</span>
                    <span className="ie-app-card__title">Flagship Website Hero</span>
                  </div>
                  <div className="ie-mockup-web">
                    {/* Browser Chrome */}
                    <div className="ie-web__chrome">
                      <div className="ie-web__dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="ie-web__url">https://{seed.domainSlug}.com</div>
                      <span className="ie-web__status">99 CWV</span>
                    </div>

                    {/* Browser Viewport */}
                    <div className="ie-web__body" style={{ backgroundColor: palette[0].hex }}>
                      <div className="ie-web__nav">
                        <div className="ie-web__brand">
                          <div className="ie-web__brand-mark">
                            <MiniBrandMark mark={mark} />
                          </div>
                          <strong
                            style={{
                              fontFamily: pairing.displayFontFamily,
                              letterSpacing: `${pairing.displayTrackingEm}em`,
                            }}
                          >
                            {seed.cleanName}
                          </strong>
                        </div>
                        <div className="ie-web__links">
                          <span>System</span>
                          <span>Evidence</span>
                          <span
                            className="ie-web__nav-pill"
                            style={{ backgroundColor: palette[2].hex }}
                          >
                            Deploy
                          </span>
                        </div>
                      </div>

                      <div className="ie-web__hero">
                        <div className="ie-web__hero-copy">
                          <span className="ie-web__eyebrow" style={{ color: palette[2].hex }}>
                            ■ {ARCH_NAMES[ai].toUpperCase()} ARCHITECTURE
                          </span>
                          <h4
                            className="ie-web__h1"
                            style={{
                              fontFamily: pairing.displayFontFamily,
                              fontWeight: pairing.displayWeight,
                              letterSpacing: `${pairing.displayTrackingEm}em`,
                              textTransform: pairing.displayTransform,
                            }}
                          >
                            {voiceOut.headline}
                          </h4>
                          <p
                            className="ie-web__lede"
                            style={{ fontFamily: pairing.secondaryFontFamily }}
                          >
                            {voiceOut.thesis}
                          </p>
                          <div className="ie-web__cta-row">
                            <span
                              className="ie-web__cta"
                              style={{ backgroundColor: palette[2].hex }}
                            >
                              Explore {seed.cleanName} →
                            </span>
                            <span className="ie-web__cta-ghost">Documentation</span>
                          </div>
                        </div>

                        <div
                          className="ie-web__hero-art"
                          style={{ backgroundColor: palette[1].hex }}
                        >
                          <MiniBrandMark mark={mark} />
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
