import React from 'react';
import Link from 'next/link';
import Reveal from './Reveal';
import { CtaButton } from './Magnetic';

/**
 * ChildPageShell — the shared skeleton for every child page (v2).
 * Server component: breadcrumb + hero + body slots + FAQ + CTA band.
 * Page agents supply copy (from lib/content) and middle sections;
 * the shell guarantees the family resemblance.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export default function ChildPageShell({
  crumbs,
  eyebrow,
  titleLines,
  lede,
  children,
  faq = [],
  cta,
}: {
  /** e.g. [{label:'Capabilities',href:'/capabilities'},{label:'Voice AI'}] — last = current */
  crumbs: { label: string; href?: string }[];
  eyebrow: string;
  titleLines: string[];
  lede: string;
  children: React.ReactNode;
  faq?: FaqItem[];
  cta: { title: string; body: string; label: string; href: string };
}) {
  return (
    <>
      <section data-scene-section="hero" className="container-x child-hero" aria-label={titleLines.join(' ')}>
        <nav className="crumbs" aria-label="Breadcrumb" style={{ marginBottom: 42 }}>
          {crumbs.map((c, i) => (
            <React.Fragment key={c.label}>
              {i > 0 && <span className="sep">/</span>}
              {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
            </React.Fragment>
          ))}
        </nav>
        <Reveal className="micro-label" delay={0.05}>{eyebrow}</Reveal>
        <h1 className="display-1" style={{ marginBlock: '22px 26px' }}>
          {titleLines.map((line, i) => (
            <Reveal key={line} line delay={0.12 + i * 0.1}>
              {line}
            </Reveal>
          ))}
        </h1>
        <Reveal className="lede" delay={0.35}>{lede}</Reveal>
        <span className="child-hero__cue" aria-hidden="true">
          <span />
        </span>
      </section>

      {children}

      {faq.length > 0 && (
        <section data-scene-section="faq" className="container-x section-y-sm" aria-label="Frequently asked questions">
          <Reveal className="micro-label" delay={0}>Questions</Reveal>
          <Reveal as="h2" className="h2" delay={0.08} style={{ marginBlock: '16px 48px' }}>
            Asked, answered.
          </Reveal>
          <div>
            {faq.map((f, i) => (
              <Reveal key={f.q} className="faq-item" delay={i * 0.06}>
                <details className="faq-details" open={i === 0 ? true : undefined}>
                  <summary className="faq-q">
                    <span className="faq-q__text">{f.q}</span>
                    <span className="faq-meta" aria-hidden="true">
                      <span className="faq-no">{String(i + 1).padStart(2, '0')}</span>
                      <span className="faq-icon" />
                    </span>
                  </summary>
                  <div className="faq-body">
                    <p className="faq-a">{f.a}</p>
                  </div>
                </details>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section data-scene-section="cta" className="container-x cta-band" aria-label="Get started">
        <Reveal className="micro-label" delay={0}>Begin</Reveal>
        <Reveal as="h2" className="display-2" delay={0.08}>
          {cta.title}
        </Reveal>
        <Reveal className="lede" delay={0.16} style={{ maxWidth: '34rem', margin: '0 auto 34px' }}>
          {cta.body}
        </Reveal>
        <Reveal delay={0.24}>
          <CtaButton href={cta.href} label={cta.label} variant="blue" />
        </Reveal>
      </section>
    </>
  );
}
