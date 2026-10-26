import Link from 'next/link';
import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { capabilityChildren } from '@/lib/content/capabilities';
import { agentChildren, type AgentChildSlug } from '@/lib/content/agentsChildren';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import { journeyStops } from '@/lib/content/agentJourney';
import CatoVoice from './CatoVoice';
import DjTrack from './DjTrack';
import ToolingDemo from './ToolingDemo';
import JourneyNav from './JourneyNav';
import './page.css';
import './journey.css';

const copy = capabilityChildren['ai-agent-systems'];

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Capabilities', path: '/capabilities' },
    { name: copy.crumbLabel, path: `/capabilities/${copy.slug}` },
  ],
  service: {
    name: copy.crumbLabel,
    description: copy.lede,
    url: `/capabilities/${copy.slug}`,
  },
  faq: copy.faq,
});

const GRAND_ORDER: AgentChildSlug[] = [
  'voice-ai',
  'generative-ui',
  'customer-experience',
  'knowledge-architecture',
];
const grands = GRAND_ORDER.map((slug) => agentChildren[slug]);

export const metadata = pageMetadata({
  title: 'AI & Agent Systems',
  description: copy.lede,
  path: '/capabilities/ai-agent-systems',
  keywords: [
    'AI agent systems',
    'voice AI agents',
    'generative UI',
    'customer experience AI',
    'knowledge architecture',
    'agent persona design',
  ],
});

/** First clause of a lede — the one-line teaser for the sub-index cards. */
function oneLine(lede: string): string {
  const cuts = [lede.indexOf(' — '), lede.indexOf('. ')].filter((n) => n > 0);
  const at = cuts.length ? Math.min(...cuts) : -1;
  return (at > 0 ? lede.slice(0, at) : lede).trim();
}

/**
 * /capabilities/ai-agent-systems — the flagship child page and parent of the
 * four agent specialisms. Section ids: hero, journey (nine stops), feature,
 * faq, cta (hero/faq/cta rendered by ChildPageShell). Copy: @/lib/content only.
 */
export default function AiAgentSystemsPage() {
  return (
    <>
      <ChildPageShell
        crumbs={[
          { label: 'Capabilities', href: '/capabilities' },
          { label: copy.crumbLabel },
        ]}
        eyebrow={copy.eyebrow}
        titleLines={copy.titleLines}
        lede={copy.lede}
        faq={copy.faq}
        cta={copy.cta}
      >
        <JsonLd data={jsonLd} />
        {/* ---------- journey: nine stops; Cato performs at each, then falls to the next ---------- */}
        <div data-scene-section="journey" className="aas-journey" aria-label="What Cato does">
          {journeyStops.map((stop, i) => (
            <section key={stop.id} id={stop.id} className="aas-stop" aria-labelledby={`${stop.id}-title`}>
              <div className="aas-stop-copy container-x">
                <Reveal className="micro-label" delay={0}>
                  <span className="index-no">{String(i + 1).padStart(2, '0')}</span> {stop.eyebrow}
                </Reveal>
                <Reveal as="h2" className="h2 aas-stop-title" delay={0.08}>
                  <span id={`${stop.id}-title`}>
                    {stop.titleLines[0]}
                    <br />
                    {stop.titleLines[1]}
                  </span>
                </Reveal>
                <Reveal as="p" className="body-lg aas-stop-body" delay={0.16}>
                  {stop.body}
                </Reveal>
                <Reveal delay={0.22}>
                  <ul className="tag-list aas-stop-tags">
                    {stop.tags.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </Reveal>
                {stop.id === 'entertainment' && <DjTrack />}
                {stop.id === 'tooling' && <ToolingDemo />}
                <JourneyNav index={i} />
              </div>
            </section>
          ))}
        </div>

        {/* ---------- feature: the three pillars + the four specialisms ---------- */}
        <section
          data-scene-section="feature"
          className="container-x section-y-sm"
          aria-label="What a Cato agent is made of"
        >
          <Reveal className="micro-label" delay={0}>
            What we build
          </Reveal>
          <div className="aas-feats">
            {copy.features.map((f, i) => (
              <Reveal key={f.index} className="aas-feat" delay={i * 0.08}>
                <span className="index-no aas-feat-no" aria-hidden="true">
                  {f.index}
                </span>
                <h2 className="h3 aas-feat-title">
                  <ProximityType>{f.title}</ProximityType>
                </h2>
                <p className="body-lg aas-feat-body">{f.body}</p>
              </Reveal>
            ))}
          </div>

          <nav className="aas-sub" aria-label="The four agent specialisms">
            <Reveal className="micro-label" delay={0}>
              The four specialisms
            </Reveal>
            <ul className="aas-sub-grid">
              {grands.map((g, i) => (
                <li key={g.slug}>
                  <Reveal delay={i * 0.06} style={{ height: '100%' }}>
                    <Link
                      className="aas-sub-card"
                      href={`/capabilities/ai-agent-systems/${g.slug}`}
                    >
                      <span className="index-no" aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="aas-sub-title">{g.crumbLabel}</span>
                      <span className="aas-sub-line">{oneLine(g.lede)}</span>
                      <span className="aas-sub-arrow" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </nav>
        </section>

      </ChildPageShell>

      <CatoVoice />
    </>
  );
}
