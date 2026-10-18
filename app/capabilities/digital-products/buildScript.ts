import type { StreamAgent, StreamStep } from '@/components/kit/StreamSimulator';

/**
 * buildScript.ts — the two "films" of the digital-products page.
 *
 * 1. `aurelleScript` — the Studio stage: four Cato agents assemble the
 *    landing page of AURELLE, a fictional alpine fragrance house, from
 *    wireframe to launch. ~57 steps, four disciplines visibly cooperating.
 *
 * 2. `buildVibeScript` — the Sketch Engine: composes a personalized
 *    ~20-step script from the visitor's three answers. Their category
 *    becomes the brand; the "feel" answer swaps copy AND layout variant.
 *
 * All coordinates are percents of the StreamSimulator stage (0–100).
 * Blue spectrum only. Cato voice: precise, confident, no hype.
 */

export const studioAgents: StreamAgent[] = [
  { id: 'strategy', name: 'Sapphire', role: 'Strategy', color: '#1226c8' },
  { id: 'design', name: 'Azure', role: 'Design', color: '#2e4bff' },
  { id: 'engineering', name: 'Ice', role: 'Engineering', color: '#93a9ff' },
  { id: 'seo', name: 'Indigo', role: 'Discoverability', color: '#0a1890' },
];

export const aurelleBrand = { name: 'AURELLE', domain: 'aurelle.co' };

/* ------------------------------------------------------------------ */
/*  AURELLE — "Watch a site being born."                               */
/* ------------------------------------------------------------------ */

