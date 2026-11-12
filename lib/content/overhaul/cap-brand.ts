/**
 * Overhaul deck & deterministic generative engine for /capabilities/brand-creative
 * ("Brand is infrastructure." — The Identity Engine).
 *
 * Strictly adheres to Cato's blue-only spectrum (#fafbfe paper, #eef2ff ice,
 * #dce4ff soft blue, #93a9ff azure, #6b87ff cobalt, #2e4bff electric blue,
 * #1f38e0 royal, #1226c8 deep ultramarine, #0a1890 navy, #0a0c12 ink).
 */

export interface DialStop {
  v: number;
  name: string;
}

export interface DialDef {
  id: 'arch' | 'voice' | 'struct';
  label: string;
  caption: string;
  stops: DialStop[];
}

export interface DialValues {
  arch: number;
  voice: number;
  struct: number;
}

export interface BrandPreset {
  name: string;
  sector: string;
  dials: DialValues;
}

export const BRAND_PRESETS: readonly BrandPreset[] = [
  { name: 'Cato', sector: 'AI Strategy & Engineering', dials: { arch: 1 / 3, voice: 0.38, struct: 0.44 } },
  { name: 'Vesper', sector: 'Autonomous Avionics', dials: { arch: 2 / 3, voice: 0.82, struct: 0.22 } },
  { name: 'Aether', sector: 'Climate Infrastructure', dials: { arch: 0, voice: 0.24, struct: 0.18 } },
  { name: 'Kinetix', sector: 'Robotic Actuation', dials: { arch: 1, voice: 0.88, struct: 0.86 } },
  { name: 'Meridian', sector: 'Institutional Clearing', dials: { arch: 2 / 3, voice: 0.3, struct: 0.12 } },
  { name: 'Oubli', sector: 'Neural Memory Systems', dials: { arch: 1 / 3, voice: 0.68, struct: 0.92 } },
];

export const DIAL_DEFS: readonly DialDef[] = [
  {
    id: 'arch',
    label: 'Archetype',
    caption: 'Who the brand is when no one is watching.',
    stops: [
      { v: 0, name: 'Sage' },
      { v: 1 / 3, name: 'Creator' },
      { v: 2 / 3, name: 'Ruler' },
      { v: 1, name: 'Explorer' },
    ],
  },
  {
    id: 'voice',
    label: 'Voice',
    caption: 'How loudly the system is allowed to speak.',
    stops: [
      { v: 0, name: 'Quiet' },
      { v: 1, name: 'Bold' },
    ],
  },
  {
    id: 'struct',
    label: 'Structure',
    caption: 'How far the grid is allowed to bend.',
    stops: [
      { v: 0, name: 'Classic' },
      { v: 1, name: 'Avant-garde' },
    ],
  },
];

export const ARCH_NAMES = ['Sage', 'Creator', 'Ruler', 'Explorer'] as const;
export const VOICE_NAMES = ['Quiet', 'Bold'] as const;
export const STRUCT_NAMES = ['Classic', 'Avant-garde'] as const;

export const MOTIF_NAMES = [
  'Keystone Monolith',
  'Hexagonal Vault',
  'Orbital Meridian',
  'Cantilever Grid',
  'Harmonic Aperture',
  'Delta Prism Triad',
] as const;

export interface BuildStepDef {
  index: string;
  id: 'thesis' | 'mark' | 'type' | 'palette' | 'voice' | 'applications';
  label: string;
  detail: string;
}

export const BUILD_STEPS: readonly BuildStepDef[] = [
  { index: '01', id: 'thesis', label: 'Thesis & Seed', detail: 'Positioning coordinates locked' },
  { index: '02', id: 'mark', label: 'Geometric Mark', detail: 'Swiss construction grammar compiled' },
  { index: '03', id: 'type', label: 'Wordmark & Scale', detail: 'Optical pairing & hierarchy set' },
  { index: '04', id: 'palette', label: 'Spectral Palette', detail: 'Blue-spectrum roles & contrast verified' },
  { index: '05', id: 'voice', label: 'Voice Matrix', detail: 'Thesis, headline & product copy aligned' },
  { index: '06', id: 'applications', label: 'Surface System', detail: 'Card, icon, signage & flagship deployed' },
];

export const ENGINE_COPY = {
  eyebrow: 'The Identity Engine',
  title: 'Identity is a system of dials.',
  lede:
    'Enter a company name and turn the dials. Every Cato identity is a governed point in this space — thesis, geometric mark, typography, blue-spectrum palette, voice and physical surfaces compiled live as one coherent architecture.',
  assumptionNote:
    'Deterministic generative grammar — seeded by company name + Archetype × Voice × Structure coordinates.',
};

