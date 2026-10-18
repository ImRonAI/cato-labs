import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { industries } from '@/lib/content/industries';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import MomentRail from '@/components/webgl/scenes/industries/lib-b/MomentRail';
import './page.css';

const copy = industries.find((i) => i.slug === 'dental-med-spa')!;

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Industries', path: '/industries' },
    { name: copy.crumbLabel, path: `/industries/${copy.slug}` },
  ],
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: 'Dental & Med Spa',
  description: copy.lede,
  path: '/industries/dental-med-spa',
  keywords: [
    'dental practice marketing',
    'med spa marketing',
    'local SEO for dentists',
    'patient recall automation',
    'dental booking flow',
    'med spa booking experience',
    'treatment intent search',
    'lapsed patient reactivation',
    'practice reputation management',
    'membership packages med spa',
  ],
});

/**
 * /industries/dental-med-spa — the chair is filled by local intent.
 * Scene: DentalMedSpaScene ("The Polish") — hotspot 'dental-gem'.
 * Section ids are CONTRACT: hero (shell), market-truth, feature, detail,
 * faq/cta (shell). Growth-systems copy only — no treatment/outcome claims.
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
      {/* ---------- market-truth — the statement ---------- */}
      <section
        data-scene-section="market-truth"
        className="container-x dms-truth"
        aria-label="The market truth"
      >
        <Reveal className="micro-label">The market truth</Reveal>
        <Reveal as="h2" className="display-2 dms-truth__statement" delay={0.1}>
          <ProximityType>{copy.marketTruth}</ProximityType>
        </Reveal>
      </section>

      {/* ---------- feature — the three plays ---------- */}
      <section
        data-scene-section="feature"
        className="container-x dms-feature"
        aria-label="The plays"
      >
        <Reveal className="micro-label">The plays</Reveal>
        <div className="dms-feature__grid">
          {copy.plays.map((p, i) => (
            <article key={p.title} className="dms-feature__play">
              <Reveal className="index-no" delay={0}>
                {`0${i + 1}`}
              </Reveal>
              <Reveal as="h3" className="h3 dms-feature__title" delay={0.08}>
                {p.title}
              </Reveal>
              <Reveal as="p" className="dms-feature__body" delay={0.16}>
                {p.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- detail — the work, itemized ---------- */}
      <section
        data-scene-section="detail"
        className="container-x dms-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label">{copy.detail.eyebrow}</Reveal>
        <Reveal as="h2" className="h2 dms-detail__title" delay={0.08}>
          {copy.detail.title}
        </Reveal>
        <Reveal as="p" className="lede dms-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="dms-detail__bullets">
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
