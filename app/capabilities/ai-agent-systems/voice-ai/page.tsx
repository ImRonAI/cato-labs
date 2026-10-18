import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import { agentChildren } from '@/lib/content/agentsChildren';
import SignatureDwell from '../SignatureDwell';
import './page.css';

const copy = agentChildren['voice-ai'];

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
  title: 'Voice AI — Agents that answer the phone.',
  description: copy.lede,
  path: '/capabilities/ai-agent-systems/voice-ai',
  keywords: [
    'voice AI agents',
    'AI call answering',
    'AI outbound calling',
    'voice agent consultancy',
  ],
});

export default function VoiceAiPage() {
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
      {/* FEATURE — the three jobs, editorial blocks. The h2 titles are
          ProximityType: the scene reports the 'voice-core' hotspot and the
          type glints when the waveform core passes beneath it. */}
      <section
        data-scene-section="feature"
        className="container-x section-y va-feature"
        aria-label={`${copy.crumbLabel} — what the agent does`}
      >
        <div className="va-feature__list">
          {copy.features.map((f, i) => (
            <Reveal key={f.index} className="va-feature__item" delay={i * 0.08}>
              <span className="index-no" aria-hidden="true">{f.index}</span>
              <h2 className="h3 va-feature__title">
                <ProximityType>{f.title}</ProximityType>
              </h2>
              <p className="va-feature__body">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* DETAIL — proof block: title rail + body/bullets rail */}
      <section
        data-scene-section="detail"
        className="container-x section-y va-detail"
        aria-label={copy.detail.title}
      >
        <div className="va-detail__grid">
          <div>
            <Reveal className="micro-label" delay={0}>{copy.detail.eyebrow}</Reveal>
            <Reveal as="h2" className="h2 va-detail__title" delay={0.08}>
              {copy.detail.title}
            </Reveal>
          </div>
          <div>
            <Reveal as="p" className="body-lg va-detail__body" delay={0.16}>
              {copy.detail.body}
            </Reveal>
            <Reveal delay={0.24}>
              <ul className="tag-list va-detail__bullets">
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
