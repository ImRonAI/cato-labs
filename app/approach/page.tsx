import { pageMetadata } from '@/lib/seo';
import { approachPage, approachStages } from '@/lib/content';
import Reveal from '@/components/ui/Reveal';
import { CtaButton } from '@/components/ui/Magnetic';
import './approach.css';

export const metadata = pageMetadata({
  title: 'Approach',
  description:
    'Five moves, in order, every time: evidence, market truth, decision, implementation and trade-off — how Cato Labs turns ambiguity into architecture.',
  path: '/approach',
  keywords: [
    'AI strategy methodology',
    'evidence-based strategy',
    'decision framework',
    'implementation planning',
    'strategic trade-offs',
  ],
});

/**
 * Approach — the five Cato moves.
 * Section ids are CONTRACT: app-hero, evidence, truth, decision,
 * implementation, tradeoff, app-outro. The WebGL marble run reads them:
 * each move's section scrubs the marble down its own glass ramp, so the
 * copy column stays left and the run owns the right half of the frame.
 */
export default function ApproachPage() {
  const { hero, outro } = approachPage;

  return (
    <>
      {/* ------------------------------ hero ------------------------------ */}
      <section
        data-scene-section="app-hero"
        className="app-hero container-x"
        aria-label="Approach"
      >
        <Reveal>
          <span className="micro-label">{hero.eyebrow}</span>
        </Reveal>
        <h1 className="display-1 app-hero-title">
          {hero.titleLines.map((line, i) => (
            <Reveal key={line} line as="span" delay={0.15 + i * 0.13}>
              {line}
            </Reveal>
          ))}
        </h1>
        <Reveal delay={0.45}>
          <p className="lede app-hero-sub">{hero.sub}</p>
        </Reveal>
      </section>

      {/* -------------------------- the five moves ------------------------- */}
      {approachStages.map((stage, i) => (
        <section
          key={stage.id}
          id={stage.id}
          data-scene-section={stage.id}
          aria-label={`Move ${stage.index} — ${stage.title}`}
          className="app-stage container-x"
        >
          <div className="app-stage-sticky">
            <div className="app-stage-inner">
              <Reveal>
                <span className="micro-label">Move {stage.index}</span>
              </Reveal>
              <Reveal as="h2" className="h2 app-stage-title" delay={0.08}>
                {stage.title}
              </Reveal>
              <Reveal as="p" className="app-stage-question text-accent" delay={0.16}>
                {stage.question}
              </Reveal>
              <Reveal as="p" className="lede app-stage-narrative" delay={0.26}>
                {stage.narrative}
              </Reveal>
            </div>
            <span className="app-stage-index" aria-hidden="true">
              {stage.index}
            </span>
          </div>
          {i < approachStages.length - 1 && (
            <hr className="rule app-stage-rule" aria-hidden="true" />
          )}
        </section>
      ))}

      {/* ------------------------------ outro ------------------------------ */}
      <section
        data-scene-section="app-outro"
        className="app-outro container-x section-y"
        aria-label="Next"
      >
        <Reveal>
          <span className="micro-label">{outro.eyebrow}</span>
        </Reveal>
        <Reveal as="h2" className="display-2 app-outro-title" delay={0.1}>
          {outro.title}
        </Reveal>
        <Reveal as="p" className="lede app-outro-body" delay={0.2}>
          {outro.body}
        </Reveal>
        <Reveal className="app-outro-cta" delay={0.32}>
          <CtaButton href={outro.cta.href} label={outro.cta.label} variant="ghost" />
        </Reveal>
      </section>
    </>
  );
}
