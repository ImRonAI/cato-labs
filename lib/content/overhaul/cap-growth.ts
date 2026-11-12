/**
 * Overhaul copy & deterministic 24-month cohort model for
 * /capabilities/growth-distribution ("Growth is architecture, not activity.").
 *
 * All assumptions are explicit and labelled in the UI. Pure deterministic
 * client-side math — zero network calls, zero external dependencies.
 */

export type ChannelId =
  | 'seo'
  | 'paid'
  | 'social'
  | 'partners'
  | 'crm'
  | 'local';

export type HorizonMonths = 12 | 18 | 24;
export type EngineMode = 'architecture' | 'activity';

export interface ChannelSpec {
  id: ChannelId;
  code: string;
  label: string;
  shortLabel: string;
  role: string;
  /** Baseline Customer Acquisition Cost in USD at reference spend */
  baseCac: number;
  /** Baseline visit-to-customer conversion rate (0..1) */
  conversionRate: number;
  /** Months before full channel velocity (indexing, cadence, partner onboarding) */
  lagMonths: number;
  /** Monthly compounding efficiency gain under Architecture mode */
  monthlyCompounding: number;
  /** Fraction of prior months' content/authority output that persists each month */
  assetPersistence: number;
  /** Month-1 cohort retention rate (0..1) */
  month1Retention: number;
  /** Base monthly cohort logo decay rate (0..1) before CRM lifecycle lift */
  monthlyChurn: number;
  /** Shade in the Cato blue spectrum for stacked chart & telemetry */
  tint: string;
  tintSoft: string;
  /** Explicit human-readable assumption summary shown in the assumptions drawer */
  assumptionNote: string;
  /** Native content format produced during the Launch Asset fan-out */
  launchArtifact: string;
}

export const CHANNELS: readonly ChannelSpec[] = [
  {
    id: 'seo',
    code: 'CH-01',
    label: 'Search & SEO Content',
    shortLabel: 'Search / SEO',
    role: 'Technical schema, llms.txt & topical authority pillars',
    baseCac: 1_850,
    conversionRate: 0.039,
    lagMonths: 3.0,
    monthlyCompounding: 0.058,
    assetPersistence: 0.96,
    month1Retention: 0.972,
    monthlyChurn: 0.014,
    tint: '#1226c8',
    tintSoft: 'rgba(18, 38, 200, 0.82)',
    assumptionNote:
      '3-month technical & crawl-budget ramp; published pillars persist at 96%/mo and compound organic authority at +5.8%/mo.',
    launchArtifact: 'Canonical Pillar + JSON-LD Schema + llms.txt Entity Graph',
  },
  {
    id: 'paid',
    code: 'CH-02',
    label: 'Paid Search Capture',
    shortLabel: 'Paid Search',
    role: 'High-intent demand capture & message validation',
    baseCac: 2_380,
    conversionRate: 0.045,
    lagMonths: 0.2,
    monthlyCompounding: 0.005,
    assetPersistence: 0.0,
    month1Retention: 0.935,
    monthlyChurn: 0.032,
    tint: '#2e4bff',
    tintSoft: 'rgba(46, 75, 255, 0.78)',
    assumptionNote:
      'Immediate month-1 auction capture; zero residual traffic when spend pauses; auction elasticity raises CAC as share exceeds 30%.',
    launchArtifact: 'High-Intent Search Capture & Landing Variant',
  },
  {
    id: 'social',
    code: 'CH-03',
    label: 'Social Operating System',
    shortLabel: 'Social Engine',
    role: 'One narrative system cut natively across 6 dialects',
    baseCac: 1_960,
    conversionRate: 0.028,
    lagMonths: 1.2,
    monthlyCompounding: 0.042,
    assetPersistence: 0.9,
    month1Retention: 0.956,
    monthlyChurn: 0.02,
    tint: '#4c68ff',
    tintSoft: 'rgba(76, 104, 255, 0.74)',
    assumptionNote:
      '1.2-month cadence ramp; owned audience graph compounds organic reach at +4.2%/mo across LinkedIn, X, YouTube, IG & TikTok.',
    launchArtifact: '6-Dialect Native Cut (LinkedIn Thread, X Signal, YT Deep-Dive, IG/TT)',
  },
  {
    id: 'partners',
    code: 'CH-04',
    label: 'Distribution Partnerships',
    shortLabel: 'Partnerships',
    role: 'Creative co-distribution & ecosystem step-changes',
    baseCac: 1_680,
    conversionRate: 0.052,
    lagMonths: 2.0,
    monthlyCompounding: 0.038,
    assetPersistence: 0.92,
    month1Retention: 0.974,
    monthlyChurn: 0.013,
    tint: '#6b87ff',
    tintSoft: 'rgba(107, 135, 255, 0.72)',
    assumptionNote:
      '2-month partner onboarding; co-distribution drops trigger step-change inflection waves at Months 4, 9, 15 and 21.',
    launchArtifact: 'Partner Co-Distribution Kit & Syndicated Drop',
  },
  {
    id: 'crm',
    code: 'CH-05',
    label: 'Email, CRM & Lifecycle',
    shortLabel: 'Email / CRM',
    role: 'Automated nurture, activation & cohort expansion',
    baseCac: 1_190,
    conversionRate: 0.064,
    lagMonths: 0.8,
    monthlyCompounding: 0.046,
    assetPersistence: 0.94,
    month1Retention: 0.982,
    monthlyChurn: 0.01,
    tint: '#93a9ff',
    tintSoft: 'rgba(147, 169, 255, 0.72)',
    assumptionNote:
      '0.8-month automation setup; compresses cross-channel cohort churn by up to 42% and lifts conversion across all traffic.',
    launchArtifact: 'Behavioural Lifecycle Sequence & Lead Qualification Loop',
  },
  {
    id: 'local',
    code: 'CH-06',
    label: 'Local-Market Capture',
    shortLabel: 'Local Capture',
    role: 'Map-pack dominance & regional beachhead expansion',
    baseCac: 1_490,
    conversionRate: 0.058,
    lagMonths: 1.5,
    monthlyCompounding: 0.04,
    assetPersistence: 0.93,
    month1Retention: 0.968,
    monthlyChurn: 0.015,
    tint: '#b9c9ff',
    tintSoft: 'rgba(185, 201, 255, 0.75)',
    assumptionNote:
      '1.5-month regional beachhead ramp; map-pack rankings and verified local citations build a high-intent regional moat.',
    launchArtifact: 'Regional Beachhead Pages & Map-Pack Entity Schema',
  },
] as const;

