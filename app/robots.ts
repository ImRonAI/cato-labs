import type { MetadataRoute } from 'next';
import { site } from '@/lib/content';

/**
 * Robots — open web. Everyone is allowed everywhere, and the major
 * AI/LLM crawlers get an explicit, named welcome with their own
 * Allow rules so there is no ambiguity about our posture.
 */
const aiCrawlers = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: [...aiCrawlers], allow: '/' },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