/* ---------------------------------------------------------------- */
/*  Deterministic math helpers                                       */
/* ---------------------------------------------------------------- */

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const fmt = (n: number) => n.toFixed(2);

/** Deterministic hash from company name string — never random noise. */
export interface NameSeed {
  cleanName: string;
  domainSlug: string;
  hash: number;
  motifIndex: number;
  harmonicRatio: number;
  symmetryBias: number;
  innerRingFactor: number;
}

const PRESET_MOTIF_MAP: Record<string, number> = {
  cato: 0,
  vesper: 5,
  aether: 2,
  kinetix: 3,
  meridian: 4,
  oubli: 1,
};

export function hashBrandName(rawName: string): NameSeed {
  const trimmed = rawName.trim();
  const cleanName = trimmed.length > 0 ? trimmed : 'Cato';
  let h1 = 2166136261;
  let h2 = 16777619;
  for (let i = 0; i < cleanName.length; i++) {
    const code = cleanName.charCodeAt(i) | 0;
    const lower = code >= 65 && code <= 90 ? code + 32 : code;
    h1 ^= lower;
    h1 = Math.imul(h1, 16777619);
    h2 ^= lower * (i + 1);
    h2 = Math.imul(h2, 2246822519);
  }
  const hash = Math.abs(h1 ^ h2);
  const presetMotif = PRESET_MOTIF_MAP[cleanName.toLowerCase()];
  const motifIndex = presetMotif !== undefined ? presetMotif : hash % 6;
  const harmonicRatio = ((hash >>> 3) % 100) / 100;
  const symmetryBias = (((hash >>> 7) % 100) / 100) * 2 - 1;
  const innerRingFactor = 0.32 + (((hash >>> 11) % 100) / 100) * 0.45;
  const domainSlug =
    cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '') || 'cato';

  return {
    cleanName,
    domainSlug,
    hash,
    motifIndex,
    harmonicRatio,
    symmetryBias,
    innerRingFactor,
  };
}

/* ---------------------------------------------------------------- */
/*  Blue-spectrum palette generator                                  */
/* ---------------------------------------------------------------- */

export interface PaletteSwatch {
  role: string;
  token: string;
  hex: string;
  rgb: readonly [number, number, number];
  contrastBadge: string;
  sharePct: number;
  usage: string;
}

const PRIMARY_STOPS: readonly (readonly [number, number, number])[] = [
  [18, 38, 200],   // Sage: #1226c8 Deep Ultramarine
  [46, 75, 255],   // Creator: #2e4bff Electric Blue
  [10, 24, 144],   // Ruler: #0a1890 Imperial Navy
  [65, 102, 255],  // Explorer: #4166ff Cobalt Signal
];

const ACCENT_STOPS: readonly (readonly [number, number, number])[] = [
  [107, 135, 255], // #6b87ff
  [147, 169, 255], // #93a9ff
  [46, 75, 255],   // #2e4bff
  [185, 201, 255], // #b9c9ff
];

function sampleRamp(
  stops: readonly (readonly [number, number, number])[],
  t: number,
): [number, number, number] {
  const x = clamp01(t) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [
    Math.round(lerp(a[0], b[0], f)),
    Math.round(lerp(a[1], b[1], f)),
    Math.round(lerp(a[2], b[2], f)),
  ];
}

export function rgbToHex(c: readonly [number, number, number]): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}