export interface AllocationPreset {
  id: string;
  label: string;
  badge: string;
  description: string;
  monthlyBudget: number;
  horizonMonths: HorizonMonths;
  mode: EngineMode;
  weights: Record<ChannelId, number>;
}

export const ALLOCATION_PRESETS: readonly AllocationPreset[] = [
  {
    id: 'compounding-flagship',
    label: 'Cato Compounding Architecture',
    badge: 'Recommended',
    description:
      'Search & content pillars paired with AI schema, social dialects, partner step-changes and lifecycle retention.',
    monthlyBudget: 50_000,
    horizonMonths: 24,
    mode: 'architecture',
    weights: {
      seo: 0.28,
      paid: 0.12,
      social: 0.18,
      partners: 0.16,
      crm: 0.14,
      local: 0.12,
    },
  },
  {
    id: 'local-beachhead',
    label: 'Local Beachhead → National',
    badge: 'Regional',
    description:
      'Dominates local map packs and high-intent search first, then recycles cashflow into national authority pillars.',
    monthlyBudget: 35_000,
    horizonMonths: 24,
    mode: 'architecture',
    weights: {
      seo: 0.24,
      paid: 0.14,
      social: 0.12,
      partners: 0.10,
      crm: 0.14,
      local: 0.26,
    },
  },
  {
    id: 'category-velocity',
    label: 'Category Leader Scale',
    badge: 'Scale',
    description:
      'High-output editorial & social operating model amplified by co-distribution partnership drops.',
    monthlyBudget: 85_000,
    horizonMonths: 24,
    mode: 'architecture',
    weights: {
      seo: 0.26,
      paid: 0.10,
      social: 0.22,
      partners: 0.22,
      crm: 0.12,
      local: 0.08,
    },
  },
  {
    id: 'activity-trap',
    label: 'Paid-Heavy Activity Baseline',
    badge: 'Spend-Only',
    description:
      'Over-indexed on uncompounded paid auctions with minimal content persistence or lifecycle architecture.',
    monthlyBudget: 50_000,
    horizonMonths: 24,
    mode: 'activity',
    weights: {
      seo: 0.08,
      paid: 0.56,
      social: 0.14,
      partners: 0.06,
      crm: 0.08,
      local: 0.08,
    },
  },
] as const;

