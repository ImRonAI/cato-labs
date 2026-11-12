'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  decisionEngineCopy,
  scenarios,
  type ScenarioId,
  type ScenarioSpec,
} from '@/lib/content/overhaul/cap-strategy';
import {
  CURVE_SAMPLES,
  strategyBus,
  triggerStrategyPulse,
} from '@/components/webgl/scenes/capabilities/children/strategy-transformation/bus';
import {
  advanceMonteCarloSession,
  createMonteCarloSession,
  formatCurrencyK,
  runFullMonteCarlo,
  summarizeMonteCarloSession,
  TOTAL_MONTE_CARLO_RUNS,
  type MonteCarloSummary,
  type PathSimulationResult,
  type SimulationParams,
} from './monte-carlo';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Build SVG path `d` for a series of (x, y) coordinates */
function buildLinePath(pts: readonly [number, number][]): string {
  if (pts.length === 0) return '';
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  }
  return d;
}

/** Build closed SVG polygon `d` between an upper and lower series */
function buildBandPath(
  upper: readonly [number, number][],
  lower: readonly [number, number][],
): string {
  if (upper.length === 0 || lower.length === 0) return '';
  let d = `M ${upper[0][0].toFixed(1)} ${upper[0][1].toFixed(1)}`;
  for (let i = 1; i < upper.length; i++) {
    d += ` L ${upper[i][0].toFixed(1)} ${upper[i][1].toFixed(1)}`;
  }
  for (let i = lower.length - 1; i >= 0; i--) {
    d += ` L ${lower[i][0].toFixed(1)} ${lower[i][1].toFixed(1)}`;
  }
  return `${d} Z`;
}