export function computePalette(arch: number, voice: number, struct: number): PaletteSwatch[] {
  const primRgb = sampleRamp(PRIMARY_STOPS, arch);
  // Voice shifts intensity slightly toward deeper or brighter electric blue
  const boostedPrimary: [number, number, number] = [
    Math.round(lerp(primRgb[0], 46, voice * 0.25)),
    Math.round(lerp(primRgb[1], 75, voice * 0.25)),
    Math.round(lerp(primRgb[2], 255, voice * 0.25)),
  ];
  const accentRgb = sampleRamp(ACCENT_STOPS, clamp01(arch * 0.7 + struct * 0.3));
  const deepRgb: [number, number, number] = [
    Math.round(lerp(10, 18, arch)),
    Math.round(lerp(20, 38, arch)),
    Math.round(lerp(128, 200, voice)),
  ];
  const iceRgb: [number, number, number] = [
    Math.round(lerp(238, 224, struct * 0.6)),
    Math.round(lerp(242, 234, struct * 0.6)),
    255,
  ];
  const paperRgb: [number, number, number] = [250, 251, 254];
  const inkRgb: [number, number, number] = [10, 12, 18];

  const primaryShare = Math.round(lerp(12, 24, voice));
  const deepShare = Math.round(lerp(8, 16, struct));
  const iceShare = Math.round(lerp(18, 24, 1 - voice));
  const inkShare = 14;
  const paperShare = 100 - primaryShare - deepShare - iceShare - inkShare;

  return [
    {
      role: 'Canvas / Paper',
      token: '--brand-paper',
      hex: rgbToHex(paperRgb),
      rgb: paperRgb,
      contrastBadge: '19.4:1 AAA',
      sharePct: paperShare,
      usage: 'Primary architectural field & negative space',
    },
    {
      role: 'Ice Surface',
      token: '--brand-ice',
      hex: rgbToHex(iceRgb),
      rgb: iceRgb,
      contrastBadge: '16.8:1 AAA',
      sharePct: iceShare,
      usage: 'Frosted containers, elevation planes & grids',
    },
    {
      role: 'Primary Signal',
      token: '--brand-signal',
      hex: rgbToHex(boostedPrimary),
      rgb: boostedPrimary,
      contrastBadge: '6.2:1 AA+',
      sharePct: primaryShare,
      usage: 'Logomark core, active controls & focal beacons',
    },
    {
      role: 'Spectral Accent',
      token: '--brand-azure',
      hex: rgbToHex(accentRgb),
      rgb: accentRgb,
      contrastBadge: '4.6:1 AA',
      sharePct: deepShare,
      usage: 'Refractive secondary geometry & data callouts',
    },
    {
      role: 'Anchor Ink',
      token: '--brand-ink',
      hex: rgbToHex(inkRgb),
      rgb: inkRgb,
      contrastBadge: '19.4:1 AAA',
      sharePct: inkShare,
      usage: 'Display typography, wordmark & structural rules',
    },
  ];
}

/* ---------------------------------------------------------------- */
/*  Typography pairing & scale generator                             */
/* ---------------------------------------------------------------- */

export interface TypePairingSpec {
  id: string;
  name: string;
  rationale: string;
  displayFontFamily: string;
  displayLabel: string;
  displayWeight: number;
  displayTrackingEm: number;
  displayTransform: 'none' | 'uppercase';
  displayStyle: 'normal' | 'italic';
  secondaryFontFamily: string;
  secondaryLabel: string;
  monoFontFamily: string;
  monoLabel: string;
}

export interface TypeScaleRow {
  role: string;
  tag: string;
  remSize: string;
  pxSize: string;
  lineHeight: string;
  tracking: string;
  weight: number;
  fontFamily: string;
  sample: string;
}

