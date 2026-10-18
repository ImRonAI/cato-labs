import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { industries } from '@/lib/content/industries';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import MomentRail from '@/components/webgl/scenes/industries/lib-b/MomentRail';
import './page.css';

const copy = industries.find((i) => i.slug === 'architecture-interior-design')!;

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Industries', path: '/industries' },
    { name: copy.crumbLabel, path: `/industries/${copy.slug}` },
  ],
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: 'Architecture & Interior Design',
  description:
    'Cato Labs for architecture & interior design: positioning, portfolio experience and inquiry systems for architecture and design practices whose work deserves a better frame.',
  path: '/industries/architecture-interior-design',
  keywords: [
    'architecture firm marketing',
    'interior design marketing',
    'architect portfolio website',
    'design practice positioning',
    'architecture branding',
    'editorial portfolio design',
    'project inquiry qualification',
    'architecture website design',
    'interior designer brand',
    'design studio marketing',
  ],
});

/**
 * /industries/architecture-interior-design — clients buy a point of view.
 * Scene: ArchitectureInteriorDesignScene ("The Composition").
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
      <MomentRail label={copy.crumbLabel}/>
      {/* ---------- market-truth — the blunt statement ---------- */}
      <section
        data-scene-section="market-truth"
        className="container-x aid-truth"
        aria-label="The market truth"
      >
        <Reveal className="micro-label">The market truth</Reveal>
        <Reveal as="h2" className="display-2 aid-truth__statement" delay={0.1}>
          <ProximityType>{copy.marketTruth}</ProximityType>
        </Reveal>
      </section>

      {/* ---------- feature — the plays ---------- */}
      <section
        data-scene-section="feature"
        className="container-x aid-feature"
        aria-label="The plays"
      >
        <Reveal className="micro-label">The plays</Reveal>
        <div className="aid-feature__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="aid-feature__block">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 aid-feature__block-title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="aid-feature__body" delay={0.16}>
                {f.body}
              </Reveal>
            </article>
          ))}
        </div>

        <div className="aid-plays">
          <Reveal className="micro-label micro-label--ink" delay={0}>
            Mapped to Cato practices
          </Reveal>
          <div className="aid-plays__grid">
            {copy.plays.map((p, i) => (
              <article key={p.title} className="aid-play">
                <Reveal className="index-no" delay={0}>
                  0{i + 1}
                </Reveal>
                <Reveal as="h3" className="aid-play__title" delay={0.06}>
                  {p.title}
                </Reveal>
                <Reveal as="p" className="aid-play__body" delay={0.12}>
                  {p.body}
                </Reveal>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- detail — the work, itemized ---------- */}
      <section
        data-scene-section="detail"
        className="container-x aid-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label">{copy.detail.eyebrow}</Reveal>
        <Reveal as="h2" className="h2 aid-detail__title" delay={0.08}>
          {copy.detail.title}
        </Reveal>
        <Reveal as="p" className="lede aid-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="aid-detail__bullets">
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
