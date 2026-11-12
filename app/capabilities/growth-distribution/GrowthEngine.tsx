'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ALLOCATION_PRESETS,
   BASELINE_MONTHLY_REVENUE,
  CHANNELS,
  COMPOSITE_ARPU,
  GROSS_MARGIN,
  LAUNCH_ASSETS,
  type ChannelId,
  type EngineMode,
  type HorizonMonths,
  growthEngineCopy,
  normalizeWeights,
  simulateAssetLaunch,
  simulateGrowthEngine,
} from '@/lib/content/overhaul/cap-growth';
import {
  engineBus,
  subscribeEngineDirectives,
  triggerWebglLaunchWave,
} from '@/components/webgl/scenes/capabilities/children/growth-distribution/engine-bus';

function fmtCurrency(n: number, compact = true): string {
  if (!Number.isFinite(n)) return '$0';
  if (compact) {
    if (Math.abs(n) >= 1_000_000) {
      return `$${(n / 1_000_000).toFixed(2)}M`;
    }
    if (Math.abs(n) >= 1_000) {
      return `$${Math.round(n / 1_000)}K`;
    }
  }
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

type LaunchStage = 'ready' | 'indexing' | 'cutting' | 'fanning' | 'converted';

const LAUNCH_STAGE_LABELS: Record<LaunchStage, string> = {
  ready: 'Ready to publish canonical asset across active channels',
  indexing: 'Stage 01 / 04 — Indexing canonical URL, JSON-LD schema & llms.txt entity graph…',
  cutting: 'Stage 02 / 04 — Cutting narrative into six native platform dialects & partner kit…',
  fanning: 'Stage 03 / 04 — Distributing weighted audience streams across all 6 channels…',
  converted: 'Stage 04 / 04 — Attribution complete: qualified pipeline & compounding cohorts booked.',
};

export default function GrowthEngine() {
  const [activePresetId, setActivePresetId] = useState<string>(
    ALLOCATION_PRESETS[0].id,
  );
  const [monthlyBudget, setMonthlyBudget] = useState<number>(
    ALLOCATION_PRESETS[0].monthlyBudget,
  );
  const [horizonMonths, setHorizonMonths] = useState<HorizonMonths>(
    ALLOCATION_PRESETS[0].horizonMonths,
  );
  const [mode, setMode] = useState<EngineMode>(ALLOCATION_PRESETS[0].mode);
  const [rawWeights, setRawWeights] = useState<Record<ChannelId, number>>({
    ...ALLOCATION_PRESETS[0].weights,
  });
  const [hoveredChannel, setHoveredChannel] = useState<ChannelId | null>(null);
  const [inspectedMonth, setInspectedMonth] = useState<number>(24);

  // Content Launch Moment state
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    LAUNCH_ASSETS[0].id,
  );
  const [launchStage, setLaunchStage] = useState<LaunchStage>('converted');
  const [launchCount, setLaunchCount] = useState<number>(1);
  const launchTimersRef = useRef<number[]>([]);

  const normalizedWeights = useMemo(
    () => normalizeWeights(rawWeights),
    [rawWeights],
  );

  const sim = useMemo(
    () =>
      simulateGrowthEngine({
        monthlyBudget,
        horizonMonths,
        mode,
        weights: normalizedWeights,
      }),
    [monthlyBudget, horizonMonths, mode, normalizedWeights],
  );

  const launchSummary = useMemo(
    () =>
      simulateAssetLaunch({
        assetId: selectedAssetId,
        monthlyBudget,
        weights: normalizedWeights,
        mode,
        cohortLtv: sim.cohortLtv,
      }),
    [selectedAssetId, monthlyBudget, normalizedWeights, mode, sim.cohortLtv],
  );

  // Keep inspectedMonth within horizonMonths
  const clampedInspectedMonth = Math.min(
    horizonMonths,
    Math.max(1, inspectedMonth),
  );
  const inspectedRecord =
    sim.horizonRecords[clampedInspectedMonth - 1] ??
    sim.horizonRecords[sim.horizonRecords.length - 1];

  // Sync live state to the WebGL engineBus
  useEffect(() => {
    engineBus.monthlyBudget = monthlyBudget;
    engineBus.horizonMonths = horizonMonths;
    engineBus.mode = mode;
    engineBus.weights = normalizedWeights;
    engineBus.activeChannel = hoveredChannel;
    engineBus.inspectedMonth = clampedInspectedMonth;
    engineBus.webglHeights = sim.webglHeights;
    engineBus.webglActivityHeights = sim.webglActivityHeights;
    engineBus.growthMultiple = sim.growthMultiple;
    engineBus.compoundingShare = sim.compoundingShare;
  }, [
    monthlyBudget,
    horizonMonths,
    mode,
    normalizedWeights,
    hoveredChannel,
    clampedInspectedMonth,
    sim,
  ]);

  const clearLaunchTimers = useCallback(() => {
    for (const id of launchTimersRef.current) {
      window.clearTimeout(id);
    }
    launchTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearLaunchTimers();
  }, [clearLaunchTimers]);

  const handleLaunchAsset = useCallback(
    (assetIdOverride?: string) => {
      const targetAsset = assetIdOverride ?? selectedAssetId;
      if (assetIdOverride) setSelectedAssetId(assetIdOverride);
      clearLaunchTimers();
      setLaunchCount((c) => c + 1);
      triggerWebglLaunchWave(targetAsset);

      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduced) {
        setLaunchStage('converted');
        return;
      }

      setLaunchStage('indexing');
      const t1 = window.setTimeout(() => setLaunchStage('cutting'), 650);
      const t2 = window.setTimeout(() => setLaunchStage('fanning'), 1450);
      const t3 = window.setTimeout(() => setLaunchStage('converted'), 2650);
      launchTimersRef.current = [t1, t2, t3];
    },
    [selectedAssetId, clearLaunchTimers],
  );

  const applyPreset = useCallback((presetId: string) => {
    const p = ALLOCATION_PRESETS.find((item) => item.id === presetId);
    if (!p) return;
    setActivePresetId(p.id);
    setMonthlyBudget(p.monthlyBudget);
    setHorizonMonths(p.horizonMonths);
    setMode(p.mode);
    setRawWeights({ ...p.weights });
    setInspectedMonth(p.horizonMonths);
  }, []);

  // Listen for directives from LeverGrid cards lower on the page
  useEffect(() => {
    return subscribeEngineDirectives((dir) => {
      if (dir.presetId) {
        applyPreset(dir.presetId);
      }
      if (dir.focusChannel !== undefined) {
        setHoveredChannel(dir.focusChannel);
      }
      if (dir.triggerLaunch) {
        handleLaunchAsset();
      }
    });
  }, [applyPreset, handleLaunchAsset]);

  const handleChannelSlider = useCallback((chId: ChannelId, pctValue: number) => {
    setActivePresetId('custom');
    setRawWeights((prev) => {
      const nextVal = Math.max(0.02, Math.min(0.75, pctValue / 100));
      return {
        ...prev,
        [chId]: nextVal,
      };
    });
  }, []);

  // Build SVG Stacked Area Chart geometry for 1..horizonMonths
  const chartGeom = useMemo(() => {
    const W = 760;
    const H = 310;
    const padL = 52;
    const padR = 20;
    const padT = 26;
    const padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const records = sim.horizonRecords;
    const N = records.length;

    let maxY = BASELINE_MONTHLY_REVENUE * 2.2;
    for (const r of records) {
      if (r.architectureRevenue > maxY) maxY = r.architectureRevenue;
      if (r.activityRevenue > maxY) maxY = r.activityRevenue;
      if (r.totalRevenue > maxY) maxY = r.totalRevenue;
    }
    maxY *= 1.08;

    const xForIndex = (i: number) =>
      Number((padL + (N <= 1 ? 0 : (i / (N - 1)) * plotW)).toFixed(2));
    const yForValue = (v: number) =>
      Number((padT + plotH - Math.max(0, Math.min(1, v / maxY)) * plotH).toFixed(2));

    // Stacked channel polygons (bottom to top: local, crm, partners, social, paid, seo)
    const stackOrder: ChannelId[] = [
      'local',
      'crm',
      'partners',
      'social',
      'paid',
      'seo',
    ];
    const runningBottom = new Array<number>(N).fill(0);

    const layers = stackOrder.map((chId) => {
      const chSpec = CHANNELS.find((c) => c.id === chId)!;
      const topPts: [number, number][] = [];
      const botPts: [number, number][] = [];

      for (let i = 0; i < N; i++) {
        const x = xForIndex(i);
        const y0 = yForValue(runningBottom[i]);
        const nextVal = runningBottom[i] + records[i].byChannel[chId];
        const y1 = yForValue(nextVal);
        runningBottom[i] = nextVal;
        topPts.push([x, y1]);
        botPts.push([x, y0]);
      }

      const dParts: string[] = [];
      topPts.forEach(([x, y], idx) => {
        dParts.push(`${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
      });
      for (let idx = botPts.length - 1; idx >= 0; idx--) {
        const [x, y] = botPts[idx];
        dParts.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
      }
      dParts.push('Z');

      return {
        id: chId,
        tint: chSpec.tint,
        d: dParts.join(' '),
      };
    });

    // Architecture Crest Line & Activity-Only Baseline Line
    const archLinePts = records
      .map((r, i) => `${xForIndex(i).toFixed(1)},${yForValue(r.architectureRevenue).toFixed(1)}`)
      .join(' ');
    const actLinePts = records
      .map((r, i) => `${xForIndex(i).toFixed(1)},${yForValue(r.activityRevenue).toFixed(1)}`)
      .join(' ');
    const activeTopPts = records
      .map((r, i) => `${xForIndex(i).toFixed(1)},${yForValue(r.totalRevenue).toFixed(1)}`)
      .join(' ');

    // Y-axis grid ticks
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => {
      const val = maxY * frac;
      return {
        y: yForValue(val),
        label: fmtCurrency(val, true),
      };
    });

    // Milestones within horizon
    const milestones = records
      .map((r, i) =>
        r.milestone
          ? {
              month: r.month,
              label: r.milestone,
              x: xForIndex(i),
              y: yForValue(r.totalRevenue),
            }
          : null,
      )
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const inspectedIdx = Math.min(N - 1, Math.max(0, clampedInspectedMonth - 1));
    const inspectedX = xForIndex(inspectedIdx);
    const inspectedY = yForValue(records[inspectedIdx].totalRevenue);
    const inspectedActY = yForValue(records[inspectedIdx].activityRevenue);

    return {
      W,
      H,
      padL,
      padR,
      padT,
      padB,
      plotW,
      plotH,
      layers,
      archLinePts,
      actLinePts,
      activeTopPts,
      yTicks,
      milestones,
      inspectedX,
      inspectedY,
      inspectedActY,
      xForIndex,
    };
  }, [sim.horizonRecords, clampedInspectedMonth]);

  const handleChartPointer = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      const relX = ((e.clientX - rect.left) / rect.width) * chartGeom.W;
      const u = Math.max(
        0,
        Math.min(1, (relX - chartGeom.padL) / chartGeom.plotW),
      );
      const m = Math.round(1 + u * (horizonMonths - 1));
      setInspectedMonth(m);
    },
    [chartGeom, horizonMonths],
  );

  const archAdvantageMonthly =
    sim.finalArchitectureRevenue - sim.finalActivityRevenue;
  const archAdvantageCumulative =
    sim.cumulativeArchitectureRevenue - sim.cumulativeActivityRevenue;

  return (
    <div className="ge-studio glass-card" aria-label="The Growth Engine interactive cohort simulator">
      {/* ---------- 1. TOP CONSOLE BAR: PRESETS + GLOBAL CONTROLS ---------- */}
      <div className="ge-topbar">
        <div className="ge-presets" role="group" aria-label="Allocation presets">
          <span className="ge-control-label">Architecture Presets</span>
          <div className="ge-preset-pills">
            {ALLOCATION_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="ge-preset-pill"
                aria-pressed={activePresetId === p.id}
                onClick={() => applyPreset(p.id)}
              >
                <span>{p.label}</span>
                <small>{p.badge}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="ge-global-controls">
          {/* Monthly Budget Slider */}
          <div className="ge-budget-control">
            <div className="ge-budget-control__head">
              <label htmlFor="ge-monthly-budget" className="ge-control-label">
                Monthly Budget
              </label>
              <output htmlFor="ge-monthly-budget" className="ge-budget-readout">
                {fmtCurrency(monthlyBudget, false)}
                <span>/mo</span>
              </output>
            </div>
            <input
              id="ge-monthly-budget"
              type="range"
              min={15_000}
              max={150_000}
              step={5_000}
              value={monthlyBudget}
              onChange={(e) => {
                setActivePresetId('custom');
                setMonthlyBudget(Number(e.target.value));
              }}
              className="ge-range ge-range--primary"
            />
          </div>

          {/* Horizon Selector (12M / 18M / 24M) */}
          <div className="ge-segmented-wrap">
            <span className="ge-control-label">Horizon</span>
            <div className="ge-segmented" role="group" aria-label="Projection horizon in months">
              {([12, 18, 24] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  className="ge-seg-btn"
                  aria-pressed={horizonMonths === h}
                  onClick={() => {
                    setHorizonMonths(h);
                    setInspectedMonth(h);
                  }}
                >
                  {h}M
                </button>
              ))}
            </div>
          </div>

          {/* Regime Toggle: Architecture vs Activity */}
          <div className="ge-segmented-wrap">
            <span className="ge-control-label">System Regime</span>
            <div className="ge-segmented" role="group" aria-label="Growth regime comparison">
              <button
                type="button"
                className="ge-seg-btn"
                aria-pressed={mode === 'architecture'}
                onClick={() => setMode('architecture')}
              >
                Architecture
              </button>
              <button
                type="button"
                className="ge-seg-btn"
                aria-pressed={mode === 'activity'}
                onClick={() => setMode('activity')}
              >
                Activity Only
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- 2. MAIN WORKSPACE: 6 CHANNELS (LEFT) + COHORT CHART (RIGHT) ---------- */}
      <div className="ge-main-grid">
        {/* LEFT COLUMN: 6-CHANNEL ALLOCATION SLIDERS */}
        <div className="ge-channels-panel" aria-label="Channel budget allocation">
          <div className="ge-panel-head">
            <div>
              <span className="ge-panel-eyebrow">01 · Channel Architecture</span>
              <h3 className="ge-panel-title">Six-Channel Budget Allocation</h3>
            </div>
            <span className="ge-panel-meta">
              Auto-normalized · 3D Live Sync
            </span>
          </div>

          <div className="ge-channel-list">
            {CHANNELS.map((ch) => {
              const share = normalizedWeights[ch.id];
              const pct = Math.round(share * 100);
              const chSpend = monthlyBudget * share;
              const isFocused = hoveredChannel === ch.id;

              return (
                <div
                  key={ch.id}
                  className={`ge-channel-card${isFocused ? ' is-focused' : ''}`}
                  onMouseEnter={() => setHoveredChannel(ch.id)}
                  onMouseLeave={() => setHoveredChannel(null)}
                >
                  <div className="ge-channel-card__top">
                    <div className="ge-channel-card__id">
                      <span
                        className="ge-channel-swatch"
                        style={{ background: ch.tint }}
                        aria-hidden="true"
                      />
                      <span className="ge-channel-code">{ch.code}</span>
                      <label
                        htmlFor={`ge-slider-${ch.id}`}
                        className="ge-channel-name"
                      >
                        {ch.label}
                      </label>
                    </div>
                    <div className="ge-channel-card__numbers">
                      <span className="ge-channel-dollars">
                        {fmtCurrency(chSpend, true)}/mo
                      </span>
                      <span className="ge-channel-pct">{pct}%</span>
                    </div>
                  </div>

                  <p className="ge-channel-role">{ch.role}</p>

                  <div className="ge-slider-row">
                    <input
                      id={`ge-slider-${ch.id}`}
                      type="range"
                      min={2}
                      max={65}
                      step={1}
                      value={Math.round((rawWeights[ch.id] ?? share) * 100)}
                      onFocus={() => setHoveredChannel(ch.id)}
                      onBlur={() => setHoveredChannel(null)}
                      onChange={(e) =>
                        handleChannelSlider(ch.id, Number(e.target.value))
                      }
                      aria-label={`${ch.label} budget share`}
                      className="ge-range"
                      style={
                        {
                          '--fill-pct': `${pct}%`,
                          '--bar-color': ch.tint,
                        } as React.CSSProperties
                      }
                    />
                  </div>

                  <div className="ge-channel-specs">
                    <span>Base CAC ${ch.baseCac}</span>
                    <span>CVR {(ch.conversionRate * 100).toFixed(1)}%</span>
                    <span>Lag {ch.lagMonths}m</span>
                    <span>
                      {ch.assetPersistence > 0
                        ? `+${(ch.monthlyCompounding * 100).toFixed(1)}%/mo compound`
                        : 'Non-compounding'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: TELEMETRY KPI STRIP + STACKED 24M COHORT AREA CHART */}
        <div className="ge-chart-panel">
          {/* 4 Hero Telemetry Cards */}
          <div className="ge-kpi-grid" aria-live="polite">
            <div className="ge-kpi-card ge-kpi-card--primary">
              <span className="ge-kpi-label">
                Month {horizonMonths} Attributable Revenue
              </span>
              <div className="ge-kpi-value">
                {fmtCurrency(sim.finalMonthlyRevenue, true)}
                <small>/mo</small>
              </div>
              <span className="ge-kpi-sub">
                <b>{sim.growthMultiple.toFixed(1)}×</b> vs $85K baseline ·{' '}
                {fmtCurrency(sim.cumulativeRevenue, true)} cumulative
              </span>
            </div>

            <div className="ge-kpi-card">
              <span className="ge-kpi-label">Cohort LTV : Blended CAC</span>
              <div className="ge-kpi-value">
                {sim.ltvToCac.toFixed(1)}
                <small>× ratio</small>
              </div>
              <span className="ge-kpi-sub">
                LTV <b>{fmtCurrency(sim.cohortLtv, false)}</b> · CAC{' '}
                <b>{fmtCurrency(sim.blendedCac, false)}</b>
              </span>
            </div>

            <div className="ge-kpi-card">
              <span className="ge-kpi-label">CAC Payback Period</span>
              <div className="ge-kpi-value">
                {sim.paybackMonths.toFixed(1)}
                <small> mos</small>
              </div>
              <span className="ge-kpi-sub">
                M{horizonMonths} effective CAC:{' '}
                <b>{fmtCurrency(sim.finalMonthCac, false)}</b>
              </span>
            </div>

            <div className="ge-kpi-card">
              <span className="ge-kpi-label">Compounding Asset Share</span>
              <div className="ge-kpi-value">
                {Math.round(sim.compoundingShare * 100)}
                <small>%</small>
              </div>
              <span className="ge-kpi-sub">
                Persistent authority, partner nodes &amp; retained cohorts
              </span>
            </div>
          </div>

          {/* Stacked Cohort Area Chart */}
          <div className="ge-chart-box">
            <div className="ge-chart-box__head">
              <div>
                <span className="ge-panel-eyebrow">
                  02 · Cohort Projection (M01 → M{horizonMonths})
                </span>
                <h3 className="ge-panel-title">
                  Stacked Channel Revenue vs. Spend-Only Activity
                </h3>
              </div>

              <div className="ge-chart-legend" aria-hidden="true">
                <span className="ge-legend-item">
                  <i className="ge-legend-line ge-legend-line--arch" />
                  Compounding Architecture
                </span>
                <span className="ge-legend-item">
                  <i className="ge-legend-line ge-legend-line--act" />
                  Activity-Only Baseline
                </span>
              </div>
            </div>

            <div className="ge-svg-wrap">
              <svg
                viewBox={`0 0 ${chartGeom.W} ${chartGeom.H}`}
                className="ge-svg"
                role="img"
                aria-label={`${horizonMonths}-month stacked revenue projection chart`}
                onMouseMove={handleChartPointer}
              >
                {/* Horizontal grid lines */}
                {chartGeom.yTicks.map((t, idx) => (
                  <g key={idx}>
                    <line
                      x1={chartGeom.padL}
                      y1={t.y}
                      x2={chartGeom.W - chartGeom.padR}
                      y2={t.y}
                      stroke="rgba(10, 12, 18, 0.07)"
                      strokeDasharray={idx === 0 ? undefined : '3 4'}
                    />
                    <text
                      x={chartGeom.padL - 8}
                      y={t.y + 4}
                      textAnchor="end"
                      className="ge-svg-axis"
                    >
                      {t.label}
                    </text>
                  </g>
                ))}

                {/* 6 Stacked Channel Layers */}
                {chartGeom.layers.map((layer) => {
                  const dimmed =
                    hoveredChannel !== null && hoveredChannel !== layer.id;
                  return (
                    <path
                      key={layer.id}
                      d={layer.d}
                      fill={layer.tint}
                      fillOpacity={dimmed ? 0.22 : 0.78}
                      stroke="rgba(255,255,255,0.45)"
                      strokeWidth={0.7}
                      style={{ transition: 'fill-opacity 0.25s ease' }}
                    />
                  );
                })}

                {/* Architecture Reference Line (when viewing Activity mode, still shows the compounding ceiling) */}
                <polyline
                  fill="none"
                  stroke="#1226c8"
                  strokeWidth={mode === 'architecture' ? 2.6 : 1.6}
                  strokeDasharray={mode === 'architecture' ? undefined : '5 4'}
                  points={chartGeom.archLinePts}
                />

                {/* Activity-Only Comparison Baseline (Dashed Ink/Slate Line) */}
                <polyline
                  fill="none"
                  stroke="#0a0c12"
                  strokeWidth={2}
                  strokeDasharray="6 5"
                  opacity={0.75}
                  points={chartGeom.actLinePts}
                />

                {/* Milestone Inflection Points */}
                {chartGeom.milestones.map((ms) => (
                  <g key={ms.month}>
                    <line
                      x1={ms.x}
                      y1={ms.y}
                      x2={ms.x}
                      y2={chartGeom.H - chartGeom.padB}
                      stroke="rgba(46, 75, 255, 0.28)"
                      strokeDasharray="2 3"
                    />
                    <circle
                      cx={ms.x}
                      cy={ms.y}
                      r={4.2}
                      fill="#ffffff"
                      stroke="#2e4bff"
                      strokeWidth={2.2}
                    />
                  </g>
                ))}

                {/* Interactive Inspected Month Crosshair */}
                <line
                  x1={chartGeom.inspectedX}
                  y1={chartGeom.padT}
                  x2={chartGeom.inspectedX}
                  y2={chartGeom.H - chartGeom.padB}
                  stroke="#2e4bff"
                  strokeWidth={1.5}
                />
                <circle
                  cx={chartGeom.inspectedX}
                  cy={chartGeom.inspectedY}
                  r={5.5}
                  fill="#2e4bff"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <circle
                  cx={chartGeom.inspectedX}
                  cy={chartGeom.inspectedActY}
                  r={4}
                  fill="#0a0c12"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />

                {/* X-axis month labels */}
                {sim.horizonRecords.map((r, i) => {
                  if (
                    r.month !== 1 &&
                    r.month % 3 !== 0 &&
                    r.month !== horizonMonths
                  ) {
                    return null;
                  }
                  return (
                    <text
                      key={r.month}
                      x={chartGeom.xForIndex(i)}
                      y={chartGeom.H - 10}
                      textAnchor="middle"
                      className="ge-svg-axis"
                    >
                      M{String(r.month).padStart(2, '0')}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Interactive Month Scrubber Bar & Live Receipt */}
            <div className="ge-month-inspector">
              <div className="ge-month-inspector__head">
                <div className="ge-month-inspector__title">
                  <span className="ge-badge">
                    Month {String(inspectedRecord.month).padStart(2, '0')} Telemetry
                  </span>
                  {inspectedRecord.milestone && (
                    <span className="ge-milestone-tag">
                      ★ {inspectedRecord.milestone}
                    </span>
                  )}
                </div>
                <div className="ge-month-scrubber">
                  <label htmlFor="ge-month-scrub" className="ge-control-label">
                    Scrub Month
                  </label>
                  <input
                    id="ge-month-scrub"
                    type="range"
                    min={1}
                    max={horizonMonths}
                    step={1}
                    value={clampedInspectedMonth}
                    onChange={(e) => setInspectedMonth(Number(e.target.value))}
                    className="ge-range ge-range--compact"
                  />
                </div>
              </div>

              <div className="ge-month-metrics">
                <div>
                  <small>Architecture Revenue</small>
                  <strong>
                    {fmtCurrency(inspectedRecord.architectureRevenue, false)}/mo
                  </strong>
                </div>
                <div>
                  <small>Activity-Only Baseline</small>
                  <strong>
                    {fmtCurrency(inspectedRecord.activityRevenue, false)}/mo
                  </strong>
                </div>
                <div>
                  <small>Architectural Alpha</small>
                  <strong className="ge-text-blue">
                    +
                    {fmtCurrency(
                      Math.max(
                        0,
                        inspectedRecord.architectureRevenue -
                          inspectedRecord.activityRevenue,
                      ),
                      false,
                    )}
                    /mo
                  </strong>
                </div>
                <div>
                  <small>Active Retained Customers</small>
                  <strong>{fmtNumber(inspectedRecord.activeCustomers)}</strong>
                </div>
                <div>
                  <small>Effective Month CAC</small>
                  <strong>{fmtCurrency(inspectedRecord.effectiveCac, false)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Activity vs. Architecture Side-by-Side Comparison Ledger */}
          <div className="ge-comparison-ledger">
            <div className="ge-comparison-col ge-comparison-col--arch">
              <span className="ge-comparison-tag">Cato Compounding Architecture</span>
              <h4>Systems that build durable equity</h4>
              <p>
                Technical SEO &amp; schema persist at 98%/mo, social builds an
                owned graph, partner drops create step-changes, and CRM cuts
                cohort churn.
              </p>
              <div className="ge-comparison-stats">
                <div>
                  <span>M{horizonMonths} Run-Rate</span>
                  <strong>{fmtCurrency(sim.finalArchitectureRevenue, true)}/mo</strong>
                </div>
                <div>
                  <span>{horizonMonths}M Cumulative</span>
                  <strong>{fmtCurrency(sim.cumulativeArchitectureRevenue, true)}</strong>
                </div>
              </div>
            </div>

            <div className="ge-comparison-col ge-comparison-col--act">
              <span className="ge-comparison-tag ge-comparison-tag--muted">
                Activity-Only Baseline (Uncompounded)
              </span>
              <h4>Campaigns that reset every month</h4>
              <p>
                Spend rents temporary attention with zero content persistence,
                rising auction fatigue, and unmitigated cohort churn when
                campaigns pause.
              </p>
              <div className="ge-comparison-stats">
                <div>
                  <span>M{horizonMonths} Run-Rate</span>
                  <strong>{fmtCurrency(sim.finalActivityRevenue, true)}/mo</strong>
                </div>
                <div>
                  <span>{horizonMonths}M Cumulative</span>
                  <strong>{fmtCurrency(sim.cumulativeActivityRevenue, true)}</strong>
                </div>
              </div>
              <div className="ge-comparison-delta">
                Architecture generates{' '}
                <b>+{fmtCurrency(archAdvantageMonthly, true)}/mo</b> higher run-rate
                and <b>+{fmtCurrency(archAdvantageCumulative, true)}</b> net
                cumulative revenue over {horizonMonths} months.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- 3. THE LAUNCH MOMENT: LIVE CONTENT DISTRIBUTION FAN-OUT ---------- */}
      <div className="ge-launch-section" id="growth-launch">
        <div className="ge-launch-header">
          <div>
            <span className="ge-panel-eyebrow">
              03 · The Launch Moment — Live Distribution Visualizer
            </span>
            <h3 className="ge-panel-title">
              Publish one flagship asset. Watch it fan out and convert.
            </h3>
            <p className="ge-launch-desc">
              Select a canonical piece of content and fire it into the engine.
              The WebGL network behind this page and the telemetry below trace
              how one asset is cut into six native channel dialects and
              converted into compounding cohorts.
            </p>
          </div>

          <button
            type="button"
            className="btn btn--blue ge-launch-btn"
            onClick={() => handleLaunchAsset()}
          >
            <span className="btn-label">
              {launchCount > 1 ? 'Launch Asset Again' : 'Launch Flagship Asset'}
            </span>
            <span className="btn-arrow" aria-hidden="true">
              <span className="btn-arrow__a">→</span>
              <span className="btn-arrow__b">→</span>
            </span>
          </button>
        </div>

        {/* Selectable Flagship Assets */}
        <div
          className="ge-asset-selector"
          role="group"
          aria-label="Choose a flagship content asset to launch"
        >
          {LAUNCH_ASSETS.map((asset) => {
            const selected = asset.id === selectedAssetId;
            return (
              <button
                key={asset.id}
                type="button"
                className={`ge-asset-card${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => handleLaunchAsset(asset.id)}
              >
                <span className="ge-asset-code">{asset.code}</span>
                <strong className="ge-asset-title">{asset.title}</strong>
                <span className="ge-asset-format">{asset.format}</span>
              </button>
            );
          })}
        </div>

        {/* Live Stage Status Bar */}
        <div className="ge-launch-status" role="status" aria-live="polite">
          <span
            className={`ge-status-dot ge-status-dot--${launchStage}`}
            aria-hidden="true"
          />
          <span className="ge-status-text">
            {LAUNCH_STAGE_LABELS[launchStage]}
          </span>
          <span className="ge-status-totals">
            <b>{fmtNumber(launchSummary.totalImpressions)}</b> reach →{' '}
            <b>{fmtNumber(launchSummary.totalVisits)}</b> qualified visits →{' '}
            <b>+{fmtNumber(launchSummary.totalConversions)}</b> customers (
            <b>+{fmtCurrency(launchSummary.totalLtvAdded, true)}</b> cohort LTV)
          </span>
        </div>

        {/* 6-Channel Fan-Out Telemetry Grid */}
        <div
          key={launchCount}
          className={`ge-fanout-grid is-stage-${launchStage}`}
        >
          {launchSummary.channels.map((ch, idx) => (
            <div
              key={ch.channelId}
              className="ge-fanout-card"
              style={{ '--fan-delay': `${idx * 70}ms` } as React.CSSProperties}
            >
              <div className="ge-fanout-card__head">
                <span className="ge-channel-code">{ch.code}</span>
                <strong>{ch.label}</strong>
                <span className="ge-fanout-share">
                  {Math.round(ch.share * 100)}% budget
                </span>
              </div>
              <p className="ge-fanout-artifact">{ch.artifact}</p>
              <div className="ge-fanout-metrics">
                <div>
                  <small>Reach</small>
                  <span>{fmtNumber(ch.impressions)}</span>
                </div>
                <div>
                  <small>Visits</small>
                  <span>{fmtNumber(ch.qualifiedVisits)}</span>
                </div>
                <div>
                  <small>Customers</small>
                  <span className="ge-text-blue">+{ch.conversions}</span>
                </div>
                <div>
                  <small>24M LTV</small>
                  <span className="ge-text-blue">
                    +{fmtCurrency(ch.ltvAdded, true)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- 4. EXPLICIT MODEL ASSUMPTIONS DRAWER ---------- */}
      <details className="ge-assumptions">
        <summary className="ge-assumptions__summary">
          <span>{growthEngineCopy.disclaimer}</span>
          <span className="ge-assumptions__cta">Inspect Channel Assumptions ↓</span>
        </summary>
        <div className="ge-assumptions__body">
          <div className="ge-assumptions__meta">
            <span>Baseline Revenue: ${BASELINE_MONTHLY_REVENUE.toLocaleString('en-US')}/mo</span>
            <span>Composite ARPU: ${COMPOSITE_ARPU}/mo</span>
            <span>Gross Margin: {Math.round(GROSS_MARGIN * 100)}%</span>
            <span>Partner Step-Changes: Months 4, 9, 15 &amp; 21</span>
          </div>
          <div className="ge-assumptions__table-wrap">
            <table className="ge-assumptions__table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Base CAC</th>
                  <th>Visit → Cust CVR</th>
                  <th>Ramp Lag</th>
                  <th>Compounding / Mo</th>
                  <th>Asset Persistence</th>
                  <th>M1 Retention</th>
                  <th>Base Churn / Mo</th>
                  <th>Architectural Mechanism</th>
                </tr>
              </thead>
              <tbody>
                {CHANNELS.map((ch) => (
                  <tr key={ch.id}>
                    <td>
                      <strong>{ch.label}</strong>
                    </td>
                    <td>${ch.baseCac}</td>
                    <td>{(ch.conversionRate * 100).toFixed(1)}%</td>
                    <td>{ch.lagMonths} mos</td>
                    <td>+{(ch.monthlyCompounding * 100).toFixed(1)}%</td>
                    <td>{Math.round(ch.assetPersistence * 100)}%</td>
                    <td>{(ch.month1Retention * 100).toFixed(1)}%</td>
                    <td>{(ch.monthlyChurn * 100).toFixed(1)}%</td>
                    <td>{ch.assumptionNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}
