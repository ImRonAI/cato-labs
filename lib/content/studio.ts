/**
 * The Studio — copy for the web-design showcase on the homepage and for the Cato Studio
 * session on /capabilities/digital-products, where a Cato agent builds oubliai.com from a
 * single brief.
 *
 * The session is a scripted demonstration, labelled "Demo" in its window. The code it writes
 * is not scripted: it is the production source of oubliai.com, verified file-by-file against
 * the live deployment by scripts/build-oubli-source.mjs (public/studio-session/oubliai.json).
 */

/* ------------------------------------------------------------------ */
/*  Homepage: the ten flagships, beside a header about web design      */
/* ------------------------------------------------------------------ */

export interface FlagshipSite {
  index: string;
  slug: string;
  name: string;
  discipline: string;
  location: string;
  domain: string;
  href: string;
  conciergeHref: string;
  headline: string;
  summary: string;
  conciergeName: string;
  conciergePrompt: string;
  heroImage: string | null;
  detailImage: string | null;
  typography: {
    display: string;
    body: string;
    specimen: string;
  };
  sections: readonly string[];
  /** Authentic brand palette used ONLY inside the framed flagship viewport */
  palette: {
    scheme: 'light' | 'dark';
    bg: string;
    surface: string;
    fg: string;
    muted: string;
    accent: string;
    swatches: readonly [string, string, string];
  };
}

export const homeWebDesign = {
  eyebrow: 'Web design',
  titleLines: ['Ten flagships,', 'engineered as products.'] as const,
  body:
    'Every Cato site is architected, art-directed and engineered from zero. Scroll through ten bespoke flagship concept builds, each crafted with custom editorial motion, structured search architecture, and a live Mistral GLM 5.3 Flash concierge with generative UI.',
  facts: [
    '10 bespoke builds',
    'Editorial motion',
    'Structured search',
    'Mistral GLM 5.3 Flash',
  ] as const,
  conciergeBadge: 'Mistral GLM 5.3 Flash · Live Concierge',
  cta: { label: 'Explore web design', href: '/capabilities/digital-products' },
  exploreFlagshipLabel: 'Explore flagship',
  openFullTabLabel: 'Open full site',
  launchConciergeLabel: 'Launch AI concierge',
  livePreviewLabel: 'Interactive live preview',
  editorialPlateLabel: 'Art-directed plate',
  architectureLabel: 'Architecture',
  typographyLabel: 'Typography',
  conciergeLabel: 'Concierge',
  loadingPreviewLabel: 'Mounting live flagship…',
} as const;