export function computeTypePairing(
  cleanName: string,
  archIndex: number,
  voice: number,
  struct: number,
): { pairing: TypePairingSpec; scale: TypeScaleRow[] } {
  const isBold = voice >= 0.5;
  const isAvant = struct >= 0.5;

  const pairings: readonly TypePairingSpec[] = [
    /* 0: Sage */
    {
      id: 'editorial-rational',
      name: isAvant ? 'Neo-Editorial Serif + Technical Sans' : 'Rationalist Serif + Swiss Grotesque',
      rationale: 'Authority earned through clarity: high-contrast editorial serif headlines anchored by precision grotesque body copy.',
      displayFontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif',
      displayLabel: 'Editorial Serif (Optical Display)',
      displayWeight: isBold ? 700 : 500,
      displayTrackingEm: lerp(-0.025, -0.04, struct),
      displayTransform: 'none',
      displayStyle: 'normal',
      secondaryFontFamily: 'var(--font-sans)',
      secondaryLabel: 'Inter Variable (Text & UI)',
      monoFontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
      monoLabel: 'System Mono (Index & Coordinates)',
    },
    /* 1: Creator */
    {
      id: 'swiss-geometric',
      name: isAvant ? 'Kinetic Grotesque + Architectural Mono' : 'Swiss Neo-Grotesque + Optical Sans',
      rationale: 'Engineered for makers: tight optical display proportions with tabular technical metadata.',
      displayFontFamily: 'var(--font-sans)',
      displayLabel: 'Inter Display (ss01 · cv11)',
      displayWeight: isBold ? 700 : 600,
      displayTrackingEm: lerp(-0.035, -0.052, struct),
      displayTransform: 'none',
      displayStyle: 'normal',
      secondaryFontFamily: 'var(--font-sans)',
      secondaryLabel: 'Inter Text (450 Book)',
      monoFontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
      monoLabel: 'System Mono (Spec Telemetry)',
    },
    /* 2: Ruler */
    {
      id: 'imperial-monument',
      name: isAvant ? 'Monumental All-Caps + Editorial Serif' : 'Institutional Sans + Sovereign Serif',
      rationale: 'Built to govern the category: disciplined architectural letterspacing that holds command at every scale.',
      displayFontFamily: 'var(--font-sans)',
      displayLabel: isBold ? 'Inter Monumental (700 Uppercase)' : 'Inter Architectural (600)',
      displayWeight: isBold ? 700 : 600,
      displayTrackingEm: isBold ? lerp(0.06, 0.14, struct) : lerp(-0.03, 0.04, struct),
      displayTransform: isBold ? 'uppercase' : 'none',
      displayStyle: 'normal',
      secondaryFontFamily: 'Georgia, "Iowan Old Style", serif',
      secondaryLabel: 'Editorial Serif (Longform)',
      monoFontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
      monoLabel: 'System Mono (Audit Ledger)',
    },
    /* 3: Explorer */
    {
      id: 'frontier-telemetry',
      name: isAvant ? 'Telemetry Display + Field Mono' : 'Expedition Grotesque + Technical Mono',
      rationale: 'High-velocity legibility under field conditions: crisp geometric forms paired with coordinate-grade monospace.',
      displayFontFamily: 'var(--font-sans)',
      displayLabel: 'Inter Frontier (Open Aperture)',
      displayWeight: isBold ? 700 : 550,
      displayTrackingEm: lerp(-0.02, -0.045, struct),
      displayTransform: 'none',
      displayStyle: 'normal',
      secondaryFontFamily: 'var(--font-sans)',
      secondaryLabel: 'Inter Utility (500 Medium)',
      monoFontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
      monoLabel: 'System Mono (Wayfinding & Telemetry)',
    },
  ];

  const pairing = pairings[archIndex] ?? pairings[1];
  const d1Rem = lerp(3.1, 4.0, voice).toFixed(2);
  const h2Rem = lerp(2.0, 2.55, voice).toFixed(2);
  const h3Rem = lerp(1.3, 1.55, voice).toFixed(2);

  const scale: TypeScaleRow[] = [
    {
      role: 'Display Flagship',
      tag: 'H1 / Hero',
      remSize: `${d1Rem}rem`,
      pxSize: `${Math.round(parseFloat(d1Rem) * 16)}px`,
      lineHeight: isAvant ? '0.96' : '1.02',
      tracking: `${pairing.displayTrackingEm.toFixed(3)}em`,
      weight: pairing.displayWeight,
      fontFamily: pairing.displayFontFamily,
      sample: `${cleanName} — Infrastructure for the category.`,
    },
    {
      role: 'Section Architecture',
      tag: 'H2 / Title',
      remSize: `${h2Rem}rem`,
      pxSize: `${Math.round(parseFloat(h2Rem) * 16)}px`,
      lineHeight: '1.06',
      tracking: '-0.032em',
      weight: isBold ? 650 : 600,
      fontFamily: pairing.displayFontFamily,
      sample: 'Every surface speaks the same truth.',
    },
    {
      role: 'System Subhead',
      tag: 'H3 / Module',
      remSize: `${h3Rem}rem`,
      pxSize: `${Math.round(parseFloat(h3Rem) * 16)}px`,
      lineHeight: '1.18',
      tracking: '-0.020em',
      weight: 600,
      fontFamily: 'var(--font-sans)',
      sample: `How ${cleanName} governs product, pitch and support.`,
    },
    {
      role: 'Editorial Body',
      tag: 'Body / Lede',
      remSize: '1.06rem',
      pxSize: '17px',
      lineHeight: '1.65',
      tracking: '-0.010em',
      weight: 450,
      fontFamily: pairing.secondaryFontFamily,
      sample:
        'Positioning flows into customer psychology. The thesis states what the brand believes; the system makes that belief hold everywhere.',
    },
    {
      role: 'Telemetry & Index',
      tag: 'Micro / Spec',
      remSize: '0.72rem',
      pxSize: '11.5px',
      lineHeight: '1.40',
      tracking: '0.240em',
      weight: 600,
      fontFamily: pairing.monoFontFamily,
      sample: `SYS.04 // ${cleanName.toUpperCase()} IDENTITY SPECIFICATION`,
    },
  ];

  return { pairing, scale };
}

/* ---------------------------------------------------------------- */
/*  Voice & Narrative Matrix (Thesis, Headline, Product/Support)     */
/* ---------------------------------------------------------------- */

export interface VoiceOutput {
  headline: string;
  thesis: string;
  productLine: string;
  tagline: string;
  tonePillars: readonly [string, string, string];
}

const HEADLINE_MATRIX: readonly (readonly (readonly [string, string])[])[] = [
  /* Sage */
  [
    ['Considered systems for people who notice.', 'Quiet instruments for the next century.'],
    ['We make evidence irresistible.', 'The future, measured — then claimed.'],
  ],
  /* Creator */
  [
    ['Useful things, engineered beautifully.', 'New forms for enduring needs.'],
    ['Built to be remade.', 'We design the standard. Then we ship it.'],
  ],
  /* Ruler */
  [
    ['Order, made visible.', 'The operating standard, rewritten.'],
    ['Own the category. Every surface.', 'Set the standard, or answer to it.'],
  ],
  /* Explorer */
  [
    ['Provisions for the territory ahead.', 'Instruments for uncharted work.'],
    ['Go further. The system holds.', 'Off the map. By architecture.'],
  ],
];