export interface LaunchAssetSpec {
  id: string;
  code: string;
  title: string;
  format: string;
  summary: string;
  /** Channel affinity multipliers when this asset fans out */
  channelMultipliers: Record<ChannelId, number>;
}

export const LAUNCH_ASSETS: readonly LaunchAssetSpec[] = [
  {
    id: 'pillar-study',
    code: 'ASSET — 01',
    title: 'Original Benchmark: State of Autonomous Operations',
    format: 'Canonical Research Pillar + llms.txt + 6 Social Dialects',
    summary:
      'One primary research study engineered with machine-legible schema, cut into six native social formats, syndicated through partners, and wired into CRM nurture.',
    channelMultipliers: {
      seo: 1.45,
      paid: 1.05,
      social: 1.35,
      partners: 1.3,
      crm: 1.25,
      local: 1.0,
    },
  },
  {
    id: 'interactive-diagnostic',
    code: 'ASSET — 02',
    title: 'Interactive Tool: Unit Economics & Payback Diagnostic',
    format: 'Product-Led Acquisition Surface + Partner Co-Drop',
    summary:
      'An interactive calculator that earns high-intent backlinks, converts paid search clicks at 1.6× baseline, and anchors co-branded partner launches.',
    channelMultipliers: {
      seo: 1.3,
      paid: 1.38,
      social: 1.25,
      partners: 1.48,
      crm: 1.35,
      local: 1.05,
    },
  },
  {
    id: 'regional-playbook',
    code: 'ASSET — 03',
    title: 'Market Matrix: Multi-City Beachhead Architecture',
    format: 'Programmatic Local Intent Cluster + Video Series',
    summary:
      'Structured regional landing architecture paired with local proof studies, capturing map-pack intent across priority metros.',
    channelMultipliers: {
      seo: 1.32,
      paid: 1.15,
      social: 1.18,
      partners: 1.12,
      crm: 1.2,
      local: 1.6,
    },
  },
] as const;

export interface MonthRecord {
  month: number;
  /** Attributable monthly revenue per channel under the selected mode ($) */
  byChannel: Record<ChannelId, number>;
  /** Total monthly revenue under the selected mode ($) */
  totalRevenue: number;
  /** Monthly revenue under Architecture (compounding) mode ($) */
  architectureRevenue: number;
  /** Monthly revenue under Activity (spend-only) mode ($) */
  activityRevenue: number;
  /** New customers acquired in this month under the selected mode */
  newCustomers: number;
  /** Active retained customers in this month under the selected mode */
  activeCustomers: number;
  /** Effective blended CAC in this month ($) */
  effectiveCac: number;
  /** Optional milestone annotation at key inflection months */
  milestone?: string;
}

export interface SimulationResult {
  months: MonthRecord[];
  /** Horizon-scoped months (1..horizonMonths) */
  horizonRecords: MonthRecord[];
  /** Month-H monthly revenue under selected mode ($) */
  finalMonthlyRevenue: number;
  /** Month-H monthly revenue under Architecture ($) */
  finalArchitectureRevenue: number;
  /** Month-H monthly revenue under Activity ($) */
  finalActivityRevenue: number;
  /** Cumulative revenue across horizon under selected mode ($) */
  cumulativeRevenue: number;
  /** Cumulative revenue across horizon under Architecture ($) */
  cumulativeArchitectureRevenue: number;
  /** Cumulative revenue across horizon under Activity ($) */
  cumulativeActivityRevenue: number;
  /** Cumulative spend across horizon ($) */
  cumulativeSpend: number;
  /** Blended CAC across horizon ($) */
  blendedCac: number;
  /** Month-H effective CAC ($) */
  finalMonthCac: number;
  /** 24-month Cohort LTV per acquired customer ($) */
  cohortLtv: number;
  /** LTV : CAC ratio */
  ltvToCac: number;
  /** Payback period in months */
  paybackMonths: number;
  /** Share of final month revenue coming from compounding assets + retained cohorts (0..1) */
  compoundingShare: number;
  /** Revenue multiple vs Month-1 baseline */
  growthMultiple: number;
  /** Normalized 0..1 array of 24 monthly totals for WebGL column heights */
  webglHeights: number[];
  /** Normalized 0..1 array of 24 activity-only monthly totals for WebGL baseline */
  webglActivityHeights: number[];
}

