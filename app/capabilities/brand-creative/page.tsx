import { childPageJsonLd, pageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { capabilityChildren } from '@/lib/content/capabilities';
import ChildPageShell from '@/components/ui/ChildPageShell';
import Reveal from '@/components/ui/Reveal';
import ProximityType from '@/components/webgl/kit/ProximityType';
import SpectrumMachine from './SpectrumMachine';
import './page.css';

const copy = capabilityChildren['brand-creative'];

const jsonLd = childPageJsonLd({
  crumbs: [
    { name: 'Capabilities', path: '/capabilities' },
    { name: copy.crumbLabel, path: `/capabilities/${copy.slug}` },
  ],
  service: {
    name: copy.crumbLabel,
    description: copy.lede,
    url: `/capabilities/${copy.slug}`,
  },
  faq: copy.faq,
});

export const metadata = pageMetadata({
  title: 'Brand & Creative Systems',
  description: copy.lede,
  path: '/capabilities/brand-creative',
  keywords: [
    'brand identity systems',
    'brand strategy consultancy',
    'naming and narrative systems',
    'visual identity and art direction',
    'voice and tone guidelines',
  ],
});

/**
 * /capabilities/brand-creative — "Brand is infrastructure."
 * Section ids are CONTRACT: hero (shell), feature, machine, detail,
 * faq + cta (shell). The scene reads `machine` to open the prism's fan.
 */
export default function BrandCreativePage() {
  const { features, detail, faq, cta } = copy;

  return (
    <ChildPageShell
      crumbs={[
        { label: 'Capabilities', href: '/capabilities' },
        { label: copy.crumbLabel },
      ]}
      eyebrow={copy.eyebrow}
      titleLines={copy.titleLines}
      lede={copy.lede}
      faq={faq}
      cta={cta}
    >
      <JsonLd data={jsonLd} />
      {/* ---------- the practice ---------- */}
      <section
        data-scene-section="feature"
        className="bc-features container-x"
        aria-label="The practice"
      >
        <Reveal className="micro-label">The practice</Reveal>
        <div className="bc-features__grid">
          {features.map((f, i) => (
            <Reveal key={f.index} className="bc-feature" delay={0.08 + i * 0.08}>
              <span className="index-no">{f.index}</span>
              <h3 className="h3 bc-feature__title">{f.title}</h3>
              <p className="bc-feature__body">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- the spectrum machine ---------- */}
      <section
        data-scene-section="machine"
        className="bc-machine container-x section-y"
        aria-label="The Spectrum Machine — identity as a system of dials"
      >
        <Reveal className="micro-label">The Spectrum Machine</Reveal>
        <Reveal as="h2" className="h2 bc-machine__title" delay={0.08}>
          <ProximityType>Identity is a system of dials.</ProximityType>
        </Reveal>
        <Reveal className="lede bc-machine__lede" delay={0.16}>
          Turn them. Every Cato identity is a point in this space — archetype,
          voice and structure, set deliberately and held everywhere. The mark
          redraws itself; the sentence follows.
        </Reveal>
        <Reveal delay={0.24}>
          <SpectrumMachine />
        </Reveal>
      </section>

      {/* ---------- the work ---------- */}
      <section
        data-scene-section="detail"
        className="bc-detail container-x section-y-sm"
        aria-label={detail.title}
      >
        <div className="bc-detail__left">
          <Reveal className="micro-label">{detail.eyebrow}</Reveal>
          <Reveal as="h2" className="h2 bc-detail__title" delay={0.08}>
            {detail.title}
          </Reveal>
          <Reveal className="body-lg" delay={0.16}>
            {detail.body}
          </Reveal>
        </div>
        <Reveal className="bc-detail__right" delay={0.2}>
          <ul className="bc-detail__list">
            {detail.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Reveal>
      </section>
    </ChildPageShell>
  );
}
