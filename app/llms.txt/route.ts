import {
  site,
  home,
  practices,
  approachStages,
  capabilitiesPage,
  approachPage,
  contactPage,
} from '@/lib/content';
import { capabilityChildren } from '@/lib/content/capabilities';
import { agentChildren } from '@/lib/content/agentsChildren';
import { industries, industriesIndex } from '@/lib/content/industries';
import { regions, regionsIndex } from '@/lib/content/regions';
import { workIndex, cases } from '@/lib/content/work';
import { blogIndex, posts } from '@/lib/content/blog';

export const dynamic = 'force-static';

/**
 * llms.txt — the AI-facing front door (llmstxt.org convention).
 * Concise and factual; every string is imported from the copy deck.
 */
export function GET(): Response {
  const featuredCase = cases.find((c) => c.featured) ?? cases[0];
  const samplePost = posts.find((p) => p.status === 'sample') ?? posts[0];

  const lines: string[] = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    `Extended profile for AI systems: ${site.url}/llms-full.txt`,
    '',
    '## About',
    '',
    site.description,
    '',
    '## What Cato Labs does',
    '',
    capabilitiesPage.hero.sub,
    '',
    ...practices.map((p) => `- **${p.title}**: ${p.short}`),
    '',
    '## Practice areas',
    '',
    ...Object.values(capabilityChildren).map(
      (c) => `- [${c.crumbLabel}](${site.url}/capabilities/${c.slug}) — ${c.lede}`,
    ),
    '',
    '## AI agent specialisms',
    '',
    ...Object.values(agentChildren).map(
      (c) =>
        `- [${c.crumbLabel}](${site.url}/capabilities/ai-agent-systems/${c.slug}) — ${c.lede}`,
    ),
    '',
    '## Industries',
    '',
    industriesIndex.lede,
    '',
    ...industries.map(
      (i) => `- [${i.crumbLabel}](${site.url}/industries/${i.slug}) — ${i.lede}`,
    ),
    '',
    '## Regions',
    '',
    regionsIndex.lede,
    '',
    ...regions.map(
      (r) =>
        `- [${r.crumbLabel}](${site.url}/regions/${r.slug}) — ${r.lede} Local angles: ${r.localAngles.map((a) => a.title).join('; ')}.`,
    ),
    '',
    '## How Cato thinks',
    '',
    home.approachTeaser.body,
    '',
    ...approachStages.map((s) => `${s.index}. **${s.title}** — ${s.question}`),
    '',
    '## Work',
    '',
    workIndex.lede,
    '',
    `- [${featuredCase.client} — case study](${site.url}/work/${featuredCase.slug}) — ${featuredCase.summary}`,
    '',
    '## Journal',
    '',
    blogIndex.lede,
    '',
    `- [${samplePost.title}](${site.url}/blog/${samplePost.slug}) — ${samplePost.dek}`,
    '',
    '## Key facts',
    '',
    `- Tagline: ${site.tagline}`,
    `- Also stated as: ${site.taglineExtended}`,
    `- Contact: ${site.email}`,
    `- Domain: ${site.url}`,
    '',
    '## Pages',
    '',
    `- [Home](${site.url}/) — ${home.hero.sub}`,
    `- [Capabilities](${site.url}/capabilities) — ${capabilitiesPage.hero.sub}`,
    `- [Work](${site.url}/work) — ${workIndex.lede}`,
    `- [Industries](${site.url}/industries) — ${industriesIndex.lede}`,
    `- [Regions](${site.url}/regions) — ${regionsIndex.lede}`,
    `- [Approach](${site.url}/approach) — ${approachPage.hero.sub}`,
    `- [Journal](${site.url}/blog) — ${blogIndex.lede}`,
    `- [Contact](${site.url}/contact) — ${contactPage.hero.sub}`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
