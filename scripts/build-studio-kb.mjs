#!/usr/bin/env node
/*
 * Builds a knowledge base for every studio site's concierge.
 *
 * Each page is rendered in a real browser (agent-browser / Chrome) so that content the page
 * generates at runtime — hash-routed detail views, season tabs, dialogs, tables filled from
 * script data — is captured, not just the static HTML. The page's own script data constants
 * (COURSES, PRODUCTS, PIECES …) and its JSON-LD are captured as well.
 *
 * Output: lib/studio-kb/<slug>.md (one file per site, committed, read by /api/studio-agent).
 * Usage: node scripts/build-studio-kb.mjs [--base http://localhost:3123] [slug ...]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const BASE = baseIdx !== -1 ? args[baseIdx + 1] : 'http://localhost:3123';
const only = args.filter((a, i) => !a.startsWith('--') && (baseIdx === -1 || i !== baseIdx + 1));
const SESSION = 'studio-kb';

const sites = readdirSync(resolve(root, 'public/studio-sites'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => f.replace(/\.html$/, ''))
  .filter((s) => !only.length || only.includes(s));

function ab(...a) {
  return execFileSync('agent-browser', ['--session', SESSION, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}
function evalJs(code) {
  const out = ab('eval', code);
  try {
    return JSON.parse(JSON.parse(out));
  } catch {
    try {
      return JSON.parse(out);
    } catch {
      return out;
    }
  }
}

/* Runs inside the page. Returns {sections, views, data, jsonld, tabs}. Kept self-contained. */
const EXTRACT = String.raw`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (t) => (t || '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  const SKIP = '#concierge-root, script, style, noscript, template, svg, canvas, .sm-loader, [aria-hidden="true"]:not(img)';

  // Readable text from a subtree: headings become markdown, lists become bullets, tables rows.
  function text(rootEl) {
    const out = [];
    const walk = (n) => {
      if (n.nodeType === 3) { out.push(n.textContent); return; }
      if (n.nodeType !== 1) return;
      const el = n;
      if (el.matches(SKIP)) {
        if (el.getAttribute && el.hasAttribute('aria-label') && el.matches('[data-sx-split]')) out.push(el.getAttribute('aria-label'));
        return;
      }
      // Split-text wrappers keep their accessible name: use it once.
      if (el.dataset && el.dataset.sxSplit) { out.push(el.getAttribute('aria-label') || ''); return; }
      const tag = el.tagName;
      if (tag === 'IMG') { const a = el.getAttribute('alt'); if (a) out.push(' [image: ' + a + '] '); return; }
      if (/^H[1-6]$/.test(tag)) { out.push('\n\n' + '#'.repeat(Math.min(6, Number(tag[1]) + 1)) + ' '); el.childNodes.forEach(walk); out.push('\n'); return; }
      if (tag === 'TR') { const cells = Array.from(el.children).map((c) => clean(c.innerText)); out.push('\n| ' + cells.join(' | ') + ' |'); return; }
      if (tag === 'LI') { out.push('\n- '); el.childNodes.forEach(walk); return; }
      if (tag === 'DT') { out.push('\n- **'); el.childNodes.forEach(walk); out.push('**: '); return; }
      if (tag === 'BR') { out.push('\n'); return; }
      const block = /^(P|DIV|SECTION|ARTICLE|HEADER|FOOTER|UL|OL|DL|TABLE|FIGURE|FIGCAPTION|BLOCKQUOTE|FORM|FIELDSET|LABEL)$/.test(tag);
      if (block) out.push('\n');
      el.childNodes.forEach(walk);
      if (block) out.push('\n');
    };
    walk(rootEl);
    return clean(out.join('').replace(/[ \t]*\n[ \t]*/g, '\n'));
  }

  const res = { title: document.title, description: document.querySelector('meta[name="description"]')?.content || '', sections: [], views: [], tabs: [], dialogs: [], data: {}, jsonld: [] };

  // JSON-LD
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => { try { res.jsonld.push(JSON.parse(s.textContent)); } catch {} });

  // Main page sections, in order.
  const main = document.querySelector('main') || document.body;
  const secs = main.querySelectorAll(':scope section, :scope > div > section');
  const seen = new Set();
  (secs.length ? secs : [main]).forEach((sec) => {
    if (seen.has(sec) || sec.closest('[hidden]') || sec.matches('.view, [role="dialog"]')) return;
    seen.add(sec);
    const h = sec.querySelector('h1, h2');
    res.sections.push({ id: sec.id || '', title: h ? clean(h.getAttribute('aria-label') || h.innerText) : '', text: text(sec) });
  });
  const foot = document.querySelector('footer');
  if (foot) res.sections.push({ id: 'footer', title: 'Footer', text: text(foot) });

  // Tabs (e.g. seasons): click each and capture the panel it controls.
  const tablists = document.querySelectorAll('[role="tablist"]');
  for (const tl of tablists) {
    const tabs = Array.from(tl.querySelectorAll('[role="tab"]'));
    for (const tab of tabs) {
      tab.click(); await sleep(250);
      const panelId = tab.getAttribute('aria-controls');
      const scope = tl.closest('section') || document.body;
      const panel = (panelId && document.getElementById(panelId)) || scope;
      res.tabs.push({ group: clean(tl.getAttribute('aria-label') || ''), tab: clean(tab.innerText), text: text(scope), panel: panel ? text(panel) : '' });
    }
    tabs[0]?.click();
  }

  // Hash-routed detail views: collect every "#/..." link, visit each, read the view.
  const routes = Array.from(new Set(Array.from(document.querySelectorAll('a[href^="#/"]')).map((a) => a.getAttribute('href'))));
  for (const r of routes) {
    location.hash = r; await sleep(450);
    const view = Array.from(document.querySelectorAll('.view, #view, [id^="view"], [role="dialog"], .sheet, .dossier, .dossier-backdrop'))
      .find((v) => { const cs = getComputedStyle(v); return !v.hidden && cs.display !== 'none' && cs.visibility !== 'hidden' && v.innerText.trim().length > 40; });
    if (view) res.views.push({ route: r, text: text(view) });
  }
  history.replaceState(null, '', location.pathname); dispatchEvent(new HashChangeEvent('hashchange')); await sleep(250);

  // Buttons that open dialogs / sheets (data-dialog, data-open-*).
  const openers = Array.from(document.querySelectorAll('[data-dialog], [data-open-sheet], [data-open-booking], [data-open-dossier], [data-prefill-project], button[aria-haspopup="dialog"]'));
  const done = new Set();
  for (const b of openers) {
    const key = b.getAttribute('data-dialog') || b.getAttribute('data-open-sheet') || b.getAttribute('data-open-dossier') || b.innerText.trim();
    if (done.has(key)) continue; done.add(key);
    try { b.click(); } catch {}
    await sleep(350);
    const d = Array.from(document.querySelectorAll('dialog[open], [role="dialog"]:not([hidden]), .sheet[open], .sheet[data-open="true"], .dossier-backdrop.is-open, .is-open[role="dialog"]'))
      .find((v) => getComputedStyle(v).display !== 'none' && v.innerText.trim().length > 40 && !v.closest('#concierge-root'));
    if (d) res.dialogs.push({ opener: clean(b.innerText || key), text: text(d) });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.querySelectorAll('dialog[open]').forEach((x) => { try { x.close(); } catch {} });
    await sleep(150);
  }

  // The page's own data constants, by reading top-level const/let declarations in inline scripts.
  const src = Array.from(document.querySelectorAll('script:not([src]):not([type="application/ld+json"]):not([type="application/json"]):not([type="importmap"])'))
    .filter((s) => s.id !== 'studio-concierge-js').map((s) => s.textContent).join('\n');
  const names = Array.from(new Set(Array.from(src.matchAll(/(?:const|let|var)\s+([A-Z][A-Z_0-9]{2,})\s*=\s*[\[{]/g)).map((m) => m[1])));
  for (const name of names) {
    // Evaluate the literal in isolation; bail on anything that references page variables.
    const m = src.match(new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*'));
    if (!m) continue;
    let i = m.index + m[0].length, depth = 0, inStr = null, esc = false, j = i;
    for (; j < src.length; j++) {
      const ch = src[j];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === inStr) inStr = null; continue; }
      if (ch === '"' || ch === "'" || ch === '\x60') { inStr = ch; continue; }
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') { depth--; if (depth === 0) { j++; break; } }
    }
    const lit = src.slice(i, j);
    try {
      const v = new Function('"use strict"; return (' + lit + ');')();
      const json = JSON.stringify(v, (k, x) => (typeof x === 'function' ? undefined : x));
      if (json && json.length > 20) res.data[name] = JSON.parse(json);
    } catch {}
  }
  return JSON.stringify(res);
})()`;

