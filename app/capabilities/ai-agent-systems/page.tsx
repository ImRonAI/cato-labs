import Link from 'next/link';
import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { capabilityChildren } from '@/lib/content/capabilities';
import { agentChildren, type AgentChildSlug } from '@/lib/content/agentsChildren';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import { ProactiveBubble } from '@/components/kit/ProactiveBubble';
import AgentPersona from './AgentPersona';
import SignatureDwell from './SignatureDwell';
import './page.css';

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
 * four agent specialisms. Section ids: hero, signature, feature, detail,
 * persona, faq, cta (hero/faq/cta rendered by ChildPageShell). Copy: @/lib/content only.
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
        {/* ---------- signature: the domino relay (GL scrubs this dwell) ---------- */}
        <SignatureDwell
          label="The four specialisms"
          steps={grands.map((g) => g.crumbLabel)}
          at={[0.41, 0.6, 0.79, 0.965]}
        />
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

        {/* ---------- detail: the work + bullets ---------- */}
        <section
          data-scene-section="detail"
          className="container-x section-y-sm"
          aria-label={copy.detail.eyebrow}
        >
          <div className="aas-detail-grid">
            <div>
              <Reveal className="micro-label" delay={0}>
                {copy.detail.eyebrow}
              </Reveal>
              <Reveal as="h2" className="h2 aas-detail-title" delay={0.08}>
                <ProximityType>{copy.detail.title}</ProximityType>
              </Reveal>
              <Reveal as="p" className="body-lg aas-detail-body" delay={0.16}>
                {copy.detail.body}
              </Reveal>
            </div>
            <Reveal delay={0.22}>
              <ul className="tag-list aas-detail-tags" aria-label="Deliverables">
                {copy.detail.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ---------- persona: Your Cato Agent, composed live + locally ---------- */}
        <section
          data-scene-section="persona"
          id="persona"
          className="aas-persona container-x section-y"
          aria-label="Your Cato Agent"
        >
          <Reveal className="micro-label" delay={0}>
            Live — read locally
          </Reveal>
          <Reveal as="h2" className="h2 aas-persona-title" delay={0.08}>
            <ProximityType>
              Your Cato Agent<span className="text-accent">.</span>
            </ProximityType>
          </Reveal>
          <Reveal as="p" className="lede aas-persona-lede" delay={0.16}>
            Your browser already said hello — the signals on the left never
            leave this page. On the right, the agent they brief.
          </Reveal>
          <AgentPersona />
        </section>
      </ChildPageShell>

      <ProactiveBubble
        agentName="Meridian"
        message="I'm Meridian, a Cato agent. Your browser has already briefed me — come see what I'd know about you."
        ctaLabel="Meet your agent"
        ctaHref="#persona"
        triggerSection="detail"
      />
    </>
  );
}
