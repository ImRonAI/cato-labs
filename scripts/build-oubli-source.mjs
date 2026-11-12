#!/usr/bin/env node
/**
 * Builds public/studio-session/oubliai.json — the source code the Cato Studio session on
 * /capabilities/digital-products writes while it builds oubliai.com.
 *
 * Every file is the production source of oubliai.com. Its SHA-1 must equal the uid Vercel
 * recorded for the production deployment named below, or the script stops: the session only
 * ever shows code that is really running at oubliai.com.
 *
 * Comments are removed (they are working notes, not shipped code). The removal is checked:
 * TypeScript files must re-parse cleanly and transpile to the same program as the original.
 * Each file is then tokenized once with Shiki, so the browser ships no highlighter.
 *
 * usage: node scripts/build-oubli-source.mjs [path-to-oubli-checkout]
 *   default checkout: ~/oubli-snapshot/.snapshots/oubli-next-pre-emrys-20261104
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { createHighlighter } from 'shiki';

const ROOT = path.resolve(
  process.argv[2] ?? path.join(os.homedir(), 'oubli-snapshot/.snapshots/oubli-next-pre-emrys-20261104'),
);
const OUT = path.resolve('public/studio-session/oubliai.json');

/* Production deployment of the Vercel project "oubli" (aliased to oubliai.com). The uids are
   the file hashes from the deployment's source tree (Vercel: list deployment files). */