export default function DecisionEngine() {
  const baseId = useId();
  const [scenarioId, setScenarioId] = useState<ScenarioId>(scenarios[0].id);

  const activeScenario = useMemo<ScenarioSpec>(
    () => scenarios.find((s) => s.id === scenarioId) ?? scenarios[0],
    [scenarioId],
  );

  const [investmentK, setInvestmentK] = useState<number>(
    scenarios[0].defaultLevers.investmentK,
  );
  const [horizonMonths, setHorizonMonths] = useState<number>(
    scenarios[0].defaultLevers.horizonMonths,
  );
  const [riskAppetite, setRiskAppetite] = useState<number>(
    scenarios[0].defaultLevers.riskAppetite,
  );
  const [teamCapacity, setTeamCapacity] = useState<number>(
    scenarios[0].defaultLevers.teamCapacity,
  );
  const [seedOffset, setSeedOffset] = useState<number>(0);
  const [stressShock, setStressShock] = useState<boolean>(false);

  /* null = automatically track the model's recommended path; 0|1|2 = user-pinned path */
  const [pinnedPathIndex, setPinnedPathIndex] = useState<number | null>(null);
  /* Scrubber month along the fan chart (null = terminal month H) */
  const [scrubMonth, setScrubMonth] = useState<number | null>(null);
  /* Staged evidence-trail step counter (0..4) during progressive runs */
  const [trailStage, setTrailStage] = useState<number>(4);

  const currentParams = useMemo<SimulationParams>(
    () => ({
      scenario: activeScenario,
      investmentK,
      horizonMonths,
      riskAppetite,
      teamCapacity,
      seedOffset,
      stressShock,
    }),
    [
      activeScenario,
      investmentK,
      horizonMonths,
      riskAppetite,
      teamCapacity,
      seedOffset,
      stressShock,
    ],
  );

  /* Initial synchronous state so first paint has zero layout shift */
  const [summary, setSummary] = useState<MonteCarloSummary>(() =>
    runFullMonteCarlo({
      scenario: scenarios[0],
      investmentK: scenarios[0].defaultLevers.investmentK,
      horizonMonths: scenarios[0].defaultLevers.horizonMonths,
      riskAppetite: scenarios[0].defaultLevers.riskAppetite,
      teamCapacity: scenarios[0].defaultLevers.teamCapacity,
      seedOffset: 0,
      stressShock: false,
    }),
  );

  const isFirstMount = useRef(true);
  const rafRef = useRef<number>(0);

  /* Progressive non-blocking Monte Carlo execution on parameter change */
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (prefersReducedMotion()) {
      const full = runFullMonteCarlo(currentParams);
      setSummary(full);
      setTrailStage(4);
      return;
    }

    const session = createMonteCarloSession(currentParams, TOTAL_MONTE_CARLO_RUNS);
    setTrailStage(1);

    const step = () => {
      const done = advanceMonteCarloSession(session, 600);
      const snap = summarizeMonteCarloSession(session);
      setSummary(snap);

      const ratio = session.completedRuns / session.totalRuns;
      if (ratio >= 1) {
        setTrailStage(4);
      } else if (ratio >= 0.7) {
        setTrailStage(3);
      } else if (ratio >= 0.35) {
        setTrailStage(2);
      }

      if (!done) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [currentParams]);

  const inspectedPathIndex =
    pinnedPathIndex !== null ? pinnedPathIndex : summary.recommendedPathIndex;
  const activePathResult: PathSimulationResult =
    summary.paths[inspectedPathIndex] ?? summary.paths[0];

  /* Push live Monte Carlo state to the WebGL strategyBus */
  useEffect(() => {
    const scenIdx = scenarios.findIndex((s) => s.id === activeScenario.id);
    strategyBus.scenarioIndex = scenIdx >= 0 ? scenIdx : 0;
    strategyBus.selectedPathIndex = inspectedPathIndex;
    strategyBus.recommendedPathIndex = summary.recommendedPathIndex;

    const normDiv = Math.max(250, investmentK * 2.1);
    strategyBus.p10Norm = Math.max(
      -0.35,
      Math.min(1.5, activePathResult.p10TerminalK / normDiv),
    );
    strategyBus.p50Norm = Math.max(
      -0.2,
      Math.min(1.75, activePathResult.p50TerminalK / normDiv),
    );
    strategyBus.p90Norm = Math.max(
      0.0,
      Math.min(2.1, activePathResult.p90TerminalK / normDiv),
    );
    strategyBus.spreadNorm = Math.max(
      0.22,
      Math.min(
        1.55,
        (activePathResult.p90TerminalK - activePathResult.p10TerminalK) /
          Math.max(300, investmentK * 1.8),
      ),
    );
    strategyBus.roiProb = activePathResult.roiProbPct / 100;
    strategyBus.simProgress = summary.completedRuns / summary.totalRuns;
    strategyBus.stressShock = stressShock;

    for (let i = 0; i < CURVE_SAMPLES; i++) {
      strategyBus.curveP10[i] = activePathResult.glCurveP10[i];
      strategyBus.curveP50[i] = activePathResult.glCurveP50[i];
      strategyBus.curveP90[i] = activePathResult.glCurveP90[i];
    }
  }, [
    activeScenario.id,
    inspectedPathIndex,
    summary.recommendedPathIndex,
    summary.completedRuns,
    summary.totalRuns,
    activePathResult,
    investmentK,
    stressShock,
  ]);

  /* Handlers that also trigger a 3D particle pulse on the WebGL table */
  const selectScenario = useCallback((scen: ScenarioSpec) => {
    setScenarioId(scen.id);
    setInvestmentK(scen.defaultLevers.investmentK);
    setHorizonMonths(scen.defaultLevers.horizonMonths);
    setRiskAppetite(scen.defaultLevers.riskAppetite);
    setTeamCapacity(scen.defaultLevers.teamCapacity);
    setPinnedPathIndex(null);
    setScrubMonth(null);
    triggerStrategyPulse();
  }, []);

  const resetLevers = useCallback(() => {
    setInvestmentK(activeScenario.defaultLevers.investmentK);
    setHorizonMonths(activeScenario.defaultLevers.horizonMonths);
    setRiskAppetite(activeScenario.defaultLevers.riskAppetite);
    setTeamCapacity(activeScenario.defaultLevers.teamCapacity);
    setPinnedPathIndex(null);
    setStressShock(false);
    setScrubMonth(null);
    triggerStrategyPulse();
  }, [activeScenario]);

  const rerunSeed = useCallback(() => {
    setSeedOffset((s) => s + 1);
    triggerStrategyPulse();
  }, []);

  /* Keyboard arrow navigation on scenario tabs */
  const onScenarioKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number,
  ) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const nextIdx = (idx + dir + scenarios.length) % scenarios.length;
    selectScenario(scenarios[nextIdx]);
    const btn = document.getElementById(`${baseId}-tab-${scenarios[nextIdx].id}`);
    btn?.focus();
  };

  /* ------------------------------------------------------------------ */
  /*  SVG Fan Chart Geometry Computation                                */
  /* ------------------------------------------------------------------ */

  const chartGeometry = useMemo(() => {
    const W = 680;
    const H = 300;
    const padL = 58;
    const padR = 88; /* Room on right for terminal density histogram */
    const padT = 22;
    const padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const monthly = activePathResult.monthly;
    const maxM = Math.max(1, monthly.length - 1);

    let minY = -investmentK * 0.65;
    let maxY = investmentK * 0.85;
    for (const pt of monthly) {
      if (pt.p10 < minY) minY = pt.p10;
      if (pt.p90 > maxY) maxY = pt.p90;
    }
    const ySpan = Math.max(200, maxY - minY);
    minY -= ySpan * 0.08;
    maxY += ySpan * 0.1;
    const finalSpan = maxY - minY;

    const xOf = (m: number) => padL + (m / maxM) * plotW;
    const yOf = (v: number) => padT + ((maxY - v) / finalSpan) * plotH;

    const ptsP10: [number, number][] = [];
    const ptsP25: [number, number][] = [];
    const ptsP50: [number, number][] = [];
    const ptsP75: [number, number][] = [];
    const ptsP90: [number, number][] = [];

    for (const pt of monthly) {
      const x = xOf(pt.month);
      ptsP10.push([x, yOf(pt.p10)]);
      ptsP25.push([x, yOf(pt.p25)]);
      ptsP50.push([x, yOf(pt.p50)]);
      ptsP75.push([x, yOf(pt.p75)]);
      ptsP90.push([x, yOf(pt.p90)]);
    }

    const sampleDList = activePathResult.samplePaths.map((curve) => {
      const pts: [number, number][] = curve.map((v, m) => [
        xOf(m),
        Math.max(padT, Math.min(padT + plotH, yOf(v))),
      ]);
      return buildLinePath(pts);
    });

    const zeroY = Math.max(padT, Math.min(padT + plotH, yOf(0)));
    const paybackX =
      activePathResult.paybackMonth !== null
        ? xOf(activePathResult.paybackMonth)
        : null;

    /* Y-axis grid ticks */
    const yTicks = [0.15, 0.5, 0.85].map((f) => {
      const val = minY + (1 - f) * finalSpan;
      return {
        y: padT + f * plotH,
        label: formatCurrencyK(val, true),
      };
    });

    /* X-axis month ticks */
    const xTicks: { m: number; x: number }[] = [];
    const stepM = maxM <= 12 ? 2 : maxM <= 24 ? 4 : 6;
    for (let m = 0; m <= maxM; m += stepM) {
      xTicks.push({ m, x: xOf(m) });
    }
    if (xTicks[xTicks.length - 1]?.m !== maxM) {
      xTicks.push({ m: maxM, x: xOf(maxM) });
    }

    return {
      W,
      H,
      padL,
      padR,
      padT,
      padB,
      plotW,
      plotH,
      maxM,
      minY,
      maxY,
      xOf,
      yOf,
      zeroY,
      paybackX,
      yTicks,
      xTicks,
      outerBandD: buildBandPath(ptsP90, ptsP10),
      innerBandD: buildBandPath(ptsP75, ptsP25),
      lineP10D: buildLinePath(ptsP10),
      lineP50D: buildLinePath(ptsP50),
      lineP90D: buildLinePath(ptsP90),
      ptsP50,
      sampleDList,
    };
  }, [activePathResult, investmentK]);

  const effectiveScrubMonth =
    scrubMonth !== null && scrubMonth <= chartGeometry.maxM
      ? scrubMonth
      : chartGeometry.maxM;
  const scrubPoint =
    activePathResult.monthly[effectiveScrubMonth] ??
    activePathResult.monthly[activePathResult.monthly.length - 1];
  const scrubX = chartGeometry.xOf(effectiveScrubMonth);
  const scrubY50 = chartGeometry.yOf(scrubPoint.p50);

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * chartGeometry.W;
    const ratio = (relX - chartGeometry.padL) / chartGeometry.plotW;
    if (ratio < -0.02 || ratio > 1.02) return;
    const m = Math.max(
      0,
      Math.min(chartGeometry.maxM, Math.round(ratio * chartGeometry.maxM)),
    );
    setScrubMonth(m);
  };

  const isRunning = summary.completedRuns < summary.totalRuns;

  return (
    <div className="stf-engine" role="region" aria-label="The Decision Engine">
      {/* ---------- 1. Top Instrument Chrome Bar ---------- */}
      <div className="stf-engine__topbar">
        <div className="stf-engine__brand">
          <span
            className={`stf-engine__dot${isRunning ? ' is-running' : ''}`}
            aria-hidden="true"
          />
          <span className="stf-engine__code">CATO DECISION ENGINE</span>
          <span className="stf-engine__sep" aria-hidden="true">
            /
          </span>
          <span className="stf-engine__meta" aria-live="polite">
            {summary.completedRuns.toLocaleString('en-US')} /{' '}
            {summary.totalRuns.toLocaleString('en-US')} trajectories · Seed{' '}
            {summary.seedLabel}
          </span>
        </div>

        <div className="stf-engine__actions">
          <button
            type="button"
            className={`stf-engine__chip-btn${stressShock ? ' is-active' : ''}`}
            aria-pressed={stressShock}
            onClick={() => {
              setStressShock((s) => !s);
              triggerStrategyPulse();
            }}
          >
            {stressShock ? 'Macro Shock: ON (-22% Demand)' : 'Stress-Test Macro Shock'}
          </button>
          <button
            type="button"
            className="stf-engine__chip-btn"
            onClick={rerunSeed}
          >
            Re-seed 2,400 Runs
          </button>
          <button
            type="button"
            className="stf-engine__chip-btn"
            onClick={resetLevers}
          >
            Reset Baseline
          </button>
        </div>
      </div>

      {/* ---------- 2. Strategic Question Selector Tabs ---------- */}
      <div
        className="stf-engine__tabs"
        role="tablist"
        aria-label="Strategic questions"
      >
        {scenarios.map((scen, idx) => {
          const isSelected = scen.id === activeScenario.id;
          return (
            <button
              key={scen.id}
              id={`${baseId}-tab-${scen.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel`}
              tabIndex={isSelected ? 0 : -1}
              className={`stf-engine__tab${isSelected ? ' is-selected' : ''}`}
              onClick={() => selectScenario(scen)}
              onKeyDown={(e) => onScenarioKeyDown(e, idx)}
            >
              <span className="stf-engine__tab-index">{scen.index}</span>
              <span className="stf-engine__tab-label">{scen.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* ---------- 3. Active Question Header ---------- */}
      <div className="stf-engine__question-bar" id={`${baseId}-panel`} role="tabpanel">
        <div>
          <span className="micro-label">Strategic question {activeScenario.index}</span>
          <h3 className="h3 stf-engine__question-title">{activeScenario.question}</h3>
          <p className="stf-engine__question-context">{activeScenario.context}</p>
        </div>
        <div className="stf-engine__verdict-pill">
          <span className="stf-engine__verdict-label">Recommended Path</span>
          <strong className="stf-engine__verdict-value">
            {summary.memo.recommendedCode}: {summary.memo.recommendedName}
          </strong>
          <span className="stf-engine__verdict-sub">
            {summary.memo.roiProbPct.toFixed(1)}% positive ROI · Payback{' '}
            {summary.memo.paybackText}
          </span>
        </div>
      </div>

      {/* ---------- 4. Main Workspace: Levers + Paths (Left) | Fan Chart + Sensitivity (Right) ---------- */}
      <div className="stf-engine__workspace">
        {/* LEFT COLUMN: 4 Levers + 3 Strategic Paths */}
        <div className="stf-engine__left">
          <div className="stf-engine__panel-head">
            <span className="stf-engine__panel-title">01 · Decision Levers</span>
            <span className="stf-engine__panel-sub">Drag or step to recompute</span>
          </div>

          <div className="stf-engine__levers">
            {/* Lever 1: Capital Allocation */}
            <div className="stf-lever">
              <div className="stf-lever__top">
                <label htmlFor={`${baseId}-inv`} className="stf-lever__label">
                  {decisionEngineCopy.levers.investment.label}
                </label>
                <span className="stf-lever__val">{formatCurrencyK(investmentK)}</span>
              </div>
              <p className="stf-lever__hint">{decisionEngineCopy.levers.investment.hint}</p>
              <div className="stf-lever__control">
                <button
                  type="button"
                  className="stf-lever__step"
                  aria-label="Decrease capital allocation"
                  onClick={() => {
                    setInvestmentK((v) =>
                      Math.max(decisionEngineCopy.levers.investment.min, v - 50),
                    );
                    triggerStrategyPulse();
                  }}
                >
                  −
                </button>
                <input
                  id={`${baseId}-inv`}
                  type="range"
                  min={decisionEngineCopy.levers.investment.min}
                  max={decisionEngineCopy.levers.investment.max}
                  step={decisionEngineCopy.levers.investment.step}
                  value={investmentK}
                  aria-valuetext={formatCurrencyK(investmentK)}
                  onChange={(e) => {
                    setInvestmentK(Number(e.target.value));
                    triggerStrategyPulse();
                  }}
                />
                <button
                  type="button"
                  className="stf-lever__step"
                  aria-label="Increase capital allocation"
                  onClick={() => {
                    setInvestmentK((v) =>
                      Math.min(decisionEngineCopy.levers.investment.max, v + 50),
                    );
                    triggerStrategyPulse();
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Lever 2: Evaluation Horizon */}
            <div className="stf-lever">
              <div className="stf-lever__top">
                <label htmlFor={`${baseId}-hor`} className="stf-lever__label">
                  {decisionEngineCopy.levers.horizon.label}
                </label>
                <span className="stf-lever__val">{horizonMonths} months</span>
              </div>
              <p className="stf-lever__hint">{decisionEngineCopy.levers.horizon.hint}</p>
              <div className="stf-lever__control">
                <button
                  type="button"
                  className="stf-lever__step"
                  aria-label="Decrease evaluation horizon"
                  onClick={() => {
                    setHorizonMonths((v) =>
                      Math.max(decisionEngineCopy.levers.horizon.min, v - 3),
                    );
                    setScrubMonth(null);
                    triggerStrategyPulse();
                  }}
                >
                  −
                </button>
                <input
                  id={`${baseId}-hor`}
                  type="range"
                  min={decisionEngineCopy.levers.horizon.min}
                  max={decisionEngineCopy.levers.horizon.max}
                  step={decisionEngineCopy.levers.horizon.step}
                  value={horizonMonths}
                  aria-valuetext={`${horizonMonths} months`}
                  onChange={(e) => {
                    setHorizonMonths(Number(e.target.value));
                    setScrubMonth(null);
                    triggerStrategyPulse();
                  }}
                />
                <button
                  type="button"
                  className="stf-lever__step"
                  aria-label="Increase evaluation horizon"
                  onClick={() => {
                    setHorizonMonths((v) =>
                      Math.min(decisionEngineCopy.levers.horizon.max, v + 3),
                    );
                    setScrubMonth(null);
                    triggerStrategyPulse();
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Lever 3: Risk Appetite */}
            <div className="stf-lever">
              <div className="stf-lever__top">
                <label htmlFor={`${baseId}-risk`} className="stf-lever__label">
                  {decisionEngineCopy.levers.risk.label}
                </label>
                <span className="stf-lever__val">
                  {riskAppetite}% ·{' '}
                  {riskAppetite < 35
                    ? 'Conservative'
                    : riskAppetite > 65
                      ? 'Aggressive'
                      : 'Balanced'}
                </span>
              </div>
              <p className="stf-lever__hint">{decisionEngineCopy.levers.risk.hint}</p>
              <div className="stf-lever__control">
                <button
                  type="button"
                  className="stf-lever__step"
                  aria-label="Decrease risk appetite"
                  onClick={() => {
                    setRiskAppetite((v) =>
                      Math.max(decisionEngineCopy.levers.risk.min, v - 5),
                    );
                    triggerStrategyPulse();
                  }}
                >
                  −
                </button>
                <input
                  id={`${baseId}-risk`}
                  type="range"
                  min={decisionEngineCopy.levers.risk.min}
                  max={decisionEngineCopy.levers.risk.max}
                  step={decisionEngineCopy.levers.risk.step}
                  value={riskAppetite}
                  aria-valuetext={`${riskAppetite} percent`}
                  onChange={(e) => {
                    setRiskAppetite(Number(e.target.value));
                    triggerStrategyPulse();
                  }}
                />
                <button
                  type="button"
                  className="stf-lever__step"
                  aria-label="Increase risk appetite"
                  onClick={() => {
                    setRiskAppetite((v) =>
                      Math.min(decisionEngineCopy.levers.risk.max, v + 5),
                    );
                    triggerStrategyPulse();
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Lever 4: Team Capacity */}
            <div className="stf-lever">
              <div className="stf-lever__top">
                <label htmlFor={`${baseId}-cap`} className="stf-lever__label">
                  {decisionEngineCopy.levers.capacity.label}
                </label>
                <span className="stf-lever__val">
                  {teamCapacity}% ·{' '}
                  {teamCapacity < 45
                    ? 'Constrained'
                    : teamCapacity >= 75
                      ? 'Dedicated Pod'
                      : 'Shared Bandwidth'}
                </span>
              </div>
              <p className="stf-lever__hint">{decisionEngineCopy.levers.capacity.hint}</p>
              <div className="stf-lever__control">
                <button
                  type="button"
                  className="stf-lever__step"
                  aria-label="Decrease team capacity"
                  onClick={() => {
                    setTeamCapacity((v) =>
                      Math.max(decisionEngineCopy.levers.capacity.min, v - 5),
                    );
                    triggerStrategyPulse();
                  }}
                >
                  −
                </button>
                <input
                  id={`${baseId}-cap`}
                  type="range"
                  min={decisionEngineCopy.levers.capacity.min}
                  max={decisionEngineCopy.levers.capacity.max}
                  step={decisionEngineCopy.levers.capacity.step}
                  value={teamCapacity}
                  aria-valuetext={`${teamCapacity} percent`}
                  onChange={(e) => {
                    setTeamCapacity(Number(e.target.value));
                    triggerStrategyPulse();
                  }}
                />
                <button
                  type="button"
                  className="stf-lever__step"
                  aria-label="Increase team capacity"
                  onClick={() => {
                    setTeamCapacity((v) =>
                      Math.min(decisionEngineCopy.levers.capacity.max, v + 5),
                    );
                    triggerStrategyPulse();
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 3 Strategic Paths Comparison */}
          <div className="stf-engine__panel-head stf-engine__panel-head--paths">
            <span className="stf-engine__panel-title">02 · Strategic Paths Evaluated</span>
            {pinnedPathIndex !== null && (
              <button
                type="button"
                className="stf-engine__unpin"
                onClick={() => {
                  setPinnedPathIndex(null);
                  triggerStrategyPulse();
                }}
              >
                Follow Recommended
              </button>
            )}
          </div>

          <div className="stf-paths" role="group" aria-label="Strategic paths">
            {summary.paths.map((pr, idx) => {
              const isRec = idx === summary.recommendedPathIndex;
              const isInspected = idx === inspectedPathIndex;
              return (
                <button
                  key={pr.spec.id}
                  type="button"
                  aria-pressed={isInspected}
                  className={`stf-path-card${isInspected ? ' is-inspected' : ''}${
                    isRec ? ' is-recommended' : ''
                  }`}
                  onClick={() => {
                    setPinnedPathIndex(idx);
                    triggerStrategyPulse();
                  }}
                >
                  <div className="stf-path-card__head">
                    <span className="stf-path-card__code">{pr.spec.code}</span>
                    {isRec && (
                      <span className="stf-path-card__badge">RECOMMENDED</span>
                    )}
                    {!isRec && isInspected && (
                      <span className="stf-path-card__badge stf-path-card__badge--alt">
                        INSPECTING
                      </span>
                    )}
                  </div>
                  <div className="stf-path-card__name">{pr.spec.name}</div>
                  <div className="stf-path-card__sub">{pr.spec.subtitle}</div>
                  <div className="stf-path-card__metrics">
                    <div>
                      <span>P50 Net</span>
                      <strong>{formatCurrencyK(pr.p50TerminalK, true)}</strong>
                    </div>
                    <div>
                      <span>P10 Floor</span>
                      <strong>{formatCurrencyK(pr.p10TerminalK, true)}</strong>
                    </div>
                    <div>
                      <span>P(ROI &gt; 0)</span>
                      <strong>{pr.roiProbPct.toFixed(0)}%</strong>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Live P10/P50/P90 Fan Chart + Sensitivity Bars */}
        <div className="stf-engine__right">
          {/* FAN CHART PANEL */}
          <div className="stf-chart-card">
            <div className="stf-chart-card__head">
              <div>
                <span className="stf-engine__panel-title">
                  03 · Outcome Distribution Fan ({activePathResult.spec.code}:{' '}
                  {activePathResult.spec.name})
                </span>
                <p className="stf-chart-card__sub">
                  Cumulative net value (P10 downside / P50 median / P90 upside) across{' '}
                  {horizonMonths} months + terminal probability density
                </p>
              </div>
              <div className="stf-chart-readout">
                <span className="stf-chart-readout__month">
                  Month {effectiveScrubMonth}
                  {effectiveScrubMonth === chartGeometry.maxM ? ' (Terminal)' : ''}
                </span>
                <div className="stf-chart-readout__pills">
                  <span className="stf-pill stf-pill--p10">
                    P10: {formatCurrencyK(scrubPoint.p10, true)}
                  </span>
                  <span className="stf-pill stf-pill--p50">
                    P50: {formatCurrencyK(scrubPoint.p50, true)}
                  </span>
                  <span className="stf-pill stf-pill--p90">
                    P90: {formatCurrencyK(scrubPoint.p90, true)}
                  </span>
                </div>
              </div>
            </div>

            <div className="stf-chart-wrap">
              <svg
                viewBox={`0 0 ${chartGeometry.W} ${chartGeometry.H}`}
                className="stf-chart-svg"
                role="img"
                aria-label={`Monte Carlo outcome fan chart for ${activePathResult.spec.name}. Terminal P50 net value is ${formatCurrencyK(
                  activePathResult.p50TerminalK,
                  true,
                )}, P10 is ${formatCurrencyK(
                  activePathResult.p10TerminalK,
                  true,
                )}, P90 is ${formatCurrencyK(activePathResult.p90TerminalK, true)}.`}
                onPointerMove={handleSvgPointerMove}
                onPointerLeave={() => setScrubMonth(null)}
              >
                <defs>
                  <linearGradient id={`${baseId}-fan-outer`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2e4bff" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#1226c8" stopOpacity="0.06" />
                  </linearGradient>
                  <linearGradient id={`${baseId}-fan-inner`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2e4bff" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#2e4bff" stopOpacity="0.12" />
                  </linearGradient>
                </defs>

                {/* Horizontal grid hairlines */}
                {chartGeometry.yTicks.map((t, i) => (
                  <g key={i}>
                    <line
                      x1={chartGeometry.padL}
                      y1={t.y}
                      x2={chartGeometry.W - chartGeometry.padR}
                      y2={t.y}
                      stroke="rgba(10, 12, 18, 0.07)"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={chartGeometry.padL - 8}
                      y={t.y + 4}
                      textAnchor="end"
                      className="stf-svg-axis"
                    >
                      {t.label}
                    </text>
                  </g>
                ))}

                {/* $0 Breakeven datum line */}
                <line
                  x1={chartGeometry.padL}
                  y1={chartGeometry.zeroY}
                  x2={chartGeometry.W - chartGeometry.padR}
                  y2={chartGeometry.zeroY}
                  stroke="rgba(10, 12, 18, 0.28)"
                  strokeWidth="1"
                />
                <text
                  x={chartGeometry.padL + 6}
                  y={chartGeometry.zeroY - 5}
                  className="stf-svg-zero"
                >
                  $0 Breakeven
                </text>

                {/* Individual Monte Carlo sample hairlines */}
                {chartGeometry.sampleDList.map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke="rgba(46, 75, 255, 0.11)"
                    strokeWidth="0.9"
                  />
                ))}

                {/* P10-P90 outer confidence band & P25-P75 inner quartile band */}
                <path d={chartGeometry.outerBandD} fill={`url(#${baseId}-fan-outer)`} />
                <path d={chartGeometry.innerBandD} fill={`url(#${baseId}-fan-inner)`} />

                {/* P90 Upside & P10 Downside bounds */}
                <path
                  d={chartGeometry.lineP90D}
                  fill="none"
                  stroke="#5f7dff"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />
                <path
                  d={chartGeometry.lineP10D}
                  fill="none"
                  stroke="#1226c8"
                  strokeWidth="1.4"
                  strokeDasharray="3 4"
                  opacity="0.7"
                />

                {/* Payback vertical marker */}
                {chartGeometry.paybackX !== null && (
                  <g>
                    <line
                      x1={chartGeometry.paybackX}
                      y1={chartGeometry.padT}
                      x2={chartGeometry.paybackX}
                      y2={chartGeometry.H - chartGeometry.padB}
                      stroke="#2e4bff"
                      strokeWidth="1.2"
                      strokeDasharray="2 3"
                    />
                    <rect
                      x={chartGeometry.paybackX - 42}
                      y={chartGeometry.padT + 2}
                      width="84"
                      height="18"
                      rx="4"
                      fill="#eef2ff"
                      stroke="#b9c9ff"
                    />
                    <text
                      x={chartGeometry.paybackX}
                      y={chartGeometry.padT + 14}
                      textAnchor="middle"
                      className="stf-svg-payback"
                    >
                      Payback M{activePathResult.paybackMonth}
                    </text>
                  </g>
                )}

                {/* P50 Median trajectory curve */}
                <path
                  d={chartGeometry.lineP50D}
                  fill="none"
                  stroke="#2e4bff"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Interactive scrub line & node */}
                <line
                  x1={scrubX}
                  y1={chartGeometry.padT}
                  x2={scrubX}
                  y2={chartGeometry.H - chartGeometry.padB}
                  stroke="rgba(46, 75, 255, 0.45)"
                  strokeWidth="1.2"
                />
                <circle
                  cx={scrubX}
                  cy={scrubY50}
                  r="5"
                  fill="#2e4bff"
                  stroke="#ffffff"
                  strokeWidth="2"
                />

                {/* Terminal Probability Density Histogram on right margin */}
                <g
                  transform={`translate(${
                    chartGeometry.W - chartGeometry.padR + 10
                  }, 0)`}
                >
                  <text
                    x="0"
                    y={chartGeometry.padT - 6}
                    className="stf-svg-axis"
                  >
                    Terminal pdf
                  </text>
                  {activePathResult.histogram.map((bin, bIdx) => {
                    const by = Math.max(
                      chartGeometry.padT,
                      Math.min(
                        chartGeometry.H - chartGeometry.padB - 10,
                        chartGeometry.yOf(bin.centerK) - 5,
                      ),
                    );
                    const bw = Math.max(3, bin.density * (chartGeometry.padR - 22));
                    return (
                      <rect
                        key={bIdx}
                        x="0"
                        y={by}
                        width={bw}
                        height="9"
                        rx="2"
                        fill={bin.isPositive ? '#2e4bff' : '#93a9ff'}
                        opacity={0.32 + bin.density * 0.58}
                      />
                    );
                  })}
                </g>

                {/* X-axis month labels */}
                {chartGeometry.xTicks.map((tk) => (
                  <text
                    key={tk.m}
                    x={tk.x}
                    y={chartGeometry.H - 10}
                    textAnchor="middle"
                    className="stf-svg-axis"
                  >
                    M{tk.m}
                  </text>
                ))}
              </svg>

              {/* Keyboard-accessible month scrubber bar */}
              <div className="stf-chart-scrubber">
                <label htmlFor={`${baseId}-scrub`} className="stf-chart-scrubber__label">
                  Inspect horizon month:
                </label>
                <input
                  id={`${baseId}-scrub`}
                  type="range"
                  min={0}
                  max={chartGeometry.maxM}
                  step={1}
                  value={effectiveScrubMonth}
                  aria-valuetext={`Month ${effectiveScrubMonth}`}
                  onChange={(e) => setScrubMonth(Number(e.target.value))}
                />
                <span className="stf-chart-scrubber__val">
                  M{effectiveScrubMonth} / M{chartGeometry.maxM}
                </span>
              </div>
            </div>
          </div>

          {/* SENSITIVITY BARS (Which Assumption Moves the Result Most) */}
          <div className="stf-sensitivity-card">
            <div className="stf-engine__panel-head">
              <span className="stf-engine__panel-title">
                04 · Sensitivity Attribution (What Moves the Outcome Most)
              </span>
              <span className="stf-engine__panel-sub">
                Share of P10→P90 variance &amp; dollar swing
              </span>
            </div>

            <div className="stf-sens-list" role="list">
              {activePathResult.sensitivities.map((bar, idx) => (
                <div
                  key={bar.id}
                  role="listitem"
                  className={`stf-sens-row${idx === 0 ? ' is-primary' : ''}`}
                >
                  <div className="stf-sens-row__top">
                    <span className="stf-sens-row__rank">0{idx + 1}</span>
                    <span className="stf-sens-row__name">{bar.label}</span>
                    <span className="stf-sens-row__prior">{bar.baseSummary}</span>
                    <strong className="stf-sens-row__pct">
                      {bar.varianceSharePct}% of variance
                    </strong>
                  </div>
                  <div className="stf-sens-row__bar-wrap">
                    <span className="stf-sens-row__swing stf-sens-row__swing--neg">
                      {formatCurrencyK(bar.swingMinusK, true)}
                    </span>
                    <div className="stf-sens-row__track" aria-hidden="true">
                      <div
                        className="stf-sens-row__fill"
                        style={{
                          width: `${Math.max(8, Math.min(100, bar.varianceSharePct * 1.65))}%`,
                        }}
                      />
                    </div>
                    <span className="stf-sens-row__swing stf-sens-row__swing--pos">
                      {formatCurrencyK(bar.swingPlusK, true)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- 5. Staged Evidence Trail & Executive Decision Memo ---------- */}
      <div className="stf-engine__bottom">
        {/* STAGED EVIDENCE TRAIL (Vibe-Studio-inspired visible reasoning/tool calls) */}
        <div className="stf-trail-card">
          <div className="stf-engine__panel-head">
            <span className="stf-engine__panel-title">
              05 · Agent Evidence Trail
            </span>
            <span className="stf-engine__panel-sub">
              Assumptions verified &amp; comparables pulled from live run
            </span>
          </div>

          <ol className="stf-trail-list" aria-live="polite">
            {summary.evidenceTrail.map((step, idx) => {
              const isDone = idx < trailStage;
              return (
                <li
                  key={step.id}
                  className={`stf-trail-item${isDone ? ' is-done' : ' is-pending'}`}
                >
                  <div className="stf-trail-item__head">
                    <span className="stf-trail-item__check" aria-hidden="true">
                      {isDone ? '✓' : '…'}
                    </span>
                    <code className="stf-trail-item__tool">{step.toolName}()</code>
                    <span className="stf-trail-item__title">{step.title}</span>
                    <span className="stf-trail-item__badge">{step.metricBadge}</span>
                  </div>
                  <p className="stf-trail-item__detail">{step.detail}</p>
                </li>
              );
            })}
          </ol>
        </div>

        {/* EXECUTIVE DECISION MEMO */}
        <div className="stf-memo-card">
          <div className="stf-memo-card__header">
            <div>
              <span className="micro-label">06 · Executive Decision Memo</span>
              <h4 className="stf-memo-card__title">{summary.memo.headlineVerdict}</h4>
            </div>
            <span className="stf-memo-card__confidence">
              {summary.memo.confidenceLabel} · {summary.memo.roiProbPct.toFixed(1)}% P(ROI &gt; 0)
            </span>
          </div>

          <p className="stf-memo-card__rationale">{summary.memo.rationale}</p>

          <div className="stf-memo-card__grid">
            <div className="stf-memo-box stf-memo-box--highlight">
              <span className="stf-memo-box__eyebrow">
                The #1 Assumption to Test First ({summary.memo.topAssumptionSharePct}% of variance)
              </span>
              <strong className="stf-memo-box__heading">
                {summary.memo.topAssumptionLabel}
              </strong>
              <p className="stf-memo-box__body">{summary.memo.firstTestProtocol}</p>
            </div>

            <div className="stf-memo-box">
              <span className="stf-memo-box__eyebrow">
                Explicit Trade-Off (What This Path Refuses)
              </span>
              <p className="stf-memo-box__body">{summary.memo.refusedTradeoff}</p>
              <span className="stf-memo-box__eyebrow" style={{ marginTop: 14 }}>
                Monday-Morning Execution Sequence
              </span>
              <ul className="stf-memo-box__seq">
                {summary.memo.mondaySequence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="stf-engine__footnote">{decisionEngineCopy.modelNotice}</p>
        </div>
      </div>
    </div>
  );
}
