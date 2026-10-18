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
import { workIndex, cases, restingArtDetail } from '@/lib/content/work';
import { blogIndex, sampleArticle } from '@/lib/content/blog';

export const dynamic = 'force-static';

/**
 * llms-full.txt — the extended AI-facing profile: complete practice
 * narratives with deliverables, practice-area and specialism detail,
 * industry market truths, region local angles, the documented case
 * study, and full approach-stage narratives.
 * Every string is imported from the copy deck.
 */
export function GET(): Response {
  const featuredCase = cases.find((c) => c.featured) ?? cases[0];

  const lines: string[] = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    '## About',
    '',
    site.description,
    '',
    home.manifesto.statement,
    '',
    home.manifesto.body,
    '',
    '## Practices — full narratives',
    '',
    capabilitiesPage.hero.sub,
    '',
  ];

  for (const p of practices) {
    lines.push(
      `### ${p.index} — ${p.title}`,
      '',
      p.short,
      '',
      p.narrative,
      '',
      'Deliverables:',
      '',
      ...p.deliverables.map((d) => `- ${d}`),
      '',
    );
  }

  lines.push('## Practice areas — in depth', '');

  for (const c of Object.values(capabilityChildren)) {
    lines.push(
      `### ${c.crumbLabel}`,
      '',
      `${site.url}/capabilities/${c.slug}`,
      '',
      c.lede,
      '',
    );
    for (const f of c.features) {
      lines.push(`- **${f.title}**: ${f.body}`);
    }
    lines.push('', `**${c.detail.title}** ${c.detail.body}`, '');
  }

  lines.push('## AI agent specialisms — in depth', '');

  for (const c of Object.values(agentChildren)) {
    lines.push(
      `### ${c.crumbLabel}`,
      '',
      `${site.url}/capabilities/ai-agent-systems/${c.slug}`,
      '',
      c.lede,
      '',
    );
    for (const f of c.features) {
      lines.push(`- **${f.title}**: ${f.body}`);
    }
    lines.push('', `**${c.detail.title}** ${c.detail.body}`, '');
  }

  lines.push('## Industries — market truths', '', industriesIndex.lede, '');

  for (const i of industries) {
    lines.push(
      `### ${i.crumbLabel}`,
      '',
      `${site.url}/industries/${i.slug}`,
      '',
      i.lede,
      '',
      `**Market truth:** ${i.marketTruth}`,
      '',
    );
    for (const p of i.plays) {
      lines.push(`- **${p.title}**: ${p.body}`);
    }
    lines.push('');
  }

  lines.push('## Regions — local angles', '', regionsIndex.lede, '');

  for (const r of regions) {
    lines.push(
      `### ${r.city} (${r.region})`,
      '',
      `${site.url}/regions/${r.slug}`,
      '',
      r.lede,
      '',
    );
    for (const a of r.localAngles) {
      lines.push(`- **${a.title}**: ${a.body}`);
    }
    lines.push('');
  }

  lines.push(
    `## Case study — ${featuredCase.client}`,
    '',
    `${site.url}/work/${featuredCase.slug}`,
    '',
    featuredCase.headline,
    '',
    featuredCase.summary,
    '',
    'Outcomes:',
    '',
    ...featuredCase.outcomePoints.map((o) => `- **${o.metric}** — ${o.label}`),
    '',
  );

  for (const s of restingArtDetail.sections) {
    lines.push(`### ${s.index} — ${s.title}`, '', s.body, '');
  }

  lines.push(
    `> ${restingArtDetail.pullQuote.text}`,
    '',
    `— ${restingArtDetail.pullQuote.attribution}`,
    '',
  );

  lines.push('## Approach — full narratives', '', approachPage.hero.sub, '');

  for (const s of approachStages) {
    lines.push(
      `### ${s.index} — ${s.title}`,
      '',
      `*${s.question}*`,
      '',
      s.narrative,
      '',
    );
  }

  lines.push(
    '## Journal',
    '',
    blogIndex.lede,
    '',
    `Sample essay: [${sampleArticle.title}](${site.url}/blog/the-anatomy-of-delight) (${sampleArticle.date}, ${sampleArticle.readTime}) — ${sampleArticle.dek}`,
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
  );

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
