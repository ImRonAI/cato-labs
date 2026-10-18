/**
 * CATO LABS — master copy deck.
 * Every word rendered on the site lives here. Consistency is king.
 * Grounded in the Cato Labs company brief: an AI-native strategy and
 * implementation consultancy spanning six integrated practices.
 */

export const site = {
  name: 'Cato Labs',
  legalName: 'Cato Labs',
  url: 'https://catolabs.com',
  tagline: 'Build beyond ordinary.',
  email: 'hello@catolabs.com',
  description:
    'Cato Labs is an AI-native strategy and implementation consultancy. We fuse strategy, design, engineering, AI agents, growth and operations into one integrated practice — moving ambitious companies from diagnosis to done.',
  keywords: [
    'AI consultancy',
    'AI-native consulting',
    'AI implementation',
    'AI agents',
    'digital transformation',
    'brand strategy',
    'web design and development',
    'Next.js development',
    'workflow automation',
    'SEO strategy',
    'growth consulting',
    'Cato Labs',
  ],
  taglineExtended: 'AI systems. Strategic impact.',
} as const;

export const nav = [
  { label: 'Capabilities', href: '/capabilities' },
  { label: 'Work', href: '/work' },
  { label: 'Approach', href: '/approach' },
  { label: 'Contact', href: '/contact' },
] as const;

/* ---------------------------------------------------------- */
/*  The six practices                                          */
/* ---------------------------------------------------------- */

export interface Practice {
  id: string;
  index: string;
  title: string;
  short: string;
  narrative: string;
  deliverables: string[];
}

export const practices: Practice[] = [
  {
    id: 'strategy',
    index: '01',
    title: 'Strategy & Transformation',
    short:
      'Positioning, competitive strategy and operating models — decided on evidence, not instinct.',
    narrative:
      'We begin where most firms guess. Market reality is mapped, competitors are dissected, category dynamics are made explicit — and then we decide. Cato strategy work ends in a master plan: phased, costed, and honest about trade-offs, so leadership knows exactly what will happen, in what order, and why it wins.',
    deliverables: [
      'Market & competitive intelligence',
      'Category design & positioning',
      'Executive strategy & roadmaps',
      'Market-entry sequencing',
      'Operating-model design',
      'KPI & measurement architecture',
    ],
  },
  {
    id: 'agents',
    index: '02',
    title: 'AI & Agent Systems',
    short:
      'Intelligent agents with persona, knowledge and skills — engineered into the business, not bolted on.',
    narrative:
      'We do not build FAQ bots. Cato agents are designed as part of the product experience: named, expert, integrated with your systems, and able to complete real work — then hand context to a human at exactly the right moment. Knowledge architecture, skills, escalation and evaluation are engineered as one system.',
    deliverables: [
      'Agent strategy & persona design',
      'Knowledge architecture',
      'Specialized agent skills & tools',
      'System & API integration',
      'Human handoff & escalation',
      'Evaluation & iterative refinement',
    ],
  },
  {
    id: 'product',
    index: '03',
    title: 'Digital Products & Experiences',
    short:
      'Websites and applications treated as products — architected, designed and engineered to perform.',
    narrative:
      'A website is not a brochure; it is the flagship. We take products from information architecture through high-fidelity design to production engineering on modern stacks — React, Next.js, headless platforms — chosen for the experience and the business case, never out of habit. The result is editorial-grade, fast, and built to convert.',
    deliverables: [
      'Information architecture & UX',
      'Interface & experience design',
      'Next.js / React engineering',
      'Headless commerce & CMS',
      'Conversion architecture',
      'Performance & Core Web Vitals',
    ],
  },
  {
    id: 'brand',
    index: '04',
    title: 'Brand & Creative Systems',
    short:
      'Brand as a strategic system — thesis, archetype, narrative and identity, connected end to end.',
    narrative:
      'We treat brand as infrastructure. Positioning flows into customer psychology, psychology into narrative, narrative into a visual and verbal system that survives contact with every surface — product, packaging, social, sales. Multiple territories are explored, evaluated strategically, then refined and tested until the system holds.',
    deliverables: [
      'Brand thesis & archetypes',
      'Naming & narrative systems',
      'Visual identity & art direction',
      'Typography & color systems',
      'Voice & tone guidelines',
      'Guidelines & systemization',
    ],
  },
  {
    id: 'growth',
    index: '05',
    title: 'Growth & Distribution',
    short:
      'Search, content, local and social — engineered as compounding acquisition systems.',
    narrative:
      'Growth at Cato is architecture, not activity. Keyword universes are mapped to intent and pages, content pillars build topical authority, local beachheads are made defensible before expansion, and every channel earns its budget through explicit trade-offs. We build engines that acquire while you sleep.',
    deliverables: [
      'Technical SEO & schema',
      'Keyword & intent architecture',
      'Editorial & content systems',
      'Local-market capture',
      'Social operating models',
      'CRO & experimentation',
    ],
  },
  {
    id: 'operations',
    index: '06',
    title: 'Operations & Automation',
    short:
      'Support, workflows and measurement — redesigned so the business runs on rails.',
    narrative:
      'We redesign the operating process itself. Support becomes a unified, AI-assisted system with clear escalation and proactive outreach; workflows move between systems without human relay; every metric that matters is instrumented. The outcome is an organization that scales without scaling headcount.',
    deliverables: [
      'Support operations & helpdesk design',
      'Workflow automation',
      'System-to-system integration',
      'SOPs & escalation logic',
      'Support analytics',
      'Retention & lifecycle automation',
    ],
  },
];