const THESIS_TEMPLATES: readonly (readonly [string, string])[] = [
  /* Sage */
  [
    '{name} believes clarity is the highest form of respect — replacing noise with verified evidence across every touchpoint.',
    '{name} turns complex domain truth into calm, unmistakable conviction that compounds trust over decades.',
  ],
  /* Creator */
  [
    '{name} treats every surface as a crafted product — uniting engineering rigor and editorial form in one living system.',
    '{name} exists to invent what the category assumed was impossible, with tools that feel inevitable on first touch.',
  ],
  /* Ruler */
  [
    '{name} establishes the definitive architecture for its market — governed, exact and unmistakable at every scale.',
    '{name} commands the category through structural discipline: one thesis, one standard, zero ambiguity.',
  ],
  /* Explorer */
  [
    '{name} builds infrastructure for the frontier — giving ambitious teams the instruments to move first with confidence.',
    '{name} maps new territory with precision hardware and adaptive software that never lose their bearings.',
  ],
];

const PRODUCT_SURFACE_TEMPLATES: readonly (readonly [string, string])[] = [
  /* Sage */
  [
    'All diagnostics verified. Your workspace is synchronized and ready for review.',
    'Evidence check complete — 3 high-confidence actions surfaced for Monday.',
  ],
  /* Creator */
  [
    'System compiled in 42 ms. Every token, component and surface is live.',
    'New build ready. Inspect the geometry or deploy straight to production.',
  ],
  /* Ruler */
  [
    'Governance policy active. All 14 organizational surfaces are holding specification.',
    'Command verified. System operating at 99.98% precision across all nodes.',
  ],
  /* Explorer */
  [
    'Coordinates locked. Route cleared for immediate deployment.',
    'Frontier node online — telemetry streaming live from all active sectors.',
  ],
];

const TONE_PILLARS: readonly (readonly [string, string, string])[] = [
  ['Empirical', 'Measured', 'Luminous'],
  ['Architectural', 'Tactile', 'Inventive'],
  ['Sovereign', 'Exact', 'Commanding'],
  ['Kinetic', 'Direct', 'Pioneering'],
];

export function computeVoice(
  cleanName: string,
  archIndex: number,
  voice: number,
  struct: number,
): VoiceOutput {
  const vi = voice < 0.5 ? 0 : 1;
  const si = struct < 0.5 ? 0 : 1;
  const headline = HEADLINE_MATRIX[archIndex]?.[vi]?.[si] ?? HEADLINE_MATRIX[1][0][0];
  const thesisRaw = THESIS_TEMPLATES[archIndex]?.[vi] ?? THESIS_TEMPLATES[1][0];
  const thesis = thesisRaw.replace(/\{name\}/g, cleanName);
  const productLine = PRODUCT_SURFACE_TEMPLATES[archIndex]?.[vi] ?? PRODUCT_SURFACE_TEMPLATES[1][0];
  const tonePillars = TONE_PILLARS[archIndex] ?? TONE_PILLARS[1];
  const tagline = `${ARCH_NAMES[archIndex]} · ${VOICE_NAMES[vi]} · ${STRUCT_NAMES[si]}`;

  return {
    headline,
    thesis,
    productLine,
    tagline,
    tonePillars,
  };
}

/* ---------------------------------------------------------------- */
/*  Procedural Geometric Logomark Grammar (2D SVG + 3D WebGL shared) */
/* ---------------------------------------------------------------- */

export interface MarkGeometrySpec {
  motifIndex: number;
  motifName: string;
  /** Primary stroke width in 100x100 viewBox units */
  strokeWidth: number;
  /** Secondary stroke width */
  subStrokeWidth: number;
  /** Corner fillet / radius in 100x100 viewBox units */
  cornerRadius: number;
  /** Axial cant / asymmetry (-1..1) */
  cant: number;
  /** Spread / aperture scale (0..1) */
  aperture: number;
  /** Satellite node coordinates in 100x100 viewBox */
  nodeX: number;
  nodeY: number;
  nodeR: number;
  /** Rotation of inner geometry in degrees */
  innerAngleDeg: number;
  /** Primary SVG path data */
  primaryPath: string;
  /** Secondary structural SVG path data */
  secondaryPath: string;
  /** Tertiary accent SVG path data */
  tertiaryPath: string;
  /** Primary & secondary hex colors */
  primaryColor: string;
  secondaryColor: string;
  deepColor: string;
  iceColor: string;
}

