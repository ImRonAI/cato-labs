import Link from 'next/link';
import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { blogIndex, posts } from '@/lib/content/blog';
import { home } from '@/lib/content';
import Reveal from '@/components/ui/Reveal';
import { CtaButton } from '@/components/ui/Magnetic';
import ProximityType from '@/components/webgl/kit/ProximityType';
import { entryMarks } from '@/components/webgl/scenes/blog/pages';
import DwellSteps from '@/app/work/DwellSteps';
import './page.css';

const PAGE_MARKS = entryMarks(posts.length);
export const metadata = pageMetadata({
  title: 'Journal',
  description: blogIndex.lede,
  path: '/blog',
  keywords: [
    'Cato Journal',
    'AI strategy essays',
    'experience design',
    'AI interfaces',
    'consultancy insights',
  ],
});

const sample = posts.find((p) => p.status === 'sample') ?? posts[0];
const forthcoming = posts.filter((p) => p.status === 'forthcoming');

const jsonLd = childPageJsonLd({
  crumbs: [{ name: blogIndex.eyebrow, path: '/blog' }],
});

/**
 * /blog — the journal index as a design showcase.
 * One published sample carries the full editorial treatment (feature card);
 * the two forthcoming entries are hairline rows — quiet, unlinked, honest.
 * Section ids are CONTRACT: hero, feature, cta; `pages` is the pinned dwell
 * for the signature moment. Scene: BlogScene ("Pages Turning").
 */
export default function BlogPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      {/* ---------- hero ---------- */}
      <section
        data-scene-section="hero"
        className="container-x bl-hero"
        aria-label={blogIndex.titleLines.join(' ')}
      >
        <Reveal className="micro-label" delay={0.05}>
          {blogIndex.eyebrow}
        </Reveal>
        <h1 className="display-1" style={{ marginBlock: '22px 26px' }}>
          {blogIndex.titleLines.map((line, i) => (
            <Reveal key={line} line delay={0.12 + i * 0.1}>
              {line}
            </Reveal>
          ))}
        </h1>
        <Reveal className="lede" delay={0.35}>
          {blogIndex.lede}
        </Reveal>
      </section>

      {/* ---------- pages — the signature moment: the journal opens ---------- */}
      <section
        data-scene-section="pages"
        className="dw-section"
        aria-label="The journal, opened"
      >
        <div className="dw-stage container-x">
          <DwellSteps
            section="pages"
            label={blogIndex.eyebrow}
            marks={PAGE_MARKS}
            steps={posts.map((p, i) => ({
              index: `0${i + 1}`,
              title: p.title,
              meta: p.date,
            }))}
          />
        </div>
      </section>

      {/* ---------- feature — the journal index ---------- */}
      <section
        data-scene-section="feature"
        className="container-x bl-index"
        aria-label="Journal entries"
      >
        <Reveal as="p" className="bl-note" delay={0}>
          The Cato journal launches soon. The sample below is a design study of
          the reading experience.
        </Reveal>

        {/* the sample — full editorial feature card */}
        <Reveal delay={0.1}>
          <Link
            href={`/blog/${sample.slug}`}
            className="glass-card bl-featured"
            aria-label={`${sample.title} — read the sample article`}
          >
            <div className="bl-featured__meta">
              <span className="index-no">01</span>
              <span className="bl-featured__date">
                {sample.date} · {sample.readTime}
              </span>
            </div>
            <h2 className="bl-featured__title">
              <ProximityType>{sample.title}</ProximityType>
            </h2>
            <p className="bl-featured__dek">{sample.dek}</p>
            <div className="bl-featured__foot">
              <ul className="tag-list" aria-label="Topics">
                {sample.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <span className="link-line bl-featured__more">
                Read the sample
                <span aria-hidden="true"> →</span>
              </span>
            </div>
          </Link>
        </Reveal>

        {/* forthcoming — hairline rows, no link, no dates */}
        <div className="bl-rows">
          {forthcoming.map((p, i) => (
            <Reveal key={p.slug} delay={0.08 + i * 0.07}>
              <article className="bl-row" aria-label={`${p.title} — ${p.date}`}>
                <span className="index-no bl-row__no">0{i + 2}</span>
                <div>
                  <h3 className="bl-row__title">{p.title}</h3>
                  <p className="bl-row__dek">{p.dek}</p>
                </div>
                <ul className="bl-row__tags" aria-label="Topics">
                  {p.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <span className="bl-row__label">{p.date}</span>
              </article>
            </Reveal>
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
          {home.cta.eyebrow}
        </Reveal>
        <Reveal as="h2" className="display-2" delay={0.08}>
          {home.cta.titleLines.join(' ')}
        </Reveal>
        <Reveal
          className="lede"
          delay={0.16}
          style={{ maxWidth: '34rem', margin: '0 auto 34px' }}
        >
          {home.cta.body}
        </Reveal>
        <Reveal delay={0.24}>
          <CtaButton href={home.cta.cta.href} label={home.cta.cta.label} variant="blue" />
        </Reveal>
      </section>
    </>
  );
}
