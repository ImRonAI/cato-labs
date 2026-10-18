import Link from 'next/link';
import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { workIndex, cases } from '@/lib/content/work';
import Reveal from '@/components/ui/Reveal';
import { CtaButton } from '@/components/ui/Magnetic';
import ProximityType from '@/components/webgl/kit/ProximityType';
import { DEAL_MARKS } from '@/components/webgl/scenes/work/deal';
import DwellSteps from './DwellSteps';
import './page.css';

export const metadata = pageMetadata({
  title: 'Work',
  description:
    'Selected Cato Labs engagements — Resting Art, a luxury furniture concept built end to end from category strategy to flagship e-commerce and AI concierge, plus representative work across e-commerce, legal, hospitality and SaaS.',
  path: '/work',
  keywords: [
    'consultancy portfolio',
    'case studies',
    'brand strategy case study',
    'flagship e-commerce build',
    'AI concierge',
    'luxury furniture brand',
    'category design',
    'growth engineering results',
  ],
});

const jsonLd = childPageJsonLd({
  crumbs: [{ name: workIndex.eyebrow, path: '/work' }],
});

const featured = cases.find((c) => c.featured) ?? cases[0];
const representative = cases.filter((c) => c !== featured);

/**
 * The pattern behind every engagement in the index — distilled from the
 * case files, stated the way Cato states its commitments.
 */
const principles = [
  {
    index: '01',
    title: 'Position before pixels.',
    body: 'Every engagement in this index opened the same way — the category, the margin map or the competitive set decided before a pixel was placed or a line of code was written.',
  },
  {
    index: '02',
    title: 'One accountable team.',
    body: 'Strategy, brand, build and growth carried by the same hands, from concept to launch. The method never crosses a handoff, so nothing is lost between firms.',
  },
  {
    index: '03',
    title: 'Built to keep working.',
    body: 'Flagships ship with their operating systems — agents, automation and capture infrastructure — so the machine keeps running long after launch day.',
  },
];

/**
 * /work — the portfolio index.
 * A bespoke hero (portfolios earn their own frame), the case index with
 * Resting Art featured as a full editorial block, the four representative
 * engagements as hairline rows, then the working principles and the CTA.
 * Scene: WorkScene ("The Deal"). Section ids are CONTRACT:
 * hero, feature, detail, cta; `deal` is the pinned dwell for the signature
 * moment (the five case cards dealt into a hand).
 */
export default function WorkPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      {/* ---------- hero ---------- */}
      <section
        data-scene-section="hero"
        className="container-x wk-hero"
        aria-label={workIndex.titleLines.join(' ')}
      >
        <Reveal className="micro-label" delay={0.05}>
          {workIndex.eyebrow}
        </Reveal>
        <h1 className="display-1" style={{ marginBlock: '22px 26px' }}>
          {workIndex.titleLines.map((line, i) => (
            <Reveal key={line} line delay={0.12 + i * 0.1}>
              {line}
            </Reveal>
          ))}
        </h1>
        <Reveal className="lede" delay={0.35}>
          {workIndex.lede}
        </Reveal>
      </section>

      {/* ---------- deal — the signature moment: the hand is dealt ---------- */}
      <section
        data-scene-section="deal"
        className="dw-section"
        aria-label="The engagements, dealt"
      >
        <div className="dw-stage container-x">
          <DwellSteps
            section="deal"
            label={`Case index — 0${cases.length}`}
            marks={DEAL_MARKS}
            steps={cases.map((c, i) => ({
              index: `0${i + 1}`,
              title: c.client,
              meta: c.sector,
            }))}
          />
        </div>
      </section>

      {/* ---------- feature — the case index ---------- */}
      <section
        data-scene-section="feature"
        className="container-x wk-index"
        aria-label="Case index"
      >
        <Reveal className="micro-label" delay={0}>
          {`Case index — 0${cases.length}`}
        </Reveal>

        {/* featured: Resting Art, documented in full */}
        <Reveal delay={0.1}>
          <Link
            href="/work/resting-art"
            className="glass-card wk-featured"
            aria-label={`${featured.client} — read the full case study`}
          >
            <div className="wk-featured__meta">
              <span className="index-no">01</span>
              <span className="wk-featured__client">{featured.client}</span>
              <span className="wk-featured__sector">{featured.sector}</span>
            </div>
            <h2 className="wk-featured__headline">
              <ProximityType>{featured.headline}</ProximityType>
            </h2>
            <p className="wk-featured__summary">{featured.summary}</p>
            <ul className="wk-featured__stats">
              {featured.outcomePoints.map((o) => (
                <li key={o.label}>
                  <span className="wk-stat__metric">{o.metric}</span>
                  <span className="wk-stat__label">{o.label}</span>
                </li>
              ))}
            </ul>
            <div className="wk-featured__foot">
              <ul className="tag-list" aria-label="Practices engaged">
                {featured.services.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <span className="link-line wk-featured__more">
                Read the case study
                <span aria-hidden="true"> →</span>
              </span>
            </div>
          </Link>
        </Reveal>

        {/* representative engagements — anonymized, non-linked */}
        <div className="wk-rows">
          {representative.map((c, i) => (
            <Reveal key={c.slug} delay={0.08 + i * 0.07}>
              <article className="wk-row" aria-label={`${c.client} — ${c.sector}`}>
                <span className="index-no wk-row__no">0{i + 2}</span>
                <div className="wk-row__id">
                  <h3 className="wk-row__client">{c.client}</h3>
                  <span className="wk-row__sector">{c.sector}</span>
                  <span className="wk-row__note">Representative engagement</span>
                </div>
                <ul className="wk-row__services" aria-label="Practices engaged">
                  {c.services.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <div className="wk-row__metric">
                  <span className="wk-row__metric-value">
                    {c.outcomePoints[0].metric}
                  </span>
                  <span className="wk-row__metric-label">
                    {c.outcomePoints[0].label}
                  </span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- detail — how we work ---------- */}
      <section
        data-scene-section="detail"
        className="container-x wk-how"
        aria-label="How we work"
      >
        <Reveal className="micro-label" delay={0}>
          The pattern
        </Reveal>
        <Reveal as="h2" className="h2 wk-how__title" delay={0.08}>
          How we work.
        </Reveal>
        <div className="wk-how__grid">
          {principles.map((p, i) => (
            <div key={p.index} className="wk-how__item">
              <Reveal className="index-no" delay={i * 0.08}>
                {p.index}
              </Reveal>
              <Reveal as="h3" className="h3" delay={0.08 + i * 0.08}>
                {p.title}
              </Reveal>
              <Reveal as="p" className="wk-how__body" delay={0.16 + i * 0.08}>
                {p.body}
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- cta ---------- */}
      <section
        data-scene-section="cta"
        className="container-x cta-band"
        aria-label="Get started"
      >
        <Reveal className="micro-label" delay={0}>
          Begin
        </Reveal>
        <Reveal as="h2" className="display-2" delay={0.08}>
          Have a project like these?
        </Reveal>
        <Reveal
          className="lede"
          delay={0.16}
          style={{ maxWidth: '34rem', margin: '0 auto 34px' }}
        >
          The same method runs for client engagements — evidence first, one
          accountable team, systems that ship. One conversation is enough to
          see whether the fit is real.
        </Reveal>
        <Reveal delay={0.24}>
          <CtaButton href="/contact" label="Start the conversation" variant="blue" />
        </Reveal>
      </section>
    </>
  );
}