export const aurelleScript: StreamStep[] = [
  { type: 'wait', ms: 500 },

  /* ---- nav: Sapphire wires the architecture, Azure surfaces it ---- */
  {
    type: 'parallel',
    steps: [
      { type: 'cursor', agent: 'strategy', to: { x: 20, y: 9 } },
      { type: 'cursor', agent: 'engineering', to: { x: 80, y: 9 } },
      { type: 'cursor', agent: 'design', to: { x: 9, y: 7 } },
      {
        type: 'rect',
        agent: 'strategy',
        id: 'nav',
        at: { x: 5, y: 4, w: 90, h: 10 },
        style: 'wire',
        label: 'wireframe · nav',
        dur: 1.3,
      },
    ],
  },
  {
    type: 'text',
    agent: 'design',
    id: 'brand',
    at: { x: 7, y: 6.6 },
    content: 'AURELLE',
    style: 'label',
  },
  {
    type: 'parallel',
    steps: [
      { type: 'cursor', agent: 'seo', to: { x: 66, y: 7 } },
      {
        type: 'text',
        agent: 'seo',
        id: 'navlinks',
        at: { x: 64, y: 7 },
        content: 'Collection · Journal',
        style: 'label',
      },
    ],
  },
  {
    type: 'rect',
    agent: 'design',
    id: 'nav-fill',
    at: { x: 5, y: 4, w: 90, h: 10 },
    style: 'fill',
  },

  /* ---- hero: the headline gets typed, the mountain gets generated ---- */
  {
    type: 'parallel',
    steps: [
      { type: 'cursor', agent: 'strategy', to: { x: 9, y: 20 } },
      { type: 'cursor', agent: 'design', to: { x: 76, y: 34 } },
      { type: 'cursor', agent: 'engineering', to: { x: 8, y: 23 } },
      {
        type: 'text',
        agent: 'strategy',
        id: 'eyebrow',
        at: { x: 7, y: 20 },
        content: 'Alpine fragrance house — Chamonix',
        style: 'label',
      },
    ],
  },
  {
    type: 'stroke',
    agent: 'engineering',
    id: 'rule-eyebrow',
    path: 'M 7 23.5 L 19 23.5',
    dur: 0.7,
  },
  {
    type: 'text',
    agent: 'design',
    id: 'h1a',
    at: { x: 7, y: 25 },
    content: 'Altitude,',
    style: 'h1',
    dur: 1.1,
  },
  {
    type: 'text',
    agent: 'design',
    id: 'h1b',
    at: { x: 7, y: 32.5 },
    content: 'bottled.',
    style: 'h1',
    dur: 1,
  },
  {
    type: 'stroke',
    agent: 'engineering',
    id: 'rule-h1',
    path: 'M 7 40 L 27 40',
    dur: 0.7,
  },
  {
    type: 'text',
    agent: 'strategy',
    id: 'dek',
    at: { x: 7, y: 42.5 },
    content: 'Rare air, distilled. Scents composed at 2,000 metres — mineral, cold, exact.',
    style: 'body',
  },
  {
    type: 'text',
    agent: 'strategy',
    id: 'copytag',
    at: { x: 7, y: 51 },
    content: 'Copy · tone — cold, exact',
    style: 'label',
  },
  {
    type: 'parallel',
    steps: [
      { type: 'cursor', agent: 'design', to: { x: 9, y: 55 } },
      {
        type: 'text',
        agent: 'design',
        id: 'cta',
        at: { x: 7, y: 54.5 },
        content: 'Discover the collection',
        style: 'button',
      },
    ],
  },
  {
    type: 'parallel',
    steps: [
      { type: 'cursor', agent: 'engineering', to: { x: 76, y: 19 } },
      {
        type: 'rect',
        agent: 'engineering',
        id: 'hero-media',
        at: { x: 60, y: 19, w: 33, h: 30 },
        style: 'wire',
        label: 'media · generative',
        dur: 1.1,
      },
    ],
  },
  {
    type: 'image',
    agent: 'design',
    id: 'hero-img',
    at: { x: 60, y: 19, w: 33, h: 30 },
    seed: 'aurelle-altitude',
    dur: 1,
  },
  {
    type: 'parallel',
    steps: [
      { type: 'cursor', agent: 'seo', to: { x: 76, y: 52 } },
      {
        type: 'rect',
        agent: 'seo',
        id: 'schema-hero',
        at: { x: 60, y: 51.5, w: 33, h: 3.5 },
        style: 'wire',
        label: 'schema · product',
        dur: 1.2,
      },
    ],
  },
  {
    type: 'text',
    agent: 'seo',
    id: 'og',
    at: { x: 60, y: 58.5 },
    content: 'Meta · OG · sitemap',
    style: 'label',
  },
  { type: 'wait', ms: 350 },

  /* ---- product trio: the collection, in glass ---- */
  {
    type: 'parallel',
    steps: [
      { type: 'cursor', agent: 'engineering', to: { x: 9, y: 61 } },
      {
        type: 'text',
        agent: 'engineering',
        id: 'gridtag',
        at: { x: 7, y: 61 },
        content: 'Product grid',
        style: 'label',
      },
    ],
  },
  {
    type: 'parallel',
    steps: [
      {
        type: 'rect',
        agent: 'engineering',
        id: 'card1',
        at: { x: 7, y: 63.5, w: 25, h: 19 },
        style: 'wire',
        dur: 1.1,
      },
      {
        type: 'rect',
        agent: 'engineering',
        id: 'card2',
        at: { x: 37.5, y: 63.5, w: 25, h: 19 },
        style: 'wire',
        dur: 1.1,
      },
      {
        type: 'rect',
        agent: 'engineering',
        id: 'card3',
        at: { x: 68, y: 63.5, w: 25, h: 19 },
        style: 'wire',
        dur: 1.1,
      },
    ],
  },
  {
    type: 'parallel',
    steps: [
      {
        type: 'rect',
        agent: 'design',
        id: 'card1-g',
        at: { x: 7, y: 63.5, w: 25, h: 19 },
        style: 'glass',
        label: 'tokens · glass',
      },
      {
        type: 'rect',
        agent: 'design',
        id: 'card2-g',
        at: { x: 37.5, y: 63.5, w: 25, h: 19 },
        style: 'glass',
      },
      {
        type: 'rect',
        agent: 'design',
        id: 'card3-g',
        at: { x: 68, y: 63.5, w: 25, h: 19 },
        style: 'glass',
      },
      { type: 'cursor', agent: 'design', to: { x: 19, y: 66 } },
    ],
  },
  {
    type: 'parallel',
    steps: [
      {
        type: 'text',
        agent: 'strategy',
        id: 'p1',
        at: { x: 9.5, y: 67.5 },
        content: 'Sommet N°1',
        style: 'label',
      },
      {
        type: 'text',
        agent: 'strategy',
        id: 'p2',
        at: { x: 40, y: 67.5 },
        content: 'Crevasse N°2',
        style: 'label',
      },
      {
        type: 'text',
        agent: 'strategy',
        id: 'p3',
        at: { x: 70.5, y: 67.5 },
        content: 'Treeline N°3',
        style: 'label',
      },
    ],
  },
  {
    type: 'parallel',
    steps: [
      {
        type: 'text',
        agent: 'seo',
        id: 'p1s',
        at: { x: 9.5, y: 72 },
        content: 'Eau de parfum · 50ml',
        style: 'label',
      },
      {
        type: 'text',
        agent: 'seo',
        id: 'p2s',
        at: { x: 40, y: 72 },
        content: 'Eau de parfum · 50ml',
        style: 'label',
      },
      {
        type: 'text',
        agent: 'seo',
        id: 'p3s',
        at: { x: 70.5, y: 72 },
        content: 'Eau de parfum · 50ml',
        style: 'label',
      },
      { type: 'cursor', agent: 'seo', to: { x: 70, y: 72 } },
    ],
  },
  {
    type: 'parallel',
    steps: [
      {
        type: 'text',
        agent: 'design',
        id: 'p1p',
        at: { x: 9.5, y: 76.5 },
        content: '€180',
        style: 'body',
      },
      {
        type: 'text',
        agent: 'design',
        id: 'p2p',
        at: { x: 40, y: 76.5 },
        content: '€210',
        style: 'body',
      },
      {
        type: 'text',
        agent: 'design',
        id: 'p3p',
        at: { x: 70.5, y: 76.5 },
        content: '€165',
        style: 'body',
      },
    ],
  },
  { type: 'wait', ms: 300 },

  /* ---- social proof + footer ---- */
  {
    type: 'parallel',
    steps: [
      { type: 'cursor', agent: 'engineering', to: { x: 30, y: 88 } },
      {
        type: 'rect',
        agent: 'engineering',
        id: 'reviews',
        at: { x: 7, y: 87, w: 56, h: 8.5 },
        style: 'glass',
        label: 'social proof',
      },
    ],
  },
  {
    type: 'text',
    agent: 'design',
    id: 'stars',
    at: { x: 9.5, y: 89.5 },
    content: '★★★★★',
    style: 'label',
  },
  {
    type: 'text',
    agent: 'strategy',
    id: 'quote',
    at: { x: 22, y: 89 },
    content: '“Like standing above the weather.”',
    style: 'body',
  },
  {
    type: 'text',
    agent: 'seo',
    id: 'attrib',
    at: { x: 22, y: 92 },
    content: '— Monocle, retail awards',
    style: 'label',
  },
  {
    type: 'parallel',
    steps: [
      {
        type: 'rect',
        agent: 'engineering',
        id: 'footer',
        at: { x: 68, y: 87, w: 25, h: 8.5 },
        style: 'wire',
        label: 'footer',
        dur: 1,
      },
      { type: 'cursor', agent: 'engineering', to: { x: 70, y: 88 } },
    ],
  },
  {
    type: 'text',
    agent: 'design',
    id: 'foot-brand',
    at: { x: 70.5, y: 89.5 },
    content: 'AURELLE',
    style: 'label',
  },
  {
    type: 'text',
    agent: 'seo',
    id: 'foot-meta',
    at: { x: 84, y: 89.5 },
    content: 'Est. 2026',
    style: 'label',
  },

  /* ---- shipped: the four cursors rest ---- */
  { type: 'wait', ms: 250 },
  {
    type: 'parallel',
    steps: [
      { type: 'cursor', agent: 'strategy', to: { x: 28, y: 32 }, dur: 1.3 },
      { type: 'cursor', agent: 'design', to: { x: 46, y: 44 }, dur: 1.3 },
      { type: 'cursor', agent: 'engineering', to: { x: 64, y: 56 }, dur: 1.3 },
      { type: 'cursor', agent: 'seo', to: { x: 86, y: 24 }, dur: 1.3 },
    ],
  },
  { type: 'wait', ms: 300 },
];

