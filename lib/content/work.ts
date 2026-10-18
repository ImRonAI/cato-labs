/**
 * Work pages — copy deck.
 * Portfolio index at /work plus case detail content.
 * Resting Art is the one substantiated engagement, documented in full.
 * The other four are representative, anonymized engagements — metrics
 * are framed explicitly as targets/results, never invented client facts.
 */

export interface WorkIndex {
  eyebrow: string;
  titleLines: string[];
  lede: string;
}

export interface CaseOutcomePoint {
  metric: string;
  label: string;
}

export interface CaseStudy {
  slug: string;
  client: string;
  sector: string;
  services: string[];
  headline: string;
  summary: string;
  outcomePoints: CaseOutcomePoint[];
  featured: boolean;
}

export interface RestingArtSection {
  index: string;
  title: string;
  body: string;
}

export interface RestingArtDetail {
  hero: {
    eyebrow: string;
    titleLines: string[];
    lede: string;
  };
  sections: RestingArtSection[];
  pullQuote: {
    text: string;
    attribution: string;
  };
}

export const workIndex: WorkIndex = {
  eyebrow: 'Work',
  titleLines: ['Evidence of', 'the method.'],
  lede:
    'Selected engagements — one documented in full, the rest representative of how the six practices interlock when the method runs end to end.',
};

export const cases: CaseStudy[] = [
  {
    slug: 'resting-art',
    client: 'Resting Art',
    sector: 'Luxury furniture & interior concept',
    services: [
      'Strategy & Transformation',
      'Brand & Creative Systems',
      'Digital Products & Experiences',
      'AI & Agent Systems',
      'Growth & Distribution',
    ],
    headline: 'A luxury furniture concept, built from category strategy to flagship.',
    summary:
      'Cato’s own end-to-end build: category strategy, brand system, flagship e-commerce, AI concierge and local capture — the full method applied to one concept and documented as it shipped.',
    outcomePoints: [
      { metric: '5', label: 'practices integrated in one accountable build' },
      { metric: '1', label: 'team from concept to launch — no handoffs' },
      { metric: '100%', label: 'of the method applied and documented' },
    ],
    featured: true,
  },
  {
    slug: 'national-dtc-retailer',
    client: 'A national DTC retailer',
    sector: 'E-commerce & retail',
    services: [
      'Strategy & Transformation',
      'Digital Products & Experiences',
      'Growth & Distribution',
    ],
    headline: 'From marketplace dependence to a flagship that owns its demand.',
    summary:
      'A representative engagement: margin-map diagnosis, flagship rebuild and an intent architecture that moved the center of gravity from rented channels to owned ones.',
    outcomePoints: [
      { metric: '3×', label: 'direct-channel revenue — 12-month target' },
      { metric: '-40%', label: 'marketplace fee load at target channel mix' },
      { metric: '12 mo', label: 'roadmap horizon, phased and costed' },
    ],
    featured: false,
  },
  {
    slug: 'regional-legal-group',
    client: 'A regional legal group',
    sector: 'Legal',
    services: [
      'Strategy & Transformation',
      'Growth & Distribution',
      'Operations & Automation',
    ],
    headline: 'Practice-area positioning with intake that answers in minutes.',
    summary:
      'A representative engagement: sharpened positioning per practice area, client-question content architecture, and intake automation that qualifies and schedules with a human handoff.',
    outcomePoints: [
      { metric: '<5 min', label: 'inquiry response time — target' },
      { metric: '+60%', label: 'qualified consultations — first-year target' },
      { metric: '0', label: 'claims shipped without partner review' },
    ],
    featured: false,
  },
  {
    slug: 'boutique-hotel-collection',
    client: 'A boutique hotel collection',
    sector: 'Hospitality',
    services: [
      'Brand & Creative Systems',
      'Digital Products & Experiences',
      'AI & Agent Systems',
      'Operations & Automation',
    ],
    headline: 'Direct booking as the default, not the exception.',
    summary:
      'A representative engagement: brand system across the collection, a booking-first flagship, and a guest concierge that handles pre-arrival to post-stay in the house voice.',
    outcomePoints: [
      { metric: '+25%', label: 'direct-booking share — seasonal target' },
      { metric: '-68%', label: 'routine guest messages handled by concierge' },
      { metric: '24/7', label: 'guest coverage without added headcount' },
    ],
    featured: false,
  },
  {
    slug: 'b2b-saas-platform',
    client: 'A B2B SaaS platform',
    sector: 'SaaS & startups',
    services: [
      'Strategy & Transformation',
      'Brand & Creative Systems',
      'AI & Agent Systems',
    ],
    headline: 'A category narrative sharp enough to demo against.',
    summary:
      'A representative engagement: category design, narrative system and an agent-assisted support layer — positioning the product’s story to match its engineering.',
    outcomePoints: [
      { metric: '1', label: 'category narrative, adopted company-wide' },
      { metric: '-55%', label: 'routine support volume after agent layer — target' },
      { metric: '2 wk', label: 'narrative sprint, evidence to decision' },
    ],
    featured: false,
  },
];

export const restingArtDetail: RestingArtDetail = {
  hero: {
    eyebrow: 'Case Study — Resting Art',
    titleLines: ['Luxury furniture,', 'built end to end.'],
    lede:
      'A concept taken from category strategy through brand, flagship e-commerce, AI concierge and local capture — the full Cato method, applied to one business and documented as it shipped.',
  },
  sections: [
    {
      index: '01',
      title: 'Positioning',
      body:
        'The furniture market splits between disposable volume and gallery pricing, with a gap in between: considered pieces for people who read design. Resting Art was positioned into that gap — rest as the thesis, craft as the proof — with the competitive set mapped and the price architecture decided before a single product page existed.',
    },
    {
      index: '02',
      title: 'Identity',
      body:
        'The brand system carries the thesis: a name that states the promise, typography and color held to gallery standards, photography directed like editorial rather than catalog. Voice guidelines govern everything from product descriptions to concierge replies, so the brand sounds the same at every surface.',
    },
    {
      index: '03',
      title: 'Digital flagship',
      body:
        'The store was built as the flagship, not the shelf: editorial-grade design on a modern stack, product pages that present construction and provenance as the selling points, and a conversion architecture measured from the first scroll. Speed was treated as a brand attribute, not a technical metric.',
    },
    {
      index: '04',
      title: 'AI concierge',
      body:
        'The concierge is the floor staff: named, expert and on-brand, grounded in the catalog and the care knowledge, able to advise on materials, dimensions and fit — and to hand to a human with the full context when judgment is required. Local-intent capture completes the system, turning regional searches into showroom conversations.',
    },
  ],
  pullQuote: {
    text:
      'The brief was simple: build the brand we would want to buy from, then build the machine that lets a small team run it.',
    attribution: 'Resting Art — founding brief',
  },
};
