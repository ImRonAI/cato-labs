import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { industries } from '@/lib/content/industries';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import MomentRail from '@/components/webgl/scenes/industries/lib-b/MomentRail';
import './page.css';

const copy = industries.find((i) => i.slug === 'saas-startups')!;

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Industries', path: '/industries' },
    { name: copy.crumbLabel, path: `/industries/${copy.slug}` },
  ],
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: 'SaaS & Startups',
  description:
    'Cato Labs for SaaS & startups: category narrative, product-led web experience and agent-assisted operations for software companies that have built something and need it found.',
  path: '/industries/saas-startups',
  keywords: [
    'saas marketing strategy',
    'category design',
    'product-led growth',
    'saas positioning',
    'startup narrative design',
    'product-led website',
    'ai customer support',
    'saas onboarding automation',
    'developer marketing',
    'founder brand content',
  ],
});

/**
 * /industries/saas-startups — distribution decides more than features.
 * Scene: SaasStartupsScene ("The Flywheel").
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
        className="container-x ss-truth"
        aria-label="The market truth"
      >
        <Reveal className="micro-label">The market truth</Reveal>
        <Reveal as="h2" className="display-2 ss-truth__statement" delay={0.1}>
          <ProximityType>{copy.marketTruth}</ProximityType>
        </Reveal>
      </section>

      {/* ---------- feature — the plays ---------- */}
      <section
        data-scene-section="feature"
        className="container-x ss-feature"
        aria-label="The plays"
      >
        <Reveal className="micro-label">The plays</Reveal>
        <div className="ss-feature__grid">
          {copy.features.map((f) => (
            <article key={f.index} className="ss-feature__block">
              <Reveal className="index-no" delay={0}>
                {f.index}
              </Reveal>
              <Reveal as="h3" className="h3 ss-feature__block-title" delay={0.08}>
                {f.title}
              </Reveal>
              <Reveal as="p" className="ss-feature__body" delay={0.16}>
                {f.body}
              </Reveal>
            </article>
          ))}
        </div>

        <div className="ss-plays">
          <Reveal className="micro-label micro-label--ink" delay={0}>
            Mapped to Cato practices
          </Reveal>
          <div className="ss-plays__grid">
            {copy.plays.map((p, i) => (
              <article key={p.title} className="ss-play">
                <Reveal className="index-no" delay={0}>
                  0{i + 1}
                </Reveal>
                <Reveal as="h3" className="ss-play__title" delay={0.06}>
                  {p.title}
                </Reveal>
                <Reveal as="p" className="ss-play__body" delay={0.12}>
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
        className="container-x ss-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label">{copy.detail.eyebrow}</Reveal>
        <Reveal as="h2" className="h2 ss-detail__title" delay={0.08}>
          {copy.detail.title}
        </Reveal>
        <Reveal as="p" className="lede ss-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="ss-detail__bullets">
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
