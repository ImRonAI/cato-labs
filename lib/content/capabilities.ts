/**
 * Capability child pages — copy deck.
 * One entry per practice child route under /capabilities.
 * ChildCopy is the shared contract: every child page on the site
 * (capabilities, agent specialisms, industries, regions) renders
 * from this exact shape. Page agents code against it directly.
 */

export interface ChildFeature {
  index: string;
  title: string;
  body: string;
}

export interface ChildDetail {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
}

export interface ChildFaq {
  q: string;
  a: string;
}

export interface ChildCta {
  title: string;
  body: string;
  label: string;
  href: string;
}

export interface ChildCopy {
  slug: string;
  crumbLabel: string;
  eyebrow: string;
  titleLines: string[];
  lede: string;
  features: ChildFeature[];
  detail: ChildDetail;
  faq: ChildFaq[];
  cta: ChildCta;
}

export type CapabilityChildSlug =
  | 'strategy-transformation'
  | 'ai-agent-systems'
  | 'digital-products'
  | 'brand-creative'
  | 'growth-distribution'
  | 'operations-automation';

export const capabilityChildren: Record<CapabilityChildSlug, ChildCopy> = {
  'strategy-transformation': {
    slug: 'strategy-transformation',
    crumbLabel: 'Strategy & Transformation',
    eyebrow: 'Capabilities — 01',
    titleLines: ['Decide on evidence,', 'not instinct.'],
    lede:
      'Positioning, competitive strategy and operating models — mapped from market reality, decided explicitly, and sequenced into a master plan leadership can actually execute.',
    features: [
      {
        index: '01',
        title: 'Market & competitive intelligence',
        body:
          'The category is mapped as it is: who wins, why they win, where the demand actually sits. Most firms guess here. We do not.',
      },
      {
        index: '02',
        title: 'Category design & positioning',
        body:
          'The position is chosen, not drifted into — a place in the market you can own, defend and compound, stated in one sentence the whole company can repeat.',
      },
      {
        index: '03',
        title: 'Executive strategy & roadmaps',
        body:
          'The strategy ends in a master plan: phased, costed and honest about trade-offs. What happens, in what order, and why it wins.',
      },
    ],
    detail: {
      eyebrow: 'The work',
      title: 'A plan you can act on Monday.',
      body:
        'Cato strategy work is built to survive contact with execution. Every recommendation is tied to evidence, every phase to a cost, every choice to the alternatives it refuses. The output is not a deck for the shelf; it is the operating document the build runs on.',
      bullets: [
        'Market & competitive intelligence',
        'Category design & positioning',
        'Executive strategy & roadmaps',
        'Market-entry sequencing',
        'Operating-model design',
        'KPI & measurement architecture',
      ],
    },
    faq: [
      {
        q: 'How is this different from a traditional strategy engagement?',
        a:
          'Two ways. The research is deeper — much of it agent-assisted — and the plan is built by the same team that would execute it. Nothing is recommended that we could not build.',
      },
      {
        q: 'What do we actually receive?',
        a:
          'A master plan: the evidence, the market truth, the decision, the phased build sequence and the explicit trade-offs. Plus the measurement architecture that tells you whether it is working.',
      },
      {
        q: 'How long does a strategy phase take?',
        a:
          'Typically four to eight weeks, depending on how much evidence already exists. We would rather take an extra week than decide on instinct.',
      },
      {
        q: 'Do you execute the plan, or hand it over?',
        a:
          'Both are possible. Cato is an implementation consultancy — most clients continue into build, because the same team holds the context.',
      },
    ],
    cta: {
      title: 'Start with the diagnosis.',
      body:
        'Tell us the decision you are circling. We will show you the evidence it deserves.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  'ai-agent-systems': {
    slug: 'ai-agent-systems',
    crumbLabel: 'AI & Agent Systems',
    eyebrow: 'Capabilities — 02',
    titleLines: ['Agents that do', 'the work.'],
    lede:
      'Intelligent agents with persona, knowledge and skills — designed into the product experience, integrated with your systems, and able to complete real work before handing context to a human.',
    features: [
      {
        index: '01',
        title: 'Agent strategy & persona design',
        body:
          'Every Cato agent is named, expert and on-brand. Persona is not cosmetics; it is how the agent earns trust before it earns tasks.',
      },
      {
        index: '02',
        title: 'Knowledge, skills & integration',
        body:
          'The agent is wired into your systems — catalog, calendar, CRM, phone line — so it can act, not just answer. Skills are engineered per task, then evaluated relentlessly.',
      },
      {
        index: '03',
        title: 'Voice AI & Generative UI',
        body:
          'The frontier surfaces are covered: Voice AI agents that call, listen and resolve, and Generative UI that assembles itself per user and context in real time.',
      },
    ],
    detail: {
      eyebrow: 'The work',
      title: 'Engineered into the business, not bolted on.',
      body:
        'We do not build FAQ bots. A Cato agent is part of the product: it knows the catalog, completes transactions, escalates with full context and gets measurably better every month. The same discipline extends from customer experience to knowledge architecture — the four specialisms below are where we go deepest.',
      bullets: [
        'Agent strategy & persona design',
        'Knowledge architecture',
        'Specialized agent skills & tools',
        'System & API integration',
        'Human handoff & escalation',
        'Evaluation & iterative refinement',
      ],
    },
    faq: [
      {
        q: 'What can an agent actually do for us?',
        a:
          'Real work: answer the phone, qualify a lead, book the appointment, resolve the support case, assemble the interface. If it can be specified, it can usually be agented.',
      },
      {
        q: 'How do you keep an agent from embarrassing the brand?',
        a:
          'Persona design, scoped knowledge, hard escalation rules and continuous evaluation. The agent knows what it knows — and hands over gracefully when it does not.',
      },
      {
        q: 'Do agents replace our team?',
        a:
          'No. They absorb the repetitive volume and hand humans the moments that matter — with the full context attached. Headcount shifts; judgment stays human.',
      },
      {
        q: 'What models do you build on?',
        a:
          'Whatever the task demands. Model choice is an engineering decision, revisited as the field moves. The architecture outlives any single model.',
      },
    ],
    cta: {
      title: 'Put an agent to work.',
      body:
        'Describe the task your team repeats a hundred times a week. That is usually the first agent.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  'digital-products': {
    slug: 'digital-products',
    crumbLabel: 'Digital Products & Experiences',
    eyebrow: 'Capabilities — 03',
    titleLines: ['The website is', 'the flagship.'],
    lede:
      'Websites and applications treated as products — architected, designed and engineered on modern stacks to be editorial-grade, fast and built to convert.',
    features: [
      {
        index: '01',
        title: 'Information architecture & UX',
        body:
          'The structure comes first. Every page has a job, every journey a destination, and the architecture is argued before a single pixel is placed.',
      },
      {
        index: '02',
        title: 'Interface & experience design',
        body:
          'High-fidelity, system-driven design — typography, motion and interaction held to an editorial standard, because polish is how quality is judged.',
      },
      {
        index: '03',
        title: 'Next.js / React engineering',
        body:
          'Production engineering on modern stacks, chosen for the experience and the business case. Fast by default: performance is a feature, not a fix.',
      },
    ],
    detail: {
      eyebrow: 'The work',
      title: 'Built to perform, measured like a product.',
      body:
        'A Cato build ships with conversion architecture and Core Web Vitals in the definition of done — not as a later audit. The stack is headless where headless earns its complexity, and every surface is instrumented so the experience can be argued with evidence after launch.',
      bullets: [
        'Information architecture & UX',
        'Interface & experience design',
        'Next.js / React engineering',
        'Headless commerce & CMS',
        'Conversion architecture',
        'Performance & Core Web Vitals',
      ],
    },
    faq: [
      {
        q: 'What stack do you build on?',
        a:
          'React and Next.js by default, headless commerce and CMS where the business case supports it. The stack follows the experience — never the other way around.',
      },
      {
        q: 'Can you rebuild on top of our existing systems?',
        a:
          'Yes. Most flagships sit on existing commerce, booking or CRM infrastructure. We architect the experience layer around what already works.',
      },
      {
        q: 'How do you measure success after launch?',
        a:
          'Conversion, speed and the Core Web Vitals Google actually ranks on. Every build ships instrumented, so performance is a report, not an opinion.',
      },
      {
        q: 'Do you handle content as well as code?',
        a:
          'Yes. Copy, imagery and art direction are part of the build, working alongside Brand & Creative Systems. A flagship with placeholder words is not a flagship.',
      },
    ],
    cta: {
      title: 'Build the flagship.',
      body:
        'Show us the current site and the number it is failing to move. We will show you what a flagship does differently.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  'brand-creative': {
    slug: 'brand-creative',
    crumbLabel: 'Brand & Creative Systems',
    eyebrow: 'Capabilities — 04',
    titleLines: ['Brand is', 'infrastructure.'],
    lede:
      'Brand as a strategic system — thesis, archetype, narrative and identity connected end to end, built to survive contact with every surface your company touches.',
    features: [
      {
        index: '01',
        title: 'Brand thesis & archetypes',
        body:
          'Positioning flows into customer psychology. The thesis states what the brand believes; the archetype makes that belief behave consistently everywhere.',
      },
      {
        index: '02',
        title: 'Naming & narrative systems',
        body:
          'Names, stories and messages engineered as a system — so the pitch deck, the homepage and the support reply all tell the same truth.',
      },
      {
        index: '03',
        title: 'Visual identity & art direction',
        body:
          'Typography, color, imagery and motion as one governed system. Explored widely, evaluated strategically, refined until the system holds.',
      },
    ],
    detail: {
      eyebrow: 'The work',
      title: 'A system, not a logo.',
      body:
        'Identity work at Cato is connected to strategy on one side and product on the other. Multiple territories are explored against the thesis, then systemized into guidelines a team can actually use — voice and tone included, because words are half the surface.',
      bullets: [
        'Brand thesis & archetypes',
        'Naming & narrative systems',
        'Visual identity & art direction',
        'Typography & color systems',
        'Voice & tone guidelines',
        'Guidelines & systemization',
      ],
    },
    faq: [
      {
        q: 'Is this a rebrand or a refresh?',
        a:
          'Depends on the evidence. Sometimes the thesis is right and the system is weak; sometimes the position itself has to move. The diagnosis decides.',
      },
      {
        q: 'What do we receive at the end?',
        a:
          'A governed system: thesis, narrative, identity, typography, color, voice — documented as guidelines your team and your tools can apply without us.',
      },
      {
        q: 'How do you test a direction before committing?',
        a:
          'Territories are evaluated against the strategy and pressure-tested on real surfaces — product, packaging, social, sales — before refinement begins.',
      },
    ],
    cta: {
      title: 'Give the ambition a system.',
      body:
        'Bring us the story you keep telling in fragments. We will make it hold together.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  'growth-distribution': {
    slug: 'growth-distribution',
    crumbLabel: 'Growth & Distribution',
    eyebrow: 'Capabilities — 05',
    titleLines: ['Growth is architecture,', 'not activity.'],
    lede:
      'Search, content, local and social engineered as compounding acquisition systems — every channel earning its budget through explicit trade-offs.',
    features: [
      {
        index: '01',
        title: 'Keyword & intent architecture',
        body:
          'The entire keyword universe is mapped to intent and to pages. Nothing ranks by accident; nothing is published without a job.',
      },
      {
        index: '02',
        title: 'Editorial & content systems',
        body:
          'Content pillars build topical authority on a cadence you can sustain. Quality is the strategy — volume is just the multiplier.',
      },
      {
        index: '03',
        title: 'Local-market capture',
        body:
          'Local beachheads are made defensible before expansion. Own the map pack in one market, then take the playbook to the next.',
      },
    ],
    detail: {
      eyebrow: 'The work',
      title: 'Engines that acquire while you sleep.',
      body:
        'Growth at Cato compounds. Technical SEO and schema make the site legible to machines; content systems make it authoritative to people; CRO turns the traffic into revenue. Every channel reports to the same measurement architecture, so budget follows evidence.',
      bullets: [
        'Technical SEO & schema',
        'Keyword & intent architecture',
        'Editorial & content systems',
        'Local-market capture',
        'Social operating models',
        'CRO & experimentation',
      ],
    },
    faq: [
      {
        q: 'How long until SEO produces results?',
        a:
          'Honestly: months, not weeks. Local capture moves fastest; competitive head terms take quarters. We sequence for early wins that fund the long game.',
      },
      {
        q: 'Do you run paid channels?',
        a:
          'Selectively. Paid is used to test messages and bridge gaps while organic compounds — never as a substitute for an engine that works without spend.',
      },
      {
        q: 'What about AI search and answer engines?',
        a:
          'They are now part of the architecture. Structured content, schema and clear entity signals are built in from the start, because agents are your new homepage readers.',
      },
      {
        q: 'Can you work with our in-house team?',
        a:
          'Yes. We often build the architecture and operating model, then hand channels to in-house owners with the measurement system attached.',
      },
    ],
    cta: {
      title: 'Build the engine.',
      body:
        'Tell us where your customers come from today. We will show you the system that makes it repeatable.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  'operations-automation': {
    slug: 'operations-automation',
    crumbLabel: 'Operations & Automation',
    eyebrow: 'Capabilities — 06',
    titleLines: ['Scale without', 'scaling headcount.'],
    lede:
      'Support, workflows and measurement redesigned as one system — so the business runs on rails and growth stops meaning headcount.',
    features: [
      {
        index: '01',
        title: 'Support operations & helpdesk design',
        body:
          'Support becomes a unified, AI-assisted system — one queue, clear escalation, proactive outreach — instead of a pile of inboxes.',
      },
      {
        index: '02',
        title: 'Workflow automation',
        body:
          'Work moves between systems without human relay. Every handoff that can be specified is automated; every exception routes to a person.',
      },
      {
        index: '03',
        title: 'Support analytics & lifecycle',
        body:
          'The metrics that matter are instrumented end to end — resolution time, retention, lifetime value — so operations argues from evidence.',
      },
    ],
    detail: {
      eyebrow: 'The work',
      title: 'An organization that runs on rails.',
      body:
        'We redesign the operating process itself, then automate what the redesign exposes. SOPs and escalation logic are written for humans and agents together, integrations replace swivel-chair work, and the dashboard shows the business as it actually is.',
      bullets: [
        'Support operations & helpdesk design',
        'Workflow automation',
        'System-to-system integration',
        'SOPs & escalation logic',
        'Support analytics',
        'Retention & lifecycle automation',
      ],
    },
    faq: [
      {
        q: 'Where do you usually start?',
        a:
          'With the workflow map: every recurring task, handoff and queue, measured. The map shows where hours leak — and the first automations pay for the rest.',
      },
      {
        q: 'Which tools do you integrate?',
        a:
          'The ones you already run — helpdesk, CRM, calendar, billing, phone. Automation is layered onto the stack, not sold as a rip-and-replace.',
      },
      {
        q: 'Will automation degrade the customer experience?',
        a:
          'Done properly, the opposite: faster answers, fewer dropped threads, proactive outreach. Humans keep the judgment calls; machines keep the schedule.',
      },
    ],
    cta: {
      title: 'Put the business on rails.',
      body:
        'List the three tasks your team repeats every day. That is where the automation starts.',
      label: 'Start a build',
      href: '/contact',
    },
  },
};