function stripHtml(s) {
  return String(s)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h\d|li|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&[lr]squo;/g, "'")
    .replace(/&[lr]dquo;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/* Turn a page data constant into readable markdown (objects of records, arrays of records). */
function dataToMd(name, value) {
  const lines = [];
  const recordToMd = (rec, key) => {
    if (rec === null || typeof rec !== 'object') return `- ${key ? `**${key}**: ` : ''}${stripHtml(rec)}`;
    const head = rec.name || rec.title || rec.ttl || rec.label || rec.short || rec.code || rec.slug || key || '';
    const parts = [`### ${stripHtml(head)}${rec.jp ? ` (${rec.jp})` : ''}${rec.n !== undefined ? ` — course ${rec.n}` : ''}`];
    for (const [k, v] of Object.entries(rec)) {
      if (v === '' || v === null || v === undefined) continue;
      if (['art', 'img', 'image', 'images', 'svg', 'icon', 'color', 'colors', 'hex', 'theme'].includes(k)) continue;
      if (Array.isArray(v)) {
        if (v.every((x) => Array.isArray(x) && x.length === 2)) parts.push(`- **${k}**:\n${v.map(([a, b]) => `  - ${stripHtml(a)}: ${stripHtml(b)}`).join('\n')}`);
        else if (v.every((x) => typeof x !== 'object')) parts.push(`- **${k}**: ${v.map(stripHtml).join('; ')}`);
        else parts.push(`- **${k}**:\n${v.map((x) => '  - ' + (typeof x === 'object' ? Object.entries(x).map(([a, b]) => `${a}: ${stripHtml(typeof b === 'object' ? JSON.stringify(b) : b)}`).join(' · ') : stripHtml(x))).join('\n')}`);
      } else if (typeof v === 'object') parts.push(`- **${k}**: ${Object.entries(v).map(([a, b]) => `${a}: ${stripHtml(typeof b === 'object' ? JSON.stringify(b) : b)}`).join(' · ')}`);
      else parts.push(`- **${k}**: ${stripHtml(v)}`);
    }
    return parts.join('\n');
  };
  lines.push(`## Data: ${name}`);
  if (Array.isArray(value)) value.forEach((r, i) => lines.push(recordToMd(r, String(i + 1))));
  else if (value && typeof value === 'object') {
    const vals = Object.values(value);
    if (vals.every((x) => x && typeof x === 'object')) Object.entries(value).forEach(([k, r]) => lines.push(recordToMd(r, k)));
    else lines.push(Object.entries(value).map(([k, v]) => `- **${k}**: ${stripHtml(typeof v === 'object' ? JSON.stringify(v) : v)}`).join('\n'));
  }
  return lines.join('\n\n');
}

function toMarkdown(slug, r) {
  const out = [];
  out.push(`# Knowledge base: ${r.title}`);
  out.push(`Source: /studio-sites/${slug}.html — rendered and captured ${new Date().toISOString().slice(0, 10)}. Everything below is published on the site itself.`);
  if (r.description) out.push(`> ${r.description}`);
  out.push('\n# Page, in order');
  for (const s of r.sections) {
    if (!s.text) continue;
    out.push(`\n## Section${s.id ? ` #${s.id}` : ''}${s.title ? `: ${s.title}` : ''}\n${s.text}`);
  }
  if (r.tabs.length) {
    out.push('\n# Tabbed content (every tab)');
    for (const t of r.tabs) out.push(`\n## ${t.group ? t.group + ' — ' : ''}${t.tab}\n${t.panel || t.text}`);
  }
  if (r.views.length) {
    out.push('\n# Detail pages');
    for (const v of r.views) out.push(`\n## Detail page ${v.route}\n${v.text}`);
  }
  if (r.dialogs.length) {
    out.push('\n# Dialogs and sheets');
    for (const d of r.dialogs) out.push(`\n## ${d.opener}\n${d.text}`);
  }
  const dataNames = Object.keys(r.data);
  if (dataNames.length) {
    out.push('\n# Structured data used by the page');
    for (const n of dataNames) out.push('\n' + dataToMd(n, r.data[n]));
  }
  if (r.jsonld.length) out.push('\n# Structured data (JSON-LD)\n```json\n' + JSON.stringify(r.jsonld, null, 1) + '\n```');
  // De-duplicate long repeated prose paragraphs only (detail pages often repeat page copy).
  // Short structured rows (menu items, spec lines) are kept so lists stay complete per tab.
  const seen = new Set();
  return out
    .join('\n')
    .split(/\n{2,}/)
    .filter((block) => {
      const k = block.trim();
      if (k.length < 200 || /^(- |\| |### |## |# )/.test(k)) return true;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n') + '\n';
}

mkdirSync(resolve(root, 'lib/studio-kb'), { recursive: true });
try { ab('set', 'viewport', '1440', '900'); } catch {}
// Reduced motion: count-ups, split text and reveals render their final state immediately.
try { ab('set', 'media', 'light', 'reduced-motion'); } catch {}
for (const slug of sites) {
  process.stdout.write(`${slug} … `);
  ab('open', `${BASE}/studio-sites/${slug}.html`);
  ab('wait', '2500');
  // Reduced motion so reveal animations don't hide text; wait for runtime-rendered lists.
  const r = evalJs(EXTRACT);
  if (!r || typeof r !== 'object') {
    console.log('FAILED to extract');
    continue;
  }
  const md = toMarkdown(slug, r);
  writeFileSync(resolve(root, 'lib/studio-kb', `${slug}.md`), md, 'utf8');
  console.log(`${(md.length / 1024).toFixed(1)} KB · ${r.sections.length} sections · ${r.views.length} views · ${r.tabs.length} tabs · ${r.dialogs.length} dialogs · data: ${Object.keys(r.data).join(', ') || 'none'}`);
}
try { ab('close'); } catch {}