/* ------------------------------------------------------------------ */
/*  The Sketch Engine — a personalized opening frame in ~20 steps.     */
/* ------------------------------------------------------------------ */

export type VibeFeel = 'quiet' | 'bold' | 'warm' | 'clinical';

export interface VibeAnswers {
  /** lowercase category — 'product' | 'service' | 'hospitality' | 'retail' | free text */
  category: string;
  /** audience pill label — 'Locals' | 'Connoisseurs' | 'Professionals' | 'Everyone' */
  audience: string;
  /** region pill label or free text — 'Los Angeles' | 'Palm Springs' | … */
  region?: string;
  feel: VibeFeel;
}

export interface VibeBuild {
  script: StreamStep[];
  brand: { name: string; domain: string };
}

const FEEL_COPY: Record<
  VibeFeel,
  { h1: [string, string]; h1Style: 'h1' | 'h2'; dek: (cat: string, aud: string) => string }
> = {
  quiet: {
    h1: ['Less,', 'but better.'],
    h1Style: 'h2',
    dek: (cat, aud) => `Everything essential. Nothing extra. A ${cat} house for ${aud}.`,
  },
  bold: {
    h1: ['MAKE', 'THEM LOOK.'],
    h1Style: 'h1',
    dek: (cat, aud) => `${cat.charAt(0).toUpperCase() + cat.slice(1)} that refuses to whisper. Built for ${aud}.`,
  },
  warm: {
    h1: ['Come in.', 'Stay awhile.'],
    h1Style: 'h1',
    dek: (cat, aud) => `A warm welcome, made digital. ${cat} for ${aud}, with feeling.`,
  },
  clinical: {
    h1: ['Precision,', 'by default.'],
    h1Style: 'h2',
    dek: (cat, aud) => `Every element measured, every claim sourced. ${cat} for ${aud}.`,
  },
};

