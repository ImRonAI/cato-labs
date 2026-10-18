import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import { agentChildren } from '@/lib/content/agentsChildren';
import SignatureDwell from '../SignatureDwell';
import './page.css';

const copy = agentChildren['generative-ui'];

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Capabilities', path: '/capabilities' },
    { name: 'AI & Agent Systems', path: '/capabilities/ai-agent-systems' },
    { name: copy.crumbLabel, path: `/capabilities/ai-agent-systems/${copy.slug}` },
  ],
  service: {
    name: copy.crumbLabel,
    description: copy.lede,
    url: `/capabilities/ai-agent-systems/${copy.slug}`,
  },
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: 'Generative UI — Interfaces that assemble themselves.',
  description: copy.lede,
  path: '/capabilities/ai-agent-systems/generative-ui',
  keywords: [
    'generative UI',
    'AI-generated interfaces',
    'design system governance',
    'conversational interfaces',
  ],
});

export default function GenerativeUiPage() {
  return (
    <ChildPageShell
      crumbs={[
        { label: 'Capabilities', href: '/capabilities' },
        { label: 'AI & Agent Systems', href: '/capabilities/ai-agent-systems' },
        { label: copy.crumbLabel },
      ]}
      eyebrow={copy.eyebrow}
      titleLines={copy.titleLines}
      lede={copy.lede}
      faq={copy.faq}
      cta={copy.cta}
    >
      <JsonLd data={jsonLd} />
      <SignatureDwell
        label={copy.crumbLabel}
        steps={copy.features.map((f) => f.title)}
      />
      {/* FEATURE — the three capabilities, editorial blocks. Titles are
          ProximityType: the scene reports the 'genui-cluster' hotspot and
          the type glints as the morphing panes pass beneath it. */}
      <section
        data-scene-section="feature"
        className="container-x section-y gu-feature"
        aria-label={`${copy.crumbLabel} — what it composes`}
      >
        <div className="gu-feature__list">
          {copy.features.map((f, i) => (
            <Reveal key={f.index} className="gu-feature__item" delay={i * 0.08}>
              <span className="index-no" aria-hidden="true">{f.index}</span>
              <h2 className="h3 gu-feature__title">
                <ProximityType>{f.title}</ProximityType>
              </h2>
              <p className="gu-feature__body">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* DETAIL — the work: title rail + body/bullets rail */}
      <section
        data-scene-section="detail"
        className="container-x section-y gu-detail"
        aria-label={copy.detail.title}
      >
        <div className="gu-detail__grid">
          <div>
            <Reveal className="micro-label" delay={0}>{copy.detail.eyebrow}</Reveal>
            <Reveal as="h2" className="h2 gu-detail__title" delay={0.08}>
              {copy.detail.title}
            </Reveal>
          </div>
          <div>
            <Reveal as="p" className="body-lg gu-detail__body" delay={0.16}>
              {copy.detail.body}
            </Reveal>
            <Reveal delay={0.24}>
              <ul className="tag-list gu-detail__bullets">
                {copy.detail.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>
    </ChildPageShell>
  );
}
