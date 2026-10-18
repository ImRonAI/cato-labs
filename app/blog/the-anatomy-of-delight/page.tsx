import { Fragment } from 'react';
import Link from 'next/link';
import { articleJsonLd, childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { blogIndex, sampleArticle } from '@/lib/content/blog';
import { home } from '@/lib/content';
import Reveal from '@/components/ui/Reveal';
import { CtaButton } from '@/components/ui/Magnetic';
import ReadingProgress from './ReadingProgress';
import './page.css';

const jsonLd = [
  ...childPageJsonLd({
    crumbs: [
      { name: blogIndex.eyebrow, path: '/blog' },
      { name: sampleArticle.title, path: '/blog/the-anatomy-of-delight' },
    ],
  }),
  articleJsonLd({
    title: sampleArticle.title,
    description: sampleArticle.dek,
    date: sampleArticle.date,
    url: '/blog/the-anatomy-of-delight',
  }),
];

export const metadata = pageMetadata({
  title: sampleArticle.title,
  description: sampleArticle.dek,
  path: '/blog/the-anatomy-of-delight',
  keywords: [
    'experience design',
    'AI interfaces',
    'craft',
    'Cato Journal',
    'design sample',
  ],
});

/**
 * /blog/the-anatomy-of-delight — the reading experience itself is the
 * deliverable. Breadcrumbs, an honest eyebrow, a display-2 title, the dek
 * as lede, then five sections of longform with a drop-cap first paragraph
 * and a mid-article pull quote. A hairline progress bar (client island)
 * tracks the read; ArticleScene ("The Margin") descends with it.
 * Section ids are CONTRACT: hero, feature, cta.
 */
export default function ArticlePage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <ReadingProgress />

      {/* ---------- header ---------- */}
      <section
        data-scene-section="hero"
        className="container-x art-hero"
        aria-label={sampleArticle.title}
      >
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/blog">Blog</Link>
          <span className="sep">/</span>
          <span aria-current="page">{sampleArticle.title}</span>
        </nav>
        <Reveal className="micro-label" delay={0.05}>
          {`${sampleArticle.date} · ${sampleArticle.readTime} · Design sample`}
        </Reveal>
        <h1 className="display-2 art-title">
          <Reveal line delay={0.14}>
            {sampleArticle.title}
          </Reveal>
        </h1>
        <Reveal className="lede art-lede" delay={0.3}>
          {sampleArticle.dek}
        </Reveal>
      </section>

      {/* ---------- body ---------- */}
      <article
        data-scene-section="feature"
        className="container-x art-body"
        aria-label="Article body"
      >
        {sampleArticle.sections.map((s, si) => (
          <Fragment key={s.h}>
            <section className="art-section" aria-label={s.h}>
              <Reveal as="h2" className="art-h" delay={0}>
                {s.h}
              </Reveal>
              {s.paras.map((p, pi) => (
                <Reveal
                  as="p"
                  key={`${si}.${pi}`}
                  className={si === 0 && pi === 0 ? 'art-p art-drop' : 'art-p'}
                  delay={0.08}
                >
                  {p}
                </Reveal>
              ))}
            </section>
            {s.pullQuote && (
              <Reveal as="figure" className="art-quote" delay={0.06}>
                <hr className="rule art-quote__rule" />
                <blockquote className="art-quote__text">{s.pullQuote}</blockquote>
              </Reveal>
            )}
          </Fragment>
        ))}
        <Reveal as="p" className="art-endnote" delay={0.08}>
          This is a design sample — the Cato journal launches soon.
        </Reveal>
      </article>

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