export const flagshipShowcase: readonly FlagshipSite[] = [
  {
    index: '01',
    slug: 'aurelle',
    name: 'Aurelle',
    discipline: 'Alpine Fragrance House',
    location: 'Chamonix',
    domain: 'aurelle.ch',
    href: '/studio-sites/aurelle.html',
    conciergeHref: '/studio-sites/aurelle.html?concierge=open',
    headline: 'The air up there, kept.',
    summary:
      'Three extraits de parfum from the Mont-Blanc massif composed by cryo-enfleurage in three hundred and fifty numbered flacons a year.',
    conciergeName: 'The Aurelle Concierge',
    conciergePrompt: 'Which of the three extraits is the coldest?',
    heroImage: '/images/studio-sites/aurelle-og.jpg',
    detailImage: '/images/studio-sites/aurelle-2.jpg',
    typography: {
      display: 'Instrument Serif',
      body: 'Instrument Sans',
      specimen: 'Aa · 2,400m',
    },
    sections: ['The house', 'The collection', 'Cryo-enfleurage', 'Discovery set', 'The atelier'],
    palette: {
      scheme: 'light',
      bg: '#F2F3F1',
      surface: '#E9EBE9',
      fg: '#151A1E',
      muted: '#6B7378',
      accent: '#2E5668',
      swatches: ['#F2F3F1', '#2E5668', '#151A1E'],
    },
  },
  {
    index: '02',
    slug: 'vespera',
    name: 'Vespera',
    discipline: 'Orbital & Cislunar Systems',
    location: 'Colorado Springs · Geneva',
    domain: 'vespera.aero',
    href: '/studio-sites/vespera.html',
    conciergeHref: '/studio-sites/vespera.html?concierge=open',
    headline: 'Above the weather. Below orbit. Holding station.',
    summary:
      'Autonomous solar-electric platforms engineered for persistent high-altitude observation, optical relay, and rapid suborbital repositioning.',
    conciergeName: 'The Vespera Desk',
    conciergePrompt: 'What is a stratollite and how long can it hold station?',
    heroImage: '/images/studio-sites/vespera-hero.jpg',
    detailImage: '/images/studio-sites/vespera-sentinel.jpg',
    typography: {
      display: 'Fraunces',
      body: 'Inter',
      specimen: 'FL650 · V-14',
    },
    sections: ['Systems', 'Approach', 'Programmes', 'Compliance', 'Secure enquiry'],
    palette: {
      scheme: 'dark',
      bg: '#0a0b10',
      surface: '#151822',
      fg: '#e8e6df',
      muted: '#a9a89f',
      accent: '#d9a066',
      swatches: ['#0a0b10', '#d9a066', '#e8e6df'],
    },
  },
  {
    index: '03',
    slug: 'kuroshio',
    name: 'Kuroshio',
    discipline: 'Edomae Omakase Counter',
    location: 'Ginza, Tokyo',
    domain: 'kuroshio.jp',
    href: '/studio-sites/kuroshio.html',
    conciergeHref: '/studio-sites/kuroshio.html?concierge=open',
    headline: 'Twelve seats. One current.',
    summary:
      'An eighteen-course seasonal progression served across a single slab of two-hundred-year-old hinoki from the morning Toyosu auction.',
    conciergeName: 'The Counter',
    conciergePrompt: 'What is on the omakase this autumn?',
    heroImage: '/images/studio-sites/kuroshio-hero.jpg',
    detailImage: '/images/studio-sites/kuroshio-uni.jpg',
    typography: {
      display: 'Cormorant Garamond',
      body: 'Noto Serif JP',
      specimen: '黒潮 · 17:30',
    },
    sections: ['The counter', 'Progression', 'Sourcing', 'Seatings & policies', 'Reserve'],
    palette: {
      scheme: 'dark',
      bg: '#0b0c0e',
      surface: '#121417',
      fg: '#e9e4da',
      muted: '#9a9ea3',
      accent: '#c9a26a',
      swatches: ['#0b0c0e', '#c9a26a', '#e9e4da'],
    },
  },
  {
    index: '04',
    slug: 'solstice-bio',
    name: 'Solstice Bio',
    discipline: 'Cellular Longevity & Therapeutics',
    location: 'Zurich · Boston',
    domain: 'solstice.bio',
    href: '/studio-sites/solstice-bio.html',
    conciergeHref: '/studio-sites/solstice-bio.html?concierge=open',
    headline: 'The cell, returned to a younger state.',
    summary:
      'Transient cellular reprogramming therapeutics delivering modified OSKM mRNA via lipid nanoparticles, measured at single-cell resolution.',
    conciergeName: 'Ask Solstice',
    conciergePrompt: 'What does transient reprogramming mean?',
    heroImage: '/images/studio-sites/solstice-bio-hero.jpg',
    detailImage: '/images/studio-sites/solstice-bio-1.jpg',
    typography: {
      display: 'Newsreader',
      body: 'Inter',
      specimen: 'OSKM · scRNA',
    },
    sections: ['Approach', 'Pipeline', 'People', 'Partners & investors', 'Contact'],
    palette: {
      scheme: 'light',
      bg: '#f3efe7',
      surface: '#ebe6dc',
      fg: '#17181a',
      muted: '#7a7b80',
      accent: '#b8651f',
      swatches: ['#f3efe7', '#b8651f', '#17181a'],
    },
  },
  {
    index: '05',
    slug: 'monolith',
    name: 'Monolith',
    discipline: 'Architectural Practice',
    location: 'Zurich · Kyoto',
    domain: 'monolith.arch',
    href: '/studio-sites/monolith.html',
    conciergeHref: '/studio-sites/monolith.html?concierge=open',
    headline: 'Raw matter, cast into silence.',
    summary:
      'Board-formed cast-in-place concrete structures, civic sanctuaries, and contemplative private residences built between Switzerland and Japan.',
    conciergeName: 'The Archivist',
    conciergePrompt: 'How does Douglas fir shuttering differ from Sugi cedar formwork?',
    heroImage: '/images/studio-sites/monolith-hero.jpg',
    detailImage: '/images/studio-sites/monolith-2.jpg',
    typography: {
      display: 'Cormorant Garamond',
      body: 'Plus Jakarta Sans',
      specimen: 'RC-04 · 杉',
    },
    sections: ['Practice', 'Light Study', 'Works', 'Ethos', 'Publications', 'Commission'],
    palette: {
      scheme: 'light',
      bg: '#F4F1EA',
      surface: '#EAE5DA',
      fg: '#171614',
      muted: '#78736A',
      accent: '#57534C',
      swatches: ['#F4F1EA', '#B8B0A2', '#171614'],
    },
  },
  {
    index: '06',
    slug: 'velour-capital',
    name: 'Velour Capital',
    discipline: 'Private Investment Office',
    location: 'London · Zurich',
    domain: 'velour.capital',
    href: '/studio-sites/velour-capital.html',
    conciergeHref: '/studio-sites/velour-capital.html?concierge=open',
    headline: 'Capital that keeps its voice down.',
    summary:
      'Senior secured direct lending, mezzanine capital, special situations, and sovereign debt underwritten patiently for institutions and families.',
    conciergeName: 'The Office',
    conciergePrompt: 'How does Direct Lending differ from Mezzanine Capital here?',
    heroImage: '/images/studio-sites/velour-capital-hero.jpg',
    detailImage: '/images/studio-sites/velour-capital-1.jpg',
    typography: {
      display: 'Cormorant Garamond',
      body: 'Inter',
      specimen: '§ IV · Aurum',
    },
    sections: ['The firm', 'Strategies', 'Approach', 'Letters & filings', 'Offices', 'Enquire'],
    palette: {
      scheme: 'dark',
      bg: '#161412',
      surface: '#2a2521',
      fg: '#ece6dc',
      muted: '#a69d93',
      accent: '#b59b6a',
      swatches: ['#161412', '#b59b6a', '#ece6dc'],
    },
  },
  {
    index: '07',
    slug: 'aether-motors',
    name: 'Aether Motors',
    discipline: 'Electric Grand Tourer · GT-01',
    location: 'Geneva',
    domain: 'aether.motors',
    href: '/studio-sites/aether-motors.html',
    conciergeHref: '/studio-sites/aether-motors.html?concierge=open',
    headline: 'The GT-01. Quietly immense.',
    summary:
      'A coachbuilt electric grand tourer with a 1,420 hp quad-motor drive, 820 km solid-state range, and a 0.19 drag coefficient.',
    conciergeName: 'The Aether Concierge',
    conciergePrompt: 'What makes the GT-01 different from other electric grand tourers?',
    heroImage: '/images/studio-sites/aether-motors-hero.jpg',
    detailImage: '/images/studio-sites/aether-gt01-aero.jpg',
    typography: {
      display: 'Cormorant',
      body: 'Geist',
      specimen: 'GT-01 · 0.19Cd',
    },
    sections: ['The house', 'Engineering', 'Aerodynamics', 'Atelier configurator', 'Private allocation'],
    palette: {
      scheme: 'dark',
      bg: '#0b0b0a',
      surface: '#141412',
      fg: '#ece8df',
      muted: '#8a867c',
      accent: '#b9a88a',
      swatches: ['#0b0b0a', '#b9a88a', '#ece8df'],
    },
  },
  {
    index: '08',
    slug: 'nocturne-audio',
    name: 'Nocturne Audio',
    discipline: 'Reference Acoustic Instruments',
    location: 'Geneva · Tokyo',
    domain: 'nocturneaudio.ch',
    href: '/studio-sites/nocturne-audio.html',
    conciergeHref: '/studio-sites/nocturne-audio.html?concierge=open',
    headline: 'Silence, measured.',
    summary:
      'Reference planar-magnetic headphones and Class-A triode monoblock amplification built and individually calibrated by hand in Geneva.',
    conciergeName: 'The Atelier',
    conciergePrompt: 'What is the difference between the N-1 and the Mono-A?',
    heroImage: '/images/studio-sites/nocturne-audio-hero.jpg',
    detailImage: '/images/studio-sites/nocturne-audio-2.jpg',
    typography: {
      display: 'Instrument Serif',
      body: 'Instrument Sans',
      specimen: 'N-1 · 300B',
    },
    sections: ['The principle', 'Instruments', 'Engineering', 'Listening rooms'],
    palette: {
      scheme: 'dark',
      bg: '#07070a',
      surface: '#141419',
      fg: '#ece9e2',
      muted: '#b9b6ae',
      accent: '#d9c3a0',
      swatches: ['#07070a', '#d9c3a0', '#ece9e2'],
    },
  },
  {
    index: '09',
    slug: 'helios-grid',
    name: 'Helios Grid',
    discipline: 'High-Field Fusion & Clean Baseload',
    location: 'Zurich',
    domain: 'heliosgrid.ch',
    href: '/studio-sites/helios-grid.html',
    conciergeHref: '/studio-sites/helios-grid.html?concierge=open',
    headline: 'Fusion at the scale of a substation, not a city.',
    summary:
      'The HG-400 compact 400 MWe tokamak built on high-temperature ReBCO superconducting magnets for industrial and grid baseload.',
    conciergeName: 'Ask Helios',
    conciergePrompt: 'Why does a higher magnetic field make the tokamak smaller?',
    heroImage: '/images/studio-sites/helios-grid-hero.jpg',
    detailImage: '/images/studio-sites/helios-tokamak.jpg',
    typography: {
      display: 'Newsreader',
      body: 'Inter',
      specimen: 'HG-400 · 20T',
    },
    sections: ['Technology', 'Design basis', 'Programme', 'Offtake & capital', 'Enquiries'],
    palette: {
      scheme: 'light',
      bg: '#f3f1ec',
      surface: '#eceae4',
      fg: '#17191c',
      muted: '#6b6f76',
      accent: '#b8521f',
      swatches: ['#f3f1ec', '#b8521f', '#17191c'],
    },
  },
  {
    index: '10',
    slug: 'maison-verve',
    name: 'Maison Verve',
    discipline: 'Independent Haute Horlogerie',
    location: 'Quai des Bergues, Geneva',
    domain: 'maisonverve.ch',
    href: '/studio-sites/maison-verve.html',
    conciergeHref: '/studio-sites/maison-verve.html?concierge=open',
    headline: 'The hours no one sees.',
    summary:
      'Four in-house calibres and three pieces a year, finished entirely by hand at Quai des Bergues and sealed with the Poinçon de Genève.',
    conciergeName: 'The Atelier',
    conciergePrompt: 'Compare the three pieces of this year’s trilogy',
    heroImage: '/images/studio-sites/maison-verve-hero.jpg',
    detailImage: '/images/studio-sites/maison-verve-5.jpg',
    typography: {
      display: 'Instrument Serif',
      body: 'Inter',
      specimen: 'MV-09 · 21,600',
    },
    sections: ['Calibre MV-09', 'Hand finishing', 'Annual trilogy', 'Specifications', 'Salon appointment'],
    palette: {
      scheme: 'dark',
      bg: '#0c0c0d',
      surface: '#19191c',
      fg: '#ebe6dc',
      muted: '#918a7d',
      accent: '#86a4cc',
      swatches: ['#0c0c0d', '#86a4cc', '#ebe6dc'],
    },
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Digital products: the Studio section that frames the session       */
/* ------------------------------------------------------------------ */

export const studioSection = {
  eyebrow: 'The Studio',
  title: 'From one brief to oubliai.com.',
  lede:
    'One brief, one agent, start to finish: the plan, the 3D world, the flight, the pages, the checks and the deploy. The code it writes is the real source running at oubliai.com. Watch it build, then step inside.',
};

/** The session window's own words. */
export const studioSession = {
  app: 'Cato Studio',
  project: 'oubliai.com',
  demo: 'Demo',
  demoNote: 'A recorded demonstration. The code it writes is the real source of oubliai.com.',
  placeholderIdle: 'Describe the site you want built…',
  placeholderDemo: 'Demo session · replies are off',
  preparing: 'Preparing the session…',
  starting: 'A brief is on its way.',
  error: 'The session could not load.',
  retry: 'Try again',
  siteTitle: 'oubliai.com, live',
  /** shown when the live site refuses to be framed (or cannot be reached) */
  unframed: 'The live site can’t be shown inside this window right now.',
  openSite: 'Open oubliai.com',
};

/* ------------------------------------------------------------------ */
/*  The session script                                                 */
/* ------------------------------------------------------------------ */

/** A terminal line: plain output, a success mark, a dim note, or the route table. */
export type TermTone = 'out' | 'ok' | 'dim' | 'accent';
export type TermLine = readonly [TermTone, string];

export type SessionStep =
  /** the brief is typed into the composer, then sent */
  | { kind: 'compose' }
  /** streamed reasoning; collapses to "Thought for Ns" when done */
  | { kind: 'think'; text: string }
  /** a short line from the agent */
  | { kind: 'say'; text: string }
  /** the plan card */
  | { kind: 'plan'; items: readonly string[] }
  /** plan item `index` is complete */
  | { kind: 'tick'; index: number }
  /** a terminal command; `adds` are files the command creates */
  | {
      kind: 'run';
      command: string;
      output: readonly TermLine[];
      /** total time the command takes to print its output */
      ms: number;
      adds?: readonly string[];
      /** what the conversation row reports when it finishes */
      result: string;
    }
  /** writes real files from the production source, one after another */
  | { kind: 'write'; title: string; paths: readonly string[] }
  /** the rundown, then the question */
  | { kind: 'final' };

export const oubliBrief = `Build oubliai.com, the website for Oubli, an AI research lab. We build the browser, the agents and the models the next era runs on. The site should feel like discovering something hidden, not reading a brochure.

**Concept.** One continuous 3D journey. A monolith we call the Rubik, a loose cluster of bronze and deep-teal blocks whose rows slowly turn, floats over Palm Springs at golden hour. Native scroll flies the camera through three acts: **Arrival**, the Rubik above the desert; **Approach**, closing in until the blocks fill the frame; and **The work**, through a seam into the products.

**Content.**
- Header: a lowercase "oubli" wordmark, then Home, Products and a "Discuss a project" pill.
- Hero: "00 — Oubli", the headline "What's hidden changes everything.", the one-line mission, and two actions: Enter the Rubik (fly the whole journey for me) and Explore our work (take me straight there).
- In flight, two lines: "Good ideas need somewhere to become real." and "Browser. Agents. Models."
- The work: a gallery with one screen per product, 01 / 07 to 07 / 07, changed only with Previous and Next: Agentic Browser, Gwen, Telnyx MCP, Ron AI, Flagship Models, Corbel and Liam. Each product also gets its own page.
- Under the journey, the products again as plain words.
- A journey rail (Arrival — Approach — The work) and a "Skip to products" link.

**Look.** Warm, quiet, expensive. Inter for text, DM Mono for labels. Haze, sand, bronze, deep teal and near-black #14100c, with one soft peach accent. No stock imagery and no glass cards: the world is the image.

**Engineering.** Next.js App Router and React Three Fiber, with one persistent canvas that survives navigation. Scroll drives the camera on a tall native track, no scroll-jacking. 60 fps on a laptop with DPR clamped. Real DOM text for search and screen readers, and a flat fallback when WebGL is not available. Ship it to Vercel at oubliai.com.`;

export const oubliPlan = [
  'Scaffold Next.js, TypeScript and the type system',
  'One persistent WebGL host in the root layout',
  'The world: sky, desert, Palm Springs and the Rubik',
  'The flight: a scroll-driven camera director',
  'The work: gallery, product screens and pages',
  'Header, hero, captions and the journey rail',
  'Build, test in a browser, deploy to oubliai.com',
] as const;

export const oubliSession: readonly SessionStep[] = [
  { kind: 'compose' },
  {
    kind: 'think',
    text: `The brief is unusually complete, so the real work is the order of operations.

The camera is the main character. Scroll is the timeline, so every frame of the flight has to be authored rather than simulated: one director maps a single normalised journey value to the camera's position, its gaze and the light. A single persistent canvas in the root layout reads it, which means navigating to a product never tears the renderer down.

The Rubik has to read as one object from the desert and as architecture up close. I'll grow it from a seeded grid, so it is the same Rubik on every visit, and turn its rows on a slow clock. No HDR downloads: I'll write the sky as a function, draw it as the dome, and bake the same function into the environment the bronze reflects.

Text stays in the DOM over the canvas, with a flat product list for browsers that can't draw WebGL.`,
  },
  { kind: 'say', text: 'Here is the plan. I will build it in this order and fly it in a real browser before it ships.' },
  { kind: 'plan', items: oubliPlan },
  {
    kind: 'run',
    command: 'npx create-next-app@latest oubli --typescript --app --src-dir --eslint --no-tailwind --import-alias "@/*"',
    ms: 2600,
    output: [
      ['out', 'Creating a new Next.js app in ~/oubli.'],
      ['dim', 'Using npm.'],
      ['out', 'Initializing project with template: app'],
      ['dim', 'Installing dependencies: next, react, react-dom'],
      ['dim', 'Installing devDependencies: typescript, @types/node, @types/react, @types/react-dom, eslint, eslint-config-next'],
      ['out', 'added 312 packages, and audited 313 packages in 9s'],
      ['ok', 'Success! Created oubli at ~/oubli'],
    ],
    adds: [
      'package.json',
      'tsconfig.json',
      'next.config.ts',
      'src/app/favicon.ico',
      'src/app/layout.tsx',
      'src/app/page.tsx',
      'src/app/globals.css',
      'src/app/page.module.css',
    ],
    result: 'Next.js app scaffolded',
  },
  {
    kind: 'run',
    command: 'npm install three @react-three/fiber @react-three/drei && npm install -D @types/three @playwright/test @axe-core/playwright',
    ms: 2200,
    output: [
      ['out', 'added 41 packages, and audited 354 packages in 4s'],
      ['out', 'added 9 packages, and audited 363 packages in 2s'],
      ['ok', 'found 0 vulnerabilities'],
    ],
    result: 'three.js, R3F and test tooling installed',
  },
  { kind: 'tick', index: 0 },
  {
    kind: 'write',
    title: 'The persistent host',
    paths: [
      'src/app/globals.css',
      'src/app/layout.tsx',
      'next.config.ts',
      'vercel.json',
      'src/scene/experience.ts',
      'src/components/Experience.tsx',
    ],
  },
  {
    kind: 'say',
    text: 'The canvas lives in the root layout and pages claim it, so the world survives every navigation.',
  },
  { kind: 'tick', index: 1 },
  {
    kind: 'think',
    text: `The world next. The sky is both backdrop and light: one sky function, drawn as the dome and baked into a PMREM environment, so the bronze reflects exactly the sky you see. The sun sits low at 248°, ten degrees up, and long ground shadows sell the hour. Palm Springs stays quiet and dark so the Rubik and the sky own the frame.`,
  },
  {
    kind: 'write',
    title: 'The world',
    paths: [
      'src/scene/util.ts',
      'src/scene/rubik-materials.ts',
      'src/components/scene/DesertEnvironment.tsx',
      'src/components/scene/PalmSprings.tsx',
      'src/scene/cluster.ts',
      'src/scene/carve.ts',
      'src/components/scene/CanonicalRubik.tsx',
    ],
  },
  { kind: 'tick', index: 2 },
  {
    kind: 'say',
    text: 'Now the flight. One normalised journey value drives the camera, its gaze and the light, scrubbed by native scroll.',
  },
  {
    kind: 'write',
    title: 'The flight',
    paths: [
      'src/scene/director-constants.ts',
      'src/scene/director.ts',
      'src/components/scene/CameraDirector.tsx',
      'src/components/scene/Effects.tsx',
      'src/components/scene/SceneHost.tsx',
    ],
  },
  { kind: 'tick', index: 3 },
  {
    kind: 'say',
    text: 'The work: seven products, one screen each, changed only with Previous and Next, and every one addressable.',
  },
  {
    kind: 'write',
    title: 'The work',
    paths: [
      'src/data/products.ts',
      'src/data/placeholder-ui.ts',
      'src/scene/sculpture-forms.ts',
      'src/scene/particles.ts',
      'src/components/scene/sculptures.tsx',
      'src/components/scene/InteriorChamber.tsx',
      'src/scene/selection.ts',
      'src/scene/gallery-store.ts',
      'src/scene/portfolio.ts',
      'src/components/scene/Gallery.tsx',
      'src/components/portfolio/FlatScreen.tsx',
      'src/components/portfolio/GalleryControls.tsx',
      'src/components/portfolio/ScreenList.tsx',
      'src/components/portfolio/ProductGallery.tsx',
      'src/app/products/page.tsx',
      'src/app/products/[slug]/page.tsx',
      'src/app/ui/[slug]/[screen]/route.ts',
    ],
  },
  { kind: 'tick', index: 4 },
  {
    kind: 'write',
    title: 'The front door',
    paths: ['src/components/SiteHeader.tsx', 'src/components/HomeJourney.tsx', 'src/app/page.tsx', 'src/app/page.module.css', 'package.json'],
  },
  { kind: 'tick', index: 5 },
  { kind: 'say', text: 'Everything is in. Building it, then flying it in a real browser.' },
  {
    kind: 'run',
    command: 'npm run build',
    ms: 2600,
    output: [
      ['dim', '> oubli-next@0.1.0 build'],
      ['dim', '> next build'],
      ['accent', '▲ Next.js 16.4.0'],
      ['out', 'Creating an optimized production build ...'],
      ['ok', 'Compiled successfully'],
      ['ok', 'Finished TypeScript'],
      ['ok', 'Generating static pages (32/32)'],
      ['out', 'Route (app)'],
      ['out', '┌ ○ /'],
      ['out', '├ ○ /products'],
      ['out', '├ ● /products/[slug]        7 paths'],
      ['out', '└ ● /ui/[slug]/[screen]     21 paths'],
      ['dim', '○ static   ● prerendered as static HTML'],
    ],
    result: 'Production build passed',
  },
  {
    kind: 'run',
    command: 'npm run test:e2e',
    ms: 2300,
    output: [
      ['dim', 'Running 12 tests using 4 workers'],
      ['ok', 'arrival: the Rubik over Palm Springs'],
      ['ok', 'scroll flies Arrival → Approach → The work'],
      ['ok', 'Enter the Rubik flies the journey; a wheel hands back control'],
      ['ok', 'Previous / Next change the project; #gwen deep-links'],
      ['ok', 'no WebGL: the flat product list'],
      ['ok', 'axe: no violations on / and /products'],
      ['out', '12 passed (41.6s)'],
    ],
    result: '12 browser tests passed',
  },
  {
    kind: 'run',
    command: 'vercel deploy --prod',
    ms: 2400,
    output: [
      ['dim', 'Vercel CLI'],
      ['out', 'Uploading 46 files'],
      ['out', 'Building: next build'],
      ['ok', 'Production: https://oubli-alpha.vercel.app'],
      ['accent', 'Aliased: https://oubliai.com'],
    ],
    result: 'Live at oubliai.com',
  },
  { kind: 'tick', index: 6 },
  { kind: 'final' },
];

/* ------------------------------------------------------------------ */
/*  The rundown: {files} and {lines} are filled from the real source   */
/* ------------------------------------------------------------------ */

export const oubliRundown = {
  headline: 'oubliai.com is live.',
  intro:
    '{files} files and {lines} lines, built from your brief, flown in a real browser and deployed to Vercel.',
  points: [
    {
      title: 'The flight',
      body:
        'One persistent canvas in the root layout. 520svh of native scroll drives the camera through Arrival, Approach and The work. Enter the Rubik flies the whole journey in 24 seconds; any wheel, touch or key hands control straight back.',
    },
    {
      title: 'The world',
      body:
        'A seeded cluster of bronze and deep-teal blocks over a palm-lined Palm Springs avenue, its rows turning on a slow clock. The sky is written in code and baked into the light the bronze reflects, so there are no HDR downloads.',
    },
    {
      title: 'The work',
      body:
        'Seven products, one screen each, changed only with Previous and Next and addressable as #gwen. Every product also has its own page under /products.',
    },
    {
      title: 'Fallbacks',
      body:
        'No WebGL, or a lost context, drops to a flat product list. Every word on the page is real DOM text for search and screen readers.',
    },
  ],
  stack: ['Next.js 16', 'React 19', 'three.js', 'React Three Fiber', 'TypeScript', 'Vercel'],
  question: 'Would you like to see it?',
  yes: 'Yes, show me',
  no: 'Not yet',
  yesReply: 'Yes, show me.',
  noReply: 'Not yet.',
  noAnswer: 'No problem. It is live at oubliai.com whenever you are ready.',
  later: 'Show me now',
} as const;

/** The live site the session reveals. */
export const oubliSiteUrl = 'https://oubliai.com';
