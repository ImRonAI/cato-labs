import Link from 'next/link';
import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { practices } from '@/lib/content';
import { industries, type IndustryCopy } from '@/lib/content/industries';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import './page.css';

function industryCopy(slug: string): IndustryCopy {
  const hit = industries.find((i) => i.slug === slug);
  if (!hit) throw new Error(`industries deck is missing slug: ${slug}`);
  return hit;
}

const copy = industryCopy('ecommerce-retail');

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Industries', path: '/industries' },
    { name: copy.crumbLabel, path: `/industries/${copy.slug}` },
  ],
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: copy.crumbLabel,
  description: copy.lede,
  path: '/industries/ecommerce-retail',
  keywords: [
    'e-commerce strategy',
    'retail category strategy',
    'flagship commerce',
    'AI concierge retail',
    'retention automation',
    'marketplace margin strategy',
    'direct-to-consumer brand',
  ],
});

/* The three plays are named after Cato practices — resolve the practice
   anchors from the deck so the mapping stays data-driven. */
const plays = copy.plays.map((play, i) => ({
  ...play,
  index: String(i + 1).padStart(2, '0'),
  practice: practices.find((p) => p.title === play.title),
}));

/**
 * /industries/ecommerce-retail — own the shelf, own the margin.
 * Scene: EcommerceRetailScene ("The Glass Vitrine") — on `market-truth`
 * the deep-blue product cube rises out of the glass bag: the product
 * elevated above the commodity. Hotspot 'retail-vitrine' rides the cube.
 * Section ids are CONTRACT: hero (shell), market-truth, feature, detail,
 * faq/cta (shell).
 */
export default function EcommerceRetailPage() {
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
      {/* ---------- market-truth — the statement block ---------- */}
      <section
        data-scene-section="market-truth"
        className="container-x ecr-truth"
        aria-label="The market truth"
      >
        <Reveal className="micro-label" delay={0}>
          The market truth
        </Reveal>
        <Reveal as="p" className="display-2 ecr-truth__statement" delay={0.12}>
          <ProximityType>{copy.marketTruth}</ProximityType>
        </Reveal>
      </section>

      {/* ---------- feature — the three plays, mapped to practices ---------- */}
      <section
        data-scene-section="feature"
        className="container-x ecr-plays"
        aria-label="The plays"
      >
        <Reveal className="micro-label" delay={0}>
          The plays
        </Reveal>
        <div className="ecr-plays__grid">
          {plays.map((p) => (
            <article key={p.index} className="ecr-play">
              <Reveal className="index-no" delay={0}>
                {p.index}
              </Reveal>
              <Reveal as="h3" className="h3 ecr-play__title" delay={0.08}>
                {p.practice ? (
                  <Link
                    href={`/capabilities#${p.practice.id}`}
                    className="ecr-play__link"
                  >
                    {p.title}
                  </Link>
                ) : (
                  p.title
                )}
              </Reveal>
              <Reveal as="p" className="ecr-play__body" delay={0.16}>
                {p.body}
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- detail — the work, itemized ---------- */}
      <section
        data-scene-section="detail"
        className="container-x ecr-detail"
        aria-label={copy.detail.title}
      >
        <Reveal className="micro-label" delay={0}>
          {copy.detail.eyebrow}
        </Reveal>
        <Reveal as="h2" className="h2 ecr-detail__title" delay={0.08}>
          {copy.detail.title}
        </Reveal>
        <Reveal as="p" className="lede ecr-detail__body" delay={0.16}>
          {copy.detail.body}
        </Reveal>
        <ul className="ecr-detail__bullets">
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
