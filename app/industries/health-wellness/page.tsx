import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { industries } from '@/lib/content/industries';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import './page.css';

const copy = industries.find((i) => i.slug === 'health-wellness')!;

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Industries', path: '/industries' },
    { name: copy.crumbLabel, path: `/industries/${copy.slug}` },
  ],
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: 'Health & Wellness',
  description: copy.lede,
  path: '/industries/health-wellness',
  keywords: [
    'wellness brand marketing',
    'practice growth marketing',
    'wellness booking system',
    'membership retention',
    'recall automation',
    'local search for wellness',
    'wellness studio branding',
    'appointment booking flow',
    'reputation management wellness',
    'membership architecture',
  ],
});

/**
 * /industries/health-wellness — wellness is a membership business.
 * Scene: HealthWellnessScene ("The Breath") — hotspot 'health-breath'.
 * Section ids are CONTRACT: hero (shell), market-truth, feature, detail,
 * faq/cta (shell). Growth-brand copy only — no clinical claims.
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
      {/* ---------- market-truth — the statement ---------- */}
      <section
        data-scene-section="market-truth"
        className="container-x hw-truth"
        aria-label="The market truth"
      >
        <Reveal className="micro-label">The market truth</Reveal>
        <Reveal as="h2" className="display-2 hw-truth__statement" delay={0.1}>
          <ProximityType>{copy.marketTruth}</ProximityType>
        </Reveal>
      </section>

      {/* ---------- feature — the three plays ---------- */}
      <section
        data-scene-section="feature"
        className="container-x hw-feature"
        aria-label="The plays"
      >
        <Reveal className="micro-label">The plays</Reveal>
        <div className="hw-feature__grid">
          {copy.plays.map((p, i) => (
            <article key={p.title} className="hw-feature__play">
              <Reveal className="index-no" delay={0}>
                {`0${i + 1}`}
              </Reveal>
              <Reveal as="h3" className="h3 hw-feature__title" delay={0.08}>
                {p.title}
              </Reveal>
              <Reveal as="p" className="hw-feature__body" delay={0.16}>
                {p.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- detail — the work, itemized ---------- */}
      <section
        data-scene-section="detail"
        className="container-x hw-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label">{copy.detail.eyebrow}</Reveal>
        <Reveal as="h2" className="h2 hw-detail__title" delay={0.08}>
          {copy.detail.title}
        </Reveal>
        <Reveal as="p" className="lede hw-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="hw-detail__bullets">
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