export const COMPOSITE_ARPU = 420; // Illustrative monthly revenue per active customer ($)
export const GROSS_MARGIN = 0.78; // 78% software/services composite gross margin
export const BASELINE_MONTHLY_REVENUE = 85_000; // Existing baseline monthly revenue ($85K)

const STEP_MONTHS = [4, 9, 15, 21];

const MILESTONE_LABELS: Record<number, string> = {
  3: 'Technical SEO & llms.txt indexed',
  6: 'Social operating cadence + CRM loops live',
  9: 'Partnership co-distribution step-change',
  15: 'Compounding organic overtakes paid spend',
  21: 'Multi-market authority moat established',
};

export function normalizeWeights(
  weights: Record<ChannelId, number>,
): Record<ChannelId, number> {
  let sum = 0;
  for (const ch of CHANNELS) {
    sum += Math.max(0, weights[ch.id] ?? 0);
  }
  if (sum <= 0.0001) {
    const eq = 1 / CHANNELS.length;
    return {
      seo: eq,
      paid: eq,
      social: eq,
      partners: eq,
      crm: eq,
      local: eq,
    };
  }
  return {
    seo: Math.max(0, weights.seo) / sum,
    paid: Math.max(0, weights.paid) / sum,
    social: Math.max(0, weights.social) / sum,
    partners: Math.max(0, weights.partners) / sum,
    crm: Math.max(0, weights.crm) / sum,
    local: Math.max(0, weights.local) / sum,
  };
}

function intPow(base: number, exp: number): number {
  let result = 1;
  const n = Math.max(0, Math.floor(exp));
  for (let i = 0; i < n; i++) {
    result *= base;
  }
  const frac = Math.max(0, exp - n);
  if (frac > 0) {
    result *= 1 + (base - 1) * frac;
  }
  return result;
}

/**
 * Deterministic 24-month cohort simulator.
 * Uses pure IEEE-754 arithmetic (+, -, *, /) so SSR and client hydration
 * are bit-for-bit identical across all JS runtimes.
 */
