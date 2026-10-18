import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { industries } from '@/lib/content/industries';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import './page.css';

const copy = industries.find((i) => i.slug === 'real-estate')!;

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Industries', path: '/industries' },
    { name: copy.crumbLabel, path: `/industries/${copy.slug}` },
  ],
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: 'Real Estate',
  description:
    'Local search capture, agent branding and inquiry automation for brokerages, teams and developers competing above the listing feed. The portals commoditize the listing; the agent who wins is the one the seller already trusts.',
  path: '/industries/real-estate',
  keywords: [
    'real estate marketing',
    'local SEO for realtors',
    'real estate agent branding',
    'neighborhood search capture',
    'real estate lead response',
    'brokerage website design',
    'listing showcase design',
    'real estate inquiry automation',
    'market report automation',
    'real estate authority marketing',
  ],
});

/**
 * /industries/real-estate — listings are commodities; authority is not.
 * Scene: RealEstateScene ("The Skyline Ascending").
 * Section ids are CONTRACT: hero (shell), market-truth, feature, detail, faq/cta (shell).
 */
export default function Page() {
  return (
    <ChildPageShell
      crumbs={[
        { label: 'Industries', href: '/industries' },
        { label: copy.crumbLabel },
      ]}
      eyebrow={copy.eyebrow}
      titleLines={copy.titleLines}
      lede={copy.lede}
      faq={copy.faq}
      cta={copy.cta}
    >
      <JsonLd data={jsonLd} />
      {/* ---------- market-truth — the statement the scene glints behind ---------- */}
      <section
        data-scene-section="market-truth"
        className="container-x res-truth"
        aria-label="Market truth"
      >
        <Reveal as="h2" className="display-2 res-truth__statement" delay={0.05}>
          <ProximityType>{copy.marketTruth}</ProximityType>
        </Reveal>
      </section>

      {/* ---------- feature — the three plays ---------- */}
      <section
        data-scene-section="feature"
        className="container-x res-feature"
        aria-label="The plays"
      >
        <div className="res-feature__grid">
          {copy.plays.map((p, i) => (
            <article key={p.title} className="res-feature__block">
              <Reveal className="index-no" delay={0}>
                0{i + 1}
              </Reveal>
              <Reveal as="h3" className="h3 res-feature__block-title" delay={0.08}>
                {p.title}
              </Reveal>
              <Reveal as="p" className="res-feature__body" delay={0.16}>
                {p.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- detail — the work, itemized ---------- */}
      <section
        data-scene-section="detail"
        className="container-x res-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label">{copy.detail.eyebrow}</Reveal>
        <Reveal as="h2" className="h2 res-detail__title" delay={0.08}>
          {copy.detail.title}
        </Reveal>
        <Reveal as="p" className="lede res-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="res-detail__bullets">
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
