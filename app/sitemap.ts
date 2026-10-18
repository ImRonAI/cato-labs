import type { MetadataRoute } from 'next';
import { site } from '@/lib/content';
import { capabilityChildren } from '@/lib/content/capabilities';
import { agentChildren } from '@/lib/content/agentsChildren';
import { industries } from '@/lib/content/industries';
import { regions } from '@/lib/content/regions';
import { cases } from '@/lib/content/work';
import { posts } from '@/lib/content/blog';

/**
 * Sitemap — every route on the site, derived from the copy decks so
 * new pages are picked up automatically. lastModified is evaluated per
 * request so crawlers always see deploy-fresh timestamps.
 *
 * Priority tiers:
 *   1.00 home
 *   0.90 section indexes (capabilities, work, industries, regions)
 *   0.85 capability children
 *   0.80 blog index + AI-agent specialisms
 *   0.75 industry / region children + the documented case study
 *   0.70 approach, contact, journal articles
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const entry = (
    path: string,
    priority: number,
    changeFrequency: 'monthly' | 'yearly' = 'monthly',
  ): MetadataRoute.Sitemap[number] => ({
    url: path === '/' ? site.url : `${site.url}${path}`,
    lastModified,
    changeFrequency,
    priority,
  });

  return [
    entry('/', 1),

    // Section indexes
    entry('/capabilities', 0.9),
    entry('/work', 0.9),
    entry('/industries', 0.9),
    entry('/regions', 0.9),

    // Capability children
    ...Object.keys(capabilityChildren).map((slug) =>
      entry(`/capabilities/${slug}`, 0.85),
    ),

    // Blog index + AI-agent specialisms
    entry('/blog', 0.8),
    ...Object.keys(agentChildren).map((slug) =>
      entry(`/capabilities/ai-agent-systems/${slug}`, 0.8),
    ),

    // Industry + region children
    ...industries.map((i) => entry(`/industries/${i.slug}`, 0.75)),
    ...regions.map((r) => entry(`/regions/${r.slug}`, 0.75)),

    // The documented engagement — a stable artifact, yearly cadence
    ...cases
      .filter((c) => c.slug === 'resting-art')
      .map((c) => entry(`/work/${c.slug}`, 0.75, 'yearly')),

    // Approach, contact, journal articles
    entry('/approach', 0.7),
    entry('/contact', 0.7),
    ...posts
      .filter((p) => p.status === 'sample')
      .map((p) => entry(`/blog/${p.slug}`, 0.7)),
  ];
}
