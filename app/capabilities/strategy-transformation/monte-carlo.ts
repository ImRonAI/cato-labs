/**
 * Seeded Monte Carlo Engine for /capabilities/strategy-transformation
 * ("THE DECISION ENGINE").
 *
 * Computes 2,400 stochastic trajectories across three strategic paths
 * per scenario. Supports both synchronous initial computation (zero SSR
 * layout shift) and progressive chunked execution across animation frames
 * (non-blocking live convergence).
 */

import {
  type AssumptionSpec,
  type PathSpec,
  type ScenarioSpec,
} from '@/lib/content/overhaul/cap-strategy';
import { CURVE_SAMPLES } from '@/components/webgl/scenes/capabilities/children/strategy-transformation/bus';

export const TOTAL_MONTE_CARLO_RUNS = 2400;
export const SAMPLE_HAIRLINE_COUNT = 16;
export const HISTOGRAM_BINS = 11;

export interface SimulationParams {
  scenario: ScenarioSpec;
  investmentK: number;
  horizonMonths: number;
  riskAppetite: number;
  teamCapacity: number;
  seedOffset: number;
  stressShock: boolean;
}

export interface MonthlyPercentilePoint {
  month: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface SensitivityBar {
  id: string;
  label: string;
  unit: string;
  baseSummary: string;
  varianceSharePct: number;
  swingMinusK: number;
  swingPlusK: number;
  firstTestProtocol: string;
}

export interface HistogramBin {
  centerK: number;
  density: number;
  isPositive: boolean;
}

export interface PathSimulationResult {
  pathIndex: number;
  spec: PathSpec;
  monthly: MonthlyPercentilePoint[];
  samplePaths: number[][];
  histogram: HistogramBin[];
  p10TerminalK: number;
  p50TerminalK: number;
  p90TerminalK: number;
  roiProbPct: number;
  paybackMonth: number | null;
  riskAdjustedScore: number;
  sensitivities: SensitivityBar[];
  /** Normalized 13-point curves for the 3D WebGL fan ribbon */
  glCurveP10: Float32Array;
  glCurveP50: Float32Array;
  glCurveP90: Float32Array;
}

export interface EvidenceTrailStep {
  id: string;
  toolName: string;
  title: string;
  metricBadge: string;
  detail: string;
}

export interface DecisionMemo {
  recommendedPathIndex: number;
  recommendedCode: string;
  recommendedName: string;
  confidenceLabel: 'High Conviction' | 'Moderate-High Conviction' | 'Guarded / Conditional';
  roiProbPct: number;
  paybackText: string;
  headlineVerdict: string;
  rationale: string;
  refusedTradeoff: string;
  topAssumptionLabel: string;
  topAssumptionSharePct: number;
  firstTestProtocol: string;
  mondaySequence: readonly string[];
}

export interface MonteCarloSummary {
  params: SimulationParams;
  completedRuns: number;
  totalRuns: number;
  seedLabel: string;
  paths: [PathSimulationResult, PathSimulationResult, PathSimulationResult];
  recommendedPathIndex: number;
  evidenceTrail: EvidenceTrailStep[];
  memo: DecisionMemo;
}

/* ------------------------------------------------------------------ */
/*  Deterministic PRNG (Mulberry32) + Box-Muller Normal Generator     */
/* ------------------------------------------------------------------ */

function hashParams(p: SimulationParams, pathIndex: number): number {
  let h = 2166136261 >>> 0;
  const str = `${p.scenario.id}:${pathIndex}:${p.investmentK}:${p.horizonMonths}:${p.riskAppetite}:${p.teamCapacity}:${p.seedOffset}:${p.stressShock ? 1 : 0}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function createPrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawStandardNormal(rand: () => number): number {
  const u1 = Math.max(1e-7, rand());
  const u2 = rand();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z < -3.2 ? -3.2 : z > 3.2 ? 3.2 : z;
}

export function formatCurrencyK(valK: number, showSign = false): string {
  const sign = valK < 0 ? '-' : showSign && valK > 0 ? '+' : '';
  const abs = Math.abs(valK);
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(2)}M`;
  }
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}K`;
}

/* ------------------------------------------------------------------ */
/*  Progressive Batch Accumulator per Path                            */
/* ------------------------------------------------------------------ */

interface PathAccumulator {
  pathIndex: number;
  spec: PathSpec;
  rand: () => number;
  horizon: number;
  /** Per-month values across runs: monthValues[t][runIdx] */
  monthValues: Float32Array[];
  /** Stored sample paths for background hairlines */
  samplePaths: number[][];
  /** Factor values per run for exact variance sensitivity calculation */
  factorZ: [Float32Array, Float32Array, Float32Array, Float32Array, Float32Array];
  terminalValues: Float32Array;
}

export interface ProgressiveMonteCarloSession {
  params: SimulationParams;
  completedRuns: number;
  totalRuns: number;
  accumulators: [PathAccumulator, PathAccumulator, PathAccumulator];
}

export function createMonteCarloSession(
  params: SimulationParams,
  totalRuns = TOTAL_MONTE_CARLO_RUNS,
): ProgressiveMonteCarloSession {
  const H = params.horizonMonths;
  const accumulators = params.scenario.paths.map((spec, idx): PathAccumulator => {
    const seed = hashParams(params, idx);
    const monthValues: Float32Array[] = [];
    for (let m = 0; m <= H; m++) {
      monthValues.push(new Float32Array(totalRuns));
    }
    return {
      pathIndex: idx,
      spec,
      rand: createPrng(seed),
      horizon: H,
      monthValues,
      samplePaths: [],
      factorZ: [
        new Float32Array(totalRuns),
        new Float32Array(totalRuns),
        new Float32Array(totalRuns),
        new Float32Array(totalRuns),
        new Float32Array(totalRuns),
      ],
      terminalValues: new Float32Array(totalRuns),
    };
  }) as unknown as [PathAccumulator, PathAccumulator, PathAccumulator];

  return {
    params,
    completedRuns: 0,
    totalRuns,
    accumulators,
  };
}

/**
 * Advance the Monte Carlo simulation by `batchSize` runs across all 3 paths.
 * Returns true when all runs have completed.
 */
export function advanceMonteCarloSession(
  session: ProgressiveMonteCarloSession,
  batchSize: number,
): boolean {
  const { params, totalRuns, accumulators } = session;
  const startRun = session.completedRuns;
  const endRun = Math.min(totalRuns, startRun + batchSize);
  const H = params.horizonMonths;

  const invK = params.investmentK;
  const capNorm = params.teamCapacity / 100;
  const riskNorm = params.riskAppetite / 100;
  const stressPenalty = params.stressShock ? 0.78 : 1.0;
  const stressCostMult = params.stressShock ? 1.18 : 1.0;

  /* Diminishing returns on capital scale */
  const effectiveCapitalScale = 420 * Math.pow(invK / 420, 0.85);

  for (let pIdx = 0; pIdx < 3; pIdx++) {
    const acc = accumulators[pIdx];
    const spec = acc.spec;
    const rand = acc.rand;

    /* Execution strain if path complexity exceeds team capacity */
    const capacityGap = Math.max(0, spec.executionComplexity - capNorm * 0.95);
    const capacityBoost = 0.72 + capNorm * 0.48 - capacityGap * 0.52;
    const volScale = spec.volatility * (0.78 + riskNorm * 0.48) * (params.stressShock ? 1.22 : 1.0);

    for (let r = startRun; r < endRun; r++) {
      const zAdoption = drawStandardNormal(rand);
      const zIntegration = drawStandardNormal(rand);
      const zYield = drawStandardNormal(rand);
      const zLag = drawStandardNormal(rand);
      const zMacro = drawStandardNormal(rand);

      acc.factorZ[0][r] = zAdoption;
      acc.factorZ[1][r] = zIntegration;
      acc.factorZ[2][r] = zYield;
      acc.factorZ[3][r] = zLag;
      acc.factorZ[4][r] = zMacro;

      /* 1. Effective lag in months before value generation ramps */
      const lagShock = Math.exp(
        -zLag * 0.22 - zIntegration * (0.18 + spec.executionComplexity * 0.24),
      );
      const effectiveLag =
        spec.baseLagMonths *
        (1 + capacityGap * 1.15) *
        (params.stressShock ? 1.22 : 1.0) *
        lagShock;

      /* 2. Monthly steady-state gross value once ramped */
      const upsideMult =
        zAdoption > 0 ? 1 + zAdoption * volScale * spec.upsideConvexity : Math.exp(zAdoption * volScale);
      const yieldMult = Math.exp(zYield * volScale * 0.68);
      const integrationMult = Math.exp(
        zIntegration * volScale * (0.45 + spec.executionComplexity * 0.55),
      );
      const macroMult = Math.exp(zMacro * volScale * 0.52) * stressPenalty;

      const monthlyGrossTarget =
        effectiveCapitalScale *
        spec.baseYieldRate *
        capacityBoost *
        upsideMult *
        yieldMult *
        integrationMult *
        macroMult;

      /* 3. Phased capital deployment schedule */
      const upfrontTotal = invK * spec.upfrontCapitalShare * stressCostMult;
      const phasedTotal = invK * (1 - spec.upfrontCapitalShare) * stressCostMult;
      const upfrontMonths = Math.max(2, Math.min(H, Math.round(spec.baseLagMonths + 1.5)));
      const phasedMonths = Math.max(1, H - upfrontMonths);

      let cumNet = -upfrontTotal * 0.35;
      acc.monthValues[0][r] = cumNet;

      const recordSample = r < SAMPLE_HAIRLINE_COUNT;
      const sampleCurve = recordSample ? [cumNet] : null;

      for (let m = 1; m <= H; m++) {
        const monthlyCost =
          m <= upfrontMonths
            ? (upfrontTotal * 0.65) / upfrontMonths
            : phasedTotal / phasedMonths;

        /* S-curve adoption ramp after effectiveLag */
        const rampProgress = (m - effectiveLag) / Math.max(1.2, spec.baseLagMonths * 0.85);
        const ramp = 1 / (1 + Math.exp(-rampProgress * 2.1));
        /* Compounding maturity factor over time */
        const compounding = 1 + Math.max(0, m - effectiveLag) * 0.018 * spec.upsideConvexity;

        /* Real-options Gate 1 protection: phased paths throttle subsequent spend if early demand lags */
        const isPhasedGate = spec.upfrontCapitalShare < 0.55;
        const gateThrottle =
          isPhasedGate && m > upfrontMonths && zAdoption < -0.35
            ? 0.48
            : 1.0;

        const monthlyInflow = monthlyGrossTarget * ramp * compounding;
        cumNet += monthlyInflow - monthlyCost * gateThrottle;
        acc.monthValues[m][r] = cumNet;
        if (sampleCurve) sampleCurve.push(cumNet);
      }

      if (sampleCurve) acc.samplePaths.push(sampleCurve);
      acc.terminalValues[r] = cumNet;
    }
  }

  session.completedRuns = endRun;
  return session.completedRuns >= totalRuns;
}

/** Extract a percentile from a sorted Float32Array segment [0..n-1] */
function percentileSorted(sorted: Float32Array, n: number, p: number): number {
  if (n <= 0) return 0;
  const idx = (n - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Summarize the current state of a progressive Monte Carlo session into
 * percentiles, sensitivity bars, evidence trail, and decision memo.
 */
export function summarizeMonteCarloSession(
  session: ProgressiveMonteCarloSession,
): MonteCarloSummary {
  const { params, completedRuns, totalRuns, accumulators } = session;
  const N = Math.max(1, completedRuns);
  const H = params.horizonMonths;
  const scratch = new Float32Array(N);

  const pathResults = accumulators.map((acc) => {
    const monthly: MonthlyPercentilePoint[] = [];
    for (let m = 0; m <= H; m++) {
      const src = acc.monthValues[m];
      for (let i = 0; i < N; i++) scratch[i] = src[i];
      scratch.sort();
      monthly.push({
        month: m,
        p10: percentileSorted(scratch, N, 0.1),
        p25: percentileSorted(scratch, N, 0.25),
        p50: percentileSorted(scratch, N, 0.5),
        p75: percentileSorted(scratch, N, 0.75),
        p90: percentileSorted(scratch, N, 0.9),
      });
    }

    const termP10 = monthly[H].p10;
    const termP50 = monthly[H].p50;
    const termP90 = monthly[H].p90;

    /* Positive ROI probability & median payback month */
    let positiveCount = 0;
    for (let i = 0; i < N; i++) {
      if (acc.terminalValues[i] > 0) positiveCount++;
    }
    const roiProbPct = (positiveCount / N) * 100;

    let paybackMonth: number | null = null;
    for (let m = 1; m <= H; m++) {
      if (monthly[m].p50 >= 0) {
        const prev = monthly[m - 1].p50;
        const curr = monthly[m].p50;
        const frac = curr > prev ? Math.max(0, -prev / (curr - prev)) : 0;
        paybackMonth = Number((m - 1 + frac).toFixed(1));
        break;
      }
    }

    /* Terminal histogram across [p10 - pad, p90 + pad] */
    const minV = Math.min(termP10 * 1.15, -params.investmentK * 0.5);
    const maxV = Math.max(termP90 * 1.1, params.investmentK * 0.5);
    const span = Math.max(100, maxV - minV);
    const binWidth = span / HISTOGRAM_BINS;
    const counts = new Array<number>(HISTOGRAM_BINS).fill(0);
    for (let i = 0; i < N; i++) {
      const v = acc.terminalValues[i];
      const b = Math.max(0, Math.min(HISTOGRAM_BINS - 1, Math.floor((v - minV) / binWidth)));
      counts[b]++;
    }
    const maxCount = Math.max(1, ...counts);
    const histogram: HistogramBin[] = counts.map((c, b) => {
      const centerK = minV + (b + 0.5) * binWidth;
      return {
        centerK,
        density: c / maxCount,
        isPositive: centerK >= 0,
      };
    });

    /* Variance contribution (Sensitivity bars) via covariance with terminal outcome */
    let meanY = 0;
    for (let i = 0; i < N; i++) meanY += acc.terminalValues[i];
    meanY /= N;

    const rawCorrs: number[] = [];
    for (let f = 0; f < 5; f++) {
      const zArr = acc.factorZ[f];
      let cov = 0;
      for (let i = 0; i < N; i++) {
        cov += zArr[i] * (acc.terminalValues[i] - meanY);
      }
      rawCorrs.push(Math.abs(cov / N));
    }
    const totalCorrSq =
      rawCorrs.reduce((sum, c) => sum + c * c, 0) || 1;
    const halfSpread = Math.max(40, (termP90 - termP10) * 0.5);

    const sensitivities: SensitivityBar[] = params.scenario.assumptions
      .map((assump: AssumptionSpec, fIdx: number) => {
        const share = ((rawCorrs[fIdx] * rawCorrs[fIdx]) / totalCorrSq) * 100;
        const factorSwing = halfSpread * Math.sqrt(share / 100);
        return {
          id: assump.id,
          label: assump.label,
          unit: assump.unit,
          baseSummary: assump.baseSummary,
          varianceSharePct: Math.round(share),
          swingMinusK: -Math.round(factorSwing * 0.88),
          swingPlusK: Math.round(factorSwing * 1.08),
          firstTestProtocol: assump.firstTestProtocol,
        };
      })
      .sort((a, b) => b.varianceSharePct - a.varianceSharePct);

    /* Risk-adjusted utility score: weights P10 downside protection vs P50/P90 upside by riskAppetite */
    const rWeight = params.riskAppetite / 100;
    const capNorm = params.teamCapacity / 100;
    const downsideWeight = 0.72 * (1 - rWeight * 0.72);
    const upsideWeight = 0.08 + rWeight * 0.42;
    const medianWeight = 1 - downsideWeight - upsideWeight;
    const lossAversionPenalty =
      termP10 < 0 ? termP10 * (1.25 - rWeight * 1.05) : termP10 * 0.15;
    const complexityPenalty =
      Math.max(0, acc.spec.executionComplexity - capNorm * 0.92) *
      params.investmentK *
      (1.1 - rWeight * 0.7);
    const paybackBonus =
      paybackMonth !== null
        ? (H - paybackMonth) * (params.investmentK * 0.055)
        : -params.investmentK * 0.4;
    const riskAdjustedScore =
      termP50 * medianWeight +
      termP10 * downsideWeight +
      termP90 * upsideWeight +
      lossAversionPenalty -
      complexityPenalty +
      paybackBonus;

    /* Normalized 13-point curves for 3D WebGL scene */
    const normDiv = Math.max(250, params.investmentK * 2.2);
    const glCurveP10 = new Float32Array(CURVE_SAMPLES);
    const glCurveP50 = new Float32Array(CURVE_SAMPLES);
    const glCurveP90 = new Float32Array(CURVE_SAMPLES);
    for (let i = 0; i < CURVE_SAMPLES; i++) {
      const mFloat = (i / (CURVE_SAMPLES - 1)) * H;
      const m0 = Math.floor(mFloat);
      const m1 = Math.min(H, Math.ceil(mFloat));
      const frac = mFloat - m0;
      const v10 = monthly[m0].p10 + (monthly[m1].p10 - monthly[m0].p10) * frac;
      const v50 = monthly[m0].p50 + (monthly[m1].p50 - monthly[m0].p50) * frac;
      const v90 = monthly[m0].p90 + (monthly[m1].p90 - monthly[m0].p90) * frac;
      glCurveP10[i] = Math.max(-0.35, Math.min(1.6, v10 / normDiv));
      glCurveP50[i] = Math.max(-0.25, Math.min(1.8, v50 / normDiv));
      glCurveP90[i] = Math.max(-0.15, Math.min(2.1, v90 / normDiv));
    }

    return {
      pathIndex: acc.pathIndex,
      spec: acc.spec,
      monthly,
      samplePaths: acc.samplePaths,
      histogram,
      p10TerminalK: Math.round(termP10),
      p50TerminalK: Math.round(termP50),
      p90TerminalK: Math.round(termP90),
      roiProbPct: Number(roiProbPct.toFixed(1)),
      paybackMonth,
      riskAdjustedScore: Math.round(riskAdjustedScore),
      sensitivities,
      glCurveP10,
      glCurveP50,
      glCurveP90,
    };
  }) as [PathSimulationResult, PathSimulationResult, PathSimulationResult];

  /* Determine recommended path by risk-adjusted utility score */
  let recIdx = 0;
  if (pathResults[1].riskAdjustedScore > pathResults[recIdx].riskAdjustedScore) recIdx = 1;
  if (pathResults[2].riskAdjustedScore > pathResults[recIdx].riskAdjustedScore) recIdx = 2;

  const winning = pathResults[recIdx];
  const runnerUp = pathResults
    .filter((_, idx) => idx !== recIdx)
    .sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore)[0];
  const topDriver = winning.sensitivities[0];

  const seedNum = (hashParams(params, recIdx) % 9000) + 1000;
  const seedLabel = `#${seedNum}`;

  const evidenceTrail: EvidenceTrailStep[] = [
    {
      id: 'constraints',
      toolName: 'verify_envelope',
      title: 'Capital & execution bandwidth envelope checked',
      metricBadge: `${formatCurrencyK(params.investmentK)} · ${params.teamCapacity}% capacity`,
      detail: `Phased drawdown across ${params.horizonMonths} months (${Math.round(
        winning.spec.upfrontCapitalShare * 100,
      )}% Gate 1 commitment) matched against ${params.teamCapacity}% internal team bandwidth${
        params.stressShock ? ' under +18% cost / -22% demand macro shock' : ''
      }.`,
    },
    {
      id: 'comparables',
      toolName: 'run_monte_carlo',
      title: `Simulated ${N.toLocaleString('en-US')} seeded trajectories (${seedLabel})`,
      metricBadge: `${winning.roiProbPct.toFixed(1)}% P(ROI > 0)`,
      detail: `${winning.spec.code} (${winning.spec.name}) reaches median breakeven at ${
        winning.paybackMonth !== null ? `Month ${winning.paybackMonth}` : `beyond Month ${H}`
      } with P50 net value of ${formatCurrencyK(winning.p50TerminalK, true)} (P10: ${formatCurrencyK(
        winning.p10TerminalK,
        true,
      )}, P90: ${formatCurrencyK(winning.p90TerminalK, true)}).`,
    },
    {
      id: 'sensitivity',
      toolName: 'decompose_variance',
      title: 'Rank-order variance attribution isolated',
      metricBadge: `${topDriver.varianceSharePct}% of spread`,
      detail: `"${topDriver.label}" accounts for ${topDriver.varianceSharePct}% of terminal outcome variance (${formatCurrencyK(
        topDriver.swingMinusK,
        true,
      )} to ${formatCurrencyK(topDriver.swingPlusK, true)} swing).`,
    },
    {
      id: 'dominance',
      toolName: 'issue_decision_memo',
      title: 'Risk-adjusted dominance test passed',
      metricBadge: `+${formatCurrencyK(
        Math.max(10, winning.riskAdjustedScore - runnerUp.riskAdjustedScore),
      )} utility edge`,
      detail: `At ${params.riskAppetite}% risk appetite, ${winning.spec.code} outperforms ${runnerUp.spec.code} by balancing ${formatCurrencyK(
        winning.p10TerminalK,
        true,
      )} P10 floor against ${formatCurrencyK(winning.p90TerminalK, true)} P90 upside.`,
    },
  ];

  const confidenceLabel: DecisionMemo['confidenceLabel'] =
    winning.roiProbPct >= 78
      ? 'High Conviction'
      : winning.roiProbPct >= 58
        ? 'Moderate-High Conviction'
        : 'Guarded / Conditional';

  const paybackText =
    winning.paybackMonth !== null
      ? `Month ${winning.paybackMonth}`
      : `> ${params.horizonMonths} months`;

  const memo: DecisionMemo = {
    recommendedPathIndex: recIdx,
    recommendedCode: winning.spec.code,
    recommendedName: winning.spec.name,
    confidenceLabel,
    roiProbPct: winning.roiProbPct,
    paybackText,
    headlineVerdict: `Commit to ${winning.spec.code}: ${winning.spec.name} (${formatCurrencyK(
      winning.p50TerminalK,
      true,
    )} expected net value over ${params.horizonMonths}m).`,
    rationale: `${winning.spec.summary} Given ${params.teamCapacity}% team capacity and ${params.riskAppetite}% risk appetite, this path delivers a ${winning.roiProbPct.toFixed(
      1,
    )}% probability of positive net return with ${paybackText} median payback.`,
    refusedTradeoff: winning.spec.refuses,
    topAssumptionLabel: topDriver.label,
    topAssumptionSharePct: topDriver.varianceSharePct,
    firstTestProtocol: topDriver.firstTestProtocol,
    mondaySequence: winning.spec.mondaySequence,
  };

  return {
    params,
    completedRuns: N,
    totalRuns,
    seedLabel,
    paths: pathResults,
    recommendedPathIndex: recIdx,
    evidenceTrail,
    memo,
  };
}

/** Synchronous full 2,400-run computation for initial render / reduced motion */
export function runFullMonteCarlo(params: SimulationParams): MonteCarloSummary {
  const session = createMonteCarloSession(params, TOTAL_MONTE_CARLO_RUNS);
  advanceMonteCarloSession(session, TOTAL_MONTE_CARLO_RUNS);
  return summarizeMonteCarloSession(session);
}
