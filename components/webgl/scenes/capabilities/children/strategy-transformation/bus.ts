/**
 * strategyBus — mutable channel between THE DECISION ENGINE (DOM) and
 * StrategyTransformationScene (WebGL).
 *
 * The DOM writes whenever levers, scenarios, or Monte Carlo percentiles
 * update; the WebGL scene reads transiently inside useFrame with zero
 * React re-renders.
 */

export const CURVE_SAMPLES = 13;

function defaultCurve(endY: number, sag: number): Float32Array {
  const arr = new Float32Array(CURVE_SAMPLES);
  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const u = i / (CURVE_SAMPLES - 1);
    arr[i] = -sag * Math.sin(u * Math.PI * 0.45) * (1 - u) + endY * Math.pow(u, 1.35);
  }
  return arr;
}

export const strategyBus = {
  scenarioIndex: 0,
  selectedPathIndex: 0,
  recommendedPathIndex: 0,
  investmentNorm: 0.2,
  horizonNorm: 0.4,
  riskNorm: 0.44,
  capacityNorm: 0.56,
  /** Normalized terminal outcomes (-0.8 .. +1.8) for 3D elevation */
  p10Norm: 0.22,
  p50Norm: 0.68,
  p90Norm: 1.24,
  /** Normalized P90 - P10 spread (0.2 .. 1.6) */
  spreadNorm: 0.58,
  /** Positive ROI probability (0..1) */
  roiProb: 0.86,
  /** Payback position along horizon (0.15..0.95) */
  paybackNorm: 0.38,
  /** 13-point normalized trajectory curves along the horizon */
  curveP10: defaultCurve(0.22, 0.22),
  curveP50: defaultCurve(0.68, 0.14),
  curveP90: defaultCurve(1.24, 0.08),
  /** Timestamp (performance.now()) when simulation or lever changed */
  pulseAt: 0,
  /** Progressive Monte Carlo completion (0..1) */
  simProgress: 1,
  /** Stress shock mode active */
  stressShock: false,
};

export function triggerStrategyPulse(): void {
  if (typeof performance !== 'undefined') {
    strategyBus.pulseAt = performance.now();
  }
}
