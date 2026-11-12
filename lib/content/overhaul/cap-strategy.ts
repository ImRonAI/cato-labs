/**
 * Overhaul copy & domain model deck for /capabilities/strategy-transformation
 * ("Decide on evidence, not instinct" — THE DECISION ENGINE).
 *
 * All copy is grounded in Cato Labs' Strategy & Transformation practice:
 * market & competitive intelligence, category design & positioning,
 * executive strategy & roadmaps, market-entry sequencing, operating-model
 * design, and KPI architecture.
 */

export type ScenarioId =
  | 'ai-concierge'
  | 'market-entry'
  | 'fulfilment-automation'
  | 'category-reposition';

export interface PathSpec {
  id: string;
  code: 'PATH A' | 'PATH B' | 'PATH C';
  name: string;
  subtitle: string;
  summary: string;
  /** Fraction of total capital deployed up front vs phased across gates */
  upfrontCapitalShare: number;
  /** Base monthly gross value multiplier relative to capital deployed */
  baseYieldRate: number;
  /** Implementation lag in months before compounding begins at 50% capacity */
  baseLagMonths: number;
  /** Sensitivity to execution/team capacity constraints (higher = more fragile when team is thin) */
  executionComplexity: number;
  /** Outcome volatility multiplier */
  volatility: number;
  /** Upside convexity under high adoption */
  upsideConvexity: number;
  /** What this path explicitly refuses (trade-off statement) */
  refuses: string;
  /** Concrete Monday-morning week 1-4 build sequence */
  mondaySequence: readonly string[];
}

export interface AssumptionSpec {
  id: string;
  label: string;
  unit: string;
  baseSummary: string;
  /** Validation protocol if this assumption is the #1 variance driver */
  firstTestProtocol: string;
}

export interface ScenarioSpec {
  id: ScenarioId;
  index: string;
  shortLabel: string;
  question: string;
  context: string;
  defaultLevers: {
    investmentK: number;
    horizonMonths: number;
    riskAppetite: number;
    teamCapacity: number;
  };
  assumptions: readonly [
    AssumptionSpec,
    AssumptionSpec,
    AssumptionSpec,
    AssumptionSpec,
    AssumptionSpec,
  ];
  paths: readonly [PathSpec, PathSpec, PathSpec];
}

export const decisionEngineCopy = {
  eyebrow: 'Interactive instrument — The Decision Engine',
  title: 'Pressure-test the decision before you fund the build.',
  lede:
    'Pick a strategic question, set your capital, horizon, risk tolerance and execution capacity. A seeded Monte Carlo simulation runs 2,400 trajectories across three explicit strategic paths — mapping the P10/P50/P90 outcome fan, isolating the assumption that drives the variance, and issuing an evidence-backed decision memo.',
  modelNotice:
    'Illustrative stochastic decision model — explicit domain priors, phased capital drawdowns, and Box-Muller log-normal shocks. Adjust any lever to recompute trajectories in real time.',
  levers: {
    investment: {
      label: 'Capital allocation',
      hint: 'Total committed transformation & build budget',
      min: 150,
      max: 2400,
      step: 50,
    },
    horizon: {
      label: 'Evaluation horizon',
      hint: 'Compounding window from kickoff to terminal readout',
      min: 6,
      max: 36,
      step: 3,
    },
    risk: {
      label: 'Risk appetite',
      hint: 'Downside protection vs asymmetric upside weighting',
      min: 10,
      max: 90,
      step: 5,
    },
    capacity: {
      label: 'Team capacity',
      hint: 'Internal engineering & operational bandwidth available',
      min: 20,
      max: 100,
      step: 5,
    },
  },
} as const;

