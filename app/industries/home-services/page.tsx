import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { industries } from '@/lib/content/industries';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import './page.css';

const copy = industries.find((i) => i.slug === 'home-services')!;

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Industries', path: '/industries' },
    { name: copy.crumbLabel, path: `/industries/${copy.slug}` },
  ],
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: 'Home Services',
  description:
    'Cato Labs for home services: local capture, instant response and reputation systems for the trades — plumbing to pest control — where speed-to-lead decides the work.',
  path: '/industries/home-services',
  keywords: [
    'home services marketing',
    'local seo for contractors',
    'map pack ranking',
    'voice ai answering service',
    'speed to lead',
    'review generation',
    'plumbing marketing',
    'hvac marketing',
    'contractor lead generation',
    'home services reputation management',
  ],
});

/**
 * /industries/home-services — the job goes to whoever answers.
 * Scene: HomeServicesScene ("The Interlocking Gears").
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
      {/* ---------- market-truth — the blunt statement ---------- */}
      <section
        data-scene-section="market-truth"
        className="container-x hs-truth"
        aria-label="The market truth"
      >
        <Reveal className="micro-label">The market truth</Reveal>
        <Reveal as="h2" className="display-2 hs-truth__statement" delay={0.1}>
          <ProximityType>{copy.marketTruth}</ProximityType>
        </Reveal>
      </section>

      {/* ---------- feature — the plays ---------- */}
      <section
        data-scene-section="feature"
        className="container-x hs-feature"
        aria-label="The plays"
      >
        <Reveal className="micro-label">The plays</Reveal>
        <div className="hs-feature__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="hs-feature__block">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 hs-feature__block-title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="hs-feature__body" delay={0.16}>
                {f.body}
              </Reveal>
            </article>
          ))}
        </div>

        <div className="hs-plays">
          <Reveal className="micro-label micro-label--ink" delay={0}>
            Mapped to Cato practices
          </Reveal>
          <div className="hs-plays__grid">
            {copy.plays.map((p, i) => (
              <article key={p.title} className="hs-play">
                <Reveal className="index-no" delay={0}>
                  0{i + 1}
                </Reveal>
                <Reveal as="h3" className="hs-play__title" delay={0.06}>
                  {p.title}
                </Reveal>
                <Reveal as="p" className="hs-play__body" delay={0.12}>
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
        className="container-x hs-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label">{copy.detail.eyebrow}</Reveal>
        <Reveal as="h2" className="h2 hs-detail__title" delay={0.08}>
          {copy.detail.title}
        </Reveal>
        <Reveal as="p" className="lede hs-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="hs-detail__bullets">
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
