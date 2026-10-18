import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { industries } from '@/lib/content/industries';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import './page.css';

const copy = industries.find((i) => i.slug === 'hospitality')!;

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Industries', path: '/industries' },
    { name: copy.crumbLabel, path: `/industries/${copy.slug}` },
  ],
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: 'Hospitality',
  description:
    'Brand, booking experience and guest-lifecycle systems for hotels, resorts and restaurants that want to own their guests instead of renting them. The OTA owns the relationship and takes a fifth of the room rate for the privilege.',
  path: '/industries/hospitality',
  keywords: [
    'hospitality marketing',
    'direct booking strategy',
    'hotel website design',
    'hotel brand strategy',
    'OTA commission reduction',
    'booking experience design',
    'AI guest concierge',
    'guest lifecycle automation',
    'hospitality SEO',
    'resort marketing',
  ],
});

/**
 * /industries/hospitality — the direct booking is the profit.
 * Scene: HospitalityScene ("The Welcome Light").
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
        className="container-x hsp-truth"
        aria-label="Market truth"
      >
        <Reveal as="h2" className="display-2 hsp-truth__statement" delay={0.05}>
          <ProximityType>{copy.marketTruth}</ProximityType>
        </Reveal>
      </section>

      {/* ---------- feature — the three plays ---------- */}
      <section
        data-scene-section="feature"
        className="container-x hsp-feature"
        aria-label="The plays"
      >
        <div className="hsp-feature__grid">
          {copy.plays.map((p, i) => (
            <article key={p.title} className="hsp-feature__block">
              <Reveal className="index-no" delay={0}>
                0{i + 1}
              </Reveal>
              <Reveal as="h3" className="h3 hsp-feature__block-title" delay={0.08}>
                {p.title}
              </Reveal>
              <Reveal as="p" className="hsp-feature__body" delay={0.16}>
                {p.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- detail — the work, itemized ---------- */}
      <section
        data-scene-section="detail"
        className="container-x hsp-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label">{copy.detail.eyebrow}</Reveal>
        <Reveal as="h2" className="h2 hsp-detail__title" delay={0.08}>
          {copy.detail.title}
        </Reveal>
        <Reveal as="p" className="lede hsp-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="hsp-detail__bullets">
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