const DEPLOYMENT = 'dpl_HjoWgZQhVCfwm4aTNhJaJQRb7Kwn';
const MANIFEST = [
  ['package.json', '4c7316c0ebee81d65215e03a5c9ed21276e10112'],
  ['next.config.ts', 'eaa8c49d3ea496d6989d3729c03512312707f91b'],
  ['tsconfig.json', '7675c635fde9fc4367e7757b08589557c11fea09'],
  ['vercel.json', 'cc4ad9b6daf691e993e24d957478b6f13f34e682'],
  ['src/app/layout.tsx', '79652fe22524aacb8c89160136bdd04287d68e6f'],
  ['src/app/page.tsx', 'e7bd2cb66ca0c273042534876eed75fa31fe8345'],
  ['src/app/globals.css', '901442fa035767678375223cc6f4576f76f47657'],
  ['src/app/page.module.css', '9aa14cfef2bb782a25ea950f85df14001d7d5f64'],
  ['src/app/products/page.tsx', '6f741a10c0d35de5dc7700793aabaa6f89644f30'],
  ['src/app/products/[slug]/page.tsx', '7a0f84a6b796bdee5467eeb72ac192597b25b7cd'],
  ['src/app/ui/[slug]/[screen]/route.ts', '95032038998b4f5b55f8fdc9a7d8c9151de3e712'],
  ['src/components/Experience.tsx', '02ef8cff4903e51179d2957d08cb132e9b177410'],
  ['src/components/HomeJourney.tsx', 'e8efa6d48c8e60937519efd65c7ad8142c5d9365'],
  ['src/components/SiteHeader.tsx', '5efe7a1521e957150b3fbb5c984a0902273c7b20'],
  ['src/components/portfolio/FlatScreen.tsx', '7f624769b4e9e2676e8db421bc1e3af93a32b7c1'],
  ['src/components/portfolio/GalleryControls.tsx', 'e38c81658b985d9e734e28ee3dedf5354cbd9269'],
  ['src/components/portfolio/ProductGallery.tsx', '46a217d1744ff3ace83fb779ad97cb3d457ac693'],
  ['src/components/portfolio/ScreenList.tsx', 'e3f768380de25ee623b2267ec519a76f9292885b'],
  ['src/components/scene/CameraDirector.tsx', '42f3852b4bcafd23716cfc0905cd97dca2df67f0'],
  ['src/components/scene/CanonicalRubik.tsx', 'f2a2b4c9e1708acea35803ec82cff1ab0cc27a9c'],
  ['src/components/scene/DesertEnvironment.tsx', 'dab7b954e4f53cf3ab749e8d71c69920345b5121'],
  ['src/components/scene/Effects.tsx', '8a0bbba05891d26a2d673c49cf4fbab99b64a0cb'],
  ['src/components/scene/Gallery.tsx', '790353752c18d0d8084fd3ca3fb8ceb52c699517'],
  ['src/components/scene/InteriorChamber.tsx', '03cc92ff28813c5d9024e2d4f4179f68d1ec9f7b'],
  ['src/components/scene/PalmSprings.tsx', '2c0d8a3ba29d66c36226686f30b40f8b3cab1c7b'],
  ['src/components/scene/SceneHost.tsx', 'cec969a218750a49e5038807fe58503f38214763'],
  ['src/components/scene/sculptures.tsx', '479f8b5d586fa50c709959188e358cb78ce30704'],
  ['src/data/placeholder-ui.ts', '7d3381ab5146700d078834e45b68a2a1430ec383'],
  ['src/data/products.ts', 'f20890e6969a75b982978cf92e9b73460cdad457'],
  ['src/scene/carve.ts', '1700dae2a8083fc3941b76f11c530a512bdfaa14'],
  ['src/scene/cluster.ts', '693af0b30700597a83d5647b7cf1361468d78388'],
  ['src/scene/director-constants.ts', 'b08219999900691efe1282ed20f4287dd069d77d'],
  ['src/scene/director.ts', 'e9d04baa5c46e27ef63cd30bb45926795e86ef6f'],
  ['src/scene/experience.ts', 'c5d7b859b1cf92db717ce128f8ffcbc2cc02b75c'],
  ['src/scene/gallery-store.ts', 'dc6f0027be5f3097b6e3ed2d41d6fe6a3d6b1984'],
  ['src/scene/particles.ts', '4d8eed27f102732984fd11d91e7109c875621f7b'],
  ['src/scene/portfolio.ts', '89eb53decba6e2f4ab4b71a2de36c7aa345b5af7'],
  ['src/scene/rubik-materials.ts', '60613bfeb287c6fd4d537199e25c4d98913ffc17'],
  ['src/scene/sculpture-forms.ts', '58b27c0361d268b6f5ce9f58d8fb77acbf87ea6a'],
  ['src/scene/selection.ts', '71c95ea3b18956026d811829e1bb5fe44e2d4624'],
  ['src/scene/util.ts', '6fd725e72b1b270d2215897ac7bce57277d4aa37'],
];
/* Deployed binaries: listed in the session's file tree, never shown as text. */
const BINARIES = [
  'public/fonts/InterVariable.woff2',
  'public/fonts/DMMono-Regular.woff2',
  'public/fonts/DMMono-Medium.woff2',
  'src/app/favicon.ico',
];

