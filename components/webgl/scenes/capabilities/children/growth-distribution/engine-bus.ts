import {
  ALLOCATION_PRESETS,
  type ChannelId,
  type EngineMode,
  type HorizonMonths,
  normalizeWeights,
  simulateGrowthEngine,
} from '@/lib/content/overhaul/cap-growth';

const defaultPreset = ALLOCATION_PRESETS[0];
const initialSim = simulateGrowthEngine({
  monthlyBudget: defaultPreset.monthlyBudget,
  horizonMonths: defaultPreset.horizonMonths,
  mode: defaultPreset.mode,
  weights: defaultPreset.weights,
});

/**
 * Module-scope bus connecting the DOM Growth Engine studio to GrowthDistributionScene.
 * DOM components mutate this object; the R3F scene reads it transiently inside useFrame
 * with zero React re-renders per frame.
 */
export const engineBus = {
  monthlyBudget: defaultPreset.monthlyBudget,
  horizonMonths: defaultPreset.horizonMonths as HorizonMonths,
  mode: defaultPreset.mode as EngineMode,
  weights: normalizeWeights(defaultPreset.weights) as Record<ChannelId, number>,
  activeChannel: null as ChannelId | null,
  inspectedMonth: 24,
  webglHeights: initialSim.webglHeights.slice(),
  webglActivityHeights: initialSim.webglActivityHeights.slice(),
  growthMultiple: initialSim.growthMultiple,
  compoundingShare: initialSim.compoundingShare,
  launchAt: 0,
  launchAssetId: 'pillar-study',
};

type ExternalDirectiveListener = (directive: {
  presetId?: string;
  focusChannel?: ChannelId | null;
  triggerLaunch?: boolean;
}) => void;

const directiveListeners = new Set<ExternalDirectiveListener>();

export function subscribeEngineDirectives(fn: ExternalDirectiveListener): () => void {
  directiveListeners.add(fn);
  return () => {
    directiveListeners.delete(fn);
  };
}

export function dispatchEngineDirective(directive: {
  presetId?: string;
  focusChannel?: ChannelId | null;
  triggerLaunch?: boolean;
}) {
  directiveListeners.forEach((fn) => fn(directive));
}

export function triggerWebglLaunchWave(assetId?: string) {
  if (assetId) engineBus.launchAssetId = assetId;
  engineBus.launchAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
}