export function computeMarkGeometry(
  seed: NameSeed,
  dials: DialValues,
  overrideMotif: number | null = null,
): MarkGeometrySpec {
  const { arch, voice, struct } = dials;
  const motifIndex = overrideMotif !== null ? ((overrideMotif % 6) + 6) % 6 : seed.motifIndex;
  const motifName = MOTIF_NAMES[motifIndex];

  const palette = computePalette(arch, voice, struct);
  const primaryColor = palette[2].hex; // Primary Signal (#2e4bff range)
  const secondaryColor = palette[3].hex; // Spectral Azure
  const deepColor = '#1226c8';
  const iceColor = palette[1].hex;

  const strokeWidth = lerp(2.8, 9.6, voice);
  const subStrokeWidth = strokeWidth * 0.68;
  const cornerRadius = lerp(0.5, 11.5, struct);
  const asym = (arch - 0.33) * struct * 0.85 + seed.symmetryBias * struct * 0.25;
  const cant = Math.max(-0.65, Math.min(0.65, asym));
  const aperture = clamp01(lerp(0.36, 0.78, struct * 0.6 + seed.harmonicRatio * 0.4));
  const innerAngleDeg = Math.round(lerp(0, 45, struct) + seed.symmetryBias * 12);

  const nodeR = lerp(2.4, 5.2, voice);
  let nodeX = 50;
  let nodeY = 18;
  let primaryPath = '';
  let secondaryPath = '';
  let tertiaryPath = '';

  if (motifIndex === 0) {
    /* 0: Keystone Monolith (Architectural A-portal + precision crossbar + orbital node) */
    const apexX = 50 + cant * 16;
    const apexY = lerp(16, 12, voice);
    const spread = lerp(21, 28, aperture);
    const baseLX = 50 - spread * (1 + cant * 0.2);
    const baseRX = 50 + spread * (1 - cant * 0.15);
    const baseY = 85;
    const baseRY = baseY - cant * struct * 5;

    let d1x = apexX - baseLX;
    let d1y = apexY - baseY;
    const l1 = Math.hypot(d1x, d1y) || 1;
    d1x /= l1;
    d1y /= l1;
    let d2x = baseRX - apexX;
    let d2y = baseRY - apexY;
    const l2 = Math.hypot(d2x, d2y) || 1;
    d2x /= l2;
    d2y /= l2;
    const r = Math.min(cornerRadius, l1 * 0.4, l2 * 0.4);
    const p1x = apexX - d1x * r;
    const p1y = apexY - d1y * r;
    const p2x = apexX + d2x * r;
    const p2y = apexY + d2y * r;

    primaryPath = `M ${fmt(baseLX)} ${fmt(baseY)} L ${fmt(p1x)} ${fmt(p1y)} Q ${fmt(apexX)} ${fmt(apexY)} ${fmt(p2x)} ${fmt(p2y)} L ${fmt(baseRX)} ${fmt(baseRY)}`;

    const barT = clamp01(lerp(0.62, 0.46, struct));
    const lx = lerp(apexX, baseLX, barT);
    const ly = lerp(apexY, baseY, barT);
    const rx = lerp(apexX, baseRX, barT);
    const ry = lerp(apexY, baseRY, barT);
    secondaryPath = `M ${fmt(lx)} ${fmt(ly)} L ${fmt(rx)} ${fmt(ry)}`;

    const pillarH = lerp(8, 18, aperture);
    tertiaryPath = `M ${fmt(apexX)} ${fmt(barT * 85 - pillarH * 0.5)} L ${fmt(apexX)} ${fmt(barT * 85 + pillarH * 0.5)}`;
    nodeX = apexX + lerp(0, 22, struct);
    nodeY = lerp(apexY + 26, 20, struct);
  } else if (motifIndex === 1) {
    /* 1: Hexagonal Vault (Isometric architectural cube / hexagonal chamber) */
    const R = lerp(31, 36, aperture);
    const skew = cant * 7;
    const pts: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const a = ((i * 60 - 90) * Math.PI) / 180 + struct * 0.22;
      pts.push([50 + Math.cos(a) * R + (i % 2 === 0 ? skew : -skew * 0.4), 50 + Math.sin(a) * R]);
    }
    primaryPath =
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${fmt(p[0])} ${fmt(p[1])}`).join(' ') + ' Z';
    // Inner isometric Y-ribs
    const cx = 50 + cant * 8;
    const cy = 50 + (struct - 0.5) * 8;
    secondaryPath = `M ${fmt(pts[0][0])} ${fmt(pts[0][1])} L ${fmt(cx)} ${fmt(cy)} L ${fmt(pts[2][0])} ${fmt(pts[2][1])} M ${fmt(cx)} ${fmt(cy)} L ${fmt(pts[4][0])} ${fmt(pts[4][1])}`;
    const rIn = R * lerp(0.36, 0.52, seed.innerRingFactor);
    tertiaryPath = `M ${fmt(cx - rIn)} ${fmt(cy)} L ${fmt(cx)} ${fmt(cy - rIn)} L ${fmt(cx + rIn)} ${fmt(cy)} L ${fmt(cx)} ${fmt(cy + rIn)} Z`;
    nodeX = cx;
    nodeY = cy;
  } else if (motifIndex === 2) {
    /* 2: Orbital Meridian (Dual interlocking precision arcs + axial meridian spine) */
    const R = lerp(29, 34, aperture);
    const offset = lerp(6, 14, struct);
    const c1x = 50 - offset * 0.55;
    const c2x = 50 + offset * 0.55;
    primaryPath = `M ${fmt(c1x)} ${fmt(50 - R)} A ${fmt(R)} ${fmt(R)} 0 1 0 ${fmt(c1x)} ${fmt(50 + R)} A ${fmt(R * 0.82)} ${fmt(R)} 0 1 0 ${fmt(c1x)} ${fmt(50 - R)}`;
    secondaryPath = `M ${fmt(c2x)} ${fmt(50 - R * 0.78)} A ${fmt(R * 0.78)} ${fmt(R * 0.78)} 0 1 1 ${fmt(c2x)} ${fmt(50 + R * 0.78)} M ${fmt(16)} ${fmt(50)} L ${fmt(84)} ${fmt(50)}`;
    const tiltX = cant * 14;
    tertiaryPath = `M ${fmt(50 - tiltX)} ${fmt(16)} L ${fmt(50 + tiltX)} ${fmt(84)}`;
    nodeX = c2x + Math.cos(struct * 1.6) * (R * 0.78);
    nodeY = 50 - Math.sin(struct * 1.6) * (R * 0.78);
  } else if (motifIndex === 3) {
    /* 3: Cantilever Grid (Four Swiss architectural L-beams around a central aperture) */
    const outer = lerp(31, 35, aperture);
    const inner = lerp(9, 16, struct);
    const shift = cant * 6;
    primaryPath = [
      `M ${fmt(50 - outer)} ${fmt(50 - inner + shift)} L ${fmt(50 - inner)} ${fmt(50 - inner + shift)} L ${fmt(50 - inner)} ${fmt(50 - outer)}`,
      `M ${fmt(50 + inner)} ${fmt(50 - outer)} L ${fmt(50 + inner)} ${fmt(50 - inner - shift)} L ${fmt(50 + outer)} ${fmt(50 - inner - shift)}`,
      `M ${fmt(50 + outer)} ${fmt(50 + inner - shift)} L ${fmt(50 + inner)} ${fmt(50 + inner - shift)} L ${fmt(50 + inner)} ${fmt(50 + outer)}`,
      `M ${fmt(50 - inner)} ${fmt(50 + outer)} L ${fmt(50 - inner)} ${fmt(50 + inner + shift)} L ${fmt(50 - outer)} ${fmt(50 + inner + shift)}`,
    ].join(' ');
    const boxR = inner * lerp(0.85, 1.35, aperture);
    secondaryPath = `M ${fmt(50 - boxR)} ${fmt(50 - boxR)} L ${fmt(50 + boxR)} ${fmt(50 - boxR)} L ${fmt(50 + boxR)} ${fmt(50 + boxR)} L ${fmt(50 - boxR)} ${fmt(50 + boxR)} Z`;
    tertiaryPath = `M ${fmt(50 - outer * 0.75)} ${fmt(50 + outer * 0.75)} L ${fmt(50 + outer * 0.75)} ${fmt(50 - outer * 0.75)}`;
    nodeX = 50 + cant * 12;
    nodeY = 50 - cant * 12;
  } else if (motifIndex === 4) {
    /* 4: Harmonic Aperture (Precision architectural columns + framing arch) */
    const span = lerp(26, 32, aperture);
    const tilt = cant * 10;
    const h0 = lerp(22, 30, 1 - struct * 0.4);
    const h1 = lerp(32, 36, aperture);
    const h2 = lerp(20, 32, struct);
    const xL = 50 - span;
    const xM1 = 50 - span * 0.34;
    const xM2 = 50 + span * 0.34;
    const xR = 50 + span;
    primaryPath = [
      `M ${fmt(xL)} ${fmt(50 - h0)} L ${fmt(xL + tilt * 0.5)} ${fmt(50 + h0)}`,
      `M ${fmt(xM1)} ${fmt(50 - h1)} L ${fmt(xM1 + tilt * 0.5)} ${fmt(50 + h1)}`,
      `M ${fmt(xM2)} ${fmt(50 - h1)} L ${fmt(xM2 + tilt * 0.5)} ${fmt(50 + h1)}`,
      `M ${fmt(xR)} ${fmt(50 - h2)} L ${fmt(xR + tilt * 0.5)} ${fmt(50 + h2)}`,
    ].join(' ');
    secondaryPath = `M ${fmt(xL - 3)} ${fmt(50)} L ${fmt(xR + 3)} ${fmt(50)}`;
    const ringR = span * 0.78;
    tertiaryPath = `M ${fmt(50 - ringR)} ${fmt(50)} A ${fmt(ringR)} ${fmt(ringR)} 0 1 1 ${fmt(50 + ringR)} ${fmt(50)}`;
    nodeX = xR + tilt * 0.25;
    nodeY = 50 - h2 - 8;
  } else {
    /* 5: Delta Prism Triad (Interlocking delta prism + refracted horizon vectors) */
    const topX = 50 + cant * 14;
    const topY = 16;
    const botLX = 18;
    const botRX = 82;
    const botY = 80;
    primaryPath = `M ${fmt(topX)} ${fmt(topY)} L ${fmt(botRX)} ${fmt(botY)} L ${fmt(botLX)} ${fmt(botY)} Z`;
    const inTopX = 50 - cant * 8;
    const inBotY = lerp(68, 74, aperture);
    const inMidY = lerp(36, 44, struct);
    secondaryPath = `M ${fmt(inTopX)} ${fmt(inBotY)} L ${fmt(32)} ${fmt(inMidY)} L ${fmt(68)} ${fmt(inMidY)} Z`;
    tertiaryPath = `M ${fmt(14)} ${fmt(54)} L ${fmt(50)} ${fmt(48 - struct * 10)} L ${fmt(86)} ${fmt(42 + struct * 14)}`;
    nodeX = topX;
    nodeY = lerp(52, 42, struct);
  }

  return {
    motifIndex,
    motifName,
    strokeWidth,
    subStrokeWidth,
    cornerRadius,
    cant,
    aperture,
    nodeX,
    nodeY,
    nodeR,
    innerAngleDeg,
    primaryPath,
    secondaryPath,
    tertiaryPath,
    primaryColor,
    secondaryColor,
    deepColor,
    iceColor,
  };
}

/** Builds a clean, standalone SVG file string for download. */
export function buildStandaloneSvgString(
  cleanName: string,
  mark: MarkGeometrySpec,
  recipe: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512" role="img" aria-label="${cleanName} Identity Mark — ${recipe}">
  <title>${cleanName} — ${mark.motifName} (${recipe})</title>
  <desc>Generated by the Cato Labs Identity Engine</desc>
  <rect width="100" height="100" rx="18" fill="#fafbfe"/>
  <circle cx="50" cy="50" r="38" fill="none" stroke="#dce4ff" stroke-width="0.6" stroke-dasharray="2 2"/>
  <path d="${mark.tertiaryPath}" fill="none" stroke="${mark.secondaryColor}" stroke-width="${fmt(mark.subStrokeWidth * 0.72)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
  <path d="${mark.primaryPath}" fill="none" stroke="${mark.primaryColor}" stroke-width="${fmt(mark.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${mark.secondaryPath}" fill="none" stroke="${mark.deepColor}" stroke-width="${fmt(mark.subStrokeWidth)}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${fmt(mark.nodeX)}" cy="${fmt(mark.nodeY)}" r="${fmt(mark.nodeR)}" fill="${mark.primaryColor}"/>
</svg>`;
}

/* ---------------------------------------------------------------- */
/*  Shared module-level bus (DOM Identity Engine → WebGL Scene)      */
/* ---------------------------------------------------------------- */

export interface BrandBusState {
  brandName: string;
  motifIndex: number;
  arch: number;
  voice: number;
  struct: number;
  cant: number;
  aperture: number;
  strokeWeightNorm: number;
  activeStep: number;
  assemblyPulseAt: number;
  focusedApp: number; // -1 = all, 0 = card, 1 = icon, 2 = signage, 3 = web
}

export const brandBus: BrandBusState = {
  brandName: 'Cato',
  motifIndex: 0,
  arch: 1 / 3,
  voice: 0.38,
  struct: 0.44,
  cant: 0.04,
  aperture: 0.56,
  strokeWeightNorm: 0.38,
  activeStep: 5,
  assemblyPulseAt: 0,
  focusedApp: -1,
};

export function syncBrandBus(patch: Partial<BrandBusState>): void {
  Object.assign(brandBus, patch);
}

export function triggerBrandAssemblyPulse(): void {
  brandBus.assemblyPulseAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
}
