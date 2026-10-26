#!/usr/bin/env node
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const require = createRequire('/Users/tims-stuff/TelnyxMCP/packages/app/package.json');
const esbuild = require('esbuild');

const WIDGET_CSS = readFileSync(resolve(root, 'studio-kit/src/concierge.css'), 'utf8').trim();

/* AI Elements and the shadcn primitives they use are styled with Tailwind utility classes.
   Compile them with the project's Tailwind v4, then scope every rule to #concierge-root so the
   host sites are untouched. The widget's own stylesheet follows, so its art direction wins. */
const postcss = (await import(resolve(root, 'node_modules/postcss/lib/postcss.js'))).default;
const twMod = await import(resolve(root, 'node_modules/@tailwindcss/postcss/dist/index.js'));
const tailwind = twMod.default?.default || twMod.default || twMod;
const twFrom = resolve(root, 'studio-kit/src/tailwind.css');
const scope = {
  postcssPlugin: 'scope-concierge',
  Once(css) {
    css.walkRules((rule) => {
      const parent = rule.parent;
      if (parent && parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return;
      rule.selectors = rule.selectors.map((sel) => {
        const s = sel.trim();
        if (s.startsWith('#concierge-root')) return s;
        if (s === ':root' || s === ':host' || s === 'html' || s === 'body') return '#concierge-root';
        if (/^(:root|:host)\b/.test(s)) return s.replace(/^(:root|:host)/, '#concierge-root');
        if (s === '*' || s.startsWith('*') || s.startsWith('::')) return `#concierge-root ${s}, #concierge-root${s.startsWith('::') ? s : ''}`.replace(/, #concierge-root$/, '');
        return `#concierge-root ${s}`;
      });
    });
    // Unwrap cascade layers: unlayered host-site resets would otherwise beat every utility.
    css.walkAtRules('layer', (at) => {
      if (at.nodes && at.nodes.length) at.replaceWith(at.nodes);
      else at.remove();
    });
  },
};
const twResult = await postcss([tailwind({ base: root, optimize: { minify: true } }), scope]).process(readFileSync(twFrom, 'utf8'), { from: twFrom });
const CONCIERGE_CSS = `${twResult.css}\n${WIDGET_CSS}`;
const { SITES } = await import(resolve(root, 'studio-kit/sites.mjs'));

const aliasPlugin = {
  name: 'studio-concierge-alias',
  setup(build) {
    build.onResolve({ filter: /^@\/registry\/(default|new-york-v4)\/ui\// }, (args) => {
      const name = args.path.split('/').pop();
      return { path: resolve(root, 'studio-kit/vendor/ui', `${name}.tsx`) };
    });
    build.onResolve({ filter: /^@\// }, (args) => {
      const rel = args.path.slice(2);
      const candidates = [
        resolve(root, rel),
        resolve(root, `${rel}.ts`),
        resolve(root, `${rel}.tsx`),
        resolve(root, `${rel}/index.ts`),
        resolve(root, `${rel}/index.tsx`),
      ];
      for (const c of candidates) {
        if (existsSync(c)) return { path: c };
      }
      return { path: resolve(root, rel) };
    });
    build.onResolve({ filter: /^(@streamdown\/(mermaid|code|math|cjk)|shiki)$/ }, (args) => ({
      path: args.path,
      namespace: 'shim',
    }));
    build.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({
      contents: `
        export const createCodePlugin = () => undefined;
        export const code = undefined;
        export const mermaid = undefined;
        export const math = undefined;
        export const cjk = undefined;
        export const bundledLanguages = {};
        export const createHighlighter = async () => ({ codeToTokens: () => ({ tokens: [] }) });
        export default undefined;
      `,
      loader: 'js',
    }));
  },
};

const result = await esbuild.build({
  entryPoints: [resolve(root, 'studio-kit/src/index.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  jsx: 'automatic',
  plugins: [aliasPlugin],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

const rawJs = result.outputFiles[0].text;
const safeInlineJs = rawJs.replace(/<\/script/gi, '<\\/script');

// Also write standalone assets to public/studio-concierge/
const outDir = resolve(root, 'public/studio-concierge');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'concierge.css'), CONCIERGE_CSS, 'utf8');
writeFileSync(resolve(outDir, 'concierge.js'), rawJs, 'utf8');

const BEGIN_MARKER = '<!-- STUDIO-CONCIERGE:BEGIN -->';
const END_MARKER = '<!-- STUDIO-CONCIERGE:END -->';

const MOTION_BEGIN = '<!-- STUDIO-MOTION:BEGIN -->';
const MOTION_END = '<!-- STUDIO-MOTION:END -->';
const motionVersion = Date.now().toString(36);

function jsonForScript(value) {
  return JSON.stringify(value, null, 2).replace(/</g, '\\u003c');
}

function mergeConciergeContext(html, site, file) {
  const re = /(<script[^>]*id="concierge-context"[^>]*>)([\s\S]*?)(<\/script>)/;
  const m = re.exec(html);
  if (!m) throw new Error(`Missing concierge-context in ${file}`);
  const ctx = JSON.parse(m[2]);
  if (site.tone) ctx.tone = site.tone;
  if (site.locations) ctx.locations = site.locations;
  return html.slice(0, m.index) + m[1] + '\n' + jsonForScript(ctx) + '\n' + m[3] + html.slice(m.index + m[0].length);
}

const injectionBlock = `${BEGIN_MARKER}
<style id="studio-concierge-css">${CONCIERGE_CSS}</style>
<script id="studio-concierge-js">${safeInlineJs}</script>
${END_MARKER}`;

const sitesDir = resolve(root, 'public/studio-sites');
const files = readdirSync(sitesDir).filter((f) => f.endsWith('.html')).sort();

for (const file of files) {
  const fullPath = resolve(sitesDir, file);
  let html = readFileSync(fullPath, 'utf8');
  const slug = file.replace(/\.html$/, '');
  const site = SITES[slug];
  if (site) html = mergeConciergeContext(html, site, file);

  // Motion layer: stylesheet in <head>, config + module before </body>.
  const ms = html.indexOf(MOTION_BEGIN);
  if (ms !== -1) {
    const me = html.indexOf(MOTION_END, ms);
    html = html.slice(0, ms) + html.slice(me + MOTION_END.length);
  }
  html = html.replace(/\n?<link rel="stylesheet" href="\/studio-motion\/motion\.css[^"]*" data-studio-motion>/, '');
  if (existsSync(resolve(root, `public/studio-motion/${slug}.js`))) {
    const motionBlock = `${MOTION_BEGIN}
<script type="module" src="/studio-motion/${slug}.js?v=${motionVersion}"></script>
${MOTION_END}
`;
    html = html.replace(BEGIN_MARKER, motionBlock + BEGIN_MARKER);
  }

  const startIdx = html.indexOf(BEGIN_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Missing STUDIO-CONCIERGE markers in ${file}`);
  }
  const updated =
    html.slice(0, startIdx) +
    injectionBlock +
    html.slice(endIdx + END_MARKER.length);
  writeFileSync(fullPath, updated, 'utf8');
  console.log(`Injected Studio Concierge${site ? ' + Motion' : ''} into public/studio-sites/${file} (${(updated.length / 1024).toFixed(1)} KB)`);
}
