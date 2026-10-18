import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { capabilityChildren } from '@/lib/content/capabilities';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import GrowthLevers, { LeverGrid } from './GrowthLevers';
import SocialTabs from './SocialTabs';
import './page.css';

const copy = capabilityChildren['growth-distribution'];

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

export const metadata = pageMetadata({
  title: 'Growth & Distribution',
  description: copy.lede,
  path: '/capabilities/growth-distribution',
  keywords: [
    'growth engineering',
    'technical SEO',
    'AI discoverability',
    'llms.txt',
    'social operating model',
    'content systems',
    'distribution partnerships',
  ],
});

/**
 * /capabilities/growth-distribution — the flagship growth page.
 * Server component; interactive islands (GrowthLevers chart, SocialTabs
 * particle stage) are client components filled from the same copy deck.
 * Scene sections: hero · feature · chart · levers · social · detail · faq · cta.
 */
export default function GrowthDistributionPage() {
  return (
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
      {/* ---------- feature — the three pillars ---------- */}
      <section
        data-scene-section="feature"
        className="container-x section-y-sm"
        aria-label="What the practice covers"
      >
        <div className="gd-feature-grid">
          {copy.features.map((f, i) => (
            <Reveal key={f.index} className="glass-card gd-feature" delay={0.08 * i}>
              <span className="index-no">{f.index}</span>
              <h3 className="h3 gd-feature__title">{f.title}</h3>
              <p className="gd-feature__body">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- chart — the curve we engineer ---------- */}
      <section
        data-scene-section="chart"
        id="growth-chart"
        className="container-x section-y"
        aria-label="The curve we engineer"
      >
        <Reveal className="micro-label" delay={0}>
          The evidence
        </Reveal>
        <Reveal as="h2" className="h2" delay={0.08} style={{ marginBlock: '16px 40px' }}>
          The curve we engineer.
        </Reveal>
        <GrowthLevers />
      </section>

      {/* ---------- levers — the four engines ---------- */}
      <section
        data-scene-section="levers"
        id="growth-levers"
        className="container-x section-y"
        aria-label="The growth levers"
      >
        <Reveal className="micro-label" delay={0}>
          The levers
        </Reveal>
        <Reveal as="h2" className="h2" delay={0.08} style={{ marginBlock: '16px 20px' }}>
          Four levers, one motion.
        </Reveal>
        <Reveal className="lede gd-levers__lede" delay={0.16}>
          Every channel earns its budget. These are the systems we pull — in
          sequence, measured against the same architecture.
        </Reveal>
        <LeverGrid />
      </section>

      {/* ---------- social — every platform, sculpted ---------- */}
      <section
        data-scene-section="social"
        id="growth-social"
        className="container-x section-y"
        aria-label="Social platforms, sculpted"
      >
        <Reveal className="micro-label" delay={0}>
          Social engines
        </Reveal>
        <Reveal as="h2" className="h2" delay={0.08} style={{ marginBlock: '16px 20px' }}>
          Every platform, sculpted.
        </Reveal>
        <Reveal className="lede gd-social__lede" delay={0.16}>
          One brand, six native dialects. Drag through the mark — then see what
          the system does with each room it speaks in.
        </Reveal>
        <SocialTabs />
      </section>

      {/* ---------- detail — the work, itemized ---------- */}
      <section
        data-scene-section="detail"
        className="container-x section-y-sm"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.detail.eyebrow}
        </Reveal>
        <Reveal as="h2" className="h2" delay={0.08} style={{ marginBlock: '16px 24px' }}>
          {copy.detail.title}
        </Reveal>
        <Reveal className="lede gd-detail__lede" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <Reveal delay={0.24}>
          <ul className="tag-list" aria-label="Deliverables">
            {copy.detail.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Reveal>
      </section>
    </ChildPageShell>
  );
}