const WARM_CARDS: Record<string, [string, string, string]> = {
  product: ['The object', 'The making', 'The proof'],
  service: ['The promise', 'The process', 'The proof'],
  hospitality: ['The room', 'The table', 'The welcome'],
  retail: ['The shelf', 'The story', 'The staple'],
};

export function buildVibeScript({ category, audience, region, feel }: VibeAnswers): VibeBuild {
  const cat = (category.trim().toLowerCase() || 'product').slice(0, 24);
  const aud = audience.toLowerCase();
  const where = (region ?? '').trim();
  const slug = cat.replace(/[^a-z0-9]+/g, '').slice(0, 18) || 'brand';
  const brand = {
    name: `Your ${cat} brand`,
    domain: `your-${slug}.co`,
  };
  const copy = FEEL_COPY[feel];

  const script: StreamStep[] = [
    { type: 'wait', ms: 350 },
    {
      type: 'parallel',
      steps: [
        { type: 'cursor', agent: 'design', to: { x: 9, y: 7 } },
        { type: 'cursor', agent: 'engineering', to: { x: 80, y: 9 } },
        {
          type: 'rect',
          agent: 'engineering',
          id: 'v-nav',
          at: { x: 5, y: 4, w: 90, h: 10 },
          style: 'wire',
          label: 'wireframe',
          dur: 1.2,
        },
      ],
    },
    {
      type: 'text',
      agent: 'design',
      id: 'v-brand',
      at: { x: 7, y: 6.6 },
      content: `Your ${cat} brand`,
      style: 'label',
    },
    {
      type: 'parallel',
      steps: [
        { type: 'cursor', agent: 'seo', to: { x: 72, y: 7 } },
        {
          type: 'text',
          agent: 'seo',
          id: 'v-links',
          at: { x: 70, y: 7 },
          content: 'Story · Visit · Contact',
          style: 'label',
        },
      ],
    },
    { type: 'cursor', agent: 'strategy', to: { x: 9, y: 20 } },
    {
      type: 'text',
      agent: 'strategy',
      id: 'v-eyebrow',
      at: { x: 7, y: 20 },
      content: `For ${aud}${where ? ` in ${where.toLowerCase()}` : ''} — est. soon`,
      style: 'label',
    },
    {
      type: 'text',
      agent: 'design',
      id: 'v-h1a',
      at: { x: 7, y: feel === 'bold' ? 23.5 : 25.5 },
      content: copy.h1[0],
      style: copy.h1Style,
      dur: 1,
    },
    {
      type: 'text',
      agent: 'design',
      id: 'v-h1b',
      at: { x: 7, y: feel === 'bold' ? 34 : 33 },
      content: copy.h1[1],
      style: copy.h1Style,
      dur: 1,
    },
  ];

  /* ---- layout variant by "feel" ---- */
  if (feel === 'quiet') {
    /* serif-less, wide-tracked minimal: one hairline, one tall image, air */
    script.push(
      {
        type: 'stroke',
        agent: 'engineering',
        id: 'v-rule',
        path: 'M 7 43 L 50 43',
        dur: 0.9,
      },
      {
        type: 'image',
        agent: 'design',
        id: 'v-img',
        at: { x: 62, y: 18, w: 31, h: 32 },
        seed: `vibe-quiet-${slug}`,
        dur: 1,
      },
      {
        type: 'rect',
        agent: 'seo',
        id: 'v-schema',
        at: { x: 62, y: 53, w: 31, h: 3.5 },
        style: 'wire',
        label: 'schema',
        dur: 1.1,
      },
    );
  } else if (feel === 'bold') {
    /* oversized type blocks: a colour slab, a heavy underline, no image */
    script.push(
      {
        type: 'rect',
        agent: 'design',
        id: 'v-block',
        at: { x: 58, y: 20, w: 35, h: 28 },
        style: 'fill',
        label: 'tokens · block',
      },
      {
        type: 'stroke',
        agent: 'engineering',
        id: 'v-rule',
        path: 'M 7 45.5 L 44 45.5',
        dur: 0.8,
      },
      {
        type: 'rect',
        agent: 'seo',
        id: 'v-schema',
        at: { x: 58, y: 51.5, w: 35, h: 3.5 },
        style: 'wire',
        label: 'schema',
        dur: 1.1,
      },
    );
  } else if (feel === 'warm') {
    /* rounded glass cards: the offer, told in three panels */
    const labels = WARM_CARDS[cat] ?? ['The idea', 'The craft', 'The proof'];
    script.push(
      {
        type: 'parallel',
        steps: [
          {
            type: 'rect',
            agent: 'design',
            id: 'v-c1',
            at: { x: 7, y: 61, w: 25, h: 18 },
            style: 'glass',
            label: 'tokens · glass',
          },
          {
            type: 'rect',
            agent: 'design',
            id: 'v-c2',
            at: { x: 37.5, y: 61, w: 25, h: 18 },
            style: 'glass',
          },
          {
            type: 'rect',
            agent: 'design',
            id: 'v-c3',
            at: { x: 68, y: 61, w: 25, h: 18 },
            style: 'glass',
          },
        ],
      },
      {
        type: 'parallel',
        steps: [
          {
            type: 'text',
            agent: 'strategy',
            id: 'v-c1t',
            at: { x: 9.5, y: 65 },
            content: labels[0],
            style: 'label',
          },
          {
            type: 'text',
            agent: 'strategy',
            id: 'v-c2t',
            at: { x: 40, y: 65 },
            content: labels[1],
            style: 'label',
          },
          {
            type: 'text',
            agent: 'strategy',
            id: 'v-c3t',
            at: { x: 70.5, y: 65 },
            content: labels[2],
            style: 'label',
          },
        ],
      },
      {
        type: 'rect',
        agent: 'seo',
        id: 'v-schema',
        at: { x: 7, y: 81.5, w: 25, h: 3 },
        style: 'wire',
        label: 'schema',
        dur: 1,
      },
    );
  } else {
    /* clinical: grid-precise — measured cells, metrics on record */
    script.push(
      {
        type: 'parallel',
        steps: [
          {
            type: 'rect',
            agent: 'engineering',
            id: 'v-g1',
            at: { x: 55, y: 18, w: 17, h: 14 },
            style: 'wire',
            label: 'grid · 12 col',
            dur: 1,
          },
          {
            type: 'rect',
            agent: 'engineering',
            id: 'v-g2',
            at: { x: 74, y: 18, w: 19, h: 14 },
            style: 'wire',
            dur: 1,
          },
          {
            type: 'rect',
            agent: 'engineering',
            id: 'v-g3',
            at: { x: 55, y: 35, w: 17, h: 14 },
            style: 'wire',
            dur: 1,
          },
          {
            type: 'rect',
            agent: 'engineering',
            id: 'v-g4',
            at: { x: 74, y: 35, w: 19, h: 14 },
            style: 'wire',
            dur: 1,
          },
        ],
      },
      {
        type: 'parallel',
        steps: [
          {
            type: 'text',
            agent: 'seo',
            id: 'v-m1',
            at: { x: 57, y: 22.5 },
            content: 'LCP 0.9s',
            style: 'label',
          },
          {
            type: 'text',
            agent: 'seo',
            id: 'v-m2',
            at: { x: 76, y: 22.5 },
            content: 'CLS 0.00',
            style: 'label',
          },
        ],
      },
      {
        type: 'rect',
        agent: 'seo',
        id: 'v-schema',
        at: { x: 55, y: 53, w: 38, h: 3.5 },
        style: 'wire',
        label: 'schema · dataset',
        dur: 1.1,
      },
    );
  }

  /* ---- shared close: dek, CTA, footer, cursors rest ---- */
  const dekY = feel === 'bold' ? 50 : feel === 'quiet' ? 47 : feel === 'clinical' ? 43 : 47;
  const ctaY = feel === 'bold' ? 57 : feel === 'warm' ? 54 : 54.5;
  script.push(
    {
      type: 'text',
      agent: 'strategy',
      id: 'v-dek',
      at: { x: 7, y: dekY },
      content: copy.dek(cat, aud),
      style: 'body',
    },
    {
      type: 'parallel',
      steps: [
        { type: 'cursor', agent: 'design', to: { x: 9, y: ctaY + 1 } },
        {
          type: 'text',
          agent: 'design',
          id: 'v-cta',
          at: { x: 7, y: ctaY },
          content: 'Begin here',
          style: 'button',
        },
      ],
    },
    {
      type: 'parallel',
      steps: [
        { type: 'cursor', agent: 'engineering', to: { x: 50, y: 88 } },
        {
          type: 'rect',
          agent: 'engineering',
          id: 'v-footer',
          at: { x: 5, y: 87, w: 90, h: 8 },
          style: 'wire',
          label: 'footer',
          dur: 1,
        },
      ],
    },
    {
      type: 'text',
      agent: 'design',
      id: 'v-foot',
      at: { x: 7, y: 90.3 },
      content: '© 2026',
      style: 'label',
    },
    {
      type: 'text',
      agent: 'seo',
      id: 'v-footmeta',
      at: { x: 60, y: 90.3 },
      content: brand.domain,
      style: 'label',
    },
    { type: 'wait', ms: 250 },
    {
      type: 'parallel',
      steps: [
        { type: 'cursor', agent: 'strategy', to: { x: 30, y: 34 }, dur: 1.2 },
        { type: 'cursor', agent: 'design', to: { x: 48, y: 46 }, dur: 1.2 },
        { type: 'cursor', agent: 'engineering', to: { x: 66, y: 58 }, dur: 1.2 },
        { type: 'cursor', agent: 'seo', to: { x: 86, y: 26 }, dur: 1.2 },
      ],
    },
    { type: 'wait', ms: 200 },
  );

  return { script, brand };
}
