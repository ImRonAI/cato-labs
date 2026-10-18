import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { agentChildren } from '@/lib/content/agentsChildren';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import SignatureDwell from '../SignatureDwell';
import './page.css';

const copy = agentChildren['customer-experience'];

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Capabilities', path: '/capabilities' },
    { name: 'AI & Agent Systems', path: '/capabilities/ai-agent-systems' },
    { name: copy.crumbLabel, path: `/capabilities/ai-agent-systems/${copy.slug}` },
  ],
  service: {
    name: copy.crumbLabel,
    description: copy.lede,
    url: `/capabilities/ai-agent-systems/${copy.slug}`,
  },
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: 'Customer Experience',
  description: copy.lede,
  path: '/capabilities/ai-agent-systems/customer-experience',
  keywords: [
    'AI concierge',
    'customer experience AI',
    'AI customer support agent',
    'human handoff escalation',
    'brand persona design',
  ],
});

/** Feature whose h2 glints under the GL hotspot (scene reports 'cx-handoff'). */
const PROX_FEATURE = 2; // '03 — Escalation with judgment'

/**
 * AI & Agent Systems — Customer Experience.
 * Section ids are CONTRACT: hero, feature, detail, faq, cta — the WebGL
 * scene ("The Handoff") reads them from the scroll store.
 */
export default function CustomerExperiencePage() {
  return (
    <ChildPageShell
      crumbs={[
        { label: 'Capabilities', href: '/capabilities' },
        { label: 'AI & Agent Systems', href: '/capabilities/ai-agent-systems' },
        { label: copy.crumbLabel },
      ]}
      eyebrow={copy.eyebrow}
      titleLines={copy.titleLines}
      lede={copy.lede}
      faq={copy.faq}
      cta={copy.cta}
    >
      <JsonLd data={jsonLd} />
      <SignatureDwell
        label={copy.crumbLabel}
        steps={copy.features.map((f) => f.title)}
      />
      {/* ---------------------------- features ---------------------------- */}
      <section
        data-scene-section="feature"
        className="cx-features container-x"
        aria-label="Features"
      >
        {copy.features.map((f, i) => (
          <article
            key={f.index}
            className={`cx-feature${i % 2 === 1 ? ' cx-feature--alt' : ''}`}
          >
            <span className="cx-feature-ghost" aria-hidden="true">
              {f.index}
            </span>
            <div className="cx-feature-inner">
              <Reveal>
                <span className="index-no">{f.index}</span>
              </Reveal>
              <Reveal as="h2" className="h3 cx-feature-title" delay={0.08}>
                {i === PROX_FEATURE ? (
                  <ProximityType>{f.title}</ProximityType>
                ) : (
                  f.title
                )}
              </Reveal>
              <Reveal as="p" className="body-lg cx-feature-body" delay={0.16}>
                {f.body}
              </Reveal>
            </div>
          </article>
        ))}
      </section>

      {/* ----------------------------- detail ----------------------------- */}
      <section
        data-scene-section="detail"
        className="cx-detail container-x section-y"
        aria-label="The work"
      >
        <Reveal>
          <span className="micro-label">{copy.detail.eyebrow}</span>
        </Reveal>
        <Reveal as="h2" className="h2 cx-detail-title" delay={0.08}>
          {copy.detail.title}
        </Reveal>
        <Reveal as="p" className="lede cx-detail-body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <Reveal delay={0.24}>
          <ul className="tag-list cx-detail-tags">
            {copy.detail.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Reveal>
      </section>
    </ChildPageShell>
  );
}