export function simulateGrowthEngine(params: {
  monthlyBudget: number;
  horizonMonths: HorizonMonths;
  mode: EngineMode;
  weights: Record<ChannelId, number>;
}): SimulationResult {
  const { monthlyBudget, horizonMonths, mode } = params;
  const w = normalizeWeights(params.weights);

  // Cross-channel architectural synergies (driven by CRM, SEO & Social shares)
  const crmShare = w.crm;
  const seoShare = w.seo;
  const partnersShare = w.partners;

  // CRM lifecycle investment compresses logo churn and lifts conversion across all channels
  const archChurnMultiplier = 1 - Math.min(0.42, crmShare * 1.75);
  const archConversionLift = 1 + Math.min(0.24, crmShare * 0.9 + seoShare * 0.3);

  // Track accumulated content/authority stock per channel across months 1..24
  const contentStock: Record<ChannelId, number> = {
    seo: 0,
    paid: 0,
    social: 0,
    partners: 0,
    crm: 0,
    local: 0,
  };

  // Track cohort matrices: cohortsArch[channel][cohortBirthMonth] = initial customers
  const cohortsArch: Record<ChannelId, number[]> = {
    seo: [],
    paid: [],
    social: [],
    partners: [],
    crm: [],
    local: [],
  };
  const cohortsAct: Record<ChannelId, number[]> = {
    seo: [],
    paid: [],
    social: [],
    partners: [],
    crm: [],
    local: [],
  };

  const months: MonthRecord[] = [];

  for (let m = 1; m <= 24; m++) {
    // Partnership step-change wave multiplier in Architecture mode
    let partnerWaveCount = 0;
    for (const sm of STEP_MONTHS) {
      if (m >= sm) partnerWaveCount += 1;
    }
    const partnerStepBoost = 1 + partnerWaveCount * (0.14 + partnersShare * 0.28);

    const byChannelArch: Record<ChannelId, number> = {
      seo: 0,
      paid: 0,
      social: 0,
      partners: 0,
      crm: 0,
      local: 0,
    };
    const byChannelAct: Record<ChannelId, number> = {
      seo: 0,
      paid: 0,
      social: 0,
      partners: 0,
      crm: 0,
      local: 0,
    };

    let monthNewArch = 0;
    let monthNewAct = 0;
    let monthActiveArch = 0;
    let monthActiveAct = 0;

    for (const ch of CHANNELS) {
      const id = ch.id;
      const spend = monthlyBudget * w[id];

      // 1. Ramp factor: pure IEEE-754 polynomial ramp
      const rawU =
        ch.lagMonths <= 0.3 ? 1 : Math.min(1, m / (ch.lagMonths + 1.2));
      const rampArch = rawU * (0.7 + 0.3 * rawU);

      // 2. Paid saturation penalty if a single non-compounding channel takes excessive share
      const saturationPenalty =
        id === 'paid' && w.paid > 0.25
          ? 1 + (w.paid - 0.25) * 0.85 + m * 0.015
          : 1 + Math.max(0, w[id] - 0.45) * 0.35;

      // 3. Compounding authority & persistent content stock (Architecture mode)
      const effectiveSpendUnits = spend / ch.baseCac;
      contentStock[id] =
        contentStock[id] * ch.assetPersistence + effectiveSpendUnits * rampArch;

      const compoundingBoost = intPow(
        1 + ch.monthlyCompounding,
        Math.max(0, m - ch.lagMonths),
      );

      // New customers acquired in Month m under Architecture:
      const directAcqArch =
        (spend / (ch.baseCac * saturationPenalty)) *
        rampArch *
        archConversionLift *
        (id === 'partners' ? partnerStepBoost : 1);

      const stockYieldRate =
        id === 'seo'
          ? 0.095 * compoundingBoost
          : id === 'social'
            ? 0.068 * compoundingBoost
            : id === 'partners'
              ? 0.072 * partnerStepBoost
              : id === 'crm'
                ? 0.078 * compoundingBoost
                : id === 'local'
                  ? 0.074 * compoundingBoost
                  : 0;

      const newArch = directAcqArch + contentStock[id] * stockYieldRate;

      // New customers acquired in Month m under Activity-Only (spend-only, no persistent stock, auction fatigue)
      const actFatigue = 1 + (m - 1) * 0.018;
      const newAct =
        (spend / (ch.baseCac * saturationPenalty * actFatigue)) *
        Math.min(1, rampArch * 0.9);

      cohortsArch[id].push(newArch);
      cohortsAct[id].push(newAct);

      monthNewArch += newArch;
      monthNewAct += newAct;

      // Sum retained customers across all cohorts born in months 1..m
      let retainedArch = 0;
      let retainedAct = 0;
      for (let birthIdx = 0; birthIdx < m; birthIdx++) {
        const age = m - 1 - birthIdx;
        const bornArch = cohortsArch[id][birthIdx];
        const bornAct = cohortsAct[id][birthIdx];

        const survArch =
          age === 0
            ? 1
            : ch.month1Retention *
              intPow(1 - ch.monthlyChurn * archChurnMultiplier, age - 1);

        // Activity mode lacks lifecycle architecture -> higher monthly churn (1.6x)
        const survAct =
          age === 0
            ? 1
            : (ch.month1Retention - 0.025) *
              intPow(1 - ch.monthlyChurn * 1.6, age - 1);

        retainedArch += bornArch * survArch;
        retainedAct += bornAct * survAct;
      }

      monthActiveArch += retainedArch;
      monthActiveAct += retainedAct;

      // Base existing revenue distributed across channels + new cohort revenue
      const baseChannelRev = BASELINE_MONTHLY_REVENUE * w[id];
      byChannelArch[id] = Math.round(baseChannelRev + retainedArch * COMPOSITE_ARPU);
      byChannelAct[id] = Math.round(baseChannelRev + retainedAct * COMPOSITE_ARPU);
    }

    const architectureRevenue =
      byChannelArch.seo +
      byChannelArch.paid +
      byChannelArch.social +
      byChannelArch.partners +
      byChannelArch.crm +
      byChannelArch.local;

    const activityRevenue =
      byChannelAct.seo +
      byChannelAct.paid +
      byChannelAct.social +
      byChannelAct.partners +
      byChannelAct.crm +
      byChannelAct.local;

    const selectedByChannel = mode === 'architecture' ? byChannelArch : byChannelAct;
    const selectedTotal = mode === 'architecture' ? architectureRevenue : activityRevenue;
    const selectedNew = mode === 'architecture' ? monthNewArch : monthNewAct;
    const selectedActive = mode === 'architecture' ? monthActiveArch : monthActiveAct;

    months.push({
      month: m,
      byChannel: selectedByChannel,
      totalRevenue: selectedTotal,
      architectureRevenue,
      activityRevenue,
      newCustomers: selectedNew,
      activeCustomers: selectedActive,
      effectiveCac: selectedNew > 0.1 ? monthlyBudget / selectedNew : monthlyBudget,
      milestone: MILESTONE_LABELS[m],
    });
  }

  const horizonRecords = months.filter((r) => r.month <= horizonMonths);
  const lastRec = horizonRecords[horizonRecords.length - 1] ?? months[months.length - 1];

  let cumulativeRevenue = 0;
  let cumulativeArchitectureRevenue = 0;
  let cumulativeActivityRevenue = 0;
  let totalAcquiredInHorizon = 0;

  for (const r of horizonRecords) {
    cumulativeRevenue += r.totalRevenue;
    cumulativeArchitectureRevenue += r.architectureRevenue;
    cumulativeActivityRevenue += r.activityRevenue;
    totalAcquiredInHorizon += r.newCustomers;
  }

  const cumulativeSpend = monthlyBudget * horizonMonths;
  const blendedCac =
    totalAcquiredInHorizon > 1
      ? cumulativeSpend / totalAcquiredInHorizon
      : lastRec.effectiveCac;

  // Weighted average monthly churn across channels
  let weightedChurn = 0;
  for (const ch of CHANNELS) {
    weightedChurn += w[ch.id] * ch.monthlyChurn;
  }
  const effectiveMonthlyChurn =
    mode === 'architecture'
      ? weightedChurn * archChurnMultiplier
      : weightedChurn * 1.6;

  // 24-month Gross Margin LTV per cohort customer
  let expectedActiveMonths = 0;
  for (let age = 0; age < 24; age++) {
    expectedActiveMonths += intPow(1 - effectiveMonthlyChurn, age);
  }
  const cohortLtv = expectedActiveMonths * COMPOSITE_ARPU * GROSS_MARGIN;
  const ltvToCac = blendedCac > 0 ? cohortLtv / blendedCac : 0;

  // Payback period in months (Blended CAC / monthly gross margin per customer + ramp adjustment)
  const monthlyGrossMarginPerCustomer = COMPOSITE_ARPU * GROSS_MARGIN;
  const weightedLag =
    w.seo * 1.6 +
    w.paid * 0.2 +
    w.social * 0.8 +
    w.partners * 1.1 +
    w.crm * 0.5 +
    w.local * 0.9;
  const paybackMonths =
    blendedCac / Math.max(1, monthlyGrossMarginPerCustomer) + weightedLag * 0.55;

  // Compounding share of final month revenue
  const nonPaidIncremental =
    lastRec.byChannel.seo +
    lastRec.byChannel.social +
    lastRec.byChannel.partners +
    lastRec.byChannel.crm +
    lastRec.byChannel.local -
    BASELINE_MONTHLY_REVENUE * (1 - w.paid);
  const compoundingShare = Math.min(
    0.94,
    Math.max(
      0.14,
      (nonPaidIncremental / Math.max(1, lastRec.totalRevenue)) *
        (mode === 'architecture' ? 1.05 : 0.42),
    ),
  );

  const growthMultiple = lastRec.totalRevenue / BASELINE_MONTHLY_REVENUE;

  // Normalized 24-month heights for WebGL scene (scaled against peak of architecture curve)
  let maxRev = BASELINE_MONTHLY_REVENUE * 2;
  for (const r of months) {
    if (r.architectureRevenue > maxRev) maxRev = r.architectureRevenue;
    if (r.totalRevenue > maxRev) maxRev = r.totalRevenue;
  }
  const webglHeights = months.map((r) =>
    Math.max(0.08, Math.min(1, r.totalRevenue / maxRev)),
  );
  const webglActivityHeights = months.map((r) =>
    Math.max(0.08, Math.min(1, r.activityRevenue / maxRev)),
  );

  return {
    months,
    horizonRecords,
    finalMonthlyRevenue: lastRec.totalRevenue,
    finalArchitectureRevenue: lastRec.architectureRevenue,
    finalActivityRevenue: lastRec.activityRevenue,
    cumulativeRevenue,
    cumulativeArchitectureRevenue,
    cumulativeActivityRevenue,
    cumulativeSpend,
    blendedCac,
    finalMonthCac: lastRec.effectiveCac,
    cohortLtv,
    ltvToCac,
    paybackMonths,
    compoundingShare,
    growthMultiple,
    webglHeights,
    webglActivityHeights,
  };
}

