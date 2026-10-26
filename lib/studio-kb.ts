import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Per-site knowledge bases for the studio concierges.
 * Built by `node scripts/build-studio-kb.mjs` from the rendered pages (all sections, every tab,
 * every hash-routed detail page, dialogs, and the page's own data such as COURSES or PRODUCTS).
 */
const SLUG = /^[a-z0-9-]{1,40}$/;
const cache = new Map<string, string | null>();

export function studioKnowledgeBase(slug: string | undefined): string | null {
  if (!slug || !SLUG.test(slug)) return null;
  if (cache.has(slug)) return cache.get(slug)!;
  const file = resolve(process.cwd(), 'lib/studio-kb', `${slug}.md`);
  const kb = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (process.env.NODE_ENV === 'production') cache.set(slug, kb);
  return kb;
}

/** Derive the site slug from the page the widget is running on. */
export function slugFromPath(path: unknown): string | undefined {
  if (typeof path !== 'string') return undefined;
  const m = /\/studio-sites\/([a-z0-9-]{1,40})\.html/.exec(path);
  return m?.[1];
}
