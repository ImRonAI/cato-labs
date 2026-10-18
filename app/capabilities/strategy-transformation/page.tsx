import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { capabilityChildren } from '@/lib/content/capabilities';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import './page.css';

const copy = capabilityChildren['strategy-transformation'];

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
  title: 'Strategy & Transformation',
  description:
    'Cato Labs strategy & transformation: market & competitive intelligence, category design & positioning, and executive strategy & roadmaps. Positioning, competitive strategy and operating models mapped from market reality, decided explicitly, and sequenced into a master plan leadership can actually execute.',
  path: '/capabilities/strategy-transformation',
  keywords: [
    'strategy consulting',
    'business transformation',
    'market intelligence',
    'competitive strategy',
    'category design',
    'positioning strategy',
    'operating model design',
    'strategic roadmap',
    'market entry sequencing',
    'KPI architecture',
  ],
});

/**
 * /capabilities/strategy-transformation — decide on evidence, not instinct.
 * Scene: StrategyTransformationScene ("The Chessboard of Evidence").
 * Section ids are CONTRACT: hero (shell), feature, detail, faq/cta (shell).
 */
export default function Page() {
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
      {/* ---------- feature — the three disciplines ---------- */}
      <section
        data-scene-section="feature"
        className="container-x stf-feature"
        aria-label="The practice"
      >
        <Reveal className="micro-label">The practice</Reveal>
        <Reveal as="h2" className="h2 stf-feature__title" delay={0.08}>
          <ProximityType>From evidence to decision.</ProximityType>
        </Reveal>
        <div className="stf-feature__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="stf-feature__block">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 stf-feature__block-title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="stf-feature__body" delay={0.16}>
                {f.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- detail — the work, itemized ---------- */}
      <section
        data-scene-section="detail"
        className="container-x stf-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label">{copy.detail.eyebrow}</Reveal>
        <Reveal as="h2" className="h2 stf-detail__title" delay={0.08}>
          {copy.detail.title}
        </Reveal>
        <Reveal as="p" className="lede stf-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="stf-detail__bullets">
          {copy.detail.bullets.map((b, i) => (
            <Reveal as="li" key={b} delay={0.1 + i * 0.05}>
              {b}
            </Reveal>
          ))}
        </ul>
      </section>
    </ChildPageShell>
  );
}