/* The session's code theme: Cato ink, blurple keywords, Oubli's peach for strings. */
const THEME = {
  name: 'cato-studio',
  type: 'dark',
  colors: { 'editor.background': '#0b0d14', 'editor.foreground': '#d3d8ea' },
  settings: [
    { settings: { foreground: '#d3d8ea', background: '#0b0d14' } },
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#596079', fontStyle: 'italic' } },
    {
      scope: [
        'keyword',
        'keyword.control',
        'storage',
        'storage.type',
        'storage.modifier',
        'keyword.operator.new',
        'keyword.operator.expression',
        'keyword.operator.typeof',
        'keyword.other.important.css',
      ],
      settings: { foreground: '#a395ff' },
    },
    { scope: ['keyword.operator', 'punctuation', 'meta.brace', 'punctuation.separator', 'punctuation.terminator'], settings: { foreground: '#717a9b' } },
    { scope: ['string', 'string.quoted', 'string.template', 'punctuation.definition.string', 'string.unquoted'], settings: { foreground: '#ffc99c' } },
    { scope: ['punctuation.definition.template-expression', 'punctuation.section.embedded'], settings: { foreground: '#a395ff' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character', 'keyword.other.unit'], settings: { foreground: '#ff9d87' } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call', 'variable.function'], settings: { foreground: '#7fc8ff' } },
    {
      scope: ['entity.name.type', 'support.type', 'entity.name.class', 'support.class', 'entity.other.inherited-class', 'meta.type.annotation'],
      settings: { foreground: '#cbbcff' },
    },
    { scope: ['support.type.primitive', 'support.type.builtin'], settings: { foreground: '#cbbcff' } },
    { scope: ['entity.name.tag', 'support.class.component', 'entity.name.tag.tsx'], settings: { foreground: '#8eaaff' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#b4a6ff', fontStyle: 'italic' } },
    { scope: ['variable.parameter'], settings: { foreground: '#ecdcff' } },
    { scope: ['variable.other.property', 'meta.object-literal.key', 'support.variable.property'], settings: { foreground: '#b9c5ff' } },
    { scope: ['variable.other.constant', 'variable.other.enummember'], settings: { foreground: '#e6eaff' } },
    { scope: ['support.type.property-name.json', 'support.type.property-name'], settings: { foreground: '#8eaaff' } },
    { scope: ['entity.name.tag.css', 'entity.other.attribute-name.class.css', 'entity.other.attribute-name.id.css', 'entity.other.attribute-name.pseudo-class.css', 'entity.other.attribute-name.pseudo-element.css'], settings: { foreground: '#cbbcff', fontStyle: '' } },
    { scope: ['support.type.property-name.css'], settings: { foreground: '#8eaaff' } },
    { scope: ['support.constant.property-value.css', 'constant.other.color.rgb-value', 'support.constant.color', 'support.constant.font-name'], settings: { foreground: '#ffc99c' } },
    { scope: ['variable.css', 'variable.argument.css', 'support.type.custom-property', 'variable.parameter.custom-property'], settings: { foreground: '#9fe7da' } },
    { scope: ['keyword.control.at-rule', 'keyword.control.at-rule.media.css'], settings: { foreground: '#a395ff' } },
  ],
};

const LANG = (p) => (p.endsWith('.tsx') ? 'tsx' : p.endsWith('.ts') ? 'typescript' : p.endsWith('.css') ? 'css' : 'json');

/* ---------------------------------------------------------------- comment removal */

/** Drops marked character ranges, then tidies the lines they touched. */
function applyRemovals(text, ranges) {
  const dead = new Uint8Array(text.length);
  for (const [a, b] of ranges) dead.fill(1, a, b);
  const out = [];
  let lineStart = 0;
  let blankRun = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i < text.length && text[i] !== '\n') continue;
    let line = '';
    let touched = false;
    for (let j = lineStart; j < i; j++) {
      if (dead[j]) touched = true;
      else line += text[j];
    }
    lineStart = i + 1;
    if (touched) {
      line = line.replace(/\s+$/, '');
      if (line.trim() === '') continue; // a line that only held a comment
    }
    if (line.trim() === '') {
      blankRun++;
      if (blankRun > 1 || out.length === 0) continue;
    } else blankRun = 0;
    out.push(line);
  }
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return `${out.join('\n')}\n`;
}

function stripTs(text, file) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const ranges = new Map();
  const add = (list) => {
    for (const r of list ?? []) ranges.set(r.pos, Math.max(r.end, ranges.get(r.pos) ?? 0));
  };
  const visit = (node) => {
    if (node.kind !== ts.SyntaxKind.JsxText) {
      add(ts.getLeadingCommentRanges(text, node.getFullStart()));
      add(ts.getTrailingCommentRanges(text, node.getEnd()));
    }
    /* {/* note *\/} in JSX: the braces go with the comment */
    if (ts.isJsxExpression(node) && !node.expression) ranges.set(node.getStart(sf), node.getEnd());
    for (const child of node.getChildren(sf)) visit(child);
  };
  visit(sf);
  const out = applyRemovals(text, [...ranges.entries()]);

  /* proof: the stripped file parses, and compiles to the same program as the original */
  const sf2 = ts.createSourceFile(file, out, ts.ScriptTarget.Latest, true, kind);
  if (sf2.parseDiagnostics?.length) {
    throw new Error(`${file}: stripped source no longer parses: ${sf2.parseDiagnostics[0].messageText}`);
  }
  const emit = (src) =>
    ts
      .transpileModule(src, {
        fileName: file,
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          removeComments: true,
          target: ts.ScriptTarget.ESNext,
          module: ts.ModuleKind.ESNext,
        },
      })
      .outputText.replace(/\s+/g, '');
  if (emit(text) !== emit(out)) throw new Error(`${file}: comment removal changed the program`);
  return out;
}

