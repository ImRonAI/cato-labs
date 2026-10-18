import Link from 'next/link';
import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { industriesIndex, industries } from '@/lib/content/industries';
import Reveal from '@/components/ui/Reveal';
import { CtaButton } from '@/components/ui/Magnetic';
import ProximityType from '@/components/webgl/kit/ProximityType';
import MomentDwell from '@/components/webgl/scenes/industries/lib-a/MomentDwell';
import './page.css';

export const metadata = pageMetadata({
  title: 'Industries',
  description: industriesIndex.lede,
  path: '/industries',
  keywords: [
    'industry strategy consultancy',
    'vertical market expertise',
    'e-commerce consulting',
    'hospitality marketing',
    'home services marketing',
    'legal marketing',
    'financial services marketing',
    'SaaS go-to-market',
  ],
});

/* Three example truths for the detail callout strip — chosen for range
   (speed-to-lead, belonging, narrative). Copy stays verbatim from the deck. */
const jsonLd = childPageJsonLd({
  crumbs: [{ name: industriesIndex.eyebrow, path: '/industries' }],
});

const TRUTH_SLUGS = ['home-services', 'fitness-studios', 'saas-startups'] as const;
const truths = TRUTH_SLUGS.map((slug) => {
  const hit = industries.find((i) => i.slug === slug);
  if (!hit) throw new Error(`industries deck is missing slug: ${slug}`);
  return hit;
});

/**
 * /industries — the twelve markets, as an editorial index.
 * Scene: IndustriesScene ("The Sliding Puzzle") — through the `moment`
 * dwell twelve glass tiles solve themselves; the index then lights each
 * tile as its row passes.
 * Section ids are CONTRACT: hero, feature, detail, cta (+ moment dwell).
 */
export default function IndustriesPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      {/* ---------- hero ---------- */}
      <section
        data-scene-section="hero"
        className="ind-hero container-x"
        aria-label={industriesIndex.titleLines.join(' ')}
      >
        <div className="ind-hero__body">
          <Reveal as="p" className="micro-label" delay={0.05}>
            {industriesIndex.eyebrow}
          </Reveal>
          <h1 className="display-1 ind-hero__title">
            {industriesIndex.titleLines.map((line, i) => (
              <Reveal key={line} line as="span" delay={0.12 + i * 0.1}>
                <ProximityType>{line}</ProximityType>
              </Reveal>
            ))}
          </h1>
          <Reveal as="p" className="lede ind-hero__lede" delay={0.35}>
            {industriesIndex.lede}
          </Reveal>
        </div>
      </section>

      {/* ---------- moment — the sliding puzzle solves itself, twelve tiles ---------- */}
      <MomentDwell
        id="moment"
        label={industriesIndex.eyebrow}
        ariaLabel={industriesIndex.titleLines.join(' ')}
        total={industries.length}
      />

      {/* ---------- feature — the twelve industries, an editorial index ---------- */}
      <section
        data-scene-section="feature"
        className="container-x ind-index"
        aria-label="The twelve industries"
      >
        <ol className="ind-list">
          {industries.map((ind, i) => (
            <li key={ind.slug}>
              <Reveal delay={0.04 * i}>
                <Link href={`/industries/${ind.slug}`} className="ind-row">
                  <span className="index-no">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="h3 ind-row__title">{ind.crumbLabel}</h3>
                  <span className="ind-row__lede">{ind.lede}</span>
                  <span className="ind-row__arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- detail — three market truths, called out ---------- */}
      <section
        data-scene-section="detail"
        className="container-x ind-truths"
        aria-label="Market truths"
      >
        <Reveal as="p" className="micro-label" delay={0}>
          The market truths
        </Reveal>
        <div className="ind-truths__grid">
          {truths.map((t, i) => (
            <Reveal key={t.slug} className="ind-truth glass-card" delay={0.08 * i}>
              <Link href={`/industries/${t.slug}`} className="ind-truth__tag">
                {t.crumbLabel}
              </Link>
              <p className="ind-truth__body">{t.marketTruth}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- cta — mirrors the ChildPageShell band ---------- */}
      <section
        data-scene-section="cta"
        className="container-x cta-band"
        aria-label="Get started"
      >
        <Reveal className="micro-label" delay={0}>
          Begin
        </Reveal>
        <Reveal as="h2" className="display-2" delay={0.08}>
          {industriesIndex.titleLines.join(' ')}
        </Reveal>
        <Reveal
          className="lede"
          delay={0.16}
          style={{ maxWidth: '34rem', margin: '0 auto 34px' }}
        >
          {industriesIndex.lede}
        </Reveal>
        <Reveal delay={0.24}>
          <CtaButton href="/contact" label="Start a build" variant="blue" />
        </Reveal>
      </section>
    </>
  );
}
