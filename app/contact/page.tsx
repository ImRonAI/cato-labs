import { pageMetadata } from '@/lib/seo';
import { contactPage } from '@/lib/content';
import Reveal from '@/components/ui/Reveal';
import BriefForm from './BriefForm';
import './contact.css';

export const metadata = pageMetadata({
  title: 'Contact',
  description:
    'Start a build with Cato Labs — the AI-native strategy and implementation consultancy. Send a brief or write directly; a human always replies.',
  path: '/contact',
  keywords: [
    'contact Cato Labs',
    'start a build',
    'AI consultancy contact',
    'project brief',
    'consulting inquiry',
  ],
});

/**
 * Contact — the brief form and the direct line.
 * Section ids are CONTRACT: contact-hero, contact-form.
 * The hero is a dwell (sticky copy) while the WebGL glass sheet folds into
 * a paper plane beside it; the plane then glides down to the brief.
 */
export default function ContactPage() {
  const { hero, form, direct } = contactPage;

  return (
    <>
      {/* ------------------------------ hero ------------------------------ */}
      <section
        data-scene-section="contact-hero"
        className="contact-hero"
        aria-label="Contact"
      >
        <div className="contact-hero-sticky container-x">
          <Reveal>
            <span className="micro-label">{hero.eyebrow}</span>
          </Reveal>
          <h1 className="display-1 contact-hero-title">
            {hero.titleLines.map((line, i) => (
              <Reveal key={line} line as="span" delay={0.14 + i * 0.13}>
                {line}
              </Reveal>
            ))}
          </h1>
          <Reveal delay={0.4}>
            <p className="lede contact-hero-sub">{hero.sub}</p>
          </Reveal>
        </div>
      </section>

      {/* --------------------------- the brief ---------------------------- */}
      <section
        data-scene-section="contact-form"
        className="contact-form container-x section-y"
        aria-label="Send a brief"
      >
        <div className="contact-grid">
          <Reveal className="contact-panel glass-card">
            <h2 className="h3">{form.title}</h2>
            <BriefForm />
          </Reveal>

          <Reveal className="contact-panel glass-card contact-direct" delay={0.12}>
            <h3 className="h3">{direct.title}</h3>
            <a className="link-line contact-direct-mail" href={`mailto:${direct.email}`}>
              {direct.email}
            </a>
            <p className="body-lg contact-direct-note">{direct.note}</p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