export const scenarios: readonly ScenarioSpec[] = [
  {
    id: 'ai-concierge',
    index: '01',
    shortLabel: 'AI Concierge Launch',
    question: 'Launch an autonomous AI revenue & support concierge?',
    context:
      'Wire a voice + web agent into your product catalog, booking engine, and CRM so it resolves tier-1 volume and completes guided transactions before human handoff.',
    defaultLevers: {
      investmentK: 450,
      horizonMonths: 18,
      riskAppetite: 45,
      teamCapacity: 65,
    },
    assumptions: [
      {
        id: 'adoption',
        label: 'Autonomous resolution & conversion lift',
        unit: '% of inbound sessions',
        baseSummary: '38%–64% end-to-end completion without human escalation',
        firstTestProtocol:
          'Run a 14-day shadow replay on 500 historical support & checkout transcripts against the scoped catalog schema before wiring live write-actions.',
      },
      {
        id: 'integration',
        label: 'Catalog, CRM & API integration velocity',
        unit: 'weeks to production tool-use',
        baseSummary: '4–9 weeks depending on API hygiene and auth boundaries',
        firstTestProtocol:
          'Audit the top 6 transactional endpoints (inventory, booking, CRM lookup) in week 1 and stub deterministic fallback contracts for any legacy route.',
      },
      {
        id: 'yield',
        label: 'Average order & deflection margin per resolved session',
        unit: '$ net contribution',
        baseSummary: '$18–$46 blended support savings + assisted conversion lift',
        firstTestProtocol:
          'Instrument baseline funnel drop-off and cost-per-ticket by intent cluster so agent uplift is measured against net margin, not raw chat volume.',
      },
      {
        id: 'lag',
        label: 'Guardrail & persona calibration ramp',
        unit: 'months to full traffic',
        baseSummary: '1.5–4.0 months from 10% canary to 100% traffic routing',
        firstTestProtocol:
          'Establish a 120-case golden evaluation harness with hard escalation rules before routing the first 10% of live customer traffic.',
      },
      {
        id: 'macro',
        label: 'Model token & voice transport unit cost drift',
        unit: '% variance over horizon',
        baseSummary: '±15% variance via model routing and semantic caching',
        firstTestProtocol:
          'Implement tiered model routing (fast small model for intent classification, frontier model only for multi-step synthesis) on day one.',
      },
    ],
    paths: [
      {
        id: 'phased-concierge',
        code: 'PATH A',
        name: 'Phased Support-to-Revenue Sequence',
        subtitle: 'Gate 1: High-volume deflection & booking → Gate 2: Full checkout',
        summary:
          'Launch scoped resolution and appointment booking in 6 weeks, prove containment on real traffic, then unlock autonomous cart & upsell execution in Phase 2.',
        upfrontCapitalShare: 0.42,
        baseYieldRate: 0.145,
        baseLagMonths: 2.2,
        executionComplexity: 0.42,
        volatility: 0.26,
        upsideConvexity: 1.18,
        refuses:
          'Refuses unvalidated day-one autonomous refunds and open-ended prompt surfaces before tool guardrails pass golden evals.',
        mondaySequence: [
          'Weeks 1–2: Map top 20 customer intents by volume and margin; lock escalation thresholds.',
          'Weeks 3–6: Ship Phase 1 Voice + Web agent wired to read-only catalog and booking slots.',
          'Weeks 7–12: Gate 2 expansion into authenticated order mutations and proactive retention.',
        ],
      },
      {
        id: 'full-flagship-concierge',
        code: 'PATH B',
        name: 'Simultaneous Full-Stack Flagship + Agent',
        subtitle: 'Single cutover: Generative UI storefront + autonomous voice & web',
        summary:
          'Rebuild the customer-facing digital experience around generative UI and voice autonomy in one coordinated release for maximum category differentiation.',
        upfrontCapitalShare: 0.78,
        baseYieldRate: 0.178,
        baseLagMonths: 4.1,
        executionComplexity: 0.82,
        volatility: 0.48,
        upsideConvexity: 1.52,
        refuses:
          'Refuses incremental legacy widget patching; requires dedicated engineering bandwidth and executive sign-off on a unified release.',
        mondaySequence: [
          'Weeks 1–3: Freeze legacy UI roadmap; architect unified knowledge graph and generative UI tokens.',
          'Weeks 4–10: Parallel build of headless Next.js flagship and multi-modal agent tool layer.',
          'Weeks 11–16: Full-traffic cutover with real-time eval telemetry and human-in-the-loop desk.',
        ],
      },
      {
        id: 'internal-copilot',
        code: 'PATH C',
        name: 'Internal Rep Copilot Only',
        subtitle: 'Zero customer-facing autonomy; agent drafts replies for human staff',
        summary:
          'Keep humans on every customer interaction while deploying an internal retrieval and drafting copilot inside the existing helpdesk.',
        upfrontCapitalShare: 0.3,
        baseYieldRate: 0.078,
        baseLagMonths: 1.4,
        executionComplexity: 0.24,
        volatility: 0.15,
        upsideConvexity: 0.72,
        refuses:
          'Refuses 24/7 autonomous conversion capture and nonlinear headcount leverage in exchange for near-zero brand surface risk.',
        mondaySequence: [
          'Weeks 1–2: Index SOPs and past resolved tickets into a scoped retrieval index.',
          'Weeks 3–5: Embed draft-assistant sidebar inside helpdesk for human review.',
          'Weeks 6–10: Measure handle-time reduction and identify intents ready for full autonomy.',
        ],
      },
    ],
  },
  {
    id: 'market-entry',
    index: '02',
    shortLabel: 'New Market Entry',
    question: 'Enter an adjacent geographic or vertical market?',
    context:
      'Sequence expansion into a high-margin territory where incumbents hold legacy relationships but lack modern digital distribution and AI-assisted speed.',
    defaultLevers: {
      investmentK: 650,
      horizonMonths: 24,
      riskAppetite: 50,
      teamCapacity: 60,
    },
    assumptions: [
      {
        id: 'adoption',
        label: 'Beachhead organic & local pack capture velocity',
        unit: 'qualified pipeline / mo',
        baseSummary: '2.4x–4.1x local intent capture once entity authority lands',
        firstTestProtocol:
          'Run a search & answer-engine gap audit across the target market’s top 40 commercial intents to verify incumbent weakness before hiring local reps.',
      },
      {
        id: 'integration',
        label: 'Localization, compliance & operating-model readiness',
        unit: 'weeks to launch',
        baseSummary: '5–11 weeks to adapt pricing, proof points, and service routing',
        firstTestProtocol:
          'Interview 8 target-market buyers in week 1 to test whether existing case studies transfer or require a local anchor cohort.',
      },
      {
        id: 'yield',
        label: 'Target-market LTV : CAC ratio at scale',
        unit: 'multiple',
        baseSummary: '3.2x–5.8x net contribution after initial beachhead spend',
        firstTestProtocol:
          'Launch a high-intent diagnostic landing architecture with transparent pricing tiers to measure real qualified lead cost in 21 days.',
      },
      {
        id: 'lag',
        label: 'Compounding search & authority ramp time',
        unit: 'months to breakeven',
        baseSummary: '3.5–7.0 months from local landing architecture to steady pipeline',
        firstTestProtocol:
          'Pair technical schema & programmatic local pages with targeted founder/executive outbound to bridge the first 90 days.',
      },
      {
        id: 'macro',
        label: 'Incumbent retaliatory paid-bidding & price pressure',
        unit: '% CAC inflation',
        baseSummary: '10%–35% paid auction inflation on head terms',
        firstTestProtocol:
          'Anchor acquisition on long-tail problem-intent and proprietary diagnostic tools rather than generic paid head terms.',
      },
    ],
    paths: [
      {
        id: 'beachhead-sequencing',
        code: 'PATH A',
        name: 'Defensible Beachhead Sequencing',
        subtitle: 'Own one cluster end-to-end, then replicate the playbook',
        summary:
          'Concentrate 80% of initial capital on dominating one flagship metro or sub-vertical — winning the map pack, 5 reference accounts, and unit economics before expanding.',
        upfrontCapitalShare: 0.45,
        baseYieldRate: 0.152,
        baseLagMonths: 2.8,
        executionComplexity: 0.46,
        volatility: 0.28,
        upsideConvexity: 1.28,
        refuses:
          'Refuses thin multi-city ad spend and premature regional field offices before a single beachhead proves repeatable payback.',
        mondaySequence: [
          'Weeks 1–3: Publish category-specific positioning, local schema architecture, and competitive tear-downs for Beachhead #1.',
          'Weeks 4–8: Close first 5 anchor customers with white-glove implementation to forge local proof.',
          'Weeks 9–16: Codify the acquisition + delivery playbook and unlock Gate 2 territory expansion.',
        ],
      },
      {
        id: 'multi-market-blitz',
        code: 'PATH B',
        name: 'Simultaneous Three-Market Blitz',
        subtitle: 'Parallel paid, editorial & outbound launch across all target regions',
        summary:
          'Deploy capital simultaneously across three target territories to pre-empt competitors and capture category mindshare before incumbents react.',
        upfrontCapitalShare: 0.82,
        baseYieldRate: 0.184,
        baseLagMonths: 4.5,
        executionComplexity: 0.86,
        volatility: 0.54,
        upsideConvexity: 1.58,
        refuses:
          'Refuses sequential learning gates; commits full media and onboarding capacity up front to maximize speed of footprint.',
        mondaySequence: [
          'Weeks 1–4: Stand up localized digital flagships, regional routing, and paid capture across all 3 markets.',
          'Weeks 5–10: Run synchronized outbound and category launch campaigns with dedicated onboarding pods.',
          'Weeks 11–18: Reallocate budget dynamically toward the top two performing territories based on CAC payback.',
        ],
      },
      {
        id: 'partner-channel',
        code: 'PATH C',
        name: 'Partner & Integrator Channel Entry',
        subtitle: 'Distribute through regional partners on a shared-margin model',
        summary:
          'Enter the market indirectly by equipping established local agencies or systems integrators to sell and co-deliver your capability.',
        upfrontCapitalShare: 0.28,
        baseYieldRate: 0.086,
        baseLagMonths: 2.0,
        executionComplexity: 0.32,
        volatility: 0.19,
        upsideConvexity: 0.78,
        refuses:
          'Refuses direct brand ownership and 35%–45% of gross margin in exchange for low upfront fixed cost.',
        mondaySequence: [
          'Weeks 1–3: Package co-branded partner enablement kit, margin tiers, and technical certification.',
          'Weeks 4–8: Sign 3 regional anchor partners and co-pitch their first 10 enterprise prospects.',
          'Weeks 9–14: Instrument partner pipeline telemetry and direct-assist escalation.',
        ],
      },
    ],
  },
  {
    id: 'fulfilment-automation',
    index: '03',
    shortLabel: 'Automate Operations',
    question: 'Re-architect fulfilment & operations onto autonomous rails?',
    context:
      'Redesign intake, triage, cross-system handoffs, billing, and exception routing so volume scales 3x without linear headcount additions.',
    defaultLevers: {
      investmentK: 350,
      horizonMonths: 15,
      riskAppetite: 35,
      teamCapacity: 70,
    },
    assumptions: [
      {
        id: 'adoption',
        label: 'Straight-through processing rate (zero human touch)',
        unit: '% of work items',
        baseSummary: '58%–82% of recurring handoffs automated end-to-end',
        firstTestProtocol:
          'Time-and-motion shadow the 3 highest-volume queues for 5 days; log every manual copy-paste and exception reason code.',
      },
      {
        id: 'integration',
        label: 'ERP / CRM / Billing webhook & schema reliability',
        unit: '% deterministic sync',
        baseSummary: '94%–99.5% idempotent state sync across existing stack',
        firstTestProtocol:
          'Build an idempotent event ledger between CRM and billing for one workflow before touching downstream fulfilment queues.',
      },
      {
        id: 'yield',
        label: 'Hours recovered & error-rework eliminated per 1,000 items',
        unit: 'hours / 1k orders',
        baseSummary: '140–310 specialist hours shifted from relay work to exceptions',
        firstTestProtocol:
          'Measure current rework cost and SLA breach penalties over the last 90 days to establish the hard dollar floor.',
      },
      {
        id: 'lag',
        label: 'SOP redesign & operator transition velocity',
        unit: 'months to full adoption',
        baseSummary: '1.2–3.2 months to retire legacy spreadsheets and shadow queues',
        firstTestProtocol:
          'Co-author the new exception desk UI with the two lead operators who run the manual queue today.',
      },
      {
        id: 'macro',
        label: 'Edge-case & upstream vendor schema drift',
        unit: '% exception spike',
        baseSummary: '5%–18% edge-case routing to human judgment queues',
        firstTestProtocol:
          'Enforce strict Zod/JSON-schema validation at every intake boundary with one-click human triage cards for malformed payloads.',
      },
    ],
    paths: [
      {
        id: 'workflow-redesign-rails',
        code: 'PATH A',
        name: 'Process Redesign + Phased Rail Automation',
        subtitle: 'Eliminate dumb steps first, then automate the top 3 flows',
        summary:
          'Redesign the operating process to remove redundant approvals, then layer deterministic automation and AI exception triage onto the existing stack in three 4-week sprints.',
        upfrontCapitalShare: 0.4,
        baseYieldRate: 0.162,
        baseLagMonths: 1.8,
        executionComplexity: 0.38,
        volatility: 0.21,
        upsideConvexity: 1.22,
        refuses:
          'Refuses automating broken manual processes as-is, and refuses a multi-quarter ERP rip-and-replace.',
        mondaySequence: [
          'Weeks 1–2: Instrument queue telemetry; publish the workflow map showing exact hour leaks.',
          'Weeks 3–6: Automate Intake → Triage → CRM/Billing sync with human exception routing.',
          'Weeks 7–12: Automate proactive lifecycle follow-ups and deploy live SLA observability.',
        ],
      },
      {
        id: 'autonomous-cutover',
        code: 'PATH B',
        name: 'Full-Core Autonomous Operating Model',
        subtitle: 'End-to-end orchestration engine replacing all manual queues',
        summary:
          'Re-platform intake, scheduling, dispatch, and billing onto a unified event-driven state machine with AI agents managing tier-1 and tier-2 supplier/customer coordination.',
        upfrontCapitalShare: 0.75,
        baseYieldRate: 0.192,
        baseLagMonths: 3.6,
        executionComplexity: 0.78,
        volatility: 0.42,
        upsideConvexity: 1.48,
        refuses:
          'Refuses keeping legacy manual queues running in parallel past cutover; demands strong internal engineering ownership.',
        mondaySequence: [
          'Weeks 1–3: Define canonical state machine and event contracts across all 5 core systems.',
          'Weeks 4–9: Build unified orchestration bus, agentic dispatchers, and operator command center.',
          'Weeks 10–14: Shadow-run 100% of production volume for 14 days, then cut over primary queues.',
        ],
      },
      {
        id: 'point-tool-patching',
        code: 'PATH C',
        name: 'Lightweight Webhook & Macro Patching',
        subtitle: 'Keep current SOPs; add no-code triggers between existing inboxes',
        summary:
          'Leave the current organizational workflow untouched and wire simple point-to-point scripts to reduce repetitive data entry.',
        upfrontCapitalShare: 0.25,
        baseYieldRate: 0.074,
        baseLagMonths: 1.1,
        executionComplexity: 0.2,
        volatility: 0.14,
        upsideConvexity: 0.65,
        refuses:
          'Refuses structural headcount decoupling; brittle zaps break when volume or complexity doubles.',
        mondaySequence: [
          'Weeks 1–2: Identify top 5 copy-paste actions across email, spreadsheet, and CRM.',
          'Weeks 3–4: Deploy webhook sync scripts and notification alerts.',
          'Weeks 5–8: Monitor error rates and document remaining manual bottlenecks.',
        ],
      },
    ],
  },
  {
    id: 'category-reposition',
    index: '04',
    shortLabel: 'Category Reposition',
    question: 'Reposition upmarket & rebuild the digital flagship?',
    context:
      'Move from competing on price in a crowded commodity tier to owning a defensible category thesis, backed by an editorial flagship and outcome-tiered packaging.',
    defaultLevers: {
      investmentK: 550,
      horizonMonths: 18,
      riskAppetite: 55,
      teamCapacity: 60,
    },
    assumptions: [
      {
        id: 'adoption',
        label: 'Enterprise conversion rate & ACV expansion',
        unit: '% lift in qualified ACV',
        baseSummary: '+35% to +85% average contract value on flagship-sourced pipeline',
        firstTestProtocol:
          'Pitch the new category narrative and outcome-tiered pricing on 10 live sales calls before changing a line of public website code.',
      },
      {
        id: 'integration',
        label: 'Brand system, flagship & sales enablement alignment',
        unit: 'weeks to full rollout',
        baseSummary: '6–12 weeks across thesis, visual system, Next.js flagship, and sales deck',
        firstTestProtocol:
          'Write the one-sentence category thesis and trade-off memo first; force product, marketing, and sales leadership to sign off in week 1.',
      },
      {
        id: 'yield',
        label: 'Gross margin & retention improvement in new positioning',
        unit: 'pts net retention',
        baseSummary: '+8 to +19 points net dollar retention from higher-fit buyers',
        firstTestProtocol:
          'Segment trailing 24-month customer cohorts by LTV and support burden to prove which buyer archetype actually compounds.',
      },
      {
        id: 'lag',
        label: 'Search entity & market perception re-indexing lag',
        unit: 'months to full recognition',
        baseSummary: '2.5–5.5 months for search, answer engines, and analysts to re-index',
        firstTestProtocol:
          'Preserve 100% of high-converting legacy URL equity via surgical redirect and schema mapping during the flagship transition.',
      },
      {
        id: 'macro',
        label: 'Legacy low-tier lead volume drop-off during transition',
        unit: '% low-fit volume shed',
        baseSummary: '15%–40% intentional reduction in unqualified price-shopper leads',
        firstTestProtocol:
          'Keep a self-serve qualification gate that routes sub-threshold leads to an automated tier rather than dropping them cold.',
      },
    ],
    paths: [
      {
        id: 'evidence-led-flagship',
        code: 'PATH A',
        name: 'Evidence-Validated Thesis + Flagship System',
        subtitle: 'Prove the thesis on high-intent surfaces, then ship the full flagship',
        summary:
          'Validate the category thesis and pricing architecture with real buyers, then ship the governed brand system, Next.js flagship, and conversion instrumentation as one cohesive build.',
        upfrontCapitalShare: 0.48,
        baseYieldRate: 0.158,
        baseLagMonths: 2.5,
        executionComplexity: 0.48,
        volatility: 0.27,
        upsideConvexity: 1.32,
        refuses:
          'Refuses cosmetic "logo refresh" theatre without repositioning the offer, and refuses unvalidated price hikes without proof artifacts.',
        mondaySequence: [
          'Weeks 1–3: Cohort diagnosis, competitive whitespace map, and one-sentence category thesis.',
          'Weeks 4–8: Visual identity system, interactive proof artifacts, and Next.js flagship engineering.',
          'Weeks 9–12: Instrumented launch, schema migration, and sales playbook cutover.',
        ],
      },
      {
        id: 'hard-upmarket-cutover',
        code: 'PATH B',
        name: 'Immediate Enterprise Cutover & Price Double',
        subtitle: 'Retire legacy tiers immediately; relaunch 100% around enterprise',
        summary:
          'Sunset all lower-margin offerings at launch, double minimum contract thresholds, and reallocate 100% of brand and product surface to enterprise accounts.',
        upfrontCapitalShare: 0.8,
        baseYieldRate: 0.188,
        baseLagMonths: 4.2,
        executionComplexity: 0.84,
        volatility: 0.52,
        upsideConvexity: 1.62,
        refuses:
          'Refuses straddling two buyer personas; accepts short-term top-of-funnel volume contraction to force rapid ACV expansion.',
        mondaySequence: [
          'Weeks 1–2: Grandfather existing profitable accounts; announce sunset of legacy self-serve tier.',
          'Weeks 3–8: Ship enterprise flagship, security/compliance trust center, and executive proof studies.',
          'Weeks 9–16: Account-based distribution and executive roadshow into top 200 target accounts.',
        ],
      },
      {
        id: 'cosmetic-refresh',
        code: 'PATH C',
        name: 'Visual Refresh on Existing Positioning',
        subtitle: 'Keep current offer & pricing; polish typography and hero visuals',
        summary:
          'Modernize the visual layer and page speed of the current site without altering category positioning, packaging, or sales motion.',
        upfrontCapitalShare: 0.3,
        baseYieldRate: 0.082,
        baseLagMonths: 1.5,
        executionComplexity: 0.25,
        volatility: 0.16,
        upsideConvexity: 0.74,
        refuses:
          'Refuses category re-rating; captures modest conversion lift while leaving competitive price compression intact.',
        mondaySequence: [
          'Weeks 1–2: Audit Core Web Vitals and conversion friction on top 5 landing pages.',
          'Weeks 3–6: Apply refreshed UI tokens, clearer CTAs, and faster asset delivery.',
          'Weeks 7–10: Run A/B conversion tests on headline clarity and form completion.',
        ],
      },
    ],
  },
] as const;
