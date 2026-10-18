import React from 'react';
import Link from 'next/link';
import { caseStudyJsonLd, childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { cases, restingArtDetail } from '@/lib/content/work';
import Reveal from '@/components/ui/Reveal';
import { CtaButton } from '@/components/ui/Magnetic';
import { JOIN_MARKS } from '@/components/webgl/scenes/work/joinery';
import DwellSteps from '../DwellSteps';
import './page.css';

const caseStudy = cases.find((c) => c.slug === 'resting-art') ?? cases[0];

const jsonLd = [
  ...childPageJsonLd({
    crumbs: [
      { name: 'Work', path: '/work' },
      { name: caseStudy.client, path: `/work/${caseStudy.slug}` },
    ],
  }),
  caseStudyJsonLd({
    client: caseStudy.client,
    headline: caseStudy.headline,
    description: caseStudy.summary,
    sector: caseStudy.sector,
    services: caseStudy.services,
    url: `/work/${caseStudy.slug}`,
  }),
];
const { hero, sections, pullQuote } = restingArtDetail;

export const metadata = pageMetadata({
  title: 'Resting Art',
  description: hero.lede,
  path: '/work/resting-art',
  keywords: [
    'Resting Art case study',
    'luxury furniture brand',
    'flagship e-commerce',
    'AI concierge',
    'brand identity system',
    'category strategy',
    'interior design e-commerce',
    'local search capture',
  ],
});

/* words inside the pull quote that take the blue accent treatment */
const ACCENTS = ['brand we would want to buy from', 'machine'];

/** Split the quote on its accent phrases, wrapping each in blue. Copy
    stays sourced from lib/content — this only adds emphasis. */
function accentQuote(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length > 0) {
    let earliest = -1;
    let match = '';
    for (const a of ACCENTS) {
      const idx = rest.indexOf(a);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
        match = a;
      }
    }
    if (earliest === -1) {
      nodes.push(rest);
      break;
    }
    if (earliest > 0) nodes.push(rest.slice(0, earliest));
    nodes.push(
      <span key={key++} className="text-accent">
        {match}
      </span>,
    );
    rest = rest.slice(earliest + match.length);
  }
  return nodes;
}

/**
 * /work/resting-art — the documented engagement.
 * ChildPageShell family resemblance, bespoke hero (crumbs + sector eyebrow),
 * four editorial chapters, the founding brief as a full-width statement,
 * the outcome stat row, and the CTA band.
 * Scene: CaseScene ("Joinery"). Section ids are CONTRACT:
 * hero, feature, detail, cta; `joinery` is the pinned dwell where the
 * glass table is built, one chapter per joinery stage.
 */
export default function RestingArtPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      {/* ---------- hero ---------- */}
      <section
        data-scene-section="hero"
        className="container-x ra-hero"
        aria-label={hero.titleLines.join(' ')}
      >
        <nav className="crumbs" aria-label="Breadcrumb" style={{ marginBottom: 42 }}>
          <Link href="/work">Work</Link>
          <span className="sep">/</span>
          <span aria-current="page">Resting Art</span>
        </nav>
        <Reveal className="micro-label" delay={0.05}>
          {`Case Study — ${caseStudy.sector}`}
        </Reveal>
        <h1 className="display-1" style={{ marginBlock: '22px 26px' }}>
          {hero.titleLines.map((line, i) => (
            <Reveal key={line} line delay={0.12 + i * 0.1}>
              {line}
            </Reveal>
          ))}
        </h1>
        <Reveal className="lede" delay={0.35}>
          {hero.lede}
        </Reveal>
      </section>

      {/* ---------- joinery — the signature moment: the piece is built ---------- */}
      <section
        data-scene-section="joinery"
        className="dw-section"
        aria-label="The build, in four chapters"
      >
        <div className="dw-stage container-x">
          <DwellSteps
            section="joinery"
            label={caseStudy.client}
            marks={JOIN_MARKS}
            steps={sections.map((s) => ({ index: s.index, title: s.title }))}
          />
        </div>
      </section>

      {/* ---------- feature — chapters 01–02 ---------- */}
      <section
        data-scene-section="feature"
        className="container-x ra-chapters"
        aria-label="Positioning and identity"
      >
        {sections.slice(0, 2).map((s) => (
          <article key={s.index} className="ra-chapter" aria-label={s.title}>
            <Reveal className="index-no" delay={0}>
              {s.index}
            </Reveal>
            <Reveal as="h2" className="h2 ra-chapter__title" delay={0.08}>
              {s.title}
            </Reveal>
            <Reveal as="p" className="ra-chapter__body" delay={0.16}>
              {s.body}
            </Reveal>
          </article>
        ))}
      </section>

      {/* ---------- detail — chapters 03–04 ---------- */}
      <section
        data-scene-section="detail"
        className="container-x ra-chapters"
        aria-label="Digital flagship and AI concierge"
      >
        {sections.slice(2).map((s) => (
          <article key={s.index} className="ra-chapter" aria-label={s.title}>
            <Reveal className="index-no" delay={0}>
              {s.index}
            </Reveal>
            <Reveal as="h2" className="h2 ra-chapter__title" delay={0.08}>
              {s.title}
            </Reveal>
            <Reveal as="p" className="ra-chapter__body" delay={0.16}>
              {s.body}
            </Reveal>
          </article>
        ))}
      </section>

      {/* ---------- the founding brief ---------- */}
      <section className="container-x ra-quote" aria-label="The founding brief">
        <Reveal delay={0.05}>
          <blockquote className="ra-quote__blockquote">
            <p className="display-2 ra-quote__text">{accentQuote(pullQuote.text)}</p>
            <footer className="ra-quote__attr">{pullQuote.attribution}</footer>
          </blockquote>
        </Reveal>
      </section>

      {/* ---------- outcomes ---------- */}
      <section className="container-x ra-stats" aria-label="Engagement outcomes">
        <Reveal className="micro-label" delay={0}>
          Outcomes
        </Reveal>
        <ul className="ra-stats__grid">
          {caseStudy.outcomePoints.map((o, i) => (
            <Reveal as="li" key={o.label} delay={0.08 + i * 0.08}>
              <span className="ra-stat__metric">{o.metric}</span>
              <span className="ra-stat__label">{o.label}</span>
            </Reveal>
          ))}
        </ul>
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