/* ---------------------------------------------------------- */
/*  The approach — how Cato thinks                             */
/* ---------------------------------------------------------- */

export interface ApproachStage {
  id: string;
  index: string;
  title: string;
  question: string;
  narrative: string;
}

export const approachStages: ApproachStage[] = [
  {
    id: 'evidence',
    index: 'I',
    title: 'Evidence',
    question: 'What is actually happening?',
    narrative:
      'Markets, customers, competitors, operations — mapped as they are, not as they are assumed to be. Deep research, much of it agent-assisted, grounds every engagement in observable reality before a single recommendation is made.',
  },
  {
    id: 'truth',
    index: 'II',
    title: 'Market Truth',
    question: 'What underlying dynamic matters?',
    narrative:
      'Beneath the noise sits one dynamic that decides the category. We isolate it — the truth competitors are ignoring or defending against — and make it the axis the entire strategy turns on.',
  },
  {
    id: 'decision',
    index: 'III',
    title: 'Decision',
    question: 'What should you therefore do?',
    narrative:
      'Strategy is a choice. We translate truth into an explicit decision — a position to own, a product to build, a market to enter first — stated plainly enough that the whole company can act on it.',
  },
  {
    id: 'implementation',
    index: 'IV',
    title: 'Implementation',
    question: 'Exactly how does it become real?',
    narrative:
      'Decisions are converted into architecture: experience, software, agents, content and operations — specified, sequenced and built. Cato does not hand over a deck and disappear; the plan is engineered to ship.',
  },
  {
    id: 'tradeoff',
    index: 'V',
    title: 'Trade-off',
    question: 'What are we choosing not to do?',
    narrative:
      'Every yes is a refusal of a thousand alternatives. We make the exclusions explicit — channels ignored, markets deferred, features rejected — because focus, honestly stated, is what makes a strategy hold.',
  },
];

/* ---------------------------------------------------------- */
/*  Pages                                                      */
/* ---------------------------------------------------------- */

export const home = {
  hero: {
    eyebrow: 'AI-Native Consultancy',
    titleLines: ['Build beyond', 'ordinary.'],
    sub: 'Cato Labs fuses strategy, design, engineering and intelligent systems into one practice — moving ambitious companies from what is to what’s next.',
    primaryCta: { label: 'Start a build', href: '/contact' },
    secondaryCta: { label: 'Explore capabilities', href: '/capabilities' },
  },
  manifesto: {
    eyebrow: 'The Idea',
    statement:
      'Consultancy, design studio, software firm, AI lab, growth agency — the boundaries were never real. So we removed them.',
    body: 'Cato Labs works across the full arc — what a company should do, what the experience should be, how it gets built, how it acquires customers, and how it operates. One integrated practice, accountable from diagnosis to done.',
  },
  practicesIntro: {
    eyebrow: 'Capabilities',
    title: 'Six practices. One motion.',
    body: 'Every Cato engagement can move between disciplines — because real transformation never respects org charts.',
  },
  approachTeaser: {
    eyebrow: 'Approach',
    title: 'How we think',
    body: 'Evidence. Market truth. Decision. Implementation. Trade-off. Five moves that turn ambiguity into architecture.',
    cta: { label: 'See the approach', href: '/approach' },
  },
  cta: {
    eyebrow: 'Begin',
    titleLines: ['Let’s build beyond', 'ordinary.'],
    body: 'Tell us where you’re trying to go. We’ll show you the shortest honest path there.',
    cta: { label: 'Start a build', href: '/contact' },
  },
} as const;