function stripCss(text, file) {
  const ranges = [];
  const re = /\/\*[\s\S]*?\*\//g;
  for (let m; (m = re.exec(text)); ) ranges.push([m.index, m.index + m[0].length]);
  const out = applyRemovals(text, ranges);
  const count = (s, ch) => s.split(ch).length - 1;
  if (count(out, '{') !== count(text.replace(re, ''), '{') || count(out, '}') !== count(text.replace(re, ''), '}')) {
    throw new Error(`${file}: comment removal changed the stylesheet`);
  }
  return out;
}

/* ---------------------------------------------------------------- build */

const highlighter = await createHighlighter({ themes: [THEME], langs: ['tsx', 'typescript', 'css', 'json'] });

const palette = [];
const paletteIndex = new Map();
const swatch = (color, italic) => {
  const key = `${(color ?? '#d3d8ea').toLowerCase()}${italic ? ' i' : ''}`;
  if (!paletteIndex.has(key)) {
    paletteIndex.set(key, palette.length);
    palette.push(key);
  }
  return paletteIndex.get(key);
};

swatch('#d3d8ea', false); // index 0: the base ink, also used for whitespace runs
const files = [];
let totalLines = 0;
for (const [rel, uid] of MANIFEST) {
  const abs = path.join(ROOT, rel);
  const raw = readFileSync(abs);
  const sha = createHash('sha1').update(raw).digest('hex');
  if (sha !== uid) {
    throw new Error(`${rel}: SHA-1 ${sha} does not match production uid ${uid} (${DEPLOYMENT})`);
  }
  const text = raw.toString('utf8');
  const lang = LANG(rel);
  const code = lang === 'tsx' || lang === 'typescript' ? stripTs(text, rel) : lang === 'css' ? stripCss(text, rel) : text;

  const { tokens } = highlighter.codeToTokens(code.replace(/\n$/, ''), { lang, theme: 'cato-studio' });
  const lines = tokens.map((line) => {
    const merged = [];
    for (const tok of line) {
      const italic = typeof tok.fontStyle === 'number' && tok.fontStyle > 0 && (tok.fontStyle & 1) === 1;
      const ci = /^\s+$/.test(tok.content) ? 0 : swatch(tok.color, italic);
      const last = merged[merged.length - 1];
      if (last && (last[0] === ci || /^\s+$/.test(tok.content))) last[1] += tok.content;
      else merged.push([ci, tok.content]);
    }
    return merged;
  });
  totalLines += lines.length;
  files.push({ path: rel, lang, lines });
}
mkdirSync(path.dirname(OUT), { recursive: true });
const payload = {
  v: 1,
  source: { project: 'oubli', domain: 'oubliai.com', deployment: DEPLOYMENT },
  palette,
  totalLines,
  files,
  binaries: BINARIES,
};
writeFileSync(OUT, JSON.stringify(payload));
const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1);
console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${files.length} files, ${totalLines} lines, ${palette.length} colours, ${kb} KB`);
