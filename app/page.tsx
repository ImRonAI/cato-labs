import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { home, practices, approachStages } from '@/lib/content';
import Reveal from '@/components/ui/Reveal';
import Marquee from '@/components/ui/Marquee';
import { CtaButton } from '@/components/ui/Magnetic';
import ManifestoScrub from '@/components/webgl/scenes/home/ManifestoScrub';
import './home.css';
import './motion.css';

export const metadata = pageMetadata({
  title: 'Build beyond ordinary',
  description:
    'Cato Labs is an AI-native strategy and implementation consultancy — strategy, design, engineering, AI agents, growth and operations, delivered as one integrated practice.',
  path: '/',
  keywords: [
    'AI strategy consultancy',
    'integrated consultancy',
    'digital product studio',
    'brand consultancy',
    'growth consultancy',
  ],
});

/* ------------------------------------------------------------------
   Presentational split of home.manifesto.statement into masked reveal
   lines. The words remain verbatim from @/lib/content — the line
   breaks, accent and punch line are derived from the source string.
   ------------------------------------------------------------------ */
const ACCENT = 'were never real';
const statement = home.manifesto.statement;
const accentAt = statement.indexOf(ACCENT);
const hasAccent = accentAt >= 0;
const manifestoLead = hasAccent ? [statement.slice(0, accentAt).trim()] : [statement];
const manifestoAccent = hasAccent
  ? statement.slice(accentAt, statement.indexOf('.', accentAt) + 1)
  : '';
const manifestoPunch = hasAccent
  ? statement.slice(statement.indexOf('.', accentAt) + 1).trim()
  : '';

/** Renders copy with a blue terminal full stop — the Cato period. */
function Terminal({ text }: { text: string }) {
  if (!text.endsWith('.')) return <>{text}</>;
  return (
    <>
      {text.slice(0, -1)}
      <span className="text-accent">.</span>
    </>
  );
}

/* Hero line 2 keeps its blue terminal period through the char cascade —
   CSS paints the last split unit when the line ends with a full stop. */
const heroLine2 = home.hero.titleLines[1];
const heroAccentEnd = heroLine2.endsWith('.') ? 'home-accent-end' : '';

/**
 * Home — the flagship page.
 * Section ids are CONTRACT: hero, manifesto, practices, approach-teaser, cta.
 * Exactly one h1 (hero). Copy flows from @/lib/content only.
 */