export const capabilitiesPage = {
  hero: {
    eyebrow: 'Capabilities',
    titleLines: ['One practice,', 'six disciplines.'],
    sub: 'Strategy, agents, products, brand, growth and operations — engineered to interlock, delivered as one accountable motion.',
  },
  outro: {
    eyebrow: 'Engage',
    title: 'Bring us the hard problem.',
    body: 'A Cato engagement typically begins with a diagnosis: evidence gathered, market truth isolated, the decision made explicit. From there, we build.',
    cta: { label: 'Start a build', href: '/contact' },
  },
} as const;

export const approachPage = {
  hero: {
    eyebrow: 'Approach',
    titleLines: ['From ambiguity', 'to architecture.'],
    sub: 'Five moves, in order, every time. This is how Cato turns what is actually happening into what gets built.',
  },
  outro: {
    eyebrow: 'Next',
    title: 'See what the approach produces.',
    body: 'The method is constant. What changes is the surface: a repositioned company, an intelligent agent, a flagship experience, an operation that runs itself.',
    cta: { label: 'Explore capabilities', href: '/capabilities' },
  },
} as const;

export const contactPage = {
  hero: {
    eyebrow: 'Contact',
    titleLines: ['Start a build.'],
    sub: 'One conversation is usually enough to know whether there’s something worth building together. Write to us — a human replies.',
  },
  form: {
    title: 'Tell us about the ambition.',
    fields: {
      name: 'Your name',
      company: 'Company',
      email: 'Email',
      message: 'What are you trying to build, change or escape?',
    },
    submit: 'Send the brief',
    note: 'Submissions open your mail client — nothing is stored on this site.',
  },
  direct: {
    title: 'Prefer it direct?',
    email: site.email,
    note: 'We read everything. Expect a considered reply, not an autoresponder.',
  },
} as const;

/* ---------------------------------------------------------- */
/*  Footer                                                     */
/* ---------------------------------------------------------- */

export const footer = {
  wordmark: 'CATO LABS',
  line: 'AI-native strategy & implementation.',
  copyright: '© 2026 Cato Labs. Build beyond ordinary.',
  columns: [
    {
      title: 'Practice',
      links: [
        { label: 'Capabilities', href: '/capabilities' },
        { label: 'Work', href: '/work' },
        { label: 'Approach', href: '/approach' },
        { label: 'Blog', href: '/blog' },
        { label: 'Contact', href: '/contact' },
      ],
    },
    {
      title: 'Capabilities',
      links: [
        { label: 'Strategy & Transformation', href: '/capabilities/strategy-transformation' },
        { label: 'AI & Agent Systems', href: '/capabilities/ai-agent-systems' },
        { label: 'Digital Products & Experiences', href: '/capabilities/digital-products' },
        { label: 'Brand & Creative Systems', href: '/capabilities/brand-creative' },
        { label: 'Growth & Distribution', href: '/capabilities/growth-distribution' },
        { label: 'Operations & Automation', href: '/capabilities/operations-automation' },
      ],
    },
    {
      title: 'Industries',
      links: [
        { label: 'E-commerce & Retail', href: '/industries/ecommerce-retail' },
        { label: 'Professional Services', href: '/industries/professional-services' },
        { label: 'Hospitality', href: '/industries/hospitality' },
        { label: 'Real Estate', href: '/industries/real-estate' },
        { label: 'Health & Wellness', href: '/industries/health-wellness' },
        { label: 'Home Services', href: '/industries/home-services' },
        { label: 'All industries', href: '/industries' },
      ],
    },
    {
      title: 'Regions',
      links: [
        { label: 'Palm Springs', href: '/regions/palm-springs' },
        { label: 'Palm Desert', href: '/regions/palm-desert' },
        { label: 'Indio', href: '/regions/indio' },
        { label: 'San Bernardino', href: '/regions/san-bernardino' },
        { label: 'Big Bear', href: '/regions/big-bear' },
        { label: 'Los Angeles', href: '/regions/los-angeles' },
        { label: 'All regions', href: '/regions' },
      ],
    },
  ],
} as const;