export interface ChannelFanoutMetric {
  channelId: ChannelId;
  code: string;
  label: string;
  artifact: string;
  share: number;
  impressions: number;
  qualifiedVisits: number;
  conversions: number;
  ltvAdded: number;
}

export interface LaunchFanoutSummary {
  asset: LaunchAssetSpec;
  channels: ChannelFanoutMetric[];
  totalImpressions: number;
  totalVisits: number;
  totalConversions: number;
  totalLtvAdded: number;
}

/**
 * Computes the deterministic distribution impact of publishing a single flagship
 * piece of content across the visitor's active 6-channel architecture.
 */
export function simulateAssetLaunch(params: {
  assetId: string;
  monthlyBudget: number;
  weights: Record<ChannelId, number>;
  mode: EngineMode;
  cohortLtv: number;
}): LaunchFanoutSummary {
  const asset =
    LAUNCH_ASSETS.find((a) => a.id === params.assetId) ?? LAUNCH_ASSETS[0];
  const w = normalizeWeights(params.weights);
  const modeMultiplier = params.mode === 'architecture' ? 1.0 : 0.48;
  const budgetScale = 0.28 + 0.72 * (params.monthlyBudget / 50_000);

  const channels: ChannelFanoutMetric[] = [];
  let totalImpressions = 0;
  let totalVisits = 0;
  let totalConversions = 0;
  let totalLtvAdded = 0;

  for (const ch of CHANNELS) {
    const share = w[ch.id];
    const affinity = asset.channelMultipliers[ch.id] ?? 1;
    const baseReach =
      ch.id === 'seo'
        ? 24_000
        : ch.id === 'social'
          ? 36_000
          : ch.id === 'partners'
            ? 19_000
            : ch.id === 'paid'
              ? 14_000
              : ch.id === 'local'
                ? 11_000
                : 9_500;

    const impressions = Math.round(
      baseReach * (0.25 + share * 3.4) * affinity * budgetScale * modeMultiplier,
    );
    const ctr =
      ch.id === 'crm'
        ? 0.068
        : ch.id === 'paid'
          ? 0.052
          : ch.id === 'seo'
            ? 0.044
            : ch.id === 'local'
              ? 0.048
              : ch.id === 'partners'
                ? 0.042
                : 0.026;

    const qualifiedVisits = Math.round(impressions * ctr);
    const conversions = Math.max(
      1,
      Math.round(
        qualifiedVisits *
          ch.conversionRate *
          0.35 *
          (params.mode === 'architecture' ? 1.18 : 0.82),
      ),
    );
    const ltvAdded = Math.round(conversions * params.cohortLtv);

    totalImpressions += impressions;
    totalVisits += qualifiedVisits;
    totalConversions += conversions;
    totalLtvAdded += ltvAdded;

    channels.push({
      channelId: ch.id,
      code: ch.code,
      label: ch.shortLabel,
      artifact: ch.launchArtifact,
      share,
      impressions,
      qualifiedVisits,
      conversions,
      ltvAdded,
    });
  }

  return {
    asset,
    channels,
    totalImpressions,
    totalVisits,
    totalConversions,
    totalLtvAdded,
  };
}

export const growthEngineCopy = {
  eyebrow: 'Signature Interactive Model — The Growth Engine',
  title: 'Allocate the budget. Watch the architecture compound.',
  lede:
    'Set a monthly acquisition budget across six channels and choose a horizon. Our deterministic cohort model projects 24 months of compounding revenue, CAC payback and LTV — and fires a live content release across the 3D distribution network behind this page.',
  disclaimer:
    'Illustrative composite B2B/prosumer cohort model ($85K/mo baseline, $420 ARPU, 78% gross margin) — explicit channel assumptions inspectable below.',
};
