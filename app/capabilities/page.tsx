import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { capabilitiesPage, practices } from '@/lib/content';
import Reveal from '@/components/ui/Reveal';
import { CtaButton } from '@/components/ui/Magnetic';
import PracticeIndex from './PracticeIndex';
import './capabilities.css';

export const metadata = pageMetadata({
  title: 'Capabilities',
  description:
    'Six integrated practices — strategy & transformation, AI & agent systems, digital products & experiences, brand & creative systems, growth & distribution and operations & automation — engineered to interlock, delivered as one accountable motion.',
  path: '/capabilities',
  keywords: [
    'AI strategy consultancy',
    'AI agent systems',
    'digital product development',
    'brand identity systems',
    'growth and SEO engineering',
    'operations automation',
  ],
});

/* BreadcrumbList for the index — Service/OfferCatalog coverage is global
   via the layout graph; child pages carry their own Service + FAQPage. */
const jsonLd = childPageJsonLd({
  crumbs: [{ name: capabilitiesPage.hero.eyebrow, path: '/capabilities' }],
});

/**
 * /capabilities — the six practices.
 * Copy holds the left column; the Newton's cradle (CapabilitiesScene) is the
 * fixed instrument on the right — each practice section is one strike.
 * Section ids are CONTRACT: cap-hero, strategy, agents, product, brand,
 * growth, operations, cap-outro. Practice sections also carry id={p.id}
 * for anchor deep-links (see CONTRACTS.md).
 */
export default function CapabilitiesPage() {
  const { hero, outro } = capabilitiesPage;

  return (
    <>
      <JsonLd data={jsonLd} />
      {/* ---------- hero ---------- */}
      <section
        data-scene-section="cap-hero"
        className="cap-hero container-x"
        aria-label="Capabilities overview"
      >
        <div className="cap-hero__body">
          <Reveal as="p" className="micro-label">
            {hero.eyebrow}
          </Reveal>
          <h1 className="display-1 cap-hero__title">
            {hero.titleLines.map((line, i) => (
              <Reveal key={line} line as="span" delay={0.1 + i * 0.12}>
                {line}
              </Reveal>
            ))}
          </h1>
          <Reveal as="p" className="lede cap-hero__lede" delay={0.35}>
            {hero.sub}
          </Reveal>
        </div>
        <PracticeIndex />
      </section>

      {/* ---------- the six practices ---------- */}
      {practices.map((p) => (
        <section
          key={p.id}
          data-scene-section={p.id}
          id={p.id}
          aria-label={p.title}
          className="cap-practice container-x"
        >
          <span className="cap-ghost" aria-hidden="true">
            {p.index}
          </span>
          <div className="cap-practice__inner">
            <Reveal as="p" className="micro-label">
              {`Practice ${p.index} — ${p.title}`}
            </Reveal>
            <Reveal as="h2" className="h2 cap-practice__title" delay={0.08}>
              {p.title}
            </Reveal>
            <Reveal as="p" className="lede cap-practice__lede" delay={0.16}>
              {p.narrative}
            </Reveal>
            <Reveal delay={0.24}>
              <ul
                className="tag-list cap-practice__tags"
                aria-label={`${p.title} deliverables`}
              >
                {p.deliverables.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      ))}

      {/* ---------- outro ---------- */}
      <section
        data-scene-section="cap-outro"
        className="cap-outro container-x"
        aria-label={outro.eyebrow}
      >
        <Reveal as="p" className="micro-label">
          {outro.eyebrow}
        </Reveal>
        <Reveal as="h2" className="display-2 cap-outro__title" delay={0.1}>
          {outro.title}
        </Reveal>
        <Reveal as="p" className="lede cap-outro__body" delay={0.2}>
          {outro.body}
        </Reveal>
        <Reveal className="cap-outro__cta" delay={0.3}>
          <CtaButton href={outro.cta.href} label={outro.cta.label} variant="blue" />
        </Reveal>
      </section>
    </>
  );
}