export default function HomePage() {
  return (
    <>
      {/* 1 — hero: stage-left type, the GL monolith owns stage right */}
      <section
        data-scene-section="hero"
        className="home-hero container-x"
        aria-label="Introduction"
      >
        <div className="home-hero-inner">
          <Reveal delay={0.35}>
            <p className="micro-label">{home.hero.eyebrow}</p>
          </Reveal>
          <h1 className="display-1 home-hero-title">
            <Reveal split="chars" as="span" delay={0.55} stagger={0.02}>
              {home.hero.titleLines[0]}
            </Reveal>
            <Reveal
              split="chars"
              as="span"
              delay={0.75}
              stagger={0.02}
              className={heroAccentEnd}
            >
              {heroLine2}
            </Reveal>
          </h1>
          <Reveal delay={0.9} parallax={0.5}>
            <p className="lede home-hero-sub">{home.hero.sub}</p>
          </Reveal>
          <Reveal delay={1.05} parallax={0.85}>
            <div className="home-cta-row">
              <CtaButton
                href={home.hero.primaryCta.href}
                label={home.hero.primaryCta.label}
              />
              <CtaButton
                href={home.hero.secondaryCta.href}
                label={home.hero.secondaryCta.label}
                variant="ghost"
              />
            </div>
          </Reveal>
        </div>
        <Reveal className="home-scroll-cue" delay={1.4}>
          <span className="home-scroll-cue-label" aria-hidden="true">
            Scroll
          </span>
          <span className="home-scroll-cue-line" aria-hidden="true" />
        </Reveal>
      </section>

      {/* 2 — manifesto: a sticky dwell. The words are scrubbed by scroll and
          the wrecking ball lands in the GL layer on "So we removed them." */}
      <section
        data-scene-section="manifesto"
        className="home-manifesto"
        aria-label="Manifesto"
      >
        <ManifestoScrub
          eyebrow={home.manifesto.eyebrow}
          lead={manifestoLead.join(' ')}
          accent={manifestoAccent}
          punch={manifestoPunch}
          body={home.manifesto.body}
        />
      </section>

      {/* 2.5 — the approach ribbon: five moves as a drifting hairline */}
      <Marquee
        items={approachStages.map((s) => s.title)}
        className="home-marquee"
        speed={38}
      />

      {/* 3 — practices: the editorial index of the six disciplines */}
      <section
        data-scene-section="practices"
        className="container-x section-y"
        aria-label="The six practices"
      >
        <header className="home-practices-head">
          <Reveal delay={0.05}>
            <p className="micro-label">{home.practicesIntro.eyebrow}</p>
          </Reveal>
          <Reveal line as="h2" className="h2 home-practices-title" delay={0.15}>
            {home.practicesIntro.title}
          </Reveal>
          <Reveal delay={0.3}>
            <p className="body-lg home-practices-intro">{home.practicesIntro.body}</p>
          </Reveal>
        </header>
        <ol className="home-practice-list">
          {practices.map((p, i) => (
            <li key={p.id}>
              <Reveal delay={0.06 * i} magnetX={6}>
                <Link href={`/capabilities#${p.id}`} className="home-practice-row">
                  <span className="index-no">{p.index}</span>
                  <h3 className="h3 home-practice-title">{p.title}</h3>
                  <span className="home-practice-short">{p.short}</span>
                  <span className="home-practice-marker" aria-hidden="true" />
                </Link>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* 4 — approach teaser: five moves as an inline sequence */}
      <section
        data-scene-section="approach-teaser"
        className="container-x section-y-sm"
        aria-label="Approach"
      >
        <div className="home-approach">
          <Reveal delay={0.05}>
            <p className="micro-label">{home.approachTeaser.eyebrow}</p>
          </Reveal>
          <Reveal line as="h2" className="h2 home-approach-title" delay={0.15}>
            {home.approachTeaser.title}
          </Reveal>
          <Reveal delay={0.3}>
            <p className="body-lg home-approach-body">{home.approachTeaser.body}</p>
          </Reveal>
          <Reveal delay={0.42}>
            <ol className="home-stage-seq">
              {approachStages.map((s) => (
                <li key={s.id}>
                  <span className="index-no">{s.index}</span>
                  <span className="home-stage-name">{s.title}</span>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={0.55}>
            <CtaButton
              href={home.approachTeaser.cta.href}
              label={home.approachTeaser.cta.label}
              variant="ghost"
            />
          </Reveal>
        </div>
      </section>

      {/* 5 — closing cta: the monolith reassembles behind the invitation */}
      <section data-scene-section="cta" className="container-x" aria-label="Start a build">
        <div className="home-final">
          <Reveal delay={0.1}>
            <p className="micro-label">{home.cta.eyebrow}</p>
          </Reveal>
          <h2 className="display-2 home-final-title">
            <Reveal line as="span" delay={0.2}>
              {home.cta.titleLines[0]}
            </Reveal>
            <Reveal line as="span" delay={0.34}>
              <Terminal text={home.cta.titleLines[1]} />
            </Reveal>
          </h2>
          <Reveal delay={0.5}>
            <p className="lede home-final-body">{home.cta.body}</p>
          </Reveal>
          <Reveal delay={0.65}>
            <div className="home-cta-row">
              <CtaButton href={home.cta.cta.href} label={home.cta.cta.label} variant="blue" />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
